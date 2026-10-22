# Light Scout

A photographer's light planner in a single web page: blue and golden hour times, sunrise/sunset direction, a sky chart of the sun's path, an hourly cloud-layer forecast with a rough "sky color" read, moon phase, and tonight's darkest window.

- **New: Plane spotting tab**: the Spotter's Light Planner (see below).
- Sun and moon math runs on the device (no network needed).
- Forecast and air quality (US AQI, PM2.5, PM10, aerosol haze; 5 days): [Open-Meteo](https://open-meteo.com) (free, no API key). Place search: Open-Meteo geocoding. "Locate" names your spot via BigDataCloud's free reverse geocoder.
- English and Simplified Chinese (EN / 中文 switch in the top bar; defaults to Chinese on Chinese-language devices).
- Saved places, units, clock format and language are stored in the browser.

## Spotter's Light Planner (the "Plane spotting" tab)

Helps you choose **when** to photograph aircraft from a spot **you** chose, at any of ~2,900 airports
(default: Singapore Changi, WSSS). For your position it shows, hour by hour, how well the side of a passing
aircraft that faces you will be lit, which runway end is likely in use from the latest wind report, the cloud
forecast, and aircraft arriving or departing right now.

> **Spot responsibly.** The planner never suggests places to stand: it only uses positions you add. Check local
> rules, airport security restrictions and private property boundaries, and never enter restricted areas. The
> same reminder is on the page.

**Calculated vs estimated.** Things marked **Calculated** are maths on exact inputs: the sun's position, your
distance and direction to the runway, headwind and crosswind. Things marked **Estimate** are judgements: the light
score, the runway likely in use, which aircraft are arriving or departing, and their time to the runway.

### How to use it
1. Open the **Plane spotting** tab. Changi is preselected; search for another airport by ICAO, IATA, name or city.
2. Add your position: tap **Add by tapping the map**, use **My location**, type **Coordinates**, or pick one of
   Light Scout's **saved places**. Drag the marker to fine-tune it. Pick a runway (the nearest one is used by default).
3. Read the cards: *Your position and the runway* (calculated), *Light on aircraft, by hour* (estimate, up to 7 days
   ahead, with a table of every number behind it), *Wind and runway in use*, and *Live traffic*.

### The maths, step by step
1. **Sun position** comes from Light Scout's existing `sunPos()` (azimuth = compass direction, altitude = height).
2. **Runway geometry.** Around the airport the Earth is treated as flat (under 0.1% error within 20 km): latitude
   and longitude become metres east (x) and north (y). The runway runs from end A to end B; `u` is the unit
   vector A→B. For your position P:
   ```
                      B (20R)          t = (P − A) · u     how far along the runway you are
                     /                 c = u × (P − A)     how far to the side (+ = left of planes flying A→B)
                    /                  Q = A + t·u         the closest point of the centre line
                   Q ─ ─ ─ ─ P 📷      |c| = your distance to the centre line
                  /                    bearing P→Q = the direction you face to see the runway
                 A (02L)
   ```
   If `t` is before A or after B you're **beyond the runway end**, under the approach or departure path.
3. **Light score.** A plane is front-lit when the sun is roughly behind you. With `b` = direction from the plane (at Q)
   to you and `S` = the sun's azimuth, the angle `δ = |S − b|` (0° = sun exactly behind you):
   ```
   ☀ ·········> 📷 P ─────────> ✈ Q        δ ≈ 0°   front-lit (good)
   📷 P <───────── ✈ Q <········· ☀        δ ≈ 180° backlit (silhouette)
   ```
   score = 100 × angle factor × altitude factor × cloud factor, with every threshold in `planner/config.js`:
   angle ≤ 60° → 1, fading to 0.4 at 90°, backlit → 0.1; sun 5–40° high → 1 (below 0° → 0, 0–5° → 0.5,
   40–60° → 0.6, above 60° → 0.35); clouds → `1 − 0.8 × max(low, mid, ½·high) / 100` from the Open-Meteo forecast.
   Good ≥ 70, fair ≥ 40. Beside the runway the light is the same for both directions; what changes is which side of
   the aircraft you see (and which way it moves). Beyond a runway end it's nose or tail instead.
4. **Runway in use (estimate).** METAR wind direction W (where the wind blows from, degrees true, like the runway
   headings) and speed V: `headwind = V·cos(W − H)`, `crosswind = V·sin(W − H)` (positive = from the right) for each
   runway end with heading H. The end with the most headwind is likely; below 3 kt it's "calm", and if the best end
   gets under 2 kt of headwind it's "too close to call". With no METAR it says "wind unavailable".
5. **Live traffic (estimate).** Aircraft within 25 nm, below 10,000 ft, with a track within 30° of a runway direction
   and within 2 nm of its extended centre line: before the threshold and not climbing = arriving; past it and not
   descending = departing. Time to the threshold ≈ distance ÷ ground speed.

### How to run and test it
- Online: open the GitHub Pages site and tap **Plane spotting**. To install on an iPhone: Safari → Share → **Add to
  Home Screen**. The planner works offline from the home-screen app (airports, your positions, the light chart with the
  last forecast, the last METAR); live traffic and map tiles need a connection.
- Locally: `python3 -m http.server` in this folder, then open http://localhost:8000. METAR and traffic only work on the
  GitHub Pages address, because the relay only answers that site.
- After editing `src/app.html`: run `./build.sh`. Tests: `npm test` (maths, Node only) and `npm run test:e2e`
  (headless Chromium via Playwright, all network answers replaced by fixed data, including real METAR samples).
- Refresh airport data: `python3 scripts/build_airports.py` (also runs monthly in GitHub Actions).

### Data sources, terms and attribution (checked 22 Oct 2026)
| Source | Used for | Key? | Limits | Terms | How it's reached |
|---|---|---|---|---|---|
| [OurAirports](https://ourairports.com/data/) `airports.csv`, `runways.csv` | Airports, runway end coordinates, headings (true), lengths | No | Static file | Public domain, no guarantee of accuracy; credit requested | Built into `data/airports.json` |
| [NOAA Aviation Weather Center](https://aviationweather.gov/data/api/) METAR | Wind for the runway estimate | No | 100 requests/min; custom User-Agent requested | US public domain ([NWS disclaimer](https://www.weather.gov/disclaimer)); not for flight planning | Via the relay: the API doesn't allow browser requests from other sites (CORS) |
| [Open-Meteo](https://open-meteo.com) | Cloud forecast (Light Scout's existing forecast code) | No | Generous | Free for non-commercial use, credit required | Direct |
| [adsb.lol](https://adsb.lol) `/v2/point` | Live traffic | No (a key "will be required in the future") | Real headers: 4/s, 60/min, **500/day**; the planner polls every 20 s and pauses after 10 min | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), credit required; the open API is marked deprecated | Via the relay (no CORS header) |
| [airplanes.live](https://airplanes.live) | Alternative traffic provider (off by default) | ? | ? | **Not verified** (its terms page blocks automated readers) | Via the relay |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) tiles | Map background | No | [Tile usage policy](https://operations.osmfoundation.org/policies/tiles/) | ODbL, credit on the map | Direct; never stored offline |
| OpenSky Network | Not used | Needs an OAuth2 client **secret** | 400 credits/day anonymous | — | Blocked for other sites (CORS) and a secret can't be hidden in a static page |

**The relay** is the Cloudflare worker from the SkyWatch project (`spotters-relay.maotianze.workers.dev`). It only
forwards to a fixed list of hosts and only answers `themagicianleo.github.io`. No API keys are used anywhere; `.env`
is in `.gitignore` in case one is ever needed. **Dependency:** Leaflet 1.9.4 (BSD-2-Clause, in `vendor/leaflet/`) for
the map; drawing a zoomable street map by hand isn't realistic. Everything else is plain JavaScript.

### Limitations
- **Runway in use is a guess from the wind.** Air traffic control decides; noise rules, traffic and runway works
  override wind, and Changi in light winds can use either direction. The METAR may be up to an hour old.
- **The light score is a rough model** (tunable in `planner/config.js`). It doesn't know about haze, buildings, trees,
  fences, heat shimmer, or the aircraft's height as it passes; "cloud blocks the sun" is judged from a forecast.
- **OurAirports is crowd-maintained.** Runway "ends" are the physical ends; displaced thresholds are only listed. For 260
  runways worldwide the heading field and the end coordinates disagree by over 5°; the planner warns and uses the
  coordinates. Changi was checked: headings 23°/203° true match the coordinates (22.7–22.8°).
- **Live traffic depends on volunteer receivers** (gaps happen) and on adsb.lol's deprecated open API, which may close
  or require a key. Its 500-requests-a-day cap is shared through the relay with SkyWatch's recorder. Arrival/departure
  matching and times are estimates; aircraft can go around, hold or change runway.
- **No times without a forecast:** the airport's time zone comes from Open-Meteo; until it arrives, times use your
  device's time zone (the page says so).
- **airplanes.live terms were not verified**, so it's off by default.
- **Offline:** map tiles and live traffic need a connection; the claude.ai preview of `src/app.html` has no planner tab
  (it can't load the extra files).

### How AI was used
This feature was built with an AI coding assistant (Claude, by Anthropic) at my direction. I set the goal, the rules
(open data only, no invented data, no suggested spots, label estimates) and the phases. The assistant read the providers'
documentation and terms (some through GitHub Actions, because its sandbox couldn't reach the sites), tested every API
from a real browser on this site, wrote the code, comments and tests, and drafted this README. The maths and every data
source are explained above so they can be checked.

## Files

- `src/app.html` is the source. It is also the page published as the claude.ai artifact preview (where location and weather are blocked).
- `build.sh` wraps it into `index.html`, the standalone page GitHub Pages serves, and adds the planner (`planner/`, `vendor/leaflet/`). Run it after editing `src/app.html` and commit both.
- `planner/`: the Spotter's Light Planner. `config.js` (every tunable number), `geo.js`, `light.js`, `wind.js`, `traffic.js`, `plan.js` (pure maths, tested in `tests/`), `airports.js`, `positions.js`, `map.js`, `ui.js`, `windCard.js`, `trafficCard.js`, `lightChart.js`, `i18n.js` (EN / 中文), and `sources/` (one file per data provider, so switching is one line in `config.js`).
- `data/airports.json`: built from OurAirports by `scripts/build_airports.py`.
- The planner reuses Light Scout's own sun maths, time zones, storage, saved places and Open-Meteo forecast through `window.LightScout` (defined at the end of `src/app.html`); nothing is copied.

## Hosting

GitHub Pages serves `index.html` from the `main` branch root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`), along with `manifest.webmanifest`, `sw.js` and `icons/`, which make it installable.
Install on a phone: open the Pages link, then tap **Install** in the top bar (Android/Chrome), or Share → **Add to Home Screen** (iPhone/Safari). It opens full-screen, works offline, and keeps the last forecast for when you have no signal.
