// Light Scout service worker: keeps the app (and the Spotter's Light Planner) available offline.
// Forecast, METAR and traffic requests go straight to the network; the page keeps its own saved
// copies of the last forecast and METAR. Map tiles are never stored (OpenStreetMap's tile policy).
const CACHE = "light-scout-v4";
const PLANNER = [
  "./planner/main.js", "./planner/ui.js", "./planner/config.js", "./planner/i18n.js", "./planner/geo.js", "./planner/light.js",
  "./planner/wind.js", "./planner/plan.js", "./planner/airports.js", "./planner/positions.js", "./planner/map.js",
  "./planner/lightChart.js", "./planner/windCard.js", "./planner/conditionsCard.js", "./planner/advice.js", "./planner/trafficCard.js", "./planner/traffic.js", "./planner/planner.css",
  "./planner/sources/relay.js", "./planner/sources/metar-awc.js", "./planner/sources/readsb.js",
  "./planner/sources/traffic-adsblol.js", "./planner/sources/traffic-airplaneslive.js",
  "./data/airports.json", "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css"
];
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", ...PLANNER];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first, cached copy when offline. Used for the page itself and for the planner's code and
// data, so an update never mixes new and old planner files.
function networkFirst(req, key) {
  return fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key || req, copy)); }
    return r;
  }).catch(() => caches.match(key || req, { ignoreSearch: true }));
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  const sameOrigin = url.origin === location.origin;
  const isFont = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // The page: network first so updates arrive right away, cached copy when offline.
  if (req.mode === "navigate") { e.respondWith(networkFirst(req, "./index.html")); return; }
  if (sameOrigin && /\/(planner|data)\//.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  // Icons, manifest, Leaflet, fonts: serve from cache, refresh in the background.
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
