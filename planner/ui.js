// ui.js
// The "Plane spotting" tab: airport, your positions on a map, geometry, and the hourly light chart.
// The wind card (windCard.js) and traffic card (trafficCard.js) plug in through the same `ctx`.
// Reuses Light Scout's own functions (window.LightScout): sunPos, store, esc, time formatting,
// time zones and the Open-Meteo forecast. Nothing from the network is inserted as raw HTML.

import { CONFIG } from './config.js';
import { t, cardinal } from './i18n.js';
import { loadAirports, findAirport, searchAirports, airportsMeta } from './airports.js';
import { makePositions } from './positions.js';
import { makeProjection, runwayRelation } from './geo.js';
import { dayPlan } from './plan.js';
import { lightChartSvg, legendHtml, lightTableHtml } from './lightChart.js';
import { createMap } from './map.js';

const LS = window.LightScout;
const $ = (id) => document.getElementById(id);
const esc = LS.esc;
const positions = makePositions(LS.store);

// Planner state (what's on screen). Saved choices go through LS.store.
const P = {
  airport: null,
  runwayPick: LS.store.get('planner:runway', {}), // { [airport]: runway name } when chosen by hand
  dayOffset: 0,
  forecast: null, // Open-Meteo answer for the airport (via Light Scout's fetchForecast)
  forecastFor: null,
  forecastSavedAt: null,
  tz: null, // the airport's time zone, from the forecast
  showNumbers: false,
  selHour: null, // hour picked on the light chart (index 0-23), or null = now / best time
};
let map = null;
const plugins = []; // cards added later (wind, traffic): { render(ctx) }

// Everything the cards need about the current selection.
export const ctx = {
  get airport() { return P.airport; },
  get position() { return P.airport ? positions.selected(P.airport.ident) : null; },
  get runway() { return currentRunway(); },
  get tz() { return P.tz || LS.DEVICE_TZ; },
  fmt: { time: (ms) => LS.fmtTime(ms, ctx.tz), hour: (ms) => LS.fmtHour(ms, ctx.tz), esc },
  rerender: () => renderAll(),
  get selectedHour() { return selectedHour(); },
  metar: null, // latest METAR, shared by windCard.js
  windEstimate: null, // its runway estimate, shared by windCard.js
};
// The hour shown in the Conditions card: the one you tapped, else now (today), else the best time, else noon.
function selectedHour() {
  if (P.selHour != null) return P.selHour;
  if (P.dayOffset === 0) return Math.min(23, Math.floor((Date.now() - dayStart()) / 3600e3));
  const plan = lastPlan;
  return plan?.best ? Math.floor((plan.best.start - dayStart()) / 3600e3) : 12;
}
let lastPlan = null;
export function addCard(card) {
  plugins.push(card);
}

// ---------- skeleton (built once) ----------
function skeleton(root) {
  root.innerHTML = `
  <section class="card pl-safety" role="note">
    <div class="card-head"><h2>⚠︎ <span data-pl="safetyTitle"></span></h2></div>
    <p data-pl="safety"></p>
  </section>
  <section class="card" id="plAirportCard">
    <div class="card-head"><h2 data-pl="airportTitle"></h2><span class="label">OurAirports</span></div>
    <div class="pl-search"><input id="plQ" type="search" autocomplete="off" data-pl-ph="airportPh"><div class="results" id="plResults"></div></div>
    <div id="plAirportInfo"></div>
    <div><div class="label" data-pl="runway"></div><div class="chips" id="plRunways" style="margin-top:6px"></div></div>
    <div id="plRunwayNote"></div>
  </section>
  <section class="card" id="plPosCard">
    <div class="card-head"><h2 data-pl="positionsTitle"></h2></div>
    <div class="pl-map" id="plMap"></div>
    <div class="chips" id="plPosList"></div>
    <div class="pl-actions">
      <button class="iconbtn" id="plAddTap" data-pl="addTap"></button>
      <button class="iconbtn" id="plMyLoc" data-pl="myLoc"></button>
      <button class="iconbtn" id="plFromSaved" data-pl="fromSaved"></button>
      <button class="iconbtn" id="plCoords" data-pl="coords"></button>
    </div>
    <div class="chips" id="plSaved" hidden></div>
    <div id="plPosEdit"></div>
    <p class="pl-note" data-pl="mapNote"></p>
  </section>
  <section class="card" id="plGeo"></section>
  <section class="card" id="plLight"></section>
  <section class="card" id="plCond" hidden></section>
  <section class="card" id="plWind" hidden></section>
  <section class="card" id="plTraffic" hidden></section>
  <p class="pl-credits" id="plCredits"></p>`;
}

