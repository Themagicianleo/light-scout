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
