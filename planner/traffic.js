// traffic.js
// Which aircraft are arriving at or departing from a runway (an ESTIMATE from position, track,
// height and climb/descent), and a rough time to the threshold: distance / ground speed.
//
//            before the threshold (along < 0)        after (along > 0)
//   ✈ ──────────────────────────── T ═════ runway ═════ F ─────────── ✈
//   arriving: lined up, within maxOffset of           departing: lined up, past T,
//   the extended centre line, not climbing            within departRange of F, not descending

import { makeProjection, relativeToThreshold, angleDiff, distanceM, M_PER_NM } from './geo.js';

// list: normalized aircraft (sources/readsb.js); airport: from airports.js; cfg: CONFIG.traffic
export function classify(list, airport, cfg) {
  const proj = makeProjection(airport.lat, airport.lon);
  // Every runway end as a direction of travel: threshold T (where it starts) and far end F.
  const ends = airport.runways.flatMap((r) => [
    { ident: r.leIdent, travelDeg: r.leTravelDeg, T: { lat: r.leLat, lon: r.leLon }, F: { lat: r.heLat, lon: r.heLon } },
    { ident: r.heIdent, travelDeg: r.heTravelDeg, T: { lat: r.heLat, lon: r.heLon }, F: { lat: r.leLat, lon: r.leLon } },
  ]);
  const arrivals = [], departures = [];
  let ground = 0, others = 0;
  for (const ac of list) {
    if (ac.onGround) { ground++; continue; }
    if (ac.trackDeg === null || ac.altFt === null || ac.altFt > cfg.maxAltitudeFt) { others++; continue; }
    let best = null;
    for (const e of ends) {
      if (Math.abs(angleDiff(ac.trackDeg, e.travelDeg)) > cfg.alignDeg) continue; // not lined up
      const rel = relativeToThreshold(proj, e.T, e.travelDeg, ac.lat, ac.lon);
      const off = Math.abs(rel.offsetM);
      if (off > cfg.maxOffsetNm * M_PER_NM) continue; // too far to the side of the centre line
      const distT = distanceM(ac.lat, ac.lon, e.T.lat, e.T.lon);
      const distF = distanceM(ac.lat, ac.lon, e.F.lat, e.F.lon);
      let match = null;
      if (rel.alongM < 0 && distT <= cfg.arriveRangeNm * M_PER_NM && (ac.vrFpm === null || ac.vrFpm <= 500)) {
        // Arriving: before the threshold, not climbing. Time = distance / speed (estimate).
        const etaMin = ac.gsKt !== null && ac.gsKt >= cfg.minSpeedKt ? distT / M_PER_NM / ac.gsKt * 60 : null;
        match = { kind: 'arrival', ident: e.ident, distNm: distT / M_PER_NM, etaMin, offsetM: off };
      } else if (rel.alongM > 0 && distF <= cfg.departRangeNm * M_PER_NM && (ac.vrFpm === null || ac.vrFpm >= -200)) {
        match = { kind: 'departure', ident: e.ident, distNm: distF / M_PER_NM, etaMin: null, offsetM: off };
      }
      // Parallel runways: keep the one whose centre line the aircraft is closest to.
      if (match && (!best || match.offsetM < best.offsetM)) best = match;
    }
    if (!best) { others++; continue; }
    (best.kind === 'arrival' ? arrivals : departures).push({ ac, ...best });
  }
  arrivals.sort((a, b) => (a.etaMin ?? 999) - (b.etaMin ?? 999) || a.distNm - b.distNm);
  departures.sort((a, b) => a.distNm - b.distNm);
  return { arrivals, departures, ground, others };
}
