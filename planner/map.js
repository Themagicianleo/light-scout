// map.js
// The Leaflet map: runways drawn from OurAirports, your positions (draggable), a dashed line from the
// selected position to the runway centre line, and an arrow showing the sun's direction.
// Leaflet (vendor/leaflet, BSD-2-Clause) is the planner's only dependency: drawing a zoomable street
// map by hand isn't realistic. Tiles are OpenStreetMap's (credited on the map; needs a connection).

export function createMap(el, { onTap, onMove, onSelect }) {
  const L = window.L;
  const map = L.map(el, { zoomControl: true }).setView([1.35, 103.99], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);
  const runwayLayer = L.layerGroup().addTo(map);
  const posLayer = L.layerGroup().addTo(map);
  const lineLayer = L.layerGroup().addTo(map);
  let tapMode = false;

  map.on('click', (e) => {
    if (!tapMode) return;
    tapMode = false;
    el.classList.remove('pl-tapping');
    onTap(e.latlng.lat, e.latlng.lng);
  });

  // Runway-end labels. The text goes in with textContent, so it can never be read as HTML.
  const label = (text, cls) => L.divIcon({ className: 'pl-maplabel ' + (cls || ''), html: Object.assign(document.createElement('span'), { textContent: text }), iconSize: null });

  return {
    showAirport(airport, selectedName) {
      runwayLayer.clearLayers();
      const bounds = [];
      for (const r of airport.runways) {
        const sel = r.name === selectedName;
        const line = L.polyline([[r.leLat, r.leLon], [r.heLat, r.heLon]], { color: sel ? '#ff9500' : '#8e8e93', weight: sel ? 7 : 5, opacity: 0.9 }).addTo(runwayLayer);
        line.bindTooltip(r.name);
        for (const [lat, lon, id] of [[r.leLat, r.leLon, r.leIdent], [r.heLat, r.heLon, r.heIdent]]) {
          L.marker([lat, lon], { icon: label(id, sel ? 'is-sel' : ''), interactive: false }).addTo(runwayLayer);
          bounds.push([lat, lon]);
        }
      }
      if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    },
    showPositions(list, selectedId) {
      posLayer.clearLayers();
      for (const p of list) {
        const sel = p.id === selectedId;
        const icon = L.divIcon({ className: 'pl-pos' + (sel ? ' is-sel' : ''), html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] });
        const m = L.marker([p.lat, p.lon], { icon, draggable: true, title: p.name }).addTo(posLayer);
        m.on('click', () => onSelect(p.id));
        m.on('dragend', () => { const ll = m.getLatLng(); onMove(p.id, ll.lat, ll.lng); });
      }
    },
    // Dashed line from your position to the closest point of the centre line; gold arrow towards the sun.
    showSightline(pos, Q, sunAz) {
      lineLayer.clearLayers();
      if (!pos) return;
      if (Q) L.polyline([[pos.lat, pos.lon], [Q.lat, Q.lon]], { color: '#007aff', weight: 2, dashArray: '5 6' }).addTo(lineLayer);
      if (sunAz != null) {
        const d = 0.004; // about 450 m on the map
        const rad = sunAz * Math.PI / 180, k = Math.cos(pos.lat * Math.PI / 180);
        const end = [pos.lat + d * Math.cos(rad), pos.lon + d * Math.sin(rad) / k];
        L.polyline([[pos.lat, pos.lon], end], { color: '#ff9500', weight: 3 }).addTo(lineLayer).bindTooltip('☀');
      }
    },
    setTapMode(on) {
      tapMode = on;
      el.classList.toggle('pl-tapping', on);
    },
    focus(pos) {
      map.panTo([pos.lat, pos.lon]);
    },
    resize: () => map.invalidateSize(),
  };
}
