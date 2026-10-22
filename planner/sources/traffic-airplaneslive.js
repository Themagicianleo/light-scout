// traffic-airplaneslive.js
// Alternative provider: airplanes.live (via the relay), same readsb format and URL shape.
//   GET https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}
// NOT VERIFIED: airplanes.live's terms page showed a bot check to every automated reader on 22 Oct 2026,
// and it answered 403 from a cloud server. Third-party pages say non-commercial use only and about
// 1 request per second. Read https://airplanes.live/api-guide/ yourself before switching to it
// (CONFIG.traffic.provider = 'airplanesLive').

import { viaRelay } from './relay.js';
import { parseReadsb } from './readsb.js';

export const name = 'airplanes.live';
export const creditUrl = 'https://airplanes.live';

export async function aircraftNear(lat, lon, radiusNm) {
  const r = await viaRelay(`https://api.airplanes.live/v2/point/${lat.toFixed(4)}/${lon.toFixed(4)}/${Math.round(radiusNm)}`);
  return parseReadsb(await r.json());
}
