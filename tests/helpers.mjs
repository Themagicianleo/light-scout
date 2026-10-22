// helpers.mjs: shared browser-test helpers (stand-in network answers, local server, check()).
// Network answers are replaced with fixed data so the test runs offline:
//   Open-Meteo: a made-up forecast in the real response format (hourly arrays, unixtime)
//   METAR: the real WSSS response from 22 Oct 2026; traffic: a made-up adsb.lol-format list
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

export const PORT = 8123, BASE = `http://localhost:${PORT}/`;
export const results = [];
export const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

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

export async function start() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); return server; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error('server did not start');
}

export async function newPage(browser, { metar = 'real', traffic = null, viewport = { width: 1100, height: 900 } } = {}) {
  const page = await browser.newPage({ viewport });
  await routeAll(page, page, { metar, traffic });
  return page;
}

// Stand-in answers for every outside service. `target` is a page or a whole browser context.
export async function routeAll(target, page, { metar = 'real', traffic = null } = {}) {
  page.errors ??= [];
  if (target === page) page.on('pageerror', (e) => page.errors.push(e.message));
  // prompt()/confirm() answers, in order: page.answers.push('text')
  page.answers = [];
  page.on('dialog', (d) => (page.answers.length ? d.accept(page.answers.shift()) : d.dismiss()));
  await target.route(/tile\.openstreetmap\.org|fonts\.(googleapis|gstatic)\.com|bigdatacloud|air-quality-api\.open-meteo\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await target.route(/api\.open-meteo\.com\/v1\/forecast/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(forecast()) }));
  page.relayCalls = [];
  await target.route(/spotters-relay\.maotianze\.workers\.dev/, (r) => {
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
}

