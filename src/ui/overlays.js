import { money, bignum } from '../engine/util.js';
import { PATTERN_KEYS, PATTERNS, patternStats } from '../game/patterns.js';
import { PERKS, RARITY, perkText, makePerk } from '../game/perks.js';
import { ALL_CONSUMABLES, CHARTS } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';
import { BOSSES } from '../game/bosses.js';
import { REGIMES } from '../game/market.js';
import { SECTORS, RANK_BY_VALUE, cardName } from '../game/cards.js';
import * as S from '../game/state.js';
import { cardEl, perkEl, consumableEl, attachTip, hideTip, perkTip, consumableTip, licenseTip } from './components.js';
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
  if (opts.dismissable !== false) {
    ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(); });
  }
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
      <p style="color:var(--ink-dim);font-size:12px;line-height:1.7;max-width:560px;margin:0 auto 6px">
        A roguelike day-trading deckbuilder. Build a position out of ticker cards, call the tape
        <b style="color:var(--green)">LONG</b> or <b style="color:var(--red)">SHORT</b>, and book enough P/L to clear
        the day's quota. Three deadlines a week. The third one bites back.
      </p>
      <div class="seed-row">
        <input id="seed-input" placeholder="SEED (optional)" maxlength="16" />
      </div>
      <div class="title-actions">
        <button class="btn primary" id="t-new">NEW RUN</button>
        ${hasSave ? '<button class="btn" id="t-continue">CONTINUE</button>' : ''}
        <button class="btn ghost" id="t-help">HOW TO PLAY</button>
      </div>
      <div style="margin-top:22px;font-size:10px;color:var(--ink-faint);letter-spacing:.14em">
        ${Object.keys(PERKS).length} PERKS · ${Object.keys(ALL_CONSUMABLES).length} CONSUMABLES ·
        ${Object.keys(LICENSES).length} LICENSES · ${Object.keys(BOSSES).length} BOSS DEADLINES
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
    const quota = S.quotaFor(st, slot) * (slot.boss ? (BOSSES[slot.boss].quotaMult || 1) : 1);
    const boss = slot.boss ? BOSSES[slot.boss] : null;
    const regime = REGIMES[slot.regime];
    const current = i === st.deadlineIndex;
    const done = slot.done || i < st.deadlineIndex;
    return `
      <div class="dl-choice ${current ? 'current' : ''} ${slot.boss ? 'boss' : ''} ${done ? 'done' : ''}">
        <div class="c-art">${boss ? boss.art : slot.art}</div>
        <div class="c-name">${boss ? boss.name.toUpperCase() : slot.name.toUpperCase()}</div>
        <div class="c-quota">${money(Math.round(quota / 10) * 10)}</div>
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
    <div class="sub">Three deadlines. Clear all three to move to next week. Skipping a deadline trades the cash for a bonus.</div>
    <div class="dl-choices">${cards}</div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
      <button class="btn ghost" id="dl-port">PORTFOLIO</button>
      <button class="btn ghost" id="dl-pat">PATTERNS</button>
      <button class="btn ghost" id="dl-run">RUN INFO</button>
      <button class="btn ghost" id="dl-menu">MENU</button>
    </div>`, { dismissable: false, width: '900px' });

  sheet.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => { sfx.open(); game.beginDeadline(+b.dataset.play); });
  sheet.querySelectorAll('[data-skip]').forEach((b) => b.onclick = () => { sfx.buy(); game.skipDeadline(+b.dataset.skip); });
  sheet.querySelector('#dl-port').onclick = () => portfolioScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-pat').onclick = () => patternScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-run').onclick = () => runInfoScreen(game, () => deadlineSelect(game));
  sheet.querySelector('#dl-menu').onclick = () => menuScreen(game, () => deadlineSelect(game));
}

