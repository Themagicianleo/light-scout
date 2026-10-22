# Light Scout

A photographer's light planner in a single web page: blue and golden hour times, sunrise/sunset direction, a sky chart of the sun's path, an hourly cloud-layer forecast with a rough "sky color" read, moon phase, and tonight's darkest window.

- Sun and moon math runs on the device (no network needed).
- Forecast and air quality (US AQI, PM2.5, PM10, aerosol haze; 5 days): [Open-Meteo](https://open-meteo.com) (free, no API key). Place search: Open-Meteo geocoding. "Locate" names your spot via BigDataCloud's free reverse geocoder.
- Saved places, units and clock format are stored in the browser.

## Files

- `src/app.html` is the source. It is also the page published as the claude.ai artifact preview (where location and weather are blocked).
- `build.sh` wraps it into `index.html`, the standalone page GitHub Pages serves. Run it after editing `src/app.html` and commit both.

## Hosting

GitHub Pages serves `index.html` from the `main` branch root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`), along with `manifest.webmanifest`, `sw.js` and `icons/`, which make it installable.
Install on a phone: open the Pages link, then tap **Install** in the top bar (Android/Chrome), or Share → **Add to Home Screen** (iPhone/Safari). It opens full-screen, works offline, and keeps the last forecast for when you have no signal.
