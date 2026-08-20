import { money, bignum } from '../engine/util.js';
import { FORMATION_KEYS, FORMATIONS, formationStats } from '../game/formations.js';
import { BROKERS, brokerText } from '../game/brokers.js';
import { ALL_CONSUMABLES } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';
import { BOSSES } from '../game/bosses.js';
import { REGIMES } from '../game/market.js';
import { SECTORS } from '../game/candles.js';
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
export function titleScreen(game, hasSave) {
  const sheet = showOverlay(`
    <div class="title-wrap">
      <div class="title-logo">MARGIN<em>CALL</em></div>
      <div class="title-tag">HIT THE QUOTA OR GET LIQUIDATED</div>
      <p style="color:var(--ink-dim);font-size:12px;line-height:1.7;max-width:580px;margin:0 auto 6px">
        A roguelike day-trading deckbuilder made of candlesticks. Place candles left to right to print a
        formation, call the tape <b style="color:var(--green)">LONG</b> or <b style="color:var(--red)">SHORT</b>,
        and book enough P/L to clear the day's quota. Three deadlines a week. The third one bites back.
      </p>
      <div class="seed-row"><input id="seed-input" placeholder="SEED (optional)" maxlength="16" /></div>
      <div class="title-actions">
        <button class="btn primary" id="t-new">NEW RUN</button>
        ${hasSave ? '<button class="btn" id="t-continue">CONTINUE</button>' : ''}
        <button class="btn ghost" id="t-help">HOW TO PLAY</button>
      </div>
      <div style="margin-top:20px;font-size:10px;color:var(--ink-faint);letter-spacing:.14em">
        ${Object.keys(BROKERS).length} BROKERS · ${Object.keys(ALL_CONSUMABLES).length} CONSUMABLES ·
        ${Object.keys(LICENSES).length} LICENCES · ${Object.keys(BOSSES).length} BOSS DEADLINES
      </div>
    </div>`, { dismissable: false, width: '680px' });

  sheet.querySelector('#t-new').onclick = () => {
    const seed = sheet.querySelector('#seed-input').value.trim().toUpperCase();
    sfx.open(); game.startRun(seed || null);
  };
  sheet.querySelector('#t-continue')?.addEventListener('click', () => { sfx.open(); game.continueRun(); });
  sheet.querySelector('#t-help').onclick = () => helpScreen(game, true);
}