// ---------------------------------------------------------------------------
export function bonusScreen(game, bonus) {
  const sheet = showOverlay(`
    <div style="text-align:center">
      <div style="font-size:52px">${bonus.art}</div>
      <h2 style="margin-top:8px">${bonus.name.toUpperCase()}</h2>
      <div class="sub">${bonus.text}</div>
      <button class="btn primary" id="b-ok">CONTINUE</button>
    </div>`, { dismissable: false, width: '460px' });
  sheet.querySelector('#b-ok').onclick = () => { closeOverlay(); game.afterSkip(); };
}

// ---------------------------------------------------------------------------
export function payoutScreen(game, payout) {
  const lines = payout.lines.map((l) => `
    <div class="payout-line"><span>${l.label}</span><b>${l.amount >= 0 ? '+' : '-'}$${Math.abs(l.amount)}</b></div>`).join('');
  const sheet = showOverlay(`
    <div style="text-align:center">
      <h2 style="color:var(--green)">DEADLINE CLEARED</h2>
      <div class="sub">Booked ${money(payout.profit)} against a ${money(payout.quota)} quota
        · ${payout.greens} green / ${payout.reds} red</div>
    </div>
    <div class="payout-lines">${lines}
      <div class="payout-total"><span>CASH OUT</span><b>+$${payout.total}</b></div>
    </div>
    <div style="text-align:center"><button class="btn primary" id="p-ok">HIT THE FLOOR</button></div>`,
    { dismissable: false, width: '520px' });
  sheet.querySelector('#p-ok').onclick = () => { sfx.buy(); game.openFloor(); };
}

