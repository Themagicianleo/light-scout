// trafficCard.js
// "Live traffic": aircraft lined up with a runway (arriving / departing) near the airport, with an
// ESTIMATED time to the threshold. Polls gently and only while you're looking:
//   every CONFIG.traffic.pollSeconds, only when the planner tab and the page are visible,
//   and pauses after CONFIG.traffic.pauseAfterMinutes until you press "Resume live".

import { CONFIG } from './config.js';
import { t } from './i18n.js';
import { classify } from './traffic.js';
import * as adsbLol from './sources/traffic-adsblol.js';
import * as airplanesLive from './sources/traffic-airplaneslive.js';

const PROVIDERS = { adsbLol, airplanesLive };
const LS = window.LightScout;
const esc = LS.esc;

export function trafficCard(ctx) {
  const provider = PROVIDERS[CONFIG.traffic.provider] ?? adsbLol;
  const state = { result: null, error: null, updated: null, for: null, liveSince: Date.now(), paused: false, timer: null, busy: false };
  const cfg = CONFIG.traffic;

  const visible = () => document.visibilityState === 'visible' && !document.getElementById('viewPlanner')?.hidden;

  async function poll() {
    clearTimeout(state.timer);
    const a = ctx.airport;
    if (!a) return;
    if (Date.now() - state.liveSince > cfg.pauseAfterMinutes * 60e3) { state.paused = true; render(); return; }
    if (visible() && !state.busy) {
      state.busy = true;
      try {
        const list = await provider.aircraftNear(a.lat, a.lon, cfg.radiusNm);
        if (ctx.airport?.ident === a.ident) Object.assign(state, { result: classify(list, a, cfg), error: null, updated: Date.now(), for: a.ident });
      } catch (err) {
        Object.assign(state, { error: err, for: a.ident }); // keep the last list on screen
      } finally {
        state.busy = false;
      }
      render();
    }
    state.timer = setTimeout(poll, cfg.pollSeconds * 1000);
  }

  function resume() {
    Object.assign(state, { paused: false, liveSince: Date.now() });
    poll();
  }

  function row(item) {
    const ac = item.ac;
    const name = ac.callsign ?? ac.registration ?? ac.hex;
    const alt = ac.altFt === null ? '?' : `${ac.altFt.toLocaleString(LS.loc())} ft`;
    const sub = t('atDist', { d: item.distNm.toFixed(1), alt, gs: ac.gsKt === null ? '?' : Math.round(ac.gsKt) });
    const label = item.kind === 'arrival' ? t('arriving', { ident: item.ident }) : t('departing', { ident: item.ident });
    const eta = item.etaMin == null ? '' : item.etaMin < 1 ? t('etaSoon') : t('eta', { m: Math.round(item.etaMin) });
    return `<div class="row pl-ac"><span class="dot" style="background:${item.kind === 'arrival' ? 'var(--blue)' : 'var(--muted)'}"></span>` +
      `<span class="name">${esc(name)} ${ac.type ? `<small style="display:inline">${esc(ac.type)}</small>` : ''}<small>${esc(sub)}</small></span>` +
      `<span class="val">${esc(label)}${eta ? `<small>${esc(eta)}</small>` : ''}</span></div>`;
  }

  function render() {
    const el = document.getElementById('plTraffic');
    const a = ctx.airport;
    if (!el || !a) return;
    el.hidden = false;
    const head = `<div class="card-head"><h2>${esc(t('trafficTitle'))}</h2><span class="tag pl-est">${esc(t('est'))}</span></div>` +
      `<p class="pl-note">${esc(t('trafficNote', { r: cfg.radiusNm }))}</p>`;
    let body = '';
    if (state.for === a.ident && state.result) {
      const { arrivals, departures, ground, others } = state.result;
      const items = [...arrivals, ...departures];
      body = items.length ? `<div class="rows">${items.map(row).join('')}</div>` : `<p class="err">${esc(t('noTraffic', { r: cfg.radiusNm }))}</p>`;
      const extra = others + ground;
      if (extra) body += `<p class="pl-note">${esc(t('others', { n: extra }))}</p>`;
    } else if (!state.error) {
      body = `<p class="err">${esc(t('windLoading').replace('METAR', '…'))}</p>`;
    }
    if (state.error) body += `<p class="notice">${esc(t('trafficErr', { e: state.error.message }))}</p>`;
    const status = state.paused
      ? `<div class="pl-posedit"><span>${esc(t('trafficPaused'))}</span><button class="iconbtn" data-act="resume">${esc(t('keepLive'))}</button></div>`
      : state.updated ? `<p class="pl-note">${esc(t('updated', { time: ctx.fmt.time(state.updated) }))} · ${esc(provider.name)}</p>` : '';
    el.innerHTML = head + body + status;
    el.querySelector('[data-act="resume"]')?.addEventListener('click', resume);
  }

  // Resume quickly when you come back to the tab (if not paused).
  document.addEventListener('visibilitychange', () => { if (visible() && !state.paused) poll(); });
  document.getElementById('tabPlanner')?.addEventListener('click', () => { if (!state.paused) setTimeout(poll, 50); });

  return {
    render,
    airportChanged: () => { Object.assign(state, { result: null, error: null, for: null }); resume(); },
  };
}
