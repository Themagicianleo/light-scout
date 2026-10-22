// metar-awc.js
// Latest METAR from NOAA's Aviation Weather Center data API (via the relay).
//   GET https://aviationweather.gov/api/data/metar?ids=WSSS&format=json
// Terms (aviationweather.gov/data/api, read 22 Oct 2026): no key; max 100 requests/minute; set a custom
// User-Agent (the relay does); CORS is not permitted (hence the relay). NWS data is public domain.
// Fields used, all seen in a real response on 22 Oct 2026:
//   icaoId, name, obsTime (unix s), wdir (degrees TRUE, or "VRB"), wspd (kt), rawOb
// Gusts are read from rawOb ("22015G28KT"); a "wgst" field wasn't in the real responses we saw.

import { viaRelay, SourceError } from './relay.js';

export const name = 'NOAA Aviation Weather Center';

export function parseAwc(data) {
  if (!Array.isArray(data)) throw new SourceError('format', 'unexpected METAR format');
  const m = data[0];
  if (!m || typeof m.rawOb !== 'string') return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const gust = /\b(?:\d{3}|VRB)\d{2,3}G(\d{2,3})KT\b/.exec(m.rawOb);
  return {
    station: typeof m.icaoId === 'string' ? m.icaoId : null,
    name: typeof m.name === 'string' ? m.name : null,
    observedMs: num(m.obsTime) === null ? null : m.obsTime * 1000,
    dirDeg: num(m.wdir), // null when "VRB" (variable) or missing
    variable: m.wdir === 'VRB',
    speedKt: num(m.wspd),
    gustKt: gust ? Number(gust[1]) : null,
    raw: m.rawOb,
  };
}

// Returns a METAR object, or null when the station has no recent report (HTTP 204).
export async function latestMetar(icao) {
  const r = await viaRelay(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`);
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text.trim()) return null;
  let data;
  try { data = JSON.parse(text); } catch { throw new SourceError('format', 'METAR answer was not JSON'); }
  return parseAwc(data);
}
