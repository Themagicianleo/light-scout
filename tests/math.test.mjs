// math.test.mjs: checks the planner's calculations. Run with:  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProjection, runwayRelation, angleDiff, bearingOf, distanceM, relativeToThreshold } from '../planner/geo.js';
import { lightScore, angleFactor, altitudeFactor, cloudFactor, viewFor } from '../planner/light.js';
import { components, likelyEnd } from '../planner/wind.js';
import { CONFIG } from '../planner/config.js';

// Changi runway 02L/20R, exactly as in OurAirports (22 Oct 2026).
const RWY_02L = { leLat: 1.34897, leLon: 103.977997, heLat: 1.38241, heLon: 103.991997 };
const proj = makeProjection(1.35019, 103.994003); // Changi's reference point
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

test('angles: bearings and differences wrap correctly', () => {
  assert.equal(bearingOf(0, 1), 0);
  assert.equal(bearingOf(1, 0), 90);
  assert.equal(bearingOf(0, -1), 180);
  assert.equal(bearingOf(-1, 0), 270);
  assert.equal(angleDiff(350, 10), -20);
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(Math.abs(angleDiff(0, 180)), 180);
});

test('runway geometry: Changi 02L direction, length and sides', () => {
  const mid = runwayRelation(proj, RWY_02L, 1.36569, 103.984997); // the runway's midpoint
  near(mid.bearingAtoB, 22.7, 0.3, 'direction of 02L');
  near(mid.lengthM, 4012, 15, 'length from the end coordinates; OurAirports says 13,123 ft = 4,000 m');
  near(mid.distToCentrelineM, 0, 1);
  assert.equal(mid.beyond, null);

  // 1 km east-south-east of the runway middle: to the RIGHT of planes flying 02 (A -> B).
  const east = runwayRelation(proj, RWY_02L, 1.36569 - 0.0035, 103.984997 + 0.0083);
  assert.ok(east.offsetM < 0, 'right side has a negative offset');
  near(east.distToCentrelineM, 1000, 30);
  near(east.planeToCameraDeg, 112.7, 1, 'from the runway towards you is ~90° right of 022.7°');
  near(east.cameraToRunwayDeg, 292.7, 1);

  // 2 km south of the 02L end, on the extended centre line: beyond end A, under the approach.
  const under = runwayRelation(proj, RWY_02L, 1.34897 - 0.0166, 103.977997 - 0.0070);
  assert.equal(under.beyond, 'A');
  assert.ok(under.distToCentrelineM < 50);
  near(under.distToRunwayM, 2000, 30);
});

test('threshold-relative position: before (-) and after (+) along the landing direction', () => {
  const T = { lat: 1.34897, lon: 103.977997 }; // 02L end
  const before = relativeToThreshold(proj, T, 22.7, 1.34897 - 0.0166, 103.977997 - 0.0070);
  assert.ok(before.alongM < -1900, 'south of the 02 threshold = before it when landing on 02');
  assert.ok(Math.abs(before.offsetM) < 60);
});

test('distance: haversine (a sphere) is within 0.6% of the flat map here', () => {
  // A sphere makes north-south degrees ~0.5% too long near the equator; fine for traffic ranges.
  near(distanceM(1.34897, 103.977997, 1.38241, 103.991997), 4031, 15);
});

test('light: front-lit high score, side light fades, backlit is poor, night is none', () => {
  const cfg = CONFIG.light;
  // Sun exactly behind you (sun azimuth = direction from plane to camera), 20° high, clear sky.
  assert.equal(lightScore({ az: 112.7, alt: 20 }, 112.7, { low: 0, mid: 0, high: 0 }, cfg).score, 100);
  assert.equal(lightScore({ az: 112.7, alt: 20 }, 112.7, null, cfg).rating, 'good');
  // 75° off: half-way between 60° (1.0) and 90° (0.4) = 0.7
  near(angleFactor(75, cfg), 0.7, 1e-9);
  const back = lightScore({ az: 292.7, alt: 20 }, 112.7, null, cfg);
  assert.equal(back.lighting, 'back');
  assert.equal(back.score, 10);
  assert.equal(back.rating, 'poor');
  assert.equal(lightScore({ az: 112.7, alt: -3 }, 112.7, null, cfg).rating, 'none');
});

