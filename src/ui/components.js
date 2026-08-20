import { SECTORS, ENHANCEMENTS, EDITIONS, STAMPS, candleName, baseVolume, candleShape, bodyLabel, bandOf } from '../game/candles.js';
import { BROKERS, RARITY, brokerText, brokerSellValue } from '../game/brokers.js';
import { ALL_CONSUMABLES, consumableText } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';

// ---------------------------------------------------------------------------
// Candle tile — a real candlestick drawn to scale on a chart-panel background.
// ---------------------------------------------------------------------------
export function candleEl(c, opts = {}) {
  const s = SECTORS[c.sector];
  const sealed = c.enhancement === 'obsidian';
  const el = document.createElement('div');
  const g0 = candleShape(c);
  el.className = 'candle ' + (sealed ? 'obsidian' : c.bull ? 'bull' : 'bear')
    + ' sec-' + c.sector + ' band-' + g0.band;
  el.dataset.uid = c.uid;
  if (c.enhancement) el.classList.add('enh-' + c.enhancement);
  if (c.edition) el.classList.add('ed-' + c.edition);
  if (c.debuffed) el.classList.add('debuffed');
  if (c.faceDown && !opts.reveal) el.classList.add('facedown');
  el.style.setProperty('--sc', sealed ? '#6b7480' : s.color);

  const g = candleShape(c);
  const span = g.lower + g.body + g.upper;
  const offset = Math.max(0, (100 - span) / 2);
  const band = bodyLabel(c.body);

  el.innerHTML = `
    <div class="cd-aura"></div>
    <div class="cd-top">
      <span class="cd-num">${sealed ? '—' : c.body}</span>
      <span class="cd-sector">${sealed ? '▪' : s.glyph}</span>
    </div>
    <div class="cd-chart">
      <div class="cd-grid"></div>
      ${sealed ? '<div class="cd-sealed"></div>' : `
        <div class="cd-wick" style="bottom:${offset}%;height:${span}%"></div>
        <div class="cd-real" style="bottom:${offset + g.lower}%;height:${Math.max(4, g.body)}%"><i></i></div>`}
    </div>
    <div class="cd-foot">${sealed ? '▪ OBSIDIAN' : `${c.bull ? '▲' : '▼'} ${band}`}</div>
  `;
  if (c.enhancement && !sealed) {
    const tag = document.createElement('div');
    tag.className = 'cd-tag';
    tag.style.background = ENHANCEMENTS[c.enhancement].color;
    tag.textContent = ENHANCEMENTS[c.enhancement].short;
    el.appendChild(tag);
  }
  if (c.stamp) {
    const st = document.createElement('div');
    st.className = 'cd-stamp';
    st.style.background = STAMPS[c.stamp].color;
    el.appendChild(st);
  }
  if (opts.order != null) {
    const o = document.createElement('div');
    o.className = 'cd-order';
    o.textContent = opts.order;
    el.appendChild(o);
  }
  attachTip(el, () => candleTip(c));
  return el;
}

function candleTip(c) {
  const bits = [];
  if (c.enhancement) {
    const e = ENHANCEMENTS[c.enhancement];
    bits.push(`<div class="tt-special" style="--ec:${e.color}"><b>${e.name}</b><span>${e.desc}</span></div>`);
  }
  const band = bandOf(c.body);
  bits.push(`<div class="tt-body">A <b>${band.name}</b> — its body is worth <em>${baseVolume(c)} Volume</em>, added when it prints.</div>`);
  bits.push(`<div class="tt-body"><b>${SECTORS[c.sector].name} ${SECTORS[c.sector].glyph}</b> — five of one sector on the board prints a Sector Cluster.</div>`);
  if (c.enhancement !== 'obsidian') {
    bits.push(`<div class="tt-body"><b style="color:${c.bull ? 'var(--green)' : 'var(--red)'}">${c.bull ? 'BULL' : 'BEAR'}</b> — agrees with a <b>${c.bull ? 'LONG' : 'SHORT'}</b> call, which is what earns Conviction.</div>`);
  }
  if (c.edition) bits.push(`<div class="tt-body"><b>${EDITIONS[c.edition].name}</b> — ${EDITIONS[c.edition].desc}</div>`);
  if (c.stamp) bits.push(`<div class="tt-body"><b>${STAMPS[c.stamp].name}</b> — ${STAMPS[c.stamp].desc}</div>`);
  if (c.debuffed) bits.push('<div class="tt-body" style="color:var(--red)">Blanked by the boss — prints nothing.</div>');
  return `<h4>${candleName(c)}</h4>${bits.join('')}`;
}

