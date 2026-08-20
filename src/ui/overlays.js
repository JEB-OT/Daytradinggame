import { money, bignum } from '../engine/util.js';
import { FORMATION_KEYS, FORMATIONS, formationStats } from '../game/formations.js';
import { BROKERS, RARITY, brokerText } from '../game/brokers.js';
import { ALL_CONSUMABLES, consumableText } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';
import { BOSSES } from '../game/bosses.js';
import { REGIMES } from '../game/market.js';
import { SECTORS, MAX_BODY } from '../game/candles.js';
import * as S from '../game/state.js';
import { candleEl, brokerEl, consumableEl, hideTip } from './components.js';
import { sfx, toast } from './fx.js';

const root = () => document.getElementById('overlay-root');

export function closeOverlay() { root().innerHTML = ''; hideTip(); }
export function overlayOpen() { return root().children.length > 0; }
export function overlayDismissable() { return root().firstElementChild?.dataset.dismissable === '1'; }

export function showOverlay(inner, opts = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.dataset.dismissable = opts.dismissable === false ? '0' : '1';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  if (opts.width) sheet.style.maxWidth = opts.width;
  sheet.innerHTML = inner;
  ov.appendChild(sheet);
  if (opts.dismissable !== false) ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(); });
  root().innerHTML = '';
  root().appendChild(ov);
  return sheet;
}

// ---------------------------------------------------------------------------
export function deadlineSelect(game) {
  const st = game.state;
  // Never render a locked-out week: re-derive where the run actually stands.
  S.normalizeProgress(st);
  const cards = st.upcoming.map((slot, i) => {
    const boss = slot.boss ? BOSSES[slot.boss] : null;
    const quota = Math.round((S.quotaFor(st, slot) * (boss?.quotaMult || 1)) / 10) * 10;
    const regime = REGIMES[slot.regime];
    const done = !!slot.done;
    const current = !done && i === st.deadlineIndex;
    return `
      <div class="dl-choice ${current ? 'current' : ''} ${slot.boss ? 'boss' : ''} ${done ? 'done' : ''}">
        <div class="c-art">${boss ? boss.art : slot.art}</div>
        <div class="c-name">${(boss ? boss.name : slot.name).toUpperCase()}</div>
        <div class="c-quota">${money(quota)}</div>
        <div class="c-reward">clears for $${slot.reward}</div>
        <div class="c-boss">${boss ? boss.blurb : ''}</div>
        <div class="c-regime" style="color:${regime.color}">${regime.name} — ${regime.blurb}</div>
        <div class="c-actions">
          ${done ? '<span style="font-size:11px;color:var(--ink-faint)">CLEARED</span>' :
            current ? `<button class="btn primary" data-play="${i}">TRADE</button>
                       ${slot.boss ? '' : `<button class="btn ghost" data-skip="${i}">SKIP</button>`}` :
            '<span style="font-size:11px;color:var(--ink-faint)">LOCKED</span>'}
        </div>
      </div>`;
  }).join('');

  const sheet = showOverlay(`
    <h2>WEEK ${st.week}</h2>
    <div class="sub">Three deadlines. Clear all three to reach next week. Skipping trades the cash for a bonus.</div>
    <div class="dl-choices">${cards}</div>
    <div class="btn-row">
      <button class="btn ghost" id="dl-book">BOOK</button>
      <button class="btn ghost" id="dl-form">FORMATIONS</button>
      <button class="btn ghost" id="dl-run">RUN INFO</button>
      <button class="btn ghost" id="dl-menu">MENU</button>
    </div>`, { dismissable: false, width: '900px' });

  sheet.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => { sfx.open(); game.beginDeadline(+b.dataset.play); });
  sheet.querySelectorAll('[data-skip]').forEach((b) => b.onclick = () => { sfx.buy(); game.skipDeadline(+b.dataset.skip); });
  sheet.querySelector('#dl-book').onclick = () => bookScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-form').onclick = () => formationScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-run').onclick = () => runInfoScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-menu').onclick = () => menuScreen(game, () => deadlineSelect(game));
}