// ---------------------------------------------------------------------------
export function shopScreen(game) {
  const st = game.state;
  const shop = st.shop;

  const itemHtml = shop.items.map((it, i) => {
    const price = S.itemPrice(st, it.cost);
    let art, name, desc, cls = '';
    if (it.type === 'perk') {
      const d = PERKS[it.key];
      art = d.art; name = d.name; desc = perkText(it.inst, st);
      cls = `rar-${d.rarity}`;
    } else {
      const d = ALL_CONSUMABLES[it.key];
      art = d.art; name = d.name; desc = d.text;
    }
    return `<div class="shop-slot ${it.sold ? 'sold' : ''} ${cls}" data-item="${i}">
      <div class="s-art">${art}</div>
      <div class="s-name">${name}</div>
      <div class="s-desc">${desc}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-buy="${i}" ${st.cash < price ? 'disabled' : ''}>BUY</button>
    </div>`;
  }).join('');

  const packHtml = shop.packs.map((p, i) => {
    const price = S.itemPrice(st, p.cost);
    return `<div class="shop-slot ${p.sold ? 'sold' : ''}">
      <div class="s-art">${p.art}</div>
      <div class="s-name">${p.name}</div>
      <div class="s-desc">Choose ${p.choose} of ${p.size}</div>
      <div class="s-price">$${price}</div>
      <button class="btn" data-pack="${i}" ${st.cash < price ? 'disabled' : ''}>OPEN</button>
    </div>`;
  }).join('');

  const lic = shop.license && !shop.license.sold ? (() => {
    const l = LICENSES[shop.license.key];
    const price = S.itemPrice(st, l.cost);
    return `<div class="license-card">
      <div class="l-art">${l.art}</div>
      <div class="l-name">${l.name}</div>
      <div class="l-desc">${l.text}</div>
      <button class="btn" id="buy-lic" ${st.cash < price ? 'disabled' : ''}>BUY $${price}</button>
    </div>`;
  })() : '<div style="font-size:10px;color:var(--ink-faint);text-align:center;padding:14px">No licence on offer</div>';

  const rerollCost = Math.max(0, shop.rerollCost - st.mods.rerollDiscount);
  const sheet = showOverlay(`
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <div><h2>THE FLOOR</h2><div class="sub">Week ${st.week} · spend it before the bell</div></div>
      <div style="font-size:22px;color:var(--gold);font-weight:700">${money(st.cash)}</div>
    </div>
    <div class="shop-grid">
      <div>
        <h3>ON OFFER</h3>
        <div class="shop-items" id="shop-items">${itemHtml}</div>
        <h3>PACKS</h3>
        <div class="pack-row">${packHtml}</div>
      </div>
      <div class="shop-side">
        <h3 style="margin-top:0">LICENCE</h3>
        ${lic}
        <h3>YOUR DESK</h3>
        <div id="shop-desk" style="display:flex;gap:6px;flex-wrap:wrap;min-height:90px"></div>
        <div style="font-size:10px;color:var(--ink-faint)">Right-click a perk to sell it.</div>
        <h3>CHARTS</h3>
        <div id="shop-cons" style="display:flex;gap:6px;flex-wrap:wrap;min-height:58px"></div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:center;margin-top:20px">
      <button class="btn" id="shop-reroll" ${st.cash < rerollCost && shop.freeRerolls <= 0 ? 'disabled' : ''}>
        REROLL ${shop.freeRerolls > 0 ? '(FREE x' + shop.freeRerolls + ')' : '$' + rerollCost}</button>
      <button class="btn ghost" id="shop-port">PORTFOLIO</button>
      <button class="btn primary" id="shop-next">NEXT DEADLINE →</button>
    </div>`, { dismissable: false, width: '1080px' });

  // desk / consumables previews
  const desk = sheet.querySelector('#shop-desk');
  st.perks.forEach((p) => {
    const el = perkEl(p, st);
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const r = S.sellPerk(st, p.uid);
      if (r.ok) { sfx.cash(); toast(`Sold for $${r.value}`, 'good'); shopScreen(game); game.render(); }
    });
    desk.appendChild(el);
  });
  const cons = sheet.querySelector('#shop-cons');
  st.consumables.forEach((c) => {
    const el = consumableEl(c, st);
    el.onclick = () => {
      const r = S.useConsumable(st, c.uid, []);
      if (r.ok) { sfx.buy(); toast(r.msg, 'good'); shopScreen(game); game.render(); }
      else toast(r.msg || 'Needs tickers selected — use it during a deadline', 'bad');
    };
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); S.sellConsumable(st, c.uid); sfx.cash(); shopScreen(game); game.render();
    });
    cons.appendChild(el);
  });

  sheet.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
    const r = S.buyShopItem(st, +b.dataset.buy);
    if (r.ok) { sfx.buy(); shopScreen(game); game.render(); }
    else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelectorAll('[data-pack]').forEach((b) => b.onclick = () => {
    const r = S.buyPack(st, +b.dataset.pack);
    if (r.ok) { sfx.open(); packScreen(game); }
    else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelector('#buy-lic')?.addEventListener('click', () => {
    const r = S.buyLicense(st);
    if (r.ok) { sfx.buy(); shopScreen(game); game.render(); } else { sfx.err(); toast(r.blocked, 'bad'); }
  });
  sheet.querySelector('#shop-reroll').onclick = () => {
    const r = S.rerollShop(st);
    if (r.ok) { sfx.select(); shopScreen(game); game.render(); } else { sfx.err(); toast(r.blocked, 'bad'); }
  };
  sheet.querySelector('#shop-port').onclick = () => portfolioScreen(game, () => shopScreen(game));
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
    if (opt.type === 'ticker') el = cardEl(opt.card, { reveal: true });
    else if (opt.type === 'perk') { el = perkEl(opt.inst, st, { hideSell: true }); el.style.transform = 'scale(1.3)'; el.style.margin = '12px 18px'; }
    else { el = consumableEl({ key: opt.key, uid: 'pk' + i }, st); el.style.transform = 'scale(1.35)'; el.style.margin = '10px 14px'; }
    el.classList.add('pack-opt');
    if (opt.taken) el.classList.add('taken');
    el.onclick = () => {
      const r = S.pickFromPack(st, i);
      if (r.ok) {
        sfx.buy();
        if (st.shop.pack) packScreen(game); else { shopScreen(game); }
        game.render();
      } else { sfx.err(); toast(r.blocked, 'bad'); }
    };
    wrap.appendChild(el);
  });
  sheet.querySelector('#pack-skip').onclick = () => { S.closePack(st); shopScreen(game); };
}