// ---------------------------------------------------------------------------
// Broker card
// ---------------------------------------------------------------------------
export function brokerEl(inst, state, opts = {}) {
  const d = BROKERS[inst.key];
  const el = document.createElement('div');
  el.className = `broker rarity-${d.rarity}` + (inst.edition ? ` ed-${inst.edition}` : '');
  el.dataset.uid = inst.uid;
  if (opts.disabled) el.classList.add('disabled');
  const ctr = counterText(inst);
  el.innerHTML = `
    <div class="bk-glow"></div>
    <div class="bk-art">${d.art || '📌'}</div>
    <div class="bk-name">${d.name}</div>
    ${ctr ? `<div class="bk-ctr">${ctr}</div>` : ''}
    <div class="bk-strip"></div>
  `;
  attachTip(el, () => brokerTip(inst, state, opts));
  return el;
}

function counterText(inst) {
  if (inst.counters?.x != null) return 'x' + Number(inst.counters.x).toFixed(2);
  if (inst.counters?.v) return '+' + inst.counters.v;
  if (inst.counters?.n) return '#' + inst.counters.n;
  return '';
}

export function brokerTip(inst, state, opts = {}) {
  const d = BROKERS[inst.key];
  const rar = RARITY[d.rarity];
  const ed = inst.edition ? `<div class="tt-body" style="color:var(--gold)"><b>${EDITIONS[inst.edition].name}</b> — ${EDITIONS[inst.edition].desc}</div>` : '';
  const foot = opts.hideSell ? '' : `<div class="tt-foot">Sells for $${brokerSellValue(inst, state)} · drag to reorder · right-click to sell</div>`;
  return `<h4>${d.name}</h4>
    <div class="tt-rarity" style="color:${rar.color}">${rar.name.toUpperCase()} BROKER</div>
    <div class="tt-body">${brokerText(inst, state)}</div>${ed}${foot}`;
}

// ---------------------------------------------------------------------------
// Consumable card
// ---------------------------------------------------------------------------
export function consumableEl(inst, state) {
  const d = ALL_CONSUMABLES[inst.key];
  const el = document.createElement('div');
  el.className = `consumable family-${d.family}`;
  el.dataset.uid = inst.uid;
  el.innerHTML = `<div class="cs-glow"></div><div class="cs-art">${d.art}</div><div class="cs-name">${d.name}</div>`;
  attachTip(el, () => consumableTip(inst, state));
  return el;
}

export function consumableTip(inst, state) {
  const d = ALL_CONSUMABLES[inst.key];
  const fam = { chart: 'CHART', contract: 'CONTRACT', rumor: 'RUMOR' }[d.family];
  const col = { chart: 'var(--violet)', contract: 'var(--cyan)', rumor: 'var(--magenta)' }[d.family];
  let extra;
  if (d.family === 'contract' && state) {
    const lv = state.formations[d.formation]?.level ?? 1;
    extra = `<div class="tt-foot">Currently level ${lv} → ${lv + 1}</div>`;
  } else if (d.select && d.select[1] > 0) {
    extra = `<div class="tt-foot">Select ${d.select[0]}${d.select[1] > d.select[0] ? '-' + d.select[1] : ''} candle(s), then click to use</div>`;
  } else {
    extra = '<div class="tt-foot">Click to use · right-click to sell</div>';
  }
  return `<h4>${d.name}</h4><div class="tt-rarity" style="color:${col}">${fam}</div>
    <div class="tt-body">${consumableText(d, state)}</div>${extra}`;
}

export function licenseTip(key) {
  const l = LICENSES[key];
  return `<h4>${l.name}</h4><div class="tt-rarity" style="color:var(--violet)">LICENCE · TIER ${l.tier}</div>
    <div class="tt-body">${l.text}</div><div class="tt-foot">Permanent for the rest of the run</div>`;
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------
let tipEl = null;
export function attachTip(el, htmlFn) {
  el.addEventListener('mouseenter', () => showTip(el, htmlFn()));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('mousedown', hideTip);
}

export function showTip(anchor, html) {
  tipEl = tipEl || document.getElementById('tooltip');
  if (!tipEl) return;
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  const a = anchor.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  let left = a.left + a.width / 2 - t.width / 2;
  let top = a.top - t.height - 10;
  if (top < 8) top = a.bottom + 10;
  left = Math.max(8, Math.min(window.innerWidth - t.width - 8, left));
  tipEl.style.left = left + 'px';
  tipEl.style.top = top + 'px';
}
export function hideTip() {
  tipEl = tipEl || document.getElementById('tooltip');
  if (tipEl) tipEl.hidden = true;
}