function applyText() {
  document.querySelectorAll('[data-pl]').forEach((el) => { el.textContent = t(el.dataset.pl); });
  document.querySelectorAll('[data-pl-ph]').forEach((el) => { el.placeholder = t(el.dataset.plPh); el.setAttribute('aria-label', t(el.dataset.plPh)); });
}

// ---------- airport ----------
async function setAirport(code) {
  const a = findAirport(code);
  if (!a) return;
  P.airport = a;
  LS.store.set('planner:airport', a.ident);
  P.tz = LS.store.get('planner:tz', {})[a.ident] ?? null;
  $('plQ').value = '';
  $('plResults').innerHTML = '';
  map?.showAirport(a, currentRunway()?.name);
  renderAll();
  loadForecast();
  plugins.forEach((c) => c.airportChanged?.(ctx));
}

function renderAirport() {
  const a = P.airport;
  if (!a) return;
  const codes = [a.icao || a.ident, a.iata].filter(Boolean).join(' / ');
  $('plAirportInfo').innerHTML = `<div class="pl-airport-name">${esc(a.name)}</div><div class="place-meta"><span>${esc(codes)}</span>` +
    `<span>${esc([a.city, a.country].filter(Boolean).join(', '))}</span><span>${a.runways.length} × ${esc(t('runway'))}</span>` +
    `<span class="mono">${a.lat.toFixed(4)}, ${a.lon.toFixed(4)}</span></div>`;
  const cur = currentRunway();
  $('plRunways').innerHTML = a.runways.map((r) => `<button class="chip" data-rw="${esc(r.name)}" aria-pressed="${r.name === cur?.name}">${esc(r.name)}</button>`).join('');
  const notes = [];
  if (cur?.headingMismatch) notes.push(t('mismatch', { rw: cur.name, h: cur.leHeadingT, c: cur.computedBearing.toFixed(0) }));
  if (cur?.headingFromCoords) notes.push(t('headingFromCoords'));
  $('plRunwayNote').innerHTML = notes.map((n) => `<p class="notice">${esc(n)}</p>`).join('');
}

// The runway you picked, or else the one nearest your selected position, or else the longest.
function currentRunway() {
  const a = P.airport;
  if (!a) return null;
  const picked = a.runways.find((r) => r.name === P.runwayPick[a.ident]);
  if (picked) return picked;
  const pos = positions.selected(a.ident);
  if (pos) {
    const proj = makeProjection(a.lat, a.lon);
    return [...a.runways].sort((x, y) => runwayRelation(proj, x, pos.lat, pos.lon).distToRunwayM - runwayRelation(proj, y, pos.lat, pos.lon).distToRunwayM)[0];
  }
  return [...a.runways].sort((x, y) => (y.lengthFt ?? 0) - (x.lengthFt ?? 0))[0];
}

// ---------- forecast (reuses Light Scout's fetchForecast; keeps a copy for offline) ----------
async function loadForecast() {
  const a = P.airport;
  if (!a || P.forecastFor === a.ident) return;
  try {
    const j = await LS.fetchForecast(a.lat, a.lon);
    P.forecast = j;
    P.forecastSavedAt = null;
    LS.store.set('planner:wx', { ident: a.ident, at: Date.now(), j });
  } catch {
    const saved = LS.store.get('planner:wx', null);
    P.forecast = saved && saved.ident === a.ident ? saved.j : null;
    P.forecastSavedAt = saved && saved.ident === a.ident ? saved.at : null;
  }
  P.forecastFor = a.ident;
  if (P.forecast?.timezone && LS.validTz(P.forecast.timezone)) {
    P.tz = P.forecast.timezone;
    LS.store.set('planner:tz', { ...LS.store.get('planner:tz', {}), [a.ident]: P.tz });
  }
  renderAll();
}