// ---------------------------------------------------------------------------
export function portfolioScreen(game, back) {
  const st = game.state;
  const bySector = {};
  for (const k of Object.keys(SECTORS)) bySector[k] = st.deck.filter((c) => c.sector === k).length;
  const enhanced = st.deck.filter((c) => c.enhancement).length;
  const sorted = st.deck.slice().sort((a, b) =>
    Object.keys(SECTORS).indexOf(a.sector) - Object.keys(SECTORS).indexOf(b.sector) || b.rank - a.rank);

  const sheet = showOverlay(`
    <h2>PORTFOLIO</h2>
    <div class="sub">${st.deck.length} tickers · ${enhanced} enhanced</div>
    <div class="deck-stats">
      ${Object.entries(SECTORS).map(([k, s]) =>
        `<div class="deck-stat"><label style="color:${s.color}">${s.name.toUpperCase()} ${s.glyph}</label><b>${bySector[k]}</b></div>`).join('')}
    </div>
    <div class="deck-grid" id="deck-grid"></div>
    <div style="text-align:center;margin-top:18px"><button class="btn" id="pf-back">BACK</button></div>`,
    { dismissable: false, width: '900px' });
  const grid = sheet.querySelector('#deck-grid');
  sorted.forEach((c) => grid.appendChild(cardEl(c, { reveal: true })));
  sheet.querySelector('#pf-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
export function patternScreen(game, back) {
  const st = game.state;
  const rows = PATTERN_KEYS.slice().reverse().map((k) => {
    const p = PATTERNS[k];
    const lv = st.patterns[k];
    const hidden = p.secret && !st.discoveredPatterns.includes(k) && lv.played === 0;
    const s = patternStats(k, lv.level);
    return `<tr class="${hidden ? 'secret' : ''}">
      <td>${hidden ? '???????' : p.name}</td>
      <td style="color:var(--ink-faint)">${hidden ? '???' : p.poker}</td>
      <td class="lv">lv.${lv.level}</td>
      <td class="v">${hidden ? '?' : s.volume}</td>
      <td class="m">${hidden ? '?' : 'x' + s.leverage}</td>
      <td style="color:var(--ink-faint)">${lv.played}</td>
    </tr>`;
  }).join('');
  const sheet = showOverlay(`
    <h2>CHART PATTERNS</h2>
    <div class="sub">Contracts bought on the Floor permanently level these up.</div>
    <table class="pat-table">
      <tr><th>PATTERN</th><th>MADE OF</th><th>LEVEL</th><th>VOLUME</th><th>LEVERAGE</th><th>PLAYED</th></tr>
      ${rows}
    </table>
    <div style="text-align:center;margin-top:18px"><button class="btn" id="pt-back">BACK</button></div>`,
    { dismissable: false, width: '640px' });
  sheet.querySelector('#pt-back').onclick = () => (back ? back() : closeOverlay());
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
    <div class="deck-stats" style="grid-template-columns:repeat(4,1fr)">
      <div class="deck-stat"><label>TRADES</label><b>${m.trades}</b></div>
      <div class="deck-stat"><label>DISCARDS</label><b>${m.discards}</b></div>
      <div class="deck-stat"><label>HAND SIZE</label><b>${m.handSize}</b></div>
      <div class="deck-stat"><label>DESK SLOTS</label><b>${m.slots}</b></div>
      <div class="deck-stat"><label>SIGNAL</label><b>${m.perfectSignal ? '100%' : Math.round(m.accuracy * 100) + '%'}</b></div>
      <div class="deck-stat"><label>WRONG-WAY</label><b>x${m.redMult}</b></div>
      <div class="deck-stat"><label>INTEREST</label><b>$1/$${m.interestRate}</b></div>
      <div class="deck-stat"><label>CAP</label><b>$${m.interestCap}</b></div>
    </div>
    <h3>LICENCES</h3>${licHtml}
    <h3>CAREER</h3>
    <div class="deck-stats" style="grid-template-columns:repeat(4,1fr)">
      <div class="deck-stat"><label>TRADES</label><b>${st.stats.trades}</b></div>
      <div class="deck-stat"><label>GREEN</label><b class="green">${st.stats.greens}</b></div>
      <div class="deck-stat"><label>RED</label><b>${st.stats.reds}</b></div>
      <div class="deck-stat"><label>BEST P/L</label><b>${'$' + bignum(st.stats.bestPL)}</b></div>
    </div>
    <div style="text-align:center;margin-top:18px"><button class="btn" id="ri-back">BACK</button></div>`,
    { dismissable: false, width: '640px' });
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
        <div class="deck-stat"><label>REACHED</label><b>Week ${st.week} · DL ${st.deadlineIndex + 1}</b></div>
        <div class="deck-stat"><label>DEADLINES</label><b>${st.stats.deadlinesCleared}</b></div>
        <div class="deck-stat"><label>BOSSES</label><b>${st.stats.bossesCleared}</b></div>
        <div class="deck-stat"><label>TRADES</label><b>${st.stats.trades}</b></div>
        <div class="deck-stat"><label>GREEN / RED</label><b>${st.stats.greens} / ${st.stats.reds}</b></div>
        <div class="deck-stat"><label>BEST TRADE</label><b>$${bignum(st.stats.bestPL)}</b></div>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-bottom:16px">SEED ${st.seed}</div>
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
    <div class="sub">You have one week to double the desk's money. Then another. Then another.</div>
    <div class="help-cols">
      <div>
        <h3>THE LOOP</h3>
        <ul>
          <li>Every <b>deadline</b> gives you a <b>quota</b> and a handful of <b>trades</b>.</li>
          <li>Pick 1–5 tickers from your hand to build a position.</li>
          <li>The pattern they form (pair, straight, flush…) sets your base
              <b style="color:var(--cyan)">Volume</b> and <b style="color:var(--red)">Leverage</b>.</li>
          <li>Then call it: <b style="color:var(--green)">LONG</b> or <b style="color:var(--red)">SHORT</b>.</li>
          <li>Call it right → <b>GREEN</b>, you book the full P/L.
              Call it wrong → <b>RED</b>, you keep only 35% of it.</li>
          <li>Volume × Leverage = P/L. Reach the quota before you run out of trades.</li>
          <li>Miss the quota and the run ends. That's it. No second chances.</li>
        </ul>
        <h3>THE SIGNAL</h3>
        <ul>
          <li>The desk shows an arrow for the next tick — but it only tells the truth
              <b>68%</b> of the time to start.</li>
          <li>Terminals, feeds and phones raise that. Some perks stop caring entirely.</li>
          <li>The market <b>regime</b> (Bull Run, Capitulation, Squeeze…) changes payouts for each direction.</li>
        </ul>
      </div>
      <div>
        <h3>BUILDING A DESK</h3>
        <ul>
          <li><b>Perks</b> sit on your desk and trigger left to right. Drag to reorder — order matters
              when multipliers are involved.</li>
          <li><b>Charts</b> reshape your portfolio, <b>Contracts</b> permanently level a pattern,
              <b>Rumors</b> are high-risk power spikes.</li>
          <li><b>Licences</b> are permanent run upgrades. <b>Packs</b> let you pick from a spread.</li>
          <li>Skipping a non-boss deadline trades the payout for a <b>bonus</b>.</li>
        </ul>
        <h3>BOSS DEADLINES</h3>
        <ul>
          <li>Every third deadline is a <b>boss</b> with a rule that breaks your build:
              blanked sectors, banned directions, halved leverage, disabled perks.</li>
          <li>Read it on the select screen and buy around it.</li>
        </ul>
        <h3>CONTROLS</h3>
        <ul>
          <li><span class="k">1–9</span> select ticker · <span class="k">click</span> select</li>
          <li><span class="k">L</span> long · <span class="k">S</span> short · <span class="k">D</span> discard</li>
          <li><span class="k">Space</span> sort hand · <span class="k">Esc</span> close · <span class="k">M</span> mute</li>
          <li>Right-click a perk or chart to sell it.</li>
        </ul>
      </div>
    </div>
    <div style="text-align:center;margin-top:20px"><button class="btn primary" id="h-back">GOT IT</button></div>`,
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