test('light: sun height and clouds', () => {
  const cfg = CONFIG.light;
  assert.equal(altitudeFactor(-1, cfg), 0);
  assert.equal(altitudeFactor(3, cfg), 0.5);
  assert.equal(altitudeFactor(25, cfg), 1);
  assert.equal(altitudeFactor(50, cfg), 0.6);
  assert.equal(altitudeFactor(75, cfg), 0.35);
  near(cloudFactor({ low: 100, mid: 0, high: 0 }, cfg).factor, 0.2, 1e-9);
  near(cloudFactor({ low: 0, mid: 0, high: 100 }, cfg).factor, 0.6, 1e-9, 'high cloud counts half');
  assert.equal(cloudFactor(null, cfg).blocked, null, 'no forecast: unknown, not "clear"');
});

test('view: nose towards you, or tail', () => {
  assert.equal(viewFor(22.7, 22.7), 'front'); // flying straight at you
  assert.equal(viewFor(202.7, 22.7), 'tail');
  assert.equal(viewFor(22.7, 112.7), 'side');
});

test('wind: components and likely runway end (real Changi METAR 22 Oct 2026: 10005KT)', () => {
  const c = components(100, 5, 23);
  near(c.headwindKt, 1.12, 0.01);
  near(c.crosswindKt, 4.87, 0.01, 'from the right');
  const ends = [{ ident: '02L', headingDeg: 23 }, { ident: '20R', headingDeg: 203 }];
  const real = likelyEnd(ends, { dirDeg: 100, speedKt: 5 }, CONFIG.wind);
  assert.equal(real.status, 'close', 'mostly crosswind: too close to call');
  near(real.rows[1].headwindKt, -1.12, 0.01, 'tailwind on 20R');
  const southerly = likelyEnd(ends, { dirDeg: 200, speedKt: 12 }, CONFIG.wind);
  assert.equal(southerly.status, 'ok');
  assert.equal(southerly.likely, '20R');
  assert.equal(likelyEnd(ends, { dirDeg: 200, speedKt: 2 }, CONFIG.wind).status, 'calm');
  assert.equal(likelyEnd(ends, { dirDeg: null, speedKt: 6 }, CONFIG.wind).status, 'variable');
  assert.equal(likelyEnd(ends, null, CONFIG.wind).status, 'unavailable');
});

test('day plan: side of the aircraft beside the runway, nose/tail beyond the end', async () => {
  const { dayPlan } = await import('../planner/plan.js');
  const airport = { lat: 1.35019, lon: 103.994003 };
  const runway = { ...RWY_02L, leIdent: '02L', heIdent: '20R', leTravelDeg: 23, heTravelDeg: 203 };
  const noSun = () => ({ az: 0, alt: -10 });
  const beside = dayPlan({ airport, runway, position: { lat: 1.36219, lon: 103.993297 }, dayStart: 0, sunPos: noSun, weatherAt: () => null, cfg: CONFIG.light });
  assert.deepEqual(beside.dirs.map((d) => d.view), ['rightSide', 'leftSide']);
  assert.equal(beside.hours.length, 24);
  assert.equal(beside.best, null, 'no sun all day: no best window');
  const under = dayPlan({ airport, runway, position: { lat: 1.34897 - 0.0166, lon: 103.977997 - 0.0070 }, dayStart: 0, sunPos: noSun, weatherAt: () => null, cfg: CONFIG.light });
  assert.equal(under.underPath, true);
  // South of the 02L end: planes landing/departing on 02L fly away from you (tail); 20R traffic comes at you (nose).
  assert.deepEqual(under.dirs.map((d) => d.view), ['tail', 'front']);
});

