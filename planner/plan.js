// plan.js
// Puts the pieces together for one day: for each hour, where the sun is (CALCULATED by Light Scout's
// sunPos), what the forecast says about clouds, and the light score (ESTIMATE) for planes flying
// each way along the chosen runway, as seen from your position.

import { makeProjection, runwayRelation } from './geo.js';
import { lightScore, viewFor } from './light.js';

const HOUR = 3600e3;

// airport: from airports.js; runway: one of airport.runways; position: { lat, lon }
// dayStart: midnight at the airport (ms); sunPos(t, lat, lon) and weatherAt(t) are passed in.
// weatherAt returns one forecast hour from Light Scout's wxFrom() ({ low, mid, high, vis, pp, code, ... }) or null.
export function dayPlan({ airport, runway, position, dayStart, sunPos, weatherAt, cfg }) {
  const proj = makeProjection(airport.lat, airport.lon);
  const rel = runwayRelation(proj, runway, position.lat, position.lon);
  // Within this distance of the centre line beyond a runway end, planes pass (nearly) overhead.
  const underPath = rel.beyond !== null && rel.distToCentrelineM < cfg.underPathOffsetM;
  // What each direction looks like from your position:
  //  - beside the runway: which side of the aircraft faces you, and which way it crosses your view.
  //    (rel.offsetM > 0 = you are on the LEFT of planes flying le -> he, so you see their left side.)
  //    Seen from the left of a plane's path it moves right -> left across your view; from the right, left -> right.
  //  - beyond a runway end: whether the nose or the tail points at you.
  const dirs = [
    { key: 'le', ident: runway.leIdent, travelDeg: runway.leTravelDeg, onLeft: rel.offsetM > 0 },
    { key: 'he', ident: runway.heIdent, travelDeg: runway.heTravelDeg, onLeft: rel.offsetM < 0 },
  ].map((d) => ({
    ...d,
    view: rel.beyond ? viewFor(d.travelDeg, rel.planeToCameraDeg) : d.onLeft ? 'leftSide' : 'rightSide',
  }));

  const hours = [];
  for (let i = 0; i < 24; i++) {
    const t = dayStart + i * HOUR;
    const mid = t + HOUR / 2; // judge each hour by its middle
    const sun = sunPos(mid, position.lat, position.lon);
    const wx = weatherAt(mid);
    const clouds = wx ? { low: wx.low, mid: wx.mid, high: wx.high } : null;
    // The side light is the same whichever way the planes fly (it depends on which side of the
    // runway you are); what changes per direction is whether you see the nose or the tail.
    const light = lightScore(sun, rel.planeToCameraDeg, clouds, cfg);
    hours.push({ t, sun, clouds, wx, light });
  }
  return { rel, underPath, dirs, hours, best: bestWindow(hours) };
}

// The longest run of "good" hours (or "fair" if there are no good ones).
export function bestWindow(hours) {
  for (const rating of ['good', 'fair']) {
    let best = null;
    let run = null;
    for (const h of hours) {
      if (h.light.rating === rating) {
        run = run ? { ...run, end: h.t + HOUR, peak: Math.max(run.peak, h.light.score) } : { start: h.t, end: h.t + HOUR, peak: h.light.score };
      } else {
        if (run && (!best || run.end - run.start > best.end - best.start)) best = run;
        run = null;
      }
    }
    if (run && (!best || run.end - run.start > best.end - best.start)) best = run;
    if (best) return { ...best, rating };
  }
  return null;
}