// ---------------------------------------------------------------------------
export function deadlineSelect(game) {
  const st = game.state;
  const cards = st.upcoming.map((slot, i) => {
    const boss = slot.boss ? BOSSES[slot.boss] : null;
    const quota = Math.round((S.quotaFor(st, slot) * (boss?.quotaMult || 1)) / 10) * 10;
    const regime = REGIMES[slot.regime];
    const current = i === st.deadlineIndex;
    const done = slot.done || i < st.deadlineIndex;
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
export function shopScreen(game) {
  const st = game.state;
  const shop = st.shop;
  const tiles = [];

  shop.items.forEach((it, i) => {
    const price = S.itemPrice(st, it.cost);
    const d = it.type === 'broker' ? BROKERS[it.key] : ALL_CONSUMABLES[it.key];
    const kind = it.type === 'broker' ? 'BROKER' : it.type.toUpperCase();
    const desc = it.type === 'broker' ? brokerText(it.inst, st) : d.text;
    tiles.push(`<div class="shop-slot ${it.sold ? 'sold' : ''}">
      <div class="s-kind">${kind}</div>
      <div class="s-art">${d.art}</div>
      <div class="s-name">${d.name}</div>
      <div class="s-desc">${desc}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-buy="${i}" ${st.cash < price ? 'disabled' : ''}>BUY</button>
    </div>`);
  });

  shop.packs.forEach((p, i) => {
    const price = S.itemPrice(st, p.cost);
    tiles.push(`<div class="shop-slot kind-pack ${p.sold ? 'sold' : ''}">
      <div class="s-kind">PACK</div>
      <div class="s-art">${p.art}</div>
      <div class="s-name">${p.name}</div>
      <div class="s-desc">Pick ${p.choose} of ${p.size}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-pack="${i}" ${st.cash < price ? 'disabled' : ''}>OPEN</button>
    </div>`);
  });

  if (shop.license && !shop.license.sold) {
    const l = LICENSES[shop.license.key];
    const price = S.itemPrice(st, l.cost);
    tiles.push(`<div class="shop-slot kind-licence">
      <div class="s-kind">LICENCE · PERMANENT</div>
      <div class="s-art">${l.art}</div>
      <div class="s-name">${l.name}</div>
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

  const sheet = showOverlay(`
    <div style="text-align:center">
      <h2>${open.pack.name.toUpperCase()}</h2>
      <div class="sub">Choose ${open.picks} more</div>
      <div class="pack-options" id="pack-opts"></div>
      <button class="btn ghost" id="pack-skip">SKIP</button>
    </div>`, { dismissable: false, width: '760px' });

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
export function bookScreen(game, back) {
  const st = game.state;
  const bulls = st.book.filter((c) => c.bull).length;
  const enhanced = st.book.filter((c) => c.enhancement).length;
  const avg = st.book.length ? (st.book.reduce((a, c) => a + c.body, 0) / st.book.length).toFixed(1) : '0';
  const sorted = st.book.slice().sort((a, b) =>
    Object.keys(SECTORS).indexOf(a.sector) - Object.keys(SECTORS).indexOf(b.sector) || b.body - a.body);

  const sheet = showOverlay(`
    <h2>THE BOOK</h2>
    <div class="sub">${st.book.length} candles · ${enhanced} enhanced</div>
    <div class="stat-grid">
      <div class="stat-box"><label style="color:var(--green)">BULL</label><b>${bulls}</b></div>
      <div class="stat-box"><label style="color:var(--red)">BEAR</label><b>${st.book.length - bulls}</b></div>
      <div class="stat-box"><label>AVG BODY</label><b>${avg}</b></div>
      <div class="stat-box"><label>SECTORS</label><b style="font-size:12px">${Object.entries(SECTORS).map(([k, s]) =>
        `<span style="color:${s.color}">${st.book.filter((c) => c.sector === k).length}${s.glyph}</span>`).join(' ')}</b></div>
    </div>
    <div class="book-grid" id="book-grid"></div>
    <div class="btn-row"><button class="btn" id="bk-back">BACK</button></div>`,
    { dismissable: false, width: '940px' });
  const grid = sheet.querySelector('#book-grid');
  sorted.forEach((c) => grid.appendChild(candleEl(c, { reveal: true })));
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
        <button class="btn ghost" id="go-title">TITLE</button>
      </div>
    </div>`, { dismissable: false, width: '640px' });
  sheet.querySelector('#go-again').onclick = () => game.startRun(null);
  sheet.querySelector('#go-same').onclick = () => game.startRun(st.seed);
  sheet.querySelector('#go-title').onclick = () => game.toTitle();
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
    if (fromTitle) titleScreen(game, game.hasSave());
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
        <button class="btn wide ghost" id="m-mute">${game.muted ? 'UNMUTE' : 'MUTE'}</button>
        <button class="btn wide danger" id="m-quit">ABANDON RUN</button>
      </div>
    </div>`, { width: '420px', dismissable: !back });
  const resume = () => (back ? back() : closeOverlay());
  sheet.querySelector('#m-resume').onclick = resume;
  sheet.querySelector('#m-help').onclick = () => helpScreen(game, false, () => menuScreen(game, back));
  sheet.querySelector('#m-run').onclick = () => runInfoScreen(game, () => menuScreen(game, back));
  sheet.querySelector('#m-mute').onclick = () => { game.toggleMute(); menuScreen(game, back); };
  sheet.querySelector('#m-quit').onclick = () => game.toTitle();
}
