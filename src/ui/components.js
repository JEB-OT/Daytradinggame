import { SECTORS, RANK_BY_VALUE, ENHANCEMENTS, EDITIONS, STAMPS, cardName, describeCard, baseVolume } from '../game/cards.js';
import { PERKS, RARITY, perkText, perkSellValue } from '../game/perks.js';
import { ALL_CONSUMABLES } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';

// ---------------------------------------------------------------------------
// Ticker card
// ---------------------------------------------------------------------------
export function cardEl(card, opts = {}) {
  const s = SECTORS[card.sector];
  const r = RANK_BY_VALUE[card.rank];
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.uid = card.uid;
  if (card.enhancement) el.classList.add('enh-' + card.enhancement);
  if (card.edition) el.classList.add('ed-' + card.edition);
  if (card.debuffed) el.classList.add('debuffed');
  if (card.faceDown && !opts.reveal) el.classList.add('facedown');
  el.style.setProperty('--sc', s.color);

  const rankTxt = card.enhancement === 'restricted' ? '' : r.label;
  const glyph = card.enhancement === 'restricted' ? '▪' : s.glyph;
  const col = card.enhancement === 'restricted' ? '#20262f' : s.color;
  el.innerHTML = `
    <div class="c-top"><span class="c-rank">${rankTxt}</span><span class="c-sector" style="color:${col}">${glyph}</span></div>
    <div class="c-mid" style="color:${col}">${glyph}</div>
    <div class="c-bot"><span class="c-rank">${rankTxt}</span><span class="c-sector" style="color:${col}">${glyph}</span></div>
  `;
  if (card.enhancement && card.enhancement !== 'restricted') {
    const tag = document.createElement('div');
    tag.className = 'c-tag';
    tag.style.background = ENHANCEMENTS[card.enhancement].color;
    tag.style.color = '#0a0e14';
    tag.textContent = ENHANCEMENTS[card.enhancement].short;
    el.appendChild(tag);
  }
  if (card.stamp) {
    const st = document.createElement('div');
    st.className = 'c-stamp';
    st.style.background = STAMPS[card.stamp].color;
    el.appendChild(st);
  }
  attachTip(el, () => cardTip(card));
  return el;
}

function cardTip(card) {
  const bits = [];
  bits.push(`<div class="tt-body">Base volume <em>${baseVolume(card)}</em></div>`);
  if (card.enhancement) bits.push(`<div class="tt-body"><b>${ENHANCEMENTS[card.enhancement].name}</b> — ${ENHANCEMENTS[card.enhancement].desc}</div>`);
  if (card.edition) bits.push(`<div class="tt-body"><b>${EDITIONS[card.edition].name}</b> — ${EDITIONS[card.edition].desc}</div>`);
  if (card.stamp) bits.push(`<div class="tt-body"><b>${STAMPS[card.stamp].name}</b> — ${STAMPS[card.stamp].desc}</div>`);
  if (card.debuffed) bits.push('<div class="tt-body" style="color:var(--red)">Blanked by the boss — scores nothing.</div>');
  return `<h4>${cardName(card)}</h4>${bits.join('')}`;
}

// ---------------------------------------------------------------------------
// Perk card
// ---------------------------------------------------------------------------
export function perkEl(inst, state, opts = {}) {
  const d = PERKS[inst.key];
  const el = document.createElement('div');
  el.className = `perk rarity-${d.rarity}` + (inst.edition ? ` ed-${inst.edition}` : '');
  el.dataset.uid = inst.uid;
  if (opts.disabled) el.classList.add('disabled');
  const ctrTxt = counterText(inst, d);
  el.innerHTML = `
    <div class="p-art">${d.art || '📌'}</div>
    <div class="p-name">${d.name}</div>
    ${ctrTxt ? `<div class="p-ctr">${ctrTxt}</div>` : ''}
  `;
  attachTip(el, () => perkTip(inst, state, opts));
  return el;
}

function counterText(inst, d) {
  if (inst.counters?.x != null) return 'x' + Number(inst.counters.x).toFixed(2);
  if (inst.counters?.v) return '+' + inst.counters.v;
  if (inst.counters?.n) return '#' + inst.counters.n;
  return '';
}

export function perkTip(inst, state, opts = {}) {
  const d = PERKS[inst.key];
  const rar = RARITY[d.rarity];
  const ed = inst.edition ? `<div class="tt-body" style="color:var(--gold)"><b>${EDITIONS[inst.edition].name}</b> — ${EDITIONS[inst.edition].desc}</div>` : '';
  const foot = opts.hideSell ? '' : `<div class="tt-foot">Sells for $${perkSellValue(inst, state)} · drag to reorder</div>`;
  return `<h4>${d.name}</h4>
    <div class="tt-rarity" style="color:${rar.color}">${rar.name.toUpperCase()}</div>
    <div class="tt-body">${perkText(inst, state)}</div>${ed}${foot}`;
}

// ---------------------------------------------------------------------------
// Consumable card
// ---------------------------------------------------------------------------
export function consumableEl(inst, state) {
  const d = ALL_CONSUMABLES[inst.key];
  const el = document.createElement('div');
  el.className = `consumable family-${d.family}`;
  el.dataset.uid = inst.uid;
  el.innerHTML = `<div class="c-art">${d.art}</div><div class="c-name">${d.name}</div>`;
  attachTip(el, () => consumableTip(inst, state));
  return el;
}

export function consumableTip(inst, state) {
  const d = ALL_CONSUMABLES[inst.key];
  const fam = { chart: 'CHART', contract: 'CONTRACT', rumor: 'RUMOR' }[d.family];
  const col = { chart: 'var(--violet)', contract: 'var(--cyan)', rumor: 'var(--magenta)' }[d.family];
  let extra = '';
  if (d.family === 'contract' && state) {
    const lv = state.patterns[d.pattern]?.level ?? 1;
    extra = `<div class="tt-foot">Currently level ${lv} → ${lv + 1}</div>`;
  } else if (d.select && d.select[1] > 0) {
    extra = `<div class="tt-foot">Select ${d.select[0]}${d.select[1] > d.select[0] ? '-' + d.select[1] : ''} ticker(s), then click to use</div>`;
  } else {
    extra = '<div class="tt-foot">Click to use · right-click to sell</div>';
  }
  return `<h4>${d.name}</h4><div class="tt-rarity" style="color:${col}">${fam}</div>
    <div class="tt-body">${d.text}</div>${extra}`;
}

export function licenseTip(key) {
  const l = LICENSES[key];
  return `<h4>${l.name}</h4><div class="tt-rarity" style="color:var(--violet)">LICENSE · TIER ${l.tier}</div>
    <div class="tt-body">${l.text}</div><div class="tt-foot">Permanent for the rest of the run</div>`;
}

// ---------------------------------------------------------------------------
// Tooltip plumbing
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
