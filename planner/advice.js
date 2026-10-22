// advice.js
// Suggestions for one hour, from rules you can read below. Every suggestion is an ESTIMATE and
// comes with the numbers that triggered it. Returns language-free keys; i18n.js has the words.
//
// Inputs:
//   hour      one hour from plan.dayPlan(): { t, sun: { az, alt }, wx (forecast hour or null), light }
//   plan      the whole day plan (best window, underPath, directions)
//   wind      runway estimate from wind.likelyEnd(): { status, likely } or null
//   observed  METAR conditions from parseConditions() — only passed for the current hour
//   cfg       CONFIG.advice

const THUNDER = [95, 96, 99]; // WMO weather codes used by Open-Meteo
const RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];

export function advise({ hour, plan, wind, observed, cfg }) {
  const out = [];
  const add = (key, tone, vars = {}) => out.push({ key, tone, vars });
  const wx = hour.wx;
  const sun = hour.sun;

  // 1. Safety first: thunderstorms (forecast code, or TS / CB cloud in the latest METAR).
  const obsStorm = observed && (observed.weather.some((w) => w.includes('TS')) || observed.clouds.some((c) => c.type === 'CB'));
  if ((wx && THUNDER.includes(wx.code)) || obsStorm) add('adv_storm', 'bad', { src: obsStorm ? 'metar' : 'forecast' });

  // 2. Visibility: the METAR's measured value for "now", otherwise the forecast (metres).
  const vis = observed?.visibilityM ?? wx?.vis ?? null;
  const visSrc = observed?.visibilityM != null ? 'metar' : 'forecast';
  if (vis !== null) {
    const km = Math.round(vis / 100) / 10;
    if (vis < cfg.fogVisM) add('adv_fog', 'bad', { km, src: visSrc });
    else if (vis < cfg.hazeVisM) add('adv_haze', 'meh', { km, src: visSrc });
    else if (vis >= cfg.clearVisM && (wx?.total ?? 100) < 30) add('adv_crisp', 'good', { km, src: visSrc });
  }

  // 3. Rain.
  if (wx && (wx.pp >= cfg.rainPct || RAIN.includes(wx.code))) add('adv_rain', 'meh', { pp: wx.pp ?? 0 });

  // 4. The light at this hour (sun position: calculated; quality: estimate).
  if (sun.alt <= 0) add('adv_night', 'info', {});
  else if (hour.light.lighting === 'back') add('adv_backlit', 'meh', { delta: hour.light.delta });
  else if (hour.light.rating === 'good') add('adv_frontlit', 'good', { delta: hour.light.delta, alt: Math.round(sun.alt) });
  else if (hour.light.lighting === 'side') add('adv_sidelit', 'info', { delta: hour.light.delta });

  // 5. Clouds (forecast layers, percent).
  if (wx && sun.alt > 0) {
    const lowMid = Math.max(wx.low ?? 0, wx.mid ?? 0);
    if (lowMid >= cfg.overcastPct) add('adv_overcast', 'meh', { pct: lowMid });
    else if ((wx.high ?? 0) >= cfg.thinHighPct && lowMid < cfg.lowMidForThinPct) add('adv_thinhigh', 'info', { pct: wx.high });
  }

  // 6. High sun on a bright day: heat shimmer over hot tarmac is common with long lenses.
  if (sun.alt >= cfg.shimmerAltDeg && (hour.light.blocked ?? 0) < 0.5) add('adv_shimmer', 'info', { alt: Math.round(sun.alt) });

  // 7. Where you stand: under the flight path.
  if (plan.underPath) add('adv_overhead', 'info', {});

  // 8. Which way the planes will probably go (from the wind estimate).
  if (wind?.status === 'ok') {
    const dir = plan.dirs.find((d) => d.ident === wind.likely);
    if (dir) add('adv_runway', 'info', { ident: wind.likely, view: dir.view });
  } else if (wind && ['close', 'calm', 'variable'].includes(wind.status)) add('adv_eitherway', 'info', {});

  // 9. The best time today from this spot.
  if (plan.best) add('adv_best', plan.best.rating === 'good' ? 'good' : 'info', { from: plan.best.start, to: plan.best.end, rating: plan.best.rating, score: plan.best.peak });
  else add('adv_nobest', 'meh', {});

  return out;
}