// ---------- positions ----------
function renderPositions() {
  const a = P.airport;
  const list = positions.list(a.ident);
  const sel = positions.selected(a.ident);
  $('plPosList').innerHTML = list.length
    ? list.map((p) => `<button class="chip" data-pos="${esc(p.id)}" aria-pressed="${p.id === sel?.id}">${esc(p.name)}</button>`).join('')
    : `<p class="err">${esc(t('noPositions'))}</p>`;
  $('plPosEdit').innerHTML = sel
    ? `<div class="pl-posedit"><span class="mono">${sel.lat.toFixed(5)}, ${sel.lon.toFixed(5)}</span>` +
      `<button class="iconbtn" data-act="rename">${esc(t('rename'))}</button><button class="iconbtn" data-act="remove">${esc(t('remove'))}</button></div>`
    : '';
  map?.showPositions(list, sel?.id);
}

function addPosition(lat, lon, suggestedName) {
  const a = P.airport;
  const n = positions.list(a.ident).length + 1;
  const name = prompt(t('namePrompt'), suggestedName || t('posName', { n }));
  if (name === null) return; // cancelled
  positions.add(a.ident, { name: name.trim() || t('posName', { n }), lat, lon });
  renderAll();
}

function wirePositions() {
  $('plAddTap').onclick = () => {
    $('plAddTap').textContent = t('addTapOn');
    map.setTapMode(true);
  };
  $('plMyLoc').onclick = () => {
    if (!navigator.geolocation || !window.isSecureContext) return alert(t('locErr'));
    navigator.geolocation.getCurrentPosition((p) => addPosition(p.coords.latitude, p.coords.longitude, t('myLoc')), () => alert(t('locErr')), { enableHighAccuracy: true, timeout: 20000 });
  };
  $('plCoords').onclick = () => {
    const text = prompt(t('coordsPrompt'));
    if (text == null) return;
    const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m || Math.abs(+m[1]) > 90 || Math.abs(+m[2]) > 180) return alert(t('badCoords'));
    addPosition(+m[1], +m[2]);
  };
  // Light Scout's saved places can become spotting positions.
  $('plFromSaved').onclick = () => {
    const box = $('plSaved');
    const favs = LS.favs();
    box.hidden = !box.hidden;
    box.innerHTML = favs.length ? favs.map((f, i) => `<button class="chip" data-fav="${i}">${esc(f.name)}</button>`).join('') : `<p class="err">${esc(t('noSaved'))}</p>`;
  };
  $('plSaved').onclick = (e) => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    const f = LS.favs()[+b.dataset.fav];
    $('plSaved').hidden = true;
    addPosition(f.lat, f.lng, f.name);
  };
  $('plPosList').onclick = (e) => {
    const b = e.target.closest('[data-pos]');
    if (!b) return;
    positions.select(P.airport.ident, b.dataset.pos);
    renderAll();
  };
  $('plPosEdit').onclick = (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const sel = positions.selected(P.airport.ident);
    if (!act || !sel) return;
    if (act === 'rename') {
      const name = prompt(t('namePrompt'), sel.name);
      if (name && name.trim()) positions.update(P.airport.ident, sel.id, { name: name.trim().slice(0, 60) });
    }
    if (act === 'remove' && confirm(t('removeConfirm', { name: sel.name }))) positions.remove(P.airport.ident, sel.id);
    renderAll();
  };
}

// ---------- geometry card (calculated) ----------
const km = (m) => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m) + ' m');

function renderGeometry(plan) {
  const el = $('plGeo');
  const head = `<div class="card-head"><h2>${esc(t('geoTitle'))}</h2><span class="tag pl-calc">${esc(t('calc'))}</span></div>`;
  if (!plan) { el.innerHTML = head + `<p class="err">${esc(t('noPositions'))}</p>`; return; }
  const { rel } = plan;
  const r = ctx.runway;
  // Which runway end is "A" (le) and which is "B" (he); offset > 0 means left of planes flying A -> B.
  const left = rel.offsetM > 0 ? r.leIdent : r.heIdent, right = rel.offsetM > 0 ? r.heIdent : r.leIdent;
  const along = rel.beyond
    ? t('beyond', { end: rel.beyond === 'A' ? r.leIdent : r.heIdent, d: km(rel.distToRunwayM) })
    : t('alongText', { end: r.leIdent, d: km(rel.alongM) });
  const stat = (l, v) => `<div class="stat"><div class="label">${esc(l)}</div><div class="v"><small>${esc(v)}</small></div></div>`;
  el.innerHTML = head + `<div class="stats">` +
    stat(t('distCentre'), km(rel.distToCentrelineM)) +
    stat(t('side'), t('sideText', { a: left, b: right })) +
    stat(t('along'), along) +
    stat(t('face'), t('faceText', { deg: Math.round(rel.cameraToRunwayDeg), card: cardinal(rel.cameraToRunwayDeg) })) +
    stat(t('runwayLen'), t('lenText', { m: Math.round(rel.lengthM).toLocaleString(LS.loc()), ft: (r.lengthFt ?? '?').toLocaleString(LS.loc()) })) +
    `</div>` + (plan.underPath ? `<p class="notice">${esc(t('underPath'))}</p>` : '');
}

