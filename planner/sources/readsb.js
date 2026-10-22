// readsb.js
// Both adsb.lol and airplanes.live answer in readsb's "jv2" format: { ac: [...], now, ... }.
// Only fields seen in a real adsb.lol response (22 Oct 2026, near Changi) are read:
//   hex, flight (callsign, padded with spaces), r (registration), t (type code),
//   alt_baro (feet, or the string "ground"), gs (ground speed, kt), track / true_heading (degrees),
//   baro_rate / geom_rate (ft/min), lat, lon, seen (seconds since last message)
// Anything missing becomes null; nothing is guessed.

import { SourceError } from './relay.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function normalize(ac) {
  return {
    hex: typeof ac.hex === 'string' ? ac.hex : null,
    callsign: typeof ac.flight === 'string' ? ac.flight.trim() || null : null,
    registration: typeof ac.r === 'string' ? ac.r : null,
    type: typeof ac.t === 'string' ? ac.t : null,
    onGround: ac.alt_baro === 'ground',
    altFt: num(ac.alt_baro),
    gsKt: num(ac.gs),
    trackDeg: num(ac.track) ?? num(ac.true_heading),
    vrFpm: num(ac.baro_rate) ?? num(ac.geom_rate),
    lat: num(ac.lat),
    lon: num(ac.lon),
    seenS: num(ac.seen),
  };
}

export function parseReadsb(data) {
  if (!data || !Array.isArray(data.ac)) throw new SourceError('format', 'unexpected traffic format (no "ac" list)');
  return data.ac.map(normalize).filter((a) => a.hex && a.lat !== null && a.lon !== null);
}
