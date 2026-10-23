// e2e.mjs: drives the real page in headless Chromium. Run with:  npm run test:e2e
// Network answers are replaced with fixed data (see helpers.mjs), so the test runs offline.
import { chromium, BASE, check, results, start, newPage } from './helpers.mjs';
import { extra } from './e2e-more.mjs';

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

{
  const server = await start();
  const browser = await chromium.launch();
  try {
    for (const run of [...phases, ...extra]) await run(browser);
  } finally {
    await browser.close();
    server.kill();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}
