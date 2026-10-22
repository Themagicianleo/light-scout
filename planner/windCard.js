// windCard.js
// "Wind and runway in use": latest METAR (via metar-awc.js), headwind/crosswind for every runway end
// (CALCULATED) and the likely end (ESTIMATE). With no usable METAR it says "wind unavailable".
// The last METAR per airport is kept for offline use.

import { CONFIG } from './config.js';
import { t } from './i18n.js';
import { likelyEnd } from './wind.js';
import { latestMetar } from './sources/metar-awc.js';

const LS = window.LightScout;
const esc = LS.esc;

export function windCard(ctx) {
  const state = { metar: undefined, savedAt: null, error: null, for: null, timer: null };

  const stationOf = (a) => a.icao || a.ident;

  async function load() {
    const a = ctx.airport;
    if (!a) return;
    const station = stationOf(a);
    clearTimeout(state.timer);
    try {
      const metar = await latestMetar(station);
      Object.assign(state, { metar, savedAt: null, error: null, for: station });
      const saved = LS.store.get('planner:metar', {});
      saved[station] = { at: Date.now(), metar };
      LS.store.set('planner:metar', saved);
    } catch (err) {
      const saved = LS.store.get('planner:metar', {})[station];
      Object.assign(state, saved ? { metar: saved.metar, savedAt: saved.at } : { metar: null, savedAt: null }, { error: err, for: station });
    }
    if (ctx.airport && stationOf(ctx.airport) === station) ctx.rerender();
    state.timer = setTimeout(load, CONFIG.metar.refreshMinutes * 60e3);
  }

  const ago = (ms) => {
    const min = Math.round((Date.now() - ms) / 60e3);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
  };
  const kt = (v) => `${Math.abs(v).toFixed(0)} kt`;

  function render() {
    const a = ctx.airport;
    const el = document.getElementById('plWind'); // built by ui.js when the tab first opens
    if (!a || !el) return;
    el.hidden = false;
    const station = stationOf(a);
    const head = `<div class="card-head"><h2>${esc(t('windTitle'))}</h2><span class="tag pl-est">${esc(t('est'))}</span></div>`;
    if (state.for !== station) { el.innerHTML = head + `<p class="err">${esc(t('windLoading'))}</p>`; markLikely(null); return; }
    const m = state.metar;
    if (!m || m.speedKt == null) {
      el.innerHTML = head + `<p class="notice">${esc(t('windUnavailable', { station }))}</p>` + (state.error ? `<p class="pl-note">${esc(state.error.message)}</p>` : '');
      markLikely(null);
      return;
    }
    const windText = m.speedKt === 0 ? t('windCalm') : m.dirDeg == null ? t('windVrb', { spd: m.speedKt }) : t('windText', { dir: String(m.dirDeg).padStart(3, '0'), spd: m.speedKt }) + (m.gustKt ? t('gust', { g: m.gustKt }) : '');
    const notes = [];
    if (state.savedAt) notes.push(t('windSaved', { when: ctx.fmt.time(state.savedAt) }));
    if (m.observedMs && Date.now() - m.observedMs > CONFIG.metar.staleMinutes * 60e3) notes.push(t('windOld', { ago: ago(m.observedMs) }));

    // One estimate per runway; parallel runways normally agree.
    const wind = { dirDeg: m.dirDeg, speedKt: m.speedKt, gustKt: m.gustKt };
    const perRunway = a.runways.map((r) => ({ r, est: likelyEnd([{ ident: r.leIdent, headingDeg: r.leTravelDeg }, { ident: r.heIdent, headingDeg: r.heTravelDeg }], wind, CONFIG.wind) }));
    const sel = perRunway.find((x) => x.r.name === ctx.runway?.name) ?? perRunway[0];
    const status = sel.est.status === 'ok' ? t('likely', { ident: sel.est.likely }) : t(sel.est.status);

    const rows = perRunway.flatMap(({ r, est }) => est.rows.map((row) => {
      const likely = est.likely === row.ident;
      const head = row.headwindKt >= 0 ? `${kt(row.headwindKt)}` : `${kt(row.headwindKt)} ${t('tail')}`;
      const cross = Math.abs(row.crosswindKt) < 0.5 ? '0 kt' : `${kt(row.crosswindKt)} ${row.crosswindKt > 0 ? t('fromRight') : t('fromLeft')}`;
      return `<tr class="${likely ? 'is-likely' : ''}"><td>${esc(row.ident)}${likely ? ' ✓' : ''}</td><td>${Math.round(row.headingDeg)}°</td><td>${esc(head)}</td><td>${esc(cross)}</td></tr>`;
    })).join('');

    el.innerHTML = head +
      `<p class="pl-note">${esc(t('metarFrom', { station: m.station ?? station, time: m.observedMs ? ctx.fmt.time(m.observedMs) : '?', ago: m.observedMs ? ago(m.observedMs) : '?' }))}</p>` +
      `<p class="pl-raw">${esc(m.raw)}</p>` +
      notes.map((n) => `<p class="notice">${esc(n)}</p>`).join('') +
      `<div class="stats"><div class="stat"><div class="label">${esc(t('wind'))}</div><div class="v"><small>${esc(windText)}</small></div></div>` +
      `<div class="stat"><div class="label">${esc(ctx.runway?.name ?? '')}</div><div class="v"><small class="${sel.est.status === 'ok' ? 'pl-likely' : ''}">${esc(status)}</small></div></div></div>` +
      (rows ? `<div class="pl-tablewrap"><table class="pl-table"><thead><tr><th>${esc(t('end'))}</th><th>${esc(t('heading'))}</th><th>${esc(t('head'))}</th><th>${esc(t('cross'))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : '') +
      `<p class="pl-note">headwind = speed × cos(wind − heading); crosswind = speed × sin(wind − heading). ${esc(t('windWhy'))}</p>` +
      `<p class="pl-note">${esc(t('windRelay'))}</p>`;
    markLikely(sel.est.status === 'ok' ? sel.est.likely : null);
  }

  // Put "likely in use (estimate)" next to the matching direction in the light card.
  function markLikely(ident) {
    document.querySelectorAll('#plLight [data-likely]').forEach((span) => {
      const on = span.dataset.likely === ident;
      span.textContent = on ? t('likely', { ident }) : '';
      span.classList.toggle('pl-likely', on);
      span.closest('.row')?.classList.toggle('is-likely', on);
    });
  }

  return { render, airportChanged: () => { state.for = null; load(); } };
}
