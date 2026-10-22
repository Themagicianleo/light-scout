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

export const extra = [phase2];
