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

// Observed conditions from the raw report (standard METAR groups), up to the first trend/remarks
// group, so TEMPO/BECMG forecasts aren't mistaken for "now":
//   visibility: 4 digits in metres (9999 = 10 km or more), CAVOK, or statute miles like 6SM
//   cloud: FEW/SCT/BKN/OVC + height in hundreds of feet (+ CB/TCU); VV = sky hidden (fog)
//   weather: e.g. -RA (light rain), TSRA (thunderstorm with rain), HZ (haze), BR (mist), FG (fog)
const WX = /^(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*)$/;
export function parseConditions(raw) {
  const out = { visibilityM: null, cavok: false, clouds: [], weather: [] };
  for (const tok of String(raw ?? '').split(/\s+/).slice(2)) { // skip "METAR" and the station
    if (/^(TEMPO|BECMG|NOSIG|RMK)$/.test(tok)) break;
    let m;
    if (tok === 'CAVOK') { out.cavok = true; out.visibilityM = 10000; }
    else if (/^\d{4}$/.test(tok) && out.visibilityM === null) out.visibilityM = Number(tok) === 9999 ? 10000 : Number(tok);
    else if ((m = /^(\d+)SM$/.exec(tok)) && out.visibilityM === null) out.visibilityM = Number(m[1]) * 1609;
    else if ((m = /^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/.exec(tok))) out.clouds.push({ cover: m[1], baseFt: Number(m[2]) * 100, type: m[3] ?? null });
    else if (tok.length >= 2 && (m = WX.exec(tok)) && (m[2] || m[3])) out.weather.push(tok);
  }
  return out;
}
