// conditionsCard.js
// "Conditions and suggestions" for the hour you pick on the light chart (tap a bar):
//   - forecast for that hour (Open-Meteo via Light Scout): cloud low/mid/high, visibility, rain chance, weather
//   - for the current hour, what the latest METAR actually measured (visibility, cloud, weather)
//   - suggestions from planner/advice.js, each with the numbers behind it (ESTIMATES)

import { CONFIG } from './config.js';
import { t } from './i18n.js';
import { advise } from './advice.js';
import { parseConditions } from './sources/metar-awc.js';

const LS = window.LightScout;
const esc = LS.esc;
const HOUR = 3600e3;

export function conditionsCard(ctx) {
  const km = (m) => (m >= 10000 ? '10+ km' : `${(m / 1000).toFixed(m < 5000 ? 1 : 0)} km`);
  const cover = { FEW: t('cvFEW'), SCT: t('cvSCT'), BKN: t('cvBKN'), OVC: t('cvOVC'), VV: t('cvVV') };

  function render(_, plan) {
    const el = document.getElementById('plCond');
    if (!el) return;
    el.hidden = false;
    const head = `<div class="card-head"><h2>${esc(t('condTitle'))}</h2><span class="tag pl-est">${esc(t('est'))}</span></div>`;
    if (!plan) { el.innerHTML = head + `<p class="err">${esc(t('noPositions'))}</p>`; return; }
    const hour = plan.hours[ctx.selectedHour] ?? plan.hours[12];
    const isNow = Date.now() >= hour.t && Date.now() < hour.t + HOUR;
    const metar = ctx.metar; // set by windCard.js
    const observed = isNow && metar?.raw ? parseConditions(metar.raw) : null;
    const wx = hour.wx;

    // --- forecast for the hour ---
    const bar = (label, v) => `<span>${esc(label)}</span><b><i style="width:${v ?? 0}%"></i></b><span class="mono">${v == null ? '—' : v + '%'}</span>`;
    let html = head + `<p class="pl-note">${esc(t('condFor', { time: ctx.fmt.time(hour.t) + '–' + ctx.fmt.time(hour.t + HOUR) }))} · ${esc(t('tapBar'))}</p>`;
    if (wx) {
      html += `<div class="pl-cond"><div><div class="label">${esc(t('fcTitle'))}</div>` +
        `<div class="cl pl-cl">${bar(t('cLow'), wx.low)}${bar(t('cMid'), wx.mid)}${bar(t('cHigh'), wx.high)}</div></div>` +
        `<div class="stats"><div class="stat"><div class="label">${esc(t('visibility'))}</div><div class="v">${wx.vis == null ? '—' : esc(km(wx.vis))}</div></div>` +
        `<div class="stat"><div class="label">${esc(t('rainChance'))}</div><div class="v">${wx.pp ?? 0}<small>%</small></div></div>` +
        `<div class="stat" style="grid-column:1/-1"><div class="label">${esc(t('weather'))}</div><div class="v"><small>${esc(LS.wmo(wx.code) ?? '—')}</small></div></div></div></div>`;
    } else {
      html += `<p class="notice">${esc(t('noForecastHour'))}</p>`;
    }
    // --- what the METAR measured (current hour only) ---
    if (observed) {
      const clouds = observed.cavok ? 'CAVOK' : observed.clouds.length
        ? observed.clouds.map((c) => `${cover[c.cover] ?? c.cover} ${c.baseFt.toLocaleString(LS.loc())} ft${c.type ? ' ' + c.type : ''}`).join(', ') : t('noCloudRep');
      html += `<div class="pl-obs"><div class="label">${esc(t('obsTitle', { station: metar.station ?? '' }))}</div>` +
        `<p>${esc(t('visibility'))}: <b>${observed.visibilityM == null ? '—' : esc(km(observed.visibilityM))}</b> · ${esc(t('cloudObs'))}: <b>${esc(clouds)}</b>` +
        (observed.weather.length ? ` · ${esc(t('weather'))}: <b>${esc(observed.weather.join(' '))}</b>` : '') + '</p></div>';
    }

    // --- suggestions ---
    const items = advise({ hour, plan, wind: ctx.windEstimate, observed, cfg: CONFIG.advice });
    const fmtVars = (v) => ({ ...v, from: v.from != null ? ctx.fmt.time(v.from) : '', to: v.to != null ? ctx.fmt.time(v.to) : '',
      rating: v.rating ? t('r_' + v.rating) : '', view: v.view ? t('view_' + v.view) : '', src: v.src ? t('src_' + v.src) : '' });
    html += `<div class="label" style="margin-top:4px">${esc(t('suggestions'))}</div><ul class="pl-advice">` +
      items.map((a) => `<li class="tone-${a.tone === 'info' ? 'info' : a.tone}"><b>${esc(t(a.key, fmtVars(a.vars)))}</b><small>${esc(t(a.key + '_why', fmtVars(a.vars)))}</small></li>`).join('') +
      `</ul><p class="pl-note">${esc(t('adviceNote'))}</p>`;
    el.innerHTML = html;
  }

  return { render };
}
