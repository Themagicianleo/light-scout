# Light Scout

A photographer's light planner in a single web page: blue and golden hour times, sunrise/sunset direction, a sky chart of the sun's path, an hourly cloud-layer forecast with a rough "sky color" read, moon phase, and tonight's darkest window.

- Sun and moon math runs on the device (no network needed).
- Forecast: [Open-Meteo](https://open-meteo.com) (free, no API key). Place search: Open-Meteo geocoding. "Locate" names your spot via BigDataCloud's free reverse geocoder.
- Saved places, units and clock format are stored in the browser.

## Files

- `src/app.html` is the source. It is also the page published as the claude.ai artifact preview (where location and weather are blocked).
- `build.sh` wraps it into `index.html`, the standalone page GitHub Pages serves. Run it after editing `src/app.html` and commit both.

## Hosting

GitHub Pages serves `index.html` from the `main` branch root (Settings → Pages → Deploy from a branch → `main` / `/ (root)`).
On your phone, open the Pages link, allow location, then Share → **Add to Home Screen** to open it like an app. Location requires https, which Pages provides.
