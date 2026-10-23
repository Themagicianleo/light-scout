// e2e-more.mjs: browser tests for Phases 2-4 (wind, traffic, offline). Run via tests/e2e.mjs.
import { newPage, check } from './helpers.mjs';

const BASE = 'http://localhost:8123/';
async function plannerWithPosition(browser, opts) {
  const page = await newPage(browser, opts);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('s')) return;
    sessionStorage.setItem('s', '1');
    localStorage.clear();
    localStorage.setItem('ls:planner:tab', '"planner"');
    localStorage.setItem('ls:planner:positions', JSON.stringify({ WSSS: [{ id: 'a', name: 'East fence', lat: 1.36219, lon: 103.993297 }] }));
    localStorage.setItem('ls:planner:runway', JSON.stringify({ WSSS: '02L/20R' }));
  });
  await page.goto(BASE);
  await page.waitForSelector('.pl-pos');
  return page;
}

async function phase2(browser) {
  // Real METAR (10005KT): mostly crosswind -> too close to call
  let page = await plannerWithPosition(browser, { metar: 'real' });
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('METAR WSSS'));
  let wind = await page.textContent('#plWind');
  check('[wind] latest METAR shown raw, via the relay', wind.includes('METAR WSSS 221130Z 10005KT') && page.relayCalls.some((u) => u.startsWith('https://aviationweather.gov/api/data/metar?ids=WSSS')));
  check('[wind] 10005KT on runway 02/20: "too close to call"', wind.includes('Mostly crosswind: too close to call'));
  check('[wind] numbers for all six runway ends', (await page.locator('#plWind tbody tr').count()) === 6);
  check('[wind] 02L: 1 kt headwind, 5 kt crosswind from the right', /02L23°1 kt5 kt from right/.test(wind.replace(/\s/g, '').replace('ktfrom', 'kt from')) || wind.includes('1 kt5 kt from right'), wind.slice(0, 400));
  check('[wind] labelled as an estimate', (await page.textContent('#plWind .pl-est')) === 'Estimate');
  check('[wind] no JavaScript errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();

  // Southerly 12 kt -> 20R likely, highlighted in both cards
  page = await plannerWithPosition(browser, { metar: 'south' });
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('likely in use'));
  wind = await page.textContent('#plWind');
  check('[wind] 20012KT: 20R likely, shown with the numbers', wind.includes('20R likely in use') && (await page.locator('#plWind tr.is-likely').count()) === 3);
  check('[wind] light card marks the likely direction', (await page.textContent('#plLight .row.is-likely')).includes('20R'));
  await page.close();

  // No METAR (HTTP 204) -> wind unavailable, no guess
  page = await plannerWithPosition(browser, { metar: 'none' });
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('Wind unavailable'));
  check('[wind] no METAR: "wind unavailable", no runway estimate', (await page.locator('#plLight .row.is-likely').count()) === 0);
  await page.close();

  // Relay/API down, but a METAR was saved earlier -> shown with an offline note
  page = await plannerWithPosition(browser, { metar: 'real' });
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('METAR WSSS'));
  await page.unroute(/spotters-relay\.maotianze\.workers\.dev/);
  await page.route(/spotters-relay\.maotianze\.workers\.dev/, (r) => r.fulfill({ status: 502, body: '' }));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('Offline: showing the METAR saved'));
  check('[wind] API down: last saved METAR shown and labelled', (await page.textContent('#plWind')).includes('METAR WSSS 221130Z'));
  await page.close();
}

const TRAFFIC = { ac: [
  { hex: 'aaa001', flight: 'SIA1    ', r: '9V-SMA', t: 'A359', alt_baro: 2000, gs: 150, track: 23, baro_rate: -700, lat: 1.34897 - 0.092, lon: 103.977997 - 0.039 },
  { hex: 'aaa002', flight: 'TGW2    ', t: 'A20N', alt_baro: 1500, gs: 170, track: 203, baro_rate: 2500, lat: 1.34897 - 0.02, lon: 103.977997 - 0.0085 },
  { hex: 'aaa003', flight: 'MAS144  ', t: 'A339', alt_baro: 40000, gs: 464.8, track: 331.89, lat: 1.385301, lon: 103.770983 },
], msg: 'No error', now: Date.now(), total: 3, ctime: Date.now(), ptime: 0 };

