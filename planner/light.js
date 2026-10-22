// light.js
// Light-quality score: an ESTIMATE built from calculated numbers (sun azimuth/altitude and the
// direction from the plane to your camera) and the cloud forecast. Thresholds are in config.js.

import { angleDiff } from './geo.js';

// How well the side of the plane facing you is lit, from delta = angle between the sun's azimuth
// and the direction from the plane to your camera. 0 = sun exactly behind you.
export function angleFactor(delta, cfg) {
  if (delta <= cfg.goodAngleDeg) return 1;
  if (delta <= cfg.sideAngleDeg) {
    // fade in a straight line from 1 (at goodAngleDeg) to sideFactor (at sideAngleDeg)
    const f = (delta - cfg.goodAngleDeg) / (cfg.sideAngleDeg - cfg.goodAngleDeg);
    return 1 - f * (1 - cfg.sideFactor);
  }
  return cfg.backlitFactor; // the sun is beyond the plane: you see its shadow side
}

// How useful the sun's height is. Below the horizon there is no direct light at all.
export function altitudeFactor(alt, cfg) {
  if (alt <= 0) return 0;
  if (alt < cfg.lowAltDeg) return cfg.lowAltFactor;
  if (alt <= cfg.highAltDeg) return 1;
  if (alt <= cfg.veryHighAltDeg) return cfg.highAltFactor;
  return cfg.veryHighAltFactor;
}

// How likely the sun is to be blocked, from the forecast cloud layers (percent).
// Returns { factor, blocked } or { factor: 1, blocked: null } when there's no forecast.
export function cloudFactor(w, cfg) {
  if (!w || w.low == null) return { factor: 1, blocked: null };
  const blocked = Math.max(w.low, w.mid ?? 0, cfg.highCloudWeight * (w.high ?? 0)) / 100;
  return { factor: 1 - cfg.cloudWeight * blocked, blocked };
}

// The whole score for one moment.
//   sun: { az, alt } from Light Scout's sunPos();  planeToCameraDeg from geo.runwayRelation()
//   clouds: { low, mid, high } for that hour, or null
export function lightScore(sun, planeToCameraDeg, clouds, cfg) {
  const delta = Math.abs(angleDiff(sun.az, planeToCameraDeg));
  const a = angleFactor(delta, cfg);
  const h = altitudeFactor(sun.alt, cfg);
  const c = cloudFactor(clouds, cfg);
  const score = Math.round(100 * a * h * c.factor);
  const rating = sun.alt <= 0 ? 'none' : score >= cfg.goodScore ? 'good' : score >= cfg.fairScore ? 'fair' : 'poor';
  const lighting = delta <= cfg.goodAngleDeg ? 'front' : delta <= cfg.sideAngleDeg ? 'side' : 'back';
  return { score, rating, delta: Math.round(delta), lighting, factors: { angle: a, altitude: h, clouds: c.factor }, blocked: c.blocked };
}

// Which end of the plane you see as it passes, for planes travelling in `headingDeg`:
// heading roughly towards you = front three-quarter view; away = tail view.
export function viewFor(headingDeg, planeToCameraDeg) {
  const d = Math.abs(angleDiff(headingDeg, planeToCameraDeg));
  return d < 60 ? 'front' : d > 120 ? 'tail' : 'side';
}
