// airports.js
// Airports and runways from data/airports.json (built from OurAirports by scripts/build_airports.py).

let doc = null;
let loading = null;

export function loadAirports() {
  loading ??= fetch('data/airports.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d) => (doc = d))
    .catch((err) => {
      loading = null; // allow a retry
      throw err;
    });
  return loading;
}

// For tests: use a ready-made document instead of fetching the file.
export function setAirportsDoc(d) {
  doc = d;
}

export const airportsMeta = () => (doc ? { source: doc.source, sourceUrl: doc.sourceUrl, builtAt: doc.builtAt } : null);

// Turn one compact row into a readable object. Field order is listed in the file itself.
function toAirport(row) {
  const [ident, icao, iata, name, city, country, lat, lon, elevationFt, runways] = row;
  return { ident, icao, iata, name, city, country, lat, lon, elevationFt, runways: runways.map(toRunway) };
}

function toRunway(r) {
  const [leIdent, leLat, leLon, leHeadingT, leDisplacedFt, heIdent, heLat, heLon, heHeadingT, heDisplacedFt,
    lengthFt, widthFt, surface, computedBearing] = r;
  // Headings from the data are used for labels and wind; the geometry always uses the end coordinates.
  // If the two disagree by more than 5°, the page says so (the database may have an error).
  const mismatch = leHeadingT != null && Math.abs(((leHeadingT - computedBearing + 540) % 360) - 180) > 5;
  return {
    name: `${leIdent}/${heIdent}`,
    leIdent, leLat, leLon, leHeadingT, leDisplacedFt,
    heIdent, heLat, heLon, heHeadingT, heDisplacedFt,
    lengthFt, widthFt, surface, computedBearing,
    headingMismatch: mismatch,
    // Direction of travel for each end: the data's heading if it has one, otherwise from the coordinates.
    leTravelDeg: leHeadingT ?? computedBearing,
    heTravelDeg: heHeadingT ?? (computedBearing + 180) % 360,
    headingFromCoords: leHeadingT == null,
  };
}

export function findAirport(code) {
  if (!doc || !code) return null;
  const c = code.trim().toUpperCase();
  const row = doc.airports.find((a) => a[0] === c || a[1] === c) ?? doc.airports.find((a) => a[2] === c);
  return row ? toAirport(row) : null;
}

// Search by ICAO, IATA, name or city. Exact code matches come first.
export function searchAirports(query, limit = 8) {
  if (!doc) return [];
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];
  const scored = [];
  for (const row of doc.airports) {
    const [ident, icao, iata, name, city] = row;
    let score = 0;
    if (ident === q || icao === q || iata === q) score = 3;
    else if (ident.startsWith(q) || (iata && iata.startsWith(q))) score = 2;
    else if (name.toUpperCase().includes(q) || (city && city.toUpperCase().includes(q))) score = 1;
    if (score) scored.push([score, row]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1][3].localeCompare(b[1][3]));
  return scored.slice(0, limit).map(([, row]) => toAirport(row));
}
