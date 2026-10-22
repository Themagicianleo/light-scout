// e2e.mjs: drives the real page in headless Chromium. Run with:  npm run test:e2e
// Network answers are replaced with fixed data so the test runs offline:
//   Open-Meteo: a made-up forecast in the real response format (hourly arrays, unixtime)
//   METAR: the real WSSS response from 22 Oct 2026; traffic: a made-up adsb.lol-format list
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const PORT = 8123, BASE = `http://localhost:${PORT}/`;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

// A forecast like Open-Meteo's: 7 days of hours from today's UTC midnight. Clear mornings, cloudy afternoons.
function forecast() {
  const start = Math.floor(Date.now() / 864e5) * 86400 - 86400;
  const n = 24 * 8, h = { time: [] };
  const keys = ['temperature_2m', 'relative_humidity_2m', 'dew_point_2m', 'precipitation_probability', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'visibility', 'wind_speed_10m', 'wind_direction_10m', 'weather_code'];
  keys.forEach((k) => (h[k] = []));
  for (let i = 0; i < n; i++) {
    const t = start + i * 3600, localHour = (new Date(t * 1000).getUTCHours() + 8) % 24;
    const cloudy = localHour >= 13;
    h.time.push(t);
    h.temperature_2m.push(29); h.relative_humidity_2m.push(75); h.dew_point_2m.push(24); h.precipitation_probability.push(cloudy ? 40 : 5);
    h.cloud_cover.push(cloudy ? 90 : 10); h.cloud_cover_low.push(cloudy ? 80 : 5); h.cloud_cover_mid.push(cloudy ? 40 : 0); h.cloud_cover_high.push(20);
    h.visibility.push(20000); h.wind_speed_10m.push(12); h.wind_direction_10m.push(180); h.weather_code.push(cloudy ? 3 : 1);
  }
  return { latitude: 1.35, longitude: 103.99, timezone: 'Asia/Singapore', utc_offset_seconds: 28800, hourly: h };
}

async function start() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); return server; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('server did not start');
}

export async function newPage(browser, { metar = 'real', traffic = null, viewport = { width: 1100, height: 900 } } = {}) {
  const page = await browser.newPage({ viewport });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // prompt()/confirm() answers, in order: page.answers.push('text')
  page.answers = [];
  page.on('dialog', (d) => (page.answers.length ? d.accept(page.answers.shift()) : d.dismiss()));
  await page.route(/tile\.openstreetmap\.org|fonts\.(googleapis|gstatic)\.com|bigdatacloud|air-quality-api\.open-meteo\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route(/api\.open-meteo\.com\/v1\/forecast/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast()) }));
  page.relayCalls = [];
  await page.route(/spotters-relay\.maotianze\.workers\.dev/, (r) => {
    const target = decodeURIComponent(new URL(r.request().url()).searchParams.get('url') || '');
    page.relayCalls.push(target);
    if (target.includes('aviationweather.gov')) {
      if (metar === 'none') return r.fulfill({ status: 204, body: '' });
      if (metar === 'down') return r.fulfill({ status: 502, body: 'bad gateway' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ icaoId: 'WSSS', receiptTime: '2026-10-22T11:31:06.344Z', obsTime: Math.floor(Date.now() / 1000) - 1200, reportTime: '2026-10-22T11:30:00.000Z', temp: 30, dewp: 24, wdir: metar === 'south' ? 200 : 100, wspd: metar === 'south' ? 12 : 5, visib: '6+', altim: 1009, qcField: 16, metarType: 'METAR', rawOb: metar === 'south' ? 'METAR WSSS 221130Z 20012KT 9999 FEW018 30/24 Q1009 NOSIG' : 'METAR WSSS 221130Z 10005KT 020V140 9999 FEW018 BKN300 30/24 Q1009 NOSIG', lat: 1.368, lon: 103.982, elev: 17, name: 'Singapore/Changi Intl, 4, SG', cover: 'BKN', clouds: [{ cover: 'FEW', base: 1800 }], fltCat: 'VFR' }]) });
    }
    if (target.includes('adsb.lol') || target.includes('airplanes.live')) {
      if (traffic === 'down') return r.fulfill({ status: 503, body: '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(traffic ?? { ac: [], msg: 'No error', now: Date.now(), total: 0, ctime: Date.now(), ptime: 0 }) });
    }
    return r.fulfill({ status: 400, body: 'Not allowed' });
  });
  return page;
}