async function phase3(browser) {
  let page = await plannerWithPosition(browser, { traffic: TRAFFIC });
  await page.waitForFunction(() => document.querySelector('#plTraffic')?.textContent.includes('SIA1'));
  const tr = await page.textContent('#plTraffic');
  check('[traffic] arrival listed with an estimated time to the threshold', tr.includes('SIA1') && tr.includes('Arriving 02L') && tr.includes('~2 min to the threshold'));
  check('[traffic] departure listed', tr.includes('TGW2') && tr.includes('Departing 20R'));
  check('[traffic] cruising aircraft not listed, counted as other', !tr.includes('MAS144') && tr.includes('1 other aircraft nearby'));
  check('[traffic] labelled as an estimate', (await page.textContent('#plTraffic .pl-est')) === 'Estimate');
  check('[traffic] asked adsb.lol via the relay, 25 nm around Changi', page.relayCalls.some((u) => u === 'https://api.adsb.lol/v2/point/1.3502/103.9940/25'));
  // Gentle polling: at most ~1 request per 20 s
  const before = page.relayCalls.filter((u) => u.includes('adsb.lol')).length;
  await page.waitForTimeout(5000);
  const after = page.relayCalls.filter((u) => u.includes('adsb.lol')).length;
  check('[traffic] no extra requests within 5 s', after - before === 0, `${after - before}`);
  // Light tab: polling stops
  await page.click('#tabLight');
  check('[traffic] no JavaScript errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();

  page = await plannerWithPosition(browser, { traffic: 'down' });
  await page.waitForFunction(() => document.querySelector('#plTraffic')?.textContent.includes('could not load'));
  check('[traffic] provider down: friendly message', (await page.textContent('#plTraffic')).includes('Live traffic could not load: HTTP 503'));
  await page.close();

  // Pause after 10 minutes (fake clock)
  page = await newPage(browser, { traffic: TRAFFIC });
  await page.clock.install();
  await page.addInitScript(() => {
    localStorage.setItem('ls:planner:tab', '"planner"');
    localStorage.setItem('ls:planner:positions', JSON.stringify({ WSSS: [{ id: 'a', name: 'East fence', lat: 1.36219, lon: 103.993297 }] }));
  });
  await page.goto(BASE);
  await page.waitForFunction(() => document.querySelector('#plTraffic')?.textContent.includes('SIA1'));
  await page.clock.runFor(11 * 60 * 1000);
  await page.waitForFunction(() => document.querySelector('#plTraffic')?.textContent.includes('Paused'));
  const n = page.relayCalls.filter((u) => u.includes('adsb.lol')).length;
  check('[traffic] pauses after 10 min; about 3 requests a minute until then', n >= 25 && n <= 35, `${n} requests in 10 min`);
  await page.click('#plTraffic [data-act="resume"]');
  await page.waitForFunction(() => !document.querySelector('#plTraffic').textContent.includes('Paused'));
  check('[traffic] "Resume live" restarts it', true);
  await page.close();
}

// Offline: load once online (the service worker stores the app), then go offline and reload.
async function phase4(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // Same stand-in answers as the other tests, but on the context so they also apply after reloads.
  const { routeAll } = await import('./helpers.mjs');
  await routeAll(context, page, { traffic: TRAFFIC });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('s')) return;
    sessionStorage.setItem('s', '1');
    localStorage.setItem('ls:planner:tab', '"planner"');
    localStorage.setItem('ls:planner:positions', JSON.stringify({ WSSS: [{ id: 'a', name: 'East fence', lat: 1.36219, lon: 103.993297 }] }));
  });
  await page.goto(BASE);
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('METAR WSSS'));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now the service worker controls the page
  await page.waitForSelector('.pl-pos');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  check('[iPhone] no sideways scrolling at 390 px', width <= 390, `${width}px`);
  check('[iPhone] airport search box is at least 16 px (no zoom-on-focus in Safari)', parseFloat(await page.$eval('#plQ', (e) => getComputedStyle(e).fontSize)) >= 16);

  // Go offline: the network is cut and every outside service fails.
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.route(/^https?:\/\/(?!localhost)/, (r) => r.abort('internetdisconnected'));
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.pl-pos', { timeout: 10000 });
  check('[offline] planner opens from the cache with Changi and your position', (await page.textContent('#plAirportInfo')).includes('Singapore Changi') && (await page.textContent('#plPosList')).includes('East fence'));
  check('[offline] light chart still drawn (sun maths on the device, saved forecast)', (await page.locator('#plLight .pl-chart path').count()) === 24);
  await page.waitForFunction(() => document.querySelector('#plWind')?.textContent.includes('Offline'));
  check('[offline] last METAR shown with an offline note', (await page.textContent('#plWind')).includes('METAR WSSS 221130Z'));
  await page.waitForFunction(() => document.querySelector('#plTraffic')?.textContent.includes('could not load'));
  check('[offline] live traffic says it could not load', (await page.textContent('#plTraffic')).includes('no connection'));
  await page.click('#tabLight');
  check('[offline] the Light tab still works', (await page.locator('#sunStats .stat').count()) > 0);
  check('[offline] no JavaScript errors', page.errors.length === 0, page.errors.join(' | '));
  await context.close();
}

