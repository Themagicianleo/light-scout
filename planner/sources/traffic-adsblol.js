// traffic-adsblol.js
// Aircraft near a point from adsb.lol (via the relay).
//   GET https://api.adsb.lol/v2/point/{lat}/{lon}/{radius_nm}
// Terms (API docs, read 22 Oct 2026): free to use, no key yet ("in the future you will require an API
// key"); the open API is marked DEPRECATED in favour of a feeders-only API. Data licence: ODbL 1.0,
// credit required. Real response headers: x-ratelimit-limit "4, 4;w=1, 60;w=60, 500;w=86400"
// (4 per second, 60 per minute, 500 per day). The planner polls every 20 s, only while you watch.

import { viaRelay } from './relay.js';
import { parseReadsb } from './readsb.js';

export const name = 'adsb.lol';
export const creditUrl = 'https://adsb.lol';

export async function aircraftNear(lat, lon, radiusNm) {
  const r = await viaRelay(`https://api.adsb.lol/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${Math.round(radiusNm)}`);
  return parseReadsb(await r.json());
}