// ---------------------------------------------------------------------------
export function bonusScreen(game, bonus) {
  const sheet = showOverlay(`
    <div class="title-wrap">
      <div style="font-size:50px">${bonus.art}</div>
      <h2 style="margin-top:8px">${bonus.name.toUpperCase()}</h2>
      <div class="sub">${bonus.text}</div>
      <button class="btn primary" id="b-ok">CONTINUE</button>
    </div>`, { dismissable: false, width: '440px' });
  sheet.querySelector('#b-ok').onclick = () => { closeOverlay(); game.afterSkip(); };
}

// ---------------------------------------------------------------------------
export function payoutScreen(game, payout) {
  const lines = payout.lines.map((l) =>
    `<div class="payout-line"><span>${l.label}</span><b>${l.amount >= 0 ? '+' : '-'}$${Math.abs(l.amount)}</b></div>`).join('');
  const sheet = showOverlay(`
    <div style="text-align:center">
      <h2 style="color:var(--green)">DEADLINE CLEARED</h2>
      <div class="sub">Booked ${money(payout.profit)} against a ${money(payout.quota)} quota
        · ${payout.greens} green / ${payout.reds} red · best streak ${payout.bestStreak}</div>
    </div>
    <div class="payout-lines">${lines}
      <div class="payout-total"><span>CASH OUT</span><b>+$${payout.total}</b></div>
    </div>
    <div style="text-align:center"><button class="btn primary" id="p-ok">HIT THE FLOOR</button></div>`,
    { dismissable: false, width: '520px' });
  sheet.querySelector('#p-ok').onclick = () => { sfx.buy(); game.openFloor(); };
}