// Cloud, visibility and suggestions
async function conditions(browser) {
  let page = await plannerWithPosition(browser, { metar: 'real' });
  await page.waitForFunction(() => document.querySelector('#plCond')?.textContent.includes('Measured now'));
  let c = await page.textContent('#plCond');
  check('[conditions] forecast for the current hour: cloud layers, visibility, rain chance', c.includes('Forecast (Open-Meteo)') && c.includes('Visibility') && c.includes('Rain chance') && (await page.locator('#plCond .pl-cl b').count()) === 3);
  check('[conditions] measured now from the METAR: 10+ km, few 1,800 ft, broken 30,000 ft', c.includes('Measured now (METAR WSSS)') && c.includes('10+ km') && c.includes('Few 1,800 ft, Broken 30,000 ft'));
  check('[conditions] suggestions with their reasons, labelled as an estimate', (await page.locator('#plCond .pl-advice li').count()) >= 2 && c.includes('Best light today') && (await page.textContent('#plCond .pl-est')) === 'Estimate');
  check('[conditions] cloud strip under the light chart (24 hours)', (await page.locator('#plLight .pl-bar rect[opacity]').count()) === 24);
  check('[conditions] numbers table has visibility and rain columns', (await page.textContent('#plNumbers thead')).includes('Visibility') && (await page.textContent('#plNumbers thead')).includes('Rain chance'));
  // Tap the 3 PM bar: the card switches to that hour (forecast only, no METAR) and cloudy-afternoon advice
  await page.locator('#plLight .pl-bar[data-h="15"]').click({ force: true });
  c = await page.textContent('#plCond');
  check('[conditions] tapping a bar picks that hour', /For 3:00\s?PM/.test(c) && (await page.locator('#plLight .pl-bar.is-sel').getAttribute('data-h')) === '15', c.slice(0, 120));
  check('[conditions] 3 PM: backlit from the east side, clouds hide the sun', c.includes('Backlit from your position') && c.includes('Clouds will probably hide the sun') && !c.includes('Measured now'));
  check('[conditions] no JavaScript errors', page.errors.length === 0, page.errors.join(' | '));
  await page.close();

  // Thunderstorm and 3 km visibility in the METAR: safety first
  page = await plannerWithPosition(browser, { metar: 'storm' });
  await page.waitForFunction(() => document.querySelector('#plCond')?.textContent.includes('Measured now'));
  const first = await page.textContent('#plCond .pl-advice li:first-child');
  check('[conditions] storm in the METAR: safety suggestion comes first', first.includes('Thunderstorms: stay safe first') && first.includes('measured by the METAR'));
  c = await page.textContent('#plCond');
  check('[conditions] measured 3 km haze beats the forecast\'s 20 km; TEMPO ignored', c.includes('Visibility: 3.0 km') && c.includes('Hazy: distant aircraft') && c.includes('TSRA') && !c.includes('+TSRA'));
  await page.close();
}

export const extra = [phase2, phase3, phase4, conditions];
