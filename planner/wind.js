// wind.js
// Headwind and crosswind for each runway end from the METAR wind (CALCULATED), and which end is
// likely in use (an ESTIMATE: air traffic control decides, and noise rules or traffic can override wind).
//
// The METAR wind direction is where the wind blows FROM, in degrees true (like the runway headings).
//   headwind  = speed x cos(wind direction - runway heading)   (negative = tailwind)
//   crosswind = speed x sin(wind direction - runway heading)   (positive = from the right)

const RAD = Math.PI / 180;

export function components(windFromDeg, speedKt, headingDeg) {
  const a = (windFromDeg - headingDeg) * RAD;
  return { headwindKt: speedKt * Math.cos(a), crosswindKt: speedKt * Math.sin(a) };
}

// ends: [{ ident, headingDeg }] for ONE runway (its two ends).
// wind: { dirDeg (null if variable), speedKt, gustKt } or null when there's no usable METAR.
// Returns { status, likely, rows } where status is one of:
//   'unavailable' (no METAR), 'calm', 'variable', 'close' (too close to call), 'ok'
export function likelyEnd(ends, wind, cfg) {
  if (!wind || wind.speedKt == null) return { status: 'unavailable', likely: null, rows: [] };
  if (wind.dirDeg == null) return { status: wind.speedKt < cfg.calmKt ? 'calm' : 'variable', likely: null, rows: [] };
  const rows = ends.map((e) => {
    const c = components(wind.dirDeg, wind.speedKt, e.headingDeg);
    return { ident: e.ident, headingDeg: e.headingDeg, headwindKt: c.headwindKt, crosswindKt: c.crosswindKt };
  });
  if (wind.speedKt < cfg.calmKt) return { status: 'calm', likely: null, rows };
  const sorted = [...rows].sort((a, b) => b.headwindKt - a.headwindKt);
  // Mostly crosswind (the best end gets only a tiny headwind): the wind doesn't really pick a side.
  if (sorted[0].headwindKt < cfg.tooCloseKt) return { status: 'close', likely: null, rows };
  return { status: 'ok', likely: sorted[0].ident, rows };
}