test('METAR parsing: real AWC response (WSSS, 22 Oct 2026), variable wind, gusts, empty', async () => {
  const { parseAwc } = await import('../planner/sources/metar-awc.js');
  const real = [{ icaoId: 'WSSS', receiptTime: '2026-10-22T11:31:06.344Z', obsTime: 1792668600, reportTime: '2026-10-22T11:30:00.000Z', temp: 30, dewp: 24, wdir: 100, wspd: 5, visib: '6+', altim: 1009, qcField: 16, metarType: 'METAR', rawOb: 'METAR WSSS 221130Z 10005KT 020V140 9999 FEW018 BKN300 30/24 Q1009 NOSIG', lat: 1.368, lon: 103.982, elev: 17, name: 'Singapore/Changi Intl, 4, SG', cover: 'BKN', clouds: [{ cover: 'FEW', base: 1800 }, { cover: 'BKN', base: 30000 }], fltCat: 'VFR' }];
  const m = parseAwc(real);
  assert.equal(m.station, 'WSSS');
  assert.equal(m.dirDeg, 100);
  assert.equal(m.speedKt, 5);
  assert.equal(m.gustKt, null);
  assert.equal(m.observedMs, 1792668600000);
  assert.equal(parseAwc([{ ...real[0], wdir: 'VRB', wspd: 3 }]).dirDeg, null);
  assert.equal(parseAwc([{ ...real[0], wdir: 'VRB', wspd: 3 }]).variable, true);
  assert.equal(parseAwc([{ ...real[0], rawOb: 'METAR WSSS 221130Z 22015G28KT 9999 FEW018 30/24 Q1009' }]).gustKt, 28);
  assert.equal(parseAwc([]), null);
  assert.throws(() => parseAwc({}), /unexpected/);
});

test('traffic: arriving 02L with a time estimate, departing 20R, others ignored', async () => {
  const { classify } = await import('../planner/traffic.js');
  const { parseReadsb } = await import('../planner/sources/readsb.js');
  const airport = { lat: 1.35019, lon: 103.994003, runways: [{ leIdent: '02L', heIdent: '20R', leLat: 1.34897, leLon: 103.977997, heLat: 1.38241, heLon: 103.991997, leTravelDeg: 23, heTravelDeg: 203 }] };
  const list = parseReadsb({ ac: [
    // 6 nm south-south-west of the 02L threshold on the centre line, heading 023, descending, 150 kt
    { hex: 'aaa001', flight: 'SIA1    ', t: 'A359', alt_baro: 2000, gs: 150, track: 23, baro_rate: -700, lat: 1.34897 - 0.092, lon: 103.977997 - 0.039 },
    // departing 20R: just south of the 02L/20R south end, heading 203, climbing
    { hex: 'aaa002', flight: 'TGW2    ', t: 'A20N', alt_baro: 1500, gs: 170, track: 203, baro_rate: 2500, lat: 1.34897 - 0.02, lon: 103.977997 - 0.0085 },
    // cruising overhead: too high
    { hex: 'aaa003', flight: 'MAS144  ', t: 'A339', alt_baro: 40000, gs: 464.8, track: 331.89, lat: 1.385301, lon: 103.770983 },
    // on the ground
    { hex: 'aaa004', flight: 'SIA121  ', alt_baro: 'ground', gs: 5, track: 84, lat: 1.3684, lon: 103.9879 },
    // no position: dropped
    { hex: 'aaa005', flight: 'X' },
  ] });
  assert.equal(list.length, 4);
  const r = classify(list, airport, CONFIG.traffic);
  assert.equal(r.arrivals.length, 1);
  assert.equal(r.arrivals[0].ident, '02L');
  near(r.arrivals[0].distNm, 6.0, 0.1); // 0.092° south = 5.5 nm, 0.039° west = 2.3 nm
  near(r.arrivals[0].etaMin, 6.0 / 150 * 60, 0.1, 'distance / ground speed = 2.4 min');
  assert.equal(r.departures.length, 1);
  assert.equal(r.departures[0].ident, '20R');
  assert.equal(r.ground, 1);
  assert.equal(r.others, 1);
});

test('offline: sw.js caches every planner file, the airport data and Leaflet', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const files = [
    ...readdirSync(new URL('../planner/', import.meta.url)).filter((f) => /\.(js|css)$/.test(f)).map((f) => `./planner/${f}`),
    ...readdirSync(new URL('../planner/sources/', import.meta.url)).map((f) => `./planner/sources/${f}`),
    './data/airports.json', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  ];
  for (const f of files) assert.ok(sw.includes(`"${f}"`), `${f} is missing from sw.js`);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<script type="module" src="planner/main.js">'), 'build.sh adds the planner');
});