// ---------------------------------------------------------------------------
// THE FLOOR — every purchasable is one uniform tile in a single centred grid,
// so the layout never leaves a dead column when stock is thin.
// ---------------------------------------------------------------------------
let shopDragUid = null;
export function shopScreen(game) {
  const st = game.state;
  const shop = st.shop;
  const tiles = [];

  shop.items.forEach((it, i) => {
    const price = S.itemPrice(st, it.cost);
    const d = it.type === 'broker' ? BROKERS[it.key] : ALL_CONSUMABLES[it.key];
    const KIND = { broker: 'BROKER · DESK SLOT', chart: 'CHART · ONE USE', contract: 'CONTRACT · ONE USE', rumor: 'RUMOR · ONE USE' };
    const desc = it.type === 'broker' ? brokerText(it.inst, st) : consumableText(d, st);
    const rar = it.type === 'broker' ? BROKERS[it.key].rarity : null;
    tiles.push(`<div class="shop-slot ${it.sold ? 'sold' : ''} ${rar ? 'rar-' + rar : 'kind-' + it.type}">
      <div class="s-kind">${KIND[it.type] || it.type.toUpperCase()}</div>
      <div class="s-art">${d.art}</div>
      <div class="s-name">${d.name}</div>
      ${rar ? `<div class="s-rarity" style="color:${RARITY[rar].color}">${RARITY[rar].name.toUpperCase()}</div>` : ''}
      <div class="s-desc">${desc}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-buy="${i}" ${st.cash < price ? 'disabled' : ''}>BUY</button>
    </div>`);
  });

  shop.packs.forEach((p, i) => {
    const price = S.itemPrice(st, p.cost);
    const c = S.PACK_CONTENTS[p.family];
    tiles.push(`<div class="shop-slot kind-pack ${p.sold ? 'sold' : ''} ${p.choose > 1 ? 'multi' : ''}">
      <div class="s-kind">PACK${p.choose > 1 ? ' · KEEP ' + p.choose : ''}</div>
      <div class="s-art">${p.art}</div>
      <div class="s-name">${p.name}</div>
      <div class="s-yield">${S.packSummary(p)}</div>
      <div class="s-desc">${c.blurb}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-pack="${i}" ${st.cash < price ? 'disabled' : ''}>OPEN</button>
    </div>`);
  });

  if (shop.license && !shop.license.sold) {
    const l = LICENSES[shop.license.key];
    const price = S.itemPrice(st, l.cost);
    tiles.push(`<div class="shop-slot kind-licence">
      <div class="s-kind">LICENCE · REST OF THE RUN</div>
      <div class="s-art">${l.art}</div>
      <div class="s-name">${l.name}</div>
      <div class="s-yield">Tier ${l.tier} &middot; one per run</div>
      <div class="s-desc">${l.text}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" id="buy-lic" ${st.cash < price ? 'disabled' : ''}>BUY</button>
    </div>`);
  }

  const rerollCost = Math.max(0, shop.rerollCost - st.mods.rerollDiscount);
  const sheet = showOverlay(`
    <div class="sheet-head">
      <div><h2>THE FLOOR</h2><div class="sub" style="margin:0">Week ${st.week} · spend it before the bell</div></div>
      <div style="font-size:22px;color:var(--gold);font-weight:700">${money(st.cash)}</div>
    </div>
    <div class="floor-grid" style="margin-top:14px">${tiles.join('')}</div>
    <div class="floor-earn">
      <b>HOW YOU EARN</b>
      <span><i>$4&ndash;$7</i> for clearing a deadline</span>
      <span><i>$1</i> for every trade you did not need</span>
      <span><i>$1</i> per $${st.mods.interestRate} you are holding, up to <i>$${st.mods.interestCap}</i>
        &mdash; maxed at $${st.mods.interestCap * st.mods.interestRate} banked</span>
    </div>
    <div class="floor-bar">
      <div class="fb-group">
        <span class="fb-label">DESK</span>
        <div class="fb-items" id="shop-desk"></div>
      </div>
      <div class="fb-group">
        <span class="fb-label">CHARTS</span>
        <div class="fb-items" id="shop-cons"></div>
      </div>
      <span class="fb-hint">right-click to sell · click a chart to use it</span>
    </div>
    <div class="btn-row">
      <button class="btn" id="shop-reroll" ${st.cash < rerollCost && shop.freeRerolls <= 0 ? 'disabled' : ''}>
        REROLL ${shop.freeRerolls > 0 ? '(FREE ×' + shop.freeRerolls + ')' : '$' + rerollCost}</button>
      <button class="btn ghost" id="shop-book">BOOK</button>
      <button class="btn ghost" id="shop-form">FORMATIONS</button>
      <button class="btn primary" id="shop-next">NEXT DEADLINE →</button>
    </div>`, { dismissable: false, width: '1020px' });

  const desk = sheet.querySelector('#shop-desk');
  st.brokers.forEach((b) => {
    const el = brokerEl(b, st);
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
      shopDragUid = b.uid;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', b.uid); } catch {}
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const from = st.brokers.findIndex((q) => q.uid === shopDragUid);
      const to = st.brokers.findIndex((q) => q.uid === b.uid);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = st.brokers.splice(from, 1);
      st.brokers.splice(to, 0, moved);
      sfx.select();
      shopScreen(game);
      game.render();
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const r = S.sellBroker(st, b.uid);
      if (r.ok) { sfx.cash(); toast(`Sold for $${r.value}`, 'good'); shopScreen(game); game.render(); }
    });
    desk.appendChild(el);
  });
  for (let i = S.slotsUsed(st); i < st.mods.slots; i++) {
    const e = document.createElement('div'); e.className = 'slot-empty'; desk.appendChild(e);
  }

  const cons = sheet.querySelector('#shop-cons');
  st.consumables.forEach((c) => {
    const el = consumableEl(c, st);
    el.onclick = () => {
      const r = S.useConsumable(st, c.uid, []);
      if (r.ok) { sfx.buy(); toast(r.msg, 'good'); shopScreen(game); game.render(); }
      else toast(r.msg || 'Needs candles selected — use it during a deadline', 'bad');
    };
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); S.sellConsumable(st, c.uid); sfx.cash(); shopScreen(game); game.render();
    });
    cons.appendChild(el);
  });
  for (let i = st.consumables.length; i < st.mods.chartSlots; i++) {
    const e = document.createElement('div'); e.className = 'slot-empty'; cons.appendChild(e);
  }

  sheet.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
    const r = S.buyShopItem(st, +b.dataset.buy);
    if (r.ok) { sfx.buy(); shopScreen(game); game.render(); } else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelectorAll('[data-pack]').forEach((b) => b.onclick = () => {
    const r = S.buyPack(st, +b.dataset.pack);
    if (r.ok) { sfx.open(); packScreen(game); } else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelector('#buy-lic')?.addEventListener('click', () => {
    const r = S.buyLicense(st);
    if (r.ok) { sfx.buy(); shopScreen(game); game.render(); } else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelector('#shop-reroll').onclick = () => {
    const r = S.rerollShop(st);
    if (r.ok) { sfx.select(); shopScreen(game); game.render(); } else { sfx.err(); toast(r.blocked, 'bad'); }
  };
  sheet.querySelector('#shop-book').onclick = () => bookScreen(game, () => shopScreen(game));
  sheet.querySelector('#shop-form').onclick = () => formationScreen(game, () => shopScreen(game));
  sheet.querySelector('#shop-next').onclick = () => { sfx.open(); game.leaveFloor(); };
}

// ---------------------------------------------------------------------------
export function packScreen(game) {
  const st = game.state;
  const open = st.shop.pack;
  if (!open) return shopScreen(game);

  const contents = S.PACK_CONTENTS[open.pack.family];
  const sheet = showOverlay(`
    <div style="text-align:center">
      <h2>${open.pack.name.toUpperCase()}</h2>
      <div class="pack-lead">
        <b>${open.picks}</b> more to keep &mdash; ${contents.blurb}
      </div>
      <div class="sub" style="margin-bottom:4px">${open.pack.choose > 1
        ? `This pack lets you keep <b>${open.pack.choose}</b>. Anything you do not take is gone.`
        : 'Anything you do not take is gone.'}</div>
      <div class="pack-options" id="pack-opts"></div>
      <button class="btn ghost" id="pack-skip">${open.picks < open.pack.choose ? 'DONE' : 'SKIP'}</button>
    </div>`, { dismissable: false, width: '820px' });

  const wrap = sheet.querySelector('#pack-opts');
  open.options.forEach((opt, i) => {
    let el;
    if (opt.type === 'candle') { el = candleEl(opt.candle, { reveal: true }); el.style.transform = 'scale(1.15)'; el.style.margin = '8px 10px'; }
    else if (opt.type === 'broker') { el = brokerEl(opt.inst, st, { hideSell: true }); el.style.transform = 'scale(1.3)'; el.style.margin = '12px 18px'; }
    else { el = consumableEl({ key: opt.key, uid: 'pk' + i }, st); el.style.transform = 'scale(1.3)'; el.style.margin = '12px 16px'; }
    el.classList.add('pack-opt');
    if (opt.taken) el.classList.add('taken');
    el.onclick = () => {
      const r = S.pickFromPack(st, i);
      if (r.ok) { sfx.buy(); if (st.shop.pack) packScreen(game); else shopScreen(game); game.render(); }
      else { sfx.err(); toast(r.blocked, 'bad'); }
    };
    wrap.appendChild(el);
  });
  sheet.querySelector('#pack-skip').onclick = () => { S.closePack(st); shopScreen(game); };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// THE BOOK — every candle laid out on its own sector row, one column per body,
// the way a deck view should read: you see the shape of what you own at a
// glance instead of scanning a wall of tiles.
//
// Two views share the layout:
//   ALL BOOK    everything you own
//   REMAINING   only what is still in the deck this deadline, so you can plan
//               the next placement around what can actually still be dealt
// Slots that the view does not hold are drawn as empty outlines, which is the
// whole point: the gaps are the information.
// ---------------------------------------------------------------------------
const BOOK_VIEWS = {
  all:       { key: 'all',       label: 'ALL BOOK',  blurb: 'every candle you own, wherever it is right now' },
  remaining: { key: 'remaining', label: 'REMAINING', blurb: 'only what is still in the deck and can still be dealt to you' },
};

/** One sector row: 13 body columns, each holding the candles of that body. */
function bookRow(game, sectorKey, candles, all) {
  const sec = SECTORS[sectorKey];
  const wrap = document.createElement('div');
  wrap.className = 'bk-row';
  wrap.style.setProperty('--rc', sec.color);

  const head = document.createElement('div');
  head.className = 'bk-rowhead';
  head.innerHTML = `<span class="bk-glyph">${sec.glyph}</span>
    <span class="bk-secname">${sec.name}</span>
    <span class="bk-seccount">${candles.length}<i>/${all.length}</i></span>`;
  wrap.appendChild(head);

  const strip = document.createElement('div');
  strip.className = 'bk-strip-row';
  for (let body = 1; body <= MAX_BODY; body++) {
    const here = candles.filter((c) => c.body === body);
    const owned = all.filter((c) => c.body === body);
    const cell = document.createElement('div');
    cell.className = 'bk-cell';
    if (!here.length) {
      // Nothing of this body available in this view. Say which of the two
      // reasons it is: never owned, or owned but no longer in the deck.
      cell.classList.add(owned.length ? 'gone' : 'missing');
      cell.innerHTML = `<div class="bk-ghost"><span>${body}</span></div>`;
      cell.title = owned.length
        ? `${owned.length} × ${body} of ${sec.name} — none left in the deck`
        : `no ${body} of ${sec.name} in your book`;
    } else {
      cell.appendChild(candleEl(here[0], { reveal: true }));
      if (here.length > 1) {
        const dup = document.createElement('span');
        dup.className = 'bk-dup';
        dup.textContent = '×' + here.length;
        cell.appendChild(dup);
      }
    }
    strip.appendChild(cell);
  }
  wrap.appendChild(strip);
  return wrap;
}

export function bookScreen(game, back, view = 'all') {
  const st = game.state;
  const where = S.bookLocations(st);
  const v = BOOK_VIEWS[view] ? view : 'all';
  const shown = v === 'remaining' ? where.deck : st.book;

  const bulls = shown.filter((c) => c.bull).length;
  const enhanced = shown.filter((c) => c.enhancement).length;
  const avg = shown.length ? (shown.reduce((a, c) => a + c.body, 0) / shown.length).toFixed(1) : '0';
  const sealed = shown.filter((c) => c.enhancement === 'obsidian');

  const tabs = Object.values(BOOK_VIEWS).map((b) =>
    `<button class="bk-tab ${b.key === v ? 'on' : ''}" data-view="${b.key}">${b.label}</button>`).join('');

  const split = where.dealt
    ? `<div class="bk-where">
         <span class="w-deck"><b>${where.deck.length}</b> in the deck</span>
         <span class="w-board"><b>${where.board.length}</b> on the board</span>
         <span class="w-swept"><b>${where.swept.length}</b> traded or swept</span>
       </div>`
    : `<div class="bk-where"><span class="w-deck">Nothing dealt yet — the whole book is still in the deck.</span></div>`;

  const sheet = showOverlay(`
    <div class="sheet-head">
      <div><h2>THE BOOK</h2><div class="sub" style="margin:0">${BOOK_VIEWS[v].blurb}</div></div>
      <div class="bk-tabs">${tabs}</div>
    </div>
    ${split}
    <div class="stat-grid" style="margin-top:12px">
      <div class="stat-box"><label>${v === 'remaining' ? 'IN DECK' : 'CANDLES'}</label><b>${shown.length}</b></div>
      <div class="stat-box"><label style="color:var(--green)">BULL</label><b>${bulls}</b></div>
      <div class="stat-box"><label style="color:var(--red)">BEAR</label><b>${shown.length - bulls}</b></div>
      <div class="stat-box"><label>AVG BODY</label><b>${avg}</b></div>
    </div>
    <div class="book-board" id="book-board"></div>
    <div class="bk-legend">
      <span><i class="lg-have"></i>held</span>
      <span><i class="lg-gone"></i>${v === 'remaining' ? 'already dealt' : 'not in your book'}</span>
      <span>${enhanced} enhanced${sealed.length ? ` · ${sealed.length} sealed` : ''}</span>
    </div>
    <div class="btn-row"><button class="btn" id="bk-back">BACK</button></div>`,
    { dismissable: false, width: '1080px' });

  const board = sheet.querySelector('#book-board');
  // A candle's body column is its body, so an Obsidian — which has no body or
  // sector at all — cannot sit on the grid. Those get their own shelf below it.
  const gridable = (c) => c.enhancement !== 'obsidian';
  Object.keys(SECTORS).forEach((k) => {
    board.appendChild(bookRow(game,
      k,
      shown.filter((c) => gridable(c) && c.sector === k),
      st.book.filter((c) => gridable(c) && c.sector === k)));
  });
  if (sealed.length) {
    const row = document.createElement('div');
    row.className = 'bk-row sealed-row';
    row.innerHTML = `<div class="bk-rowhead"><span class="bk-glyph">▪</span>
      <span class="bk-secname">Sealed</span><span class="bk-seccount">${sealed.length}</span></div>`;
    const strip = document.createElement('div');
    strip.className = 'bk-strip-row loose';
    sealed.forEach((c) => {
      const cell = document.createElement('div');
      cell.className = 'bk-cell';
      cell.appendChild(candleEl(c, { reveal: true }));
      strip.appendChild(cell);
    });
    row.appendChild(strip);
    board.appendChild(row);
  }

  sheet.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => {
    sfx.select();
    bookScreen(game, back, b.dataset.view);
  });
  sheet.querySelector('#bk-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
export function formationScreen(game, back) {
  const st = game.state;
  const rows = FORMATION_KEYS.slice().reverse().map((k) => {
    const f = FORMATIONS[k];
    const lv = st.formations[k];
    const hidden = f.secret && !st.discoveredFormations.includes(k) && lv.played === 0;
    const s = formationStats(k, lv.level);
    return `<tr class="${hidden ? 'secret' : ''}">
      <td>${hidden ? '???????' : f.name}</td>
      <td style="color:var(--ink-faint)">${hidden ? '???' : f.made}</td>
      <td class="lv">lv.${lv.level}</td>
      <td class="v">${hidden ? '?' : s.volume}</td>
      <td class="m">${hidden ? '?' : 'x' + s.leverage}</td>
      <td style="color:var(--ink-faint)">${lv.played}</td>
    </tr>`;
  }).join('');
  const sheet = showOverlay(`
    <h2>FORMATIONS</h2>
    <div class="sub">Contracts bought on the Floor level these permanently.
      Soldiers and Crows read the candles <b style="color:var(--cyan)">in the order you place them</b>.</div>
    <table class="pat-table">
      <tr><th>FORMATION</th><th>MADE OF</th><th>LEVEL</th><th>VOLUME</th><th>LEVERAGE</th><th>PRINTED</th></tr>
      ${rows}
    </table>
    <div class="btn-row"><button class="btn" id="ft-back">BACK</button></div>`,
    { dismissable: false, width: '680px' });
  sheet.querySelector('#ft-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
export function runInfoScreen(game, back) {
  const st = game.state;
  const licHtml = st.licenses.length
    ? st.licenses.map((k) => `<div style="display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(37,48,72,.4)">
        <span style="font-size:18px">${LICENSES[k].art}</span>
        <span style="font-size:11px"><b>${LICENSES[k].name}</b> — <span style="color:var(--ink-dim)">${LICENSES[k].text}</span></span></div>`).join('')
    : '<div style="font-size:11px;color:var(--ink-faint)">None yet.</div>';
  const m = st.mods;
  const sheet = showOverlay(`
    <h2>RUN INFO</h2>
    <div class="sub">Seed <b style="color:var(--cyan)">${st.seed}</b></div>
    <div class="stat-grid">
      <div class="stat-box"><label>TRADES</label><b>${m.trades}</b></div>
      <div class="stat-box"><label>SWEEPS</label><b>${m.discards}</b></div>
      <div class="stat-box"><label>BOARD</label><b>${m.handSize}</b></div>
      <div class="stat-box"><label>DESK SLOTS</label><b>${m.slots}</b></div>
      <div class="stat-box"><label>SIGNAL</label><b>${m.perfectSignal ? '100%' : Math.round(m.accuracy * 100) + '%'}</b></div>
      <div class="stat-box"><label>WRONG-WAY</label><b>x${m.redMult}</b></div>
      <div class="stat-box"><label>CONVICTION</label><b>${m.noConviction ? 'off' : 'x' + (1.5 + m.convictionBonus).toFixed(2)}</b></div>
      <div class="stat-box"><label>INTEREST</label><b>$1/$${m.interestRate} · cap $${m.interestCap}</b></div>
    </div>
    <h3>LICENCES</h3>${licHtml}
    <h3>CAREER</h3>
    <div class="stat-grid">
      <div class="stat-box"><label>TRADES</label><b>${st.stats.trades}</b></div>
      <div class="stat-box"><label>GREEN</label><b style="color:var(--green)">${st.stats.greens}</b></div>
      <div class="stat-box"><label>MARCHES</label><b>${st.stats.marches}</b></div>
      <div class="stat-box"><label>BEST P/L</label><b>$${bignum(st.stats.bestPL)}</b></div>
    </div>
    <div class="btn-row"><button class="btn" id="ri-back">BACK</button></div>`,
    { dismissable: false, width: '660px' });
  sheet.querySelector('#ri-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
export function gameOverScreen(game, won) {
  const st = game.state;
  const s = st.session;
  const sheet = showOverlay(`
    <div class="title-wrap">
      <div class="go-title ${won ? 'win' : ''}">${won ? 'CASHED OUT' : 'LIQUIDATED'}</div>
      <div class="sub" style="text-align:center;margin-top:10px">
        ${won ? 'You beat the street and walked away clean.'
              : `You booked ${money(s ? s.profit : 0)} against a ${money(s ? s.quota : 0)} quota. Compliance is on the phone.`}
      </div>
      <div class="go-stats">
        <div class="stat-box"><label>REACHED</label><b>Week ${st.week} · DL ${st.deadlineIndex + 1}</b></div>
        <div class="stat-box"><label>DEADLINES</label><b>${st.stats.deadlinesCleared}</b></div>
        <div class="stat-box"><label>BOSSES</label><b>${st.stats.bossesCleared}</b></div>
        <div class="stat-box"><label>TRADES</label><b>${st.stats.trades}</b></div>
        <div class="stat-box"><label>GREEN / RED</label><b>${st.stats.greens} / ${st.stats.reds}</b></div>
        <div class="stat-box"><label>BEST TRADE</label><b>$${bignum(st.stats.bestPL)}</b></div>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-bottom:14px">SEED ${st.seed}</div>
      <div class="title-actions">
        <button class="btn primary" id="go-again">NEW RUN</button>
        <button class="btn ghost" id="go-same">REPLAY SEED</button>
        <button class="btn ghost" id="go-title">MAIN MENU</button>
      </div>
    </div>`, { dismissable: false, width: '640px' });
  sheet.querySelector('#go-again').onclick = () => game.startRun(null);
  sheet.querySelector('#go-same').onclick = () => game.startRun(st.seed);
  sheet.querySelector('#go-title').onclick = () => game.toHome();
}

// ---------------------------------------------------------------------------
export function helpScreen(game, fromTitle, back) {
  const sheet = showOverlay(`
    <h2>HOW TO PLAY</h2>
    <div class="sub">One week to make the desk's money. Then another. Then another.</div>
    <div class="help-cols">
      <div>
        <h3>THE LOOP</h3>
        <ul>
          <li>Every <b>deadline</b> gives you a <b>quota</b>, a few <b>trades</b> and some <b>sweeps</b>.</li>
          <li>Place 1–5 candles from your board. <b>The order you place them is the order they print</b> —
              the badge on each candle shows its slot.</li>
          <li>What they print is a <b>formation</b>, which sets base
              <b style="color:var(--cyan)">Volume</b> and <b style="color:var(--red)">Leverage</b>.</li>
          <li>Then call it: <b style="color:var(--green)">LONG</b> or <b style="color:var(--red)">SHORT</b>.</li>
          <li>Right → <b>GREEN</b>, full P/L. Wrong → <b>RED</b>, you keep 35%.</li>
          <li>Volume × Leverage = P/L. Hit the quota before the trades run out, or the run ends.</li>
        </ul>
        <h3>THE DECK AND THE SWEPT PILE</h3>
        <ul>
          <li>Your whole book is shuffled into the <b style="color:var(--cyan)">DECK</b> on the left of
              your board at the bell. The board is dealt off the top of it and refills from it after
              every trade and sweep.</li>
          <li>Everything you trade or sweep lands on the <b>SWEPT</b> pile on the right and stays
              there until the next bell — it does not shuffle back in.</li>
          <li><span class="k">BOOK</span> → <b>REMAINING</b> shows exactly which candles are still in
              the deck, so you can tell a plan from a prayer before spending a sweep on it.</li>
        </ul>
        <h3>CANDLES</h3>
        <ul>
          <li>Every candle has a <b>sector</b>, a <b>body</b> (1–13, worth that much Volume)
              and a <b>polarity</b> — bull or bear.</li>
          <li>Matching bodies make Tweezers, Triples and Pillars. Consecutive bodies make a <b>Staircase</b>.
              One sector across the board makes a <b>Cluster</b>.</li>
          <li>Three rising bulls in a row print <b>Three White Soldiers</b>; three falling bears print
              <b>Three Black Crows</b>. Use <span class="k">ARRANGE</span> to sort your placement.</li>
        </ul>
      </div>
      <div>
        <h3>CONVICTION</h3>
        <ul>
          <li>If your printed candles agree with the direction you called, you get
              <b style="color:var(--gold)">Conviction</b>: ×1.5 Leverage when every candle agrees,
              ×1.2 when most do.</li>
          <li>That's the tension — the biggest formation is often the one pointing the wrong way.</li>
          <li>The desk signal only tells the truth <b>68%</b> of the time to start. Terminals and burner
              phones raise that. The market <b>regime</b> changes what each direction pays.</li>
        </ul>
        <h3>BUILDING A DESK</h3>
        <ul>
          <li><b>Brokers</b> sit on your desk and trigger left to right. Drag to reorder — order matters
              when multipliers are involved.</li>
          <li><b>Charts</b> reshape your book, <b>Contracts</b> level a formation permanently,
              <b>Rumors</b> are high-risk power spikes, <b>Licences</b> are permanent upgrades.</li>
          <li>Every third deadline is a <b>boss</b> that breaks one rule. Read it and buy around it.</li>
        </ul>
        <h3>CONTROLS</h3>
        <ul>
          <li><span class="k">1–9</span> place candle · <span class="k">click</span> place</li>
          <li><span class="k">L</span> long · <span class="k">S</span> short · <span class="k">W</span> sweep</li>
          <li><span class="k">A</span> arrange · <span class="k">Space</span> sort board ·
              <span class="k">Esc</span> menu · <span class="k">M</span> mute</li>
          <li>Right-click a broker or chart to sell it.</li>
        </ul>
      </div>
    </div>
    <div class="btn-row"><button class="btn primary" id="h-back">GOT IT</button></div>`,
    { dismissable: !fromTitle, width: '940px' });
  sheet.querySelector('#h-back').onclick = () => {
    if (fromTitle) game.toHome();
    else if (back) back();
    else closeOverlay();
  };
}

// ---------------------------------------------------------------------------
export function menuScreen(game, back) {
  const sheet = showOverlay(`
    <div class="title-wrap">
      <h2>MENU</h2>
      <div class="sub">Seed ${game.state?.seed ?? '—'}</div>
      <div style="display:flex;flex-direction:column;gap:8px;max-width:240px;margin:0 auto">
        <button class="btn wide" id="m-resume">RESUME</button>
        <button class="btn wide ghost" id="m-help">HOW TO PLAY</button>
        <button class="btn wide ghost" id="m-run">RUN INFO</button>
        <button class="btn wide ghost" id="m-comp">COMPENDIUM</button>
        <button class="btn wide ghost" id="m-gloss">GLOSSARY</button>
        <button class="btn wide ghost" id="m-mute">${game.muted ? 'UNMUTE' : 'MUTE'}</button>
        <button class="btn wide danger" id="m-quit">ABANDON RUN</button>
      </div>
    </div>`, { width: '420px', dismissable: !back });
  const resume = () => (back ? back() : closeOverlay());
  sheet.querySelector('#m-resume').onclick = resume;
  sheet.querySelector('#m-help').onclick = () => helpScreen(game, false, () => menuScreen(game, back));
  sheet.querySelector('#m-run').onclick = () => runInfoScreen(game, () => menuScreen(game, back));
  sheet.querySelector('#m-comp').onclick = () => game.openCompendium(() => menuScreen(game, back));
  sheet.querySelector('#m-gloss').onclick = () => game.openGlossary(() => menuScreen(game, back));
  sheet.querySelector('#m-mute').onclick = () => { game.toggleMute(); menuScreen(game, back); };
  sheet.querySelector('#m-quit').onclick = () => game.toHome();
}
