// lightChart.js
// The hourly light chart (SVG) and its table. One bar per hour; height = score, colour = rating.
// All text that came from data is escaped with Light Scout's esc().

import { t } from './i18n.js';

const COLORS = { good: 'var(--good)', fair: 'var(--meh)', poor: 'var(--bad)', none: 'var(--line)' };

// plan: from plan.dayPlan(); fmt: { hour(t), time(t), esc }; now: ms or null (only for today)
export function lightChartSvg(plan, fmt, now) {
  const W = 480, top = 6, base = 86, colW = W / 24;
  let svg = `<svg class="pl-chart" viewBox="0 0 ${W} 104" role="img" aria-label="${fmt.esc(t('lightTitle'))}">`;
  // light gridlines at 40 and 70 (the fair / good thresholds), kept faint so the bars lead
  for (const v of [40, 70, 100]) {
    const y = base - (base - top) * v / 100;
    svg += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="${v === 100 ? '0' : '2 4'}" opacity="${v === 100 ? 0 : 1}"/>`;
  }
  plan.hours.forEach((h, i) => {
    const x = i * colW + 2, w = colW - 4; // 2px gap on each side of every bar
    const r = h.light.rating;
    const height = r === 'none' ? 2 : Math.max(3, (base - top) * h.light.score / 100);
    const tip = `${fmt.hour(h.t)} · ${t('r_' + r)}${r === 'none' ? '' : ` ${h.light.score} · ${t('lighting_' + h.light.lighting)}`} · ${t('sunAlt')} ${h.sun.alt.toFixed(0)}° · ${t('sunAz')} ${h.sun.az.toFixed(0)}°` +
      (h.clouds ? ` · ${t('cloud')} ${h.clouds.low}/${h.clouds.mid}/${h.clouds.high}%` : '');
    // A tall invisible hit area per hour makes the tooltip easy to reach on a phone.
    svg += `<g><title>${fmt.esc(tip)}</title><rect x="${i * colW}" y="0" width="${colW}" height="${base}" fill="transparent"/>` +
      `<path d="${roundedTop(x, base - height, w, height, 3)}" fill="${COLORS[r]}"/></g>`;
    // Hour labels every 3 hours; the first one starts at the left edge so it isn't cut off.
    if (i % 3 === 0) svg += `<text x="${i === 0 ? 0 : i * colW + colW / 2}" y="100" text-anchor="${i === 0 ? 'start' : 'middle'}" font-size="10" fill="var(--muted)">${fmt.esc(fmt.hour(h.t))}</text>`;
  });
  svg += `<line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
  if (now != null) {
    const start = plan.hours[0].t, x = (now - start) / 864e5 * W;
    if (x >= 0 && x <= W) svg += `<line x1="${x}" x2="${x}" y1="0" y2="${base + 2}" stroke="var(--fg)" stroke-width="1.5"/>`;
  }
  return svg + '</svg>';
}

// A bar with rounded top corners, flat on the baseline.
function roundedTop(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function legendHtml() {
  return '<div class="legend pl-legend">' + ['good', 'fair', 'poor', 'none'].map((r) => `<span><i style="background:${COLORS[r]}"></i>${t('r_' + r)}</span>`).join('') + '</div>';
}

// Every number behind the chart, hour by hour.
export function lightTableHtml(plan, fmt) {
  const rows = plan.hours.map((h) => `<tr><td>${fmt.esc(fmt.hour(h.t))}</td><td>${h.sun.az.toFixed(0)}°</td><td>${h.sun.alt.toFixed(1)}°</td>` +
    `<td>${h.sun.alt > 0 ? h.light.delta + '° · ' + t('lighting_' + h.light.lighting) : '—'}</td>` +
    `<td>${h.clouds ? `${h.clouds.low}/${h.clouds.mid}/${h.clouds.high}%` : '—'}</td><td><b>${h.light.rating === 'none' ? '—' : h.light.score}</b> ${t('r_' + h.light.rating)}</td></tr>`).join('');
  return `<div class="pl-tablewrap"><table class="pl-table"><thead><tr><th>${t('hour')}</th><th>${t('sunAz')}</th><th>${t('sunAlt')}</th><th>${t('angle')}</th><th>${t('cloud')}</th><th>${t('score')}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