test('METAR observed conditions: real Changi report, haze/thunderstorm, CAVOK, trend ignored', async () => {
  const { parseConditions } = await import('../planner/sources/metar-awc.js');
  const real = parseConditions('METAR WSSS 221230Z 05006KT 010V090 9999 FEW018 BKN300 29/24 Q1010 NOSIG');
  assert.equal(real.visibilityM, 10000, '9999 means 10 km or more');
  assert.deepEqual(real.clouds.map((c) => c.cover + c.baseFt), ['FEW1800', 'BKN30000']);
  assert.deepEqual(real.weather, []);
  const storm = parseConditions('METAR WSSS 221230Z 22015G28KT 3000 -TSRA HZ FEW015CB SCT020 25/24 Q1010 TEMPO 1500 +TSRA');
  assert.equal(storm.visibilityM, 3000, 'TEMPO visibility is a forecast, not now');
  assert.deepEqual(storm.weather, ['-TSRA', 'HZ']);
  assert.equal(storm.clouds[0].type, 'CB');
  assert.equal(parseConditions('METAR EGLL 221220Z 24010KT CAVOK 15/08 Q1020').cavok, true);
});

test('suggestions: storm first, haze from the METAR, rain, light, runway, best time', async () => {
  const { advise } = await import('../planner/advice.js');
  const cfg = CONFIG.advice;
  const plan = { underPath: false, best: { start: 0, end: 3, rating: 'good', peak: 92 }, dirs: [{ ident: '02L', view: 'rightSide' }, { ident: '20R', view: 'leftSide' }] };
  const hour = (wx, sun = { az: 100, alt: 20 }, light = { rating: 'good', lighting: 'front', delta: 10, blocked: 0.1 }) => ({ t: 0, sun, wx, light });
  const clear = { low: 5, mid: 0, high: 20, total: 10, vis: 24000, pp: 5, code: 1 };
  const keys = (a) => a.map((x) => x.key);

  let a = advise({ hour: hour(clear), plan, wind: { status: 'ok', likely: '20R' }, observed: null, cfg });
  assert.deepEqual(keys(a), ['adv_crisp', 'adv_frontlit', 'adv_runway', 'adv_best']);
  assert.equal(a.find((x) => x.key === 'adv_runway').vars.view, 'leftSide');

  // Thunderstorm in the METAR: safety comes first; haze from the measured 3,000 m beats the forecast's 24 km.
  a = advise({ hour: hour(clear), plan, wind: null, observed: { visibilityM: 3000, clouds: [{ cover: 'FEW', baseFt: 1500, type: 'CB' }], weather: ['-TSRA'] }, cfg });
  assert.equal(a[0].key, 'adv_storm');
  assert.equal(a[0].tone, 'bad');
  assert.deepEqual(a.find((x) => x.key === 'adv_haze').vars, { km: 3, src: 'metar' });

  // Rainy, overcast afternoon, backlit, high sun hidden by cloud: no shimmer.
  a = advise({ hour: hour({ low: 85, mid: 40, high: 20, total: 95, vis: 8000, pp: 70, code: 63 }, { az: 250, alt: 50 }, { rating: 'poor', lighting: 'back', delta: 170, blocked: 0.85 }), plan: { ...plan, best: null }, wind: { status: 'close' }, observed: null, cfg });
  assert.deepEqual(keys(a), ['adv_rain', 'adv_backlit', 'adv_overcast', 'adv_eitherway', 'adv_nobest']);

  // Clear midday: heat shimmer note.
  a = advise({ hour: hour(clear, { az: 160, alt: 70 }, { rating: 'poor', lighting: 'front', delta: 20, blocked: 0.1 }), plan, wind: null, observed: null, cfg });
  assert.ok(keys(a).includes('adv_shimmer'));
  // Night: no light advice, no shimmer, no cloud advice.
  a = advise({ hour: hour(clear, { az: 300, alt: -20 }, { rating: 'none', lighting: 'back', delta: 150, blocked: 0.1 }), plan, wind: null, observed: null, cfg });
  assert.deepEqual(keys(a), ['adv_crisp', 'adv_night', 'adv_best']);
});