// ---------- light card (estimate) ----------
function dayStart() {
  const z = ctx.tz;
  const p = LS.partsIn(z, Date.now());
  const ymd = LS.ymdAdd({ y: p.year, m: p.month, d: p.day }, P.dayOffset);
  return LS.zonedMidnight(ymd.y, ymd.m, ymd.d, z);
}

// One forecast hour (clouds, visibility, rain chance, weather code) from Light Scout's wxFrom().
const weatherAt = (ms) => LS.wxFrom(P.forecast, ms);

function buildPlan() {
  const a = P.airport, pos = ctx.position, r = ctx.runway;
  if (!a || !pos || !r) return null;
  return dayPlan({ airport: a, runway: r, position: pos, dayStart: dayStart(), sunPos: LS.sunPos, weatherAt, cfg: CONFIG.light });
}

function renderLight(plan) {
  const el = $('plLight');
  const cfg = CONFIG.light;
  const dayLabel = P.dayOffset === 0 ? t('today') : P.dayOffset === 1 ? t('tomorrow') : t('dayN', { n: P.dayOffset });
  const head = `<div class="card-head"><h2>${esc(t('lightTitle'))}</h2><span class="tag pl-est">${esc(t('est'))}</span></div>` +
    `<div class="daynav"><button class="iconbtn" data-day="-1" ${P.dayOffset === 0 ? 'disabled' : ''} aria-label="−1">‹</button>` +
    `<div class="day">${esc(dayLabel)}<small>${esc(new Intl.DateTimeFormat(LS.loc(), { weekday: 'long', month: 'long', day: 'numeric', timeZone: ctx.tz }).format(new Date(dayStart() + 12 * 3600e3)))}</small></div>` +
    `<button class="iconbtn" data-day="1" ${P.dayOffset >= 6 ? 'disabled' : ''} aria-label="+1">›</button></div>`;
  if (!plan) { el.innerHTML = head + `<p class="err">${esc(t('noPositions'))}</p>`; return; }
  const best = plan.best;
  const bestText = best ? t('best', { from: ctx.fmt.time(best.start), to: ctx.fmt.time(best.end), rating: t('r_' + best.rating), score: best.peak }) : t('noBest');
  const dirs = plan.dirs.map((d) => `<div class="row"><span class="dot" style="background:var(--muted)"></span>` +
    `<span class="name">${esc(t('dirTitle', { ident: d.ident, deg: Math.round(d.travelDeg) }))}<small>${esc(t('view_' + d.view))}</small></span>` +
    `<span class="val" data-likely="${esc(d.ident)}"></span></div>`).join('');
  const notes = [];
  if (!plan.hours.some((h) => h.clouds)) notes.push(t('noCloud'));
  notes.push(P.tz ? t('tzNote', { tz: P.tz.replace(/_/g, ' ') }) : t('tzDevice'));
  el.innerHTML = head +
    `<p class="pl-best"><b>${esc(bestText)}</b></p>` +
    lightChartSvg(plan, ctx.fmt, P.dayOffset === 0 ? Date.now() : null, selectedHour()) + legendHtml() +
    `<div class="rows">${dirs}</div><p class="pl-note">${esc(t('sameLight'))}</p>` +
    `<p class="pl-note">${esc(t('lightNote', { good: cfg.goodAngleDeg, lo: cfg.lowAltDeg, hi: cfg.highAltDeg }))}</p>` +
    notes.map((n) => `<p class="pl-note">${esc(n)}</p>`).join('') +
    `<details ${P.showNumbers ? 'open' : ''} id="plNumbers"><summary>${esc(t('showNumbers'))}</summary>${lightTableHtml(plan, ctx.fmt)}</details>`;
  $('plNumbers').ontoggle = (e) => { P.showNumbers = e.target.open; };
}

