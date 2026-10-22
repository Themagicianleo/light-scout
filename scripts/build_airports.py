#!/usr/bin/env python3
"""Build data/airports.json for the Spotter's Light Planner from OurAirports.

OurAirports (https://ourairports.com/data/) releases its data to the public domain, with no
guarantee of accuracy. The files come from its daily GitHub export:
  https://davidmegginson.github.io/ourairports-data/airports.csv
  https://davidmegginson.github.io/ourairports-data/runways.csv
Columns are read BY NAME from the header (checked on 22 Oct 2026); if one is missing we stop.

Kept: large airports, plus medium airports with scheduled service, that have at least one open
runway with coordinates for both ends. Headings are degrees TRUE (OurAirports' le_heading_degT).

Usage:  python3 scripts/build_airports.py            (downloads the CSVs)
        python3 scripts/build_airports.py DIR        (uses airports.csv and runways.csv in DIR)
"""
import csv
import io
import json
import math
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://davidmegginson.github.io/ourairports-data/"
OUT = Path(__file__).resolve().parent.parent / "data" / "airports.json"
AIRPORT_COLS = ["ident", "type", "name", "latitude_deg", "longitude_deg", "elevation_ft", "iso_country",
                "municipality", "scheduled_service", "icao_code", "iata_code"]
RUNWAY_COLS = ["airport_ident", "length_ft", "width_ft", "surface", "closed",
               "le_ident", "le_latitude_deg", "le_longitude_deg", "le_heading_degT", "le_displaced_threshold_ft",
               "he_ident", "he_latitude_deg", "he_longitude_deg", "he_heading_degT", "he_displaced_threshold_ft"]


def read_csv(name, folder):
    if folder:
        text = (Path(folder) / name).read_text(encoding="utf-8")
    else:
        print(f"Downloading {BASE + name}")
        req = urllib.request.Request(BASE + name, headers={"User-Agent": "LightScout-build/1.0 (+https://github.com/Themagicianleo/light-scout)"})
        text = urllib.request.urlopen(req, timeout=300).read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    return reader


def need(reader, cols, name):
    missing = [c for c in cols if c not in (reader.fieldnames or [])]
    if missing:
        sys.exit(f"{name} is missing columns {missing}; not guessing. Header: {reader.fieldnames}")


def num(value):
    """'23' -> 23.0, '' -> None."""
    try:
        return float(value) if value not in ("", None) else None
    except ValueError:
        return None


def bearing(lat1, lon1, lat2, lon2):
    """Initial great-circle bearing in degrees true, used only to check the heading fields."""
    p1, p2, dl = math.radians(lat1), math.radians(lat2), math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else None
    airports_r = read_csv("airports.csv", folder)
    need(airports_r, AIRPORT_COLS, "airports.csv")
    airports = {r["ident"]: r for r in airports_r}
    runways_r = read_csv("runways.csv", folder)
    need(runways_r, RUNWAY_COLS, "runways.csv")

    runways = {}
    headings_checked = headings_far_off = 0
    for r in runways_r:
        if r["closed"] == "1":
            continue
        le = (num(r["le_latitude_deg"]), num(r["le_longitude_deg"]))
        he = (num(r["he_latitude_deg"]), num(r["he_longitude_deg"]))
        if None in le or None in he or le == he:
            continue  # without both ends we can't draw the runway or work out its direction
        computed = bearing(*le, *he)
        le_hdg = num(r["le_heading_degT"])
        he_hdg = num(r["he_heading_degT"])
        if le_hdg is not None:
            headings_checked += 1
            if abs((le_hdg - computed + 540) % 360 - 180) > 5:
                headings_far_off += 1
        runways.setdefault(r["airport_ident"], []).append([
            r["le_ident"], round(le[0], 6), round(le[1], 6), le_hdg, num(r["le_displaced_threshold_ft"]),
            r["he_ident"], round(he[0], 6), round(he[1], 6), he_hdg, num(r["he_displaced_threshold_ft"]),
            num(r["length_ft"]), num(r["width_ft"]), r["surface"] or None,
            round(computed, 1),
        ])

    out = []
    for ident, a in airports.items():
        if ident not in runways:
            continue
        if not (a["type"] == "large_airport" or (a["type"] == "medium_airport" and a["scheduled_service"] == "yes")):
            continue
        out.append([ident, a["icao_code"] or None, a["iata_code"] or None, a["name"], a["municipality"] or None,
                    a["iso_country"] or None, round(float(a["latitude_deg"]), 6), round(float(a["longitude_deg"]), 6),
                    num(a["elevation_ft"]), runways[ident]])
    out.sort(key=lambda x: x[0])

    payload = {
        "source": "OurAirports (ourairports.com), public domain, no guarantee of accuracy",
        "sourceUrl": "https://ourairports.com/data/",
        "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "airportFields": ["ident", "icao", "iata", "name", "city", "country", "lat", "lon", "elevationFt", "runways"],
        "runwayFields": ["leIdent", "leLat", "leLon", "leHeadingT", "leDisplacedFt",
                         "heIdent", "heLat", "heLon", "heHeadingT", "heDisplacedFt",
                         "lengthFt", "widthFt", "surface", "computedBearingLeToHe"],
        "note": "Runway end coordinates are the physical ends from OurAirports; displaced thresholds are listed separately. Headings are degrees true.",
        "airports": out,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(out)} airports, {sum(len(a[9]) for a in out)} runways -> {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"Heading check: {headings_far_off} of {headings_checked} runway headings differ from their end coordinates by more than 5 degrees")


if __name__ == "__main__":
    main()