// ---------- Phase 1: sun and geometry ----------
async function phase1(browser) {
  const page = await newPage(browser);
  await page.goto(BASE);
  await page.waitForSelector('#tabs:not([hidden])');
  check('[light tab] existing Light Scout still renders (sun card, forecast)', await page.locator('#sunStats .stat').count() > 0 && await page.locator('#weather .hour').count() > 0);
  await page.click('#tabPlanner');
  await page.waitForSelector('#plAirportInfo .pl-airport-name');
  check('[planner] defaults to Singapore Changi from OurAirports', (await page.textContent('#plAirportInfo')).includes('Singapore Changi Airport') && (await page.textContent('#plAirportInfo')).includes('WSSS / SIN'));
  check('[planner] Changi has its three runways', (await page.locator('#plRunways .chip').count()) === 3);
  check('[planner] safety reminder shown', (await page.textContent('.pl-safety')).includes('restricted areas'));
  check('[planner] no positions are suggested', (await page.locator('.pl-pos').count()) === 0 && (await page.textContent('#plPosList')).includes('No positions yet'));

  // Add a position by coordinates: ~1 km east of the 02L/20R middle (right of planes flying 02L).
  page.answers.push('1.36219, 103.993297', 'East fence');
  await page.click('#plCoords');
  await page.waitForSelector('.pl-pos');
  check('[planner] position added and drawn on the map', (await page.locator('.pl-pos').count()) === 1 && (await page.textContent('#plPosList')).includes('East fence'));
  const geo = await page.textContent('#plGeo');
  check('[geometry] calculated distance to the nearest centre line', /To the centre line\s*(\d+ m|\d\.\d km)/.test(geo), geo.slice(0, 160));
  check('[geometry] labelled as calculated', (await page.textContent('#plGeo .pl-calc')) === 'Calculated');
  await page.locator('#plRunways .chip', { hasText: '02L/20R' }).click();
  const geo2 = await page.textContent('#plGeo');
  check('[geometry] 02L/20R: ~1 km, right of planes on 02L, facing ~293° WNW', geo2.includes('1.0 km') && geo2.includes('Left of planes using 20R, right of planes using 02L') && /29[2-4]° \(WNW\)/.test(geo2), geo2);
  const bars = await page.locator('#plLight .pl-chart path').count();
  check('[light] 24 hourly bars', bars === 24, `${bars}`);
  check('[light] labelled as an estimate', (await page.textContent('#plLight .pl-est')) === 'Estimate');
  const light = await page.textContent('#plLight');
  check('[light] both directions: right side of 02L traffic (left → right), left side of 20R traffic', light.includes('Planes moving 02L → 23°') && light.includes('Planes moving 20R → 203°') &&
    /02L → 23°you see the aircraft's right side; it moves left → right/.test(light) && /20R → 203°you see the aircraft's left side; it moves right → left/.test(light));
  check('[light] best window found (east side = morning sun behind you)', /Best: (6|7|8|9|10)/.test(light) || /Best: 0?[6-9]:00/.test(light), light.match(/Best:[^.]*/)?.[0]);
  check('[light] times in the airport\'s time zone', light.includes('Asia/Singapore') || light.includes('Asia/Singapore'.replace('_', ' ')));
  await page.click('#plNumbers summary');
  check('[light] table of numbers has 24 rows', (await page.locator('#plNumbers tbody tr').count()) === 24);
  check('[light] afternoon cloud lowers the score', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#plNumbers tbody tr')].map((r) => r.textContent);
    return rows.some((r) => r.includes('80/40/20%'));
  }));
  await page.click('#plLight [data-day="1"]');
  check('[light] next day', (await page.textContent('#plLight .day')).startsWith('Tomorrow'));
  // Reload: tab, airport and position remembered
  await page.reload();
  await page.waitForSelector('.pl-pos');
  check('[planner] tab, airport and position remembered', (await page.textContent('#plPosList')).includes('East fence'));
  // Search another airport
  await page.fill('#plQ', 'heathrow');
  await page.click('#plResults .result');
  await page.waitForFunction(() => document.querySelector('#plAirportInfo').textContent.includes('Heathrow'));
  check('[planner] airport search (LHR) and its runways', (await page.locator('#plRunways .chip').count()) >= 2);
  check('[planner] positions are per airport', (await page.textContent('#plPosList')).includes('No positions yet'));
  // Language
  await page.click('#langZh');
  check('[i18n] planner switches to 中文', (await page.textContent('#plPosCard h2')) === '你的位置');
  await page.click('#langEn');
  check('[planner] no JavaScript errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();
}

export const phases = [phase1];

if (process.argv[1].endsWith('e2e.mjs')) {
  const server = await start();
  const browser = await chromium.launch();
  try {
    const { extra } = await import('./e2e-more.mjs').catch(() => ({ extra: [] }));
    for (const run of [...phases, ...extra]) await run(browser);
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}
export { check };