// ---------- credits ----------
function renderCredits() {
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${esc(text)}</a>`;
  $('plCredits').innerHTML = esc(t('credits', { oa: '\u0001', awc: '\u0002', om: '\u0003', ads: '\u0004', osm: '\u0005' }))
    .replace('\u0001', link('https://ourairports.com/data/', 'OurAirports'))
    .replace('\u0002', link('https://aviationweather.gov/data/api/', 'NOAA Aviation Weather Center'))
    .replace('\u0003', link('https://open-meteo.com', 'Open-Meteo'))
    .replace('\u0004', link('https://adsb.lol', 'adsb.lol') + ' (' + link('https://opendatacommons.org/licenses/odbl/1-0/', 'ODbL 1.0') + ')')
    .replace('\u0005', link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'));
  const meta = airportsMeta();
  if (meta?.builtAt) $('plCredits').append(` (OurAirports data ${meta.builtAt.slice(0, 10)})`);
}

// ---------- render everything ----------
function renderAll() {
  if (!P.airport) return;
  applyText();
  renderAirport();
  renderPositions();
  const plan = buildPlan();
  lastPlan = plan;
  renderGeometry(plan);
  renderLight(plan);
  // Map extras: the runway in use for the plan, and a line to the centre line plus the sun's direction now.
  map?.showAirport(P.airport, ctx.runway?.name);
  const pos = ctx.position;
  const sunNow = pos ? LS.sunPos(Date.now(), pos.lat, pos.lon) : null;
  map?.showSightline(pos, plan?.rel.Q, sunNow && sunNow.alt > 0 ? sunNow.az : null);
  renderCredits();
  plugins.forEach((c) => c.render(ctx, plan));
}

// ---------- start ----------
let started = false;
export async function startPlanner(root) {
  if (started) { map?.resize(); return; }
  started = true;
  skeleton(root);
  applyText();
  try {
    await loadAirports();
  } catch {
    $('plAirportInfo').innerHTML = `<p class="err">${esc(t('airportsErr'))}</p>`;
    started = false;
    return;
  }
  map = createMap($('plMap'), {
    onTap: (lat, lon) => { $('plAddTap').textContent = t('addTap'); addPosition(lat, lon); },
    onMove: (id, lat, lon) => { positions.update(P.airport.ident, id, { lat: +lat.toFixed(6), lon: +lon.toFixed(6) }); positions.select(P.airport.ident, id); renderAll(); },
    onSelect: (id) => { positions.select(P.airport.ident, id); renderAll(); },
  });
  wirePositions();
  // Airport search
  $('plQ').oninput = (e) => {
    const res = searchAirports(e.target.value);
    $('plResults').innerHTML = e.target.value.trim().length < 2 ? '' : res.length
      ? res.map((a) => `<button class="result" data-ap="${esc(a.ident)}"><span>${esc(a.name)}</span><small>${esc([a.icao || a.ident, a.iata, a.city, a.country].filter(Boolean).join(' · '))}</small></button>`).join('')
      : `<div class="err" style="padding:6px 10px">${esc(t('noAirports'))}</div>`;
  };
  $('plResults').onclick = (e) => { const b = e.target.closest('[data-ap]'); if (b) setAirport(b.dataset.ap); };
  $('plRunways').onclick = (e) => {
    const b = e.target.closest('[data-rw]');
    if (!b) return;
    P.runwayPick[P.airport.ident] = b.dataset.rw;
    LS.store.set('planner:runway', P.runwayPick);
    renderAll();
  };
  $('plLight').addEventListener('click', (e) => {
    const bar = e.target.closest('[data-h]');
    if (bar) { // a bar on the chart: show that hour in the Conditions card
      P.selHour = +bar.dataset.h;
      renderAll();
      return;
    }
    const b = e.target.closest('[data-day]');
    if (!b) return;
    P.dayOffset = Math.min(6, Math.max(0, P.dayOffset + +b.dataset.day));
    P.selHour = null;
    renderAll();
  });
  LS.onLang(() => renderAll());
  setInterval(() => { if (document.visibilityState === 'visible' && !root.hidden) renderAll(); }, 60000);
  await setAirport(LS.store.get('planner:airport', CONFIG.defaultAirport));
  map.resize();
}
