import * as S from './game/state.js';
import { RNG } from './engine/rng.js';
import { money, bignum } from './engine/util.js';
import { previewTrade } from './game/scoring.js';
import { convictionOf, FORMATIONS, CONVICTION } from './game/formations.js';
import { BROKERS, brokerSellValue } from './game/brokers.js';
import { BOSSES } from './game/bosses.js';
import { sortCandles } from './game/candles.js';
import { ChartView } from './ui/chart.js';
import { candleEl, brokerEl, consumableEl, hideTip, showTip } from './ui/components.js';
import * as FX from './ui/fx.js';
import { sfx, toast, shake, popText, particles } from './ui/fx.js';
import * as OV from './ui/overlays.js';
import * as SC from './ui/screens.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SORT_MODES = ['body', 'sector', 'polarity'];
const SORT_LABEL = { body: 'BODY', sector: 'SECTOR', polarity: 'BULL/BEAR' };

class Game {
  constructor() {
    this.state = null;
    /** Last cash total rendered — the delta animation reads off the change. */
    this.lastCash = null;
    this.chart = new ChartView($('chart'));
    this.busy = false;
    this.muted = localStorage.getItem('margincall.muted') === '1';
    FX.setMuted(this.muted);
    this.sortMode = 'body';
    this.arrangeMode = 'rising';
    this.arrangeIndex = 0;
    this.reducedMotion = localStorage.getItem('margincall.motion') === '0';
    this.applyMotion();
    this.coach = new Set();
    this.bindGlobal();
  }

  // ---------------------------------------------------------------- lifecycle
  hasSave() { return !!localStorage.getItem(S.SAVE_KEY); }
  save() { if (this.state) { try { localStorage.setItem(S.SAVE_KEY, S.serialize(this.state)); } catch {} } }
  clearSave() { localStorage.removeItem(S.SAVE_KEY); }

  toHome() { this.state = null; SC.homeScreen(this); }
  openCompendium(back) { SC.compendiumScreen(this, back); }
  /**
   * The book, on a given tab. It comes back to whatever it interrupted: the
   * board when nothing else is open, the Floor or the pack you were in
   * otherwise — opening the book must never cost you a pack.
   */
  openBook(view = 'all') {
    if (!this.state || this.busy) return;
    // Capture the way back before opening: showing the book clears it.
    const resume = OV.currentResume();
    if (OV.overlayOpen() && !resume) return;
    const back = resume || (() => OV.closeOverlay());
    sfx.open();
    OV.bookScreen(this, back, view);
  }
  openGlossary(back) { SC.glossaryScreen(this, back); }

  applyMotion() { document.body.classList.toggle('no-motion', this.reducedMotion); }
  toggleMotion() {
    this.reducedMotion = !this.reducedMotion;
    localStorage.setItem('margincall.motion', this.reducedMotion ? '0' : '1');
    this.applyMotion();
  }

  /**
   * One-shot nudges the first time a player meets a mechanic. Queued rather
   * than fired immediately — several can come due at once on a first run, and
   * three toasts on screen together is just noise.
   */
  hint(key, msg) {
    if (this.coach.has(key)) return;
    const seen = SC.career().hints || {};
    if (seen[key]) return;
    this.coach.add(key);
    SC.saveCareer({ hints: { ...seen, [key]: 1 } });
    this.hintQueue = this.hintQueue || [];
    this.hintQueue.push(msg);
    this.drainHints();
  }

  drainHints() {
    if (this.hintTimer || !this.hintQueue?.length) return;
    const msg = this.hintQueue.shift();
    toast(msg, '', 'coach');
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      this.drainHints();
    }, 3200);
  }

  startRun(seed) {
    this.state = S.newRun(seed);
    this.lastCash = null;             // no delta for the money you start with
    this.clearSave();
    this.save();
    OV.closeOverlay();
    this.render();
    OV.deadlineSelect(this);
  }

  continueRun() {
    try {
      this.state = S.deserialize(localStorage.getItem(S.SAVE_KEY));
      this.lastCash = null;           // nor for the balance a save comes back with
      OV.closeOverlay();
      this.render();
      // A run saved on the Floor picks up right there rather than losing the visit.
      if (this.state.phase === 'shop' && this.state.shop) OV.shopScreen(this);
      else OV.deadlineSelect(this);
    } catch (e) {
      console.error(e); toast('Save is corrupt — starting fresh', 'bad'); this.startRun(null);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    FX.setMuted(this.muted);
    localStorage.setItem('margincall.muted', this.muted ? '1' : '0');
  }

  // ---------------------------------------------------------------- flow
  beginDeadline(i) {
    const st = this.state;
    S.startDeadline(st, i);
    st.session.sortMode = this.sortMode;
    st.session.board = sortCandles(st.session.board, this.sortMode);
    this.chart.setMarket(st.session.market);
    this.hint('leverage', 'Volume × Leverage = P/L. Hover either number to see what feeds it.');
    OV.closeOverlay();
    this.render();
    this.renderBoard(st.session.board.map((c) => c.uid));
    this.save();
  }

  skipDeadline(i) {
    const r = S.skipDeadline(this.state, i);
    if (r.blocked) return toast(r.blocked, 'bad');
    this.render();
    OV.bonusScreen(this, r.bonus);
  }

  afterSkip() { this.render(); OV.deadlineSelect(this); this.save(); }

  openFloor() {
    S.openShop(this.state);
    this.render();
    OV.shopScreen(this);
    this.hint('floor', 'Brokers trigger left to right — drag them on your desk to change the order.');
    this.save();
  }

  leaveFloor() {
    const st = this.state;
    st.shop = null;
    S.advanceAfterDeadline(st);
    this.render();
    if (st.week > 8 && st.deadlineIndex === 0 && !st.declaredWin) {
      st.declaredWin = true;
      return this.winScreen();
    }
    OV.deadlineSelect(this);
    this.save();
  }

  recordCareer(won) {
    const st = this.state;
    if (!st) return;
    const c = SC.career();
    SC.saveCareer({
      bestWeek: Math.max(c.bestWeek || 0, st.week),
      deadlines: (c.deadlines || 0) + st.stats.deadlinesCleared,
      wins: (c.wins || 0) + (won ? 1 : 0),
    });
  }

  winScreen() {
    this.recordCareer(true);
    const st = this.state;
    const sheet = OV.showOverlay(`
      <div class="title-wrap">
        <div class="go-title win">CASHED OUT</div>
        <div class="sub" style="margin-top:12px">Eight weeks. Every quota met. You survived the desk — most don't.</div>
        <div class="go-stats">
          <div class="stat-box"><label>DEADLINES</label><b>${st.stats.deadlinesCleared}</b></div>
          <div class="stat-box"><label>BOSSES</label><b>${st.stats.bossesCleared}</b></div>
          <div class="stat-box"><label>BEST TRADE</label><b>$${bignum(st.stats.bestPL)}</b></div>
        </div>
        <div class="title-actions">
          <button class="btn primary" id="w-endless">KEEP GOING (ENDLESS)</button>
          <button class="btn ghost" id="w-new">NEW RUN</button>
        </div>
      </div>`, { dismissable: false, width: '600px' });
    sheet.querySelector('#w-endless').onclick = () => { OV.closeOverlay(); OV.deadlineSelect(this); };
    sheet.querySelector('#w-new').onclick = () => this.startRun(null);
  }

  gameOver() {
    this.recordCareer();
    sfx.fail(); shake(true); this.clearSave();
    setTimeout(() => OV.gameOverScreen(this, false), 700);
  }

  // ---------------------------------------------------------------- rendering
  render() {
    const st = this.state;
    if (!st) return;
    $('t-week').textContent = st.week;
    $('t-deadline').textContent = `${Math.min(3, st.deadlineIndex + 1)} / 3`;
    const cashEl = $('t-cash');
    const cashTxt = money(st.cash);
    if (cashEl.textContent !== cashTxt) {
      cashEl.textContent = cashTxt;
      cashEl.classList.remove('bump'); void cashEl.offsetWidth; cashEl.classList.add('bump');
    }
    // Every dollar in or out gets said. Doing it here rather than at each call
    // site means buying, selling, payouts and a rumor charging you all animate
    // without any of them having to remember to.
    if (this.lastCash != null && st.cash !== this.lastCash) FX.cashDelta(st.cash - this.lastCash);
    this.lastCash = st.cash;
    $('t-slots').textContent = `${S.slotsUsed(st)}/${st.mods.slots}`;

    this.renderDeadlineCard();
    this.renderBrokers();
    this.renderConsumables();
    this.renderBoard();
    this.renderResources();
    this.renderTape();
    this.renderMarket();
    this.updatePreview();
  }

  renderDeadlineCard() {
    const st = this.state, s = st.session;
    const card = $('deadline-card');
    if (!s) {
      card.classList.remove('boss');
      $('dl-tag').textContent = 'BETWEEN BELLS';
      $('dl-art').textContent = '🏙️';
      $('dl-quota').textContent = '—';
      $('dl-reward').innerHTML = 'Pick a deadline';
      $('dl-boss').hidden = true;
      $('dl-progress-fill').style.width = '0%';
      $('dl-profit').textContent = '$0';
      return;
    }
    const boss = s.boss ? BOSSES[s.boss] : null;
    card.classList.toggle('boss', !!boss);
    $('dl-tag').textContent = (boss ? boss.name : s.slot.name).toUpperCase();
    $('dl-art').textContent = boss ? boss.art : s.slot.art;
    $('dl-quota').textContent = money(s.quota);
    $('dl-reward').innerHTML = `Clears for <b>$${s.slot.reward}</b>`;
    const bd = $('dl-boss');
    if (boss) {
      bd.hidden = false;
      bd.innerHTML = `<b>BOSS RULE</b>${boss.blurb}${s.bossGraceLeft > 0 ? '<br><span style="color:var(--green)">(waived this trade)</span>' : ''}`;
    } else bd.hidden = true;
    $('dl-progress-fill').style.width = Math.min(100, (s.profit / s.quota) * 100) + '%';
    $('dl-profit').textContent = '$' + bignum(s.profit);
  }

  renderResources() {
    const st = this.state, s = st.session;
    const set = (id, v, warn) => { const el = $(id); el.textContent = v; el.classList.toggle('zero', !!warn && v === 0); };
    set('r-trades', s ? s.tradesLeft : st.mods.trades, true);
    set('r-sweeps', s ? s.discardsLeft : st.mods.discards, true);
    set('r-greens', s ? s.greens : 0);
    set('r-streak', s ? s.greenStreak : 0);
    $('r-book').textContent = st.book.length;
    $('r-draw').textContent = s ? s.drawPile.length : st.book.length;
  }

  /**
   * What you have booked today, and — the reason the panel exists — whether it
   * is going to be enough.
   *
   * The list on its own was a receipt: it told you what had already happened,
   * which you had just watched happen. The question you actually have with two
   * trades left is "can I still get there, or am I playing for the next run?",
   * and answering it meant holding the quota, the total and the trades left in
   * your head at once. The standing line does that arithmetic. It invents no
   * rule and costs no decision — every number in it is already on screen.
   */
  renderTape() {
    const s = this.state.session;
    const list = $('tape-list');
    const call = $('tape-call');

    call.hidden = !s;
    if (s) {
      const short = s.quota - s.profit;
      if (short <= 0) {
        call.className = 'tape-call clear';
        call.innerHTML = `<b>QUOTA CLEARED</b><span>$${bignum(-short)} over</span>`;
      } else if (s.tradesLeft > 0) {
        // What one more trade has to be worth if the rest are all like it.
        const each = short / s.tradesLeft;
        call.className = 'tape-call';
        call.innerHTML = `<b>$${bignum(short)} to go</b><span>$${bignum(each)} × ${s.tradesLeft} trade${s.tradesLeft === 1 ? '' : 's'}</span>`;
      } else {
        call.className = 'tape-call short';
        call.innerHTML = `<b>$${bignum(short)} short</b><span>no trades left</span>`;
      }
    }

    if (!s || !s.history.length) { list.innerHTML = '<div class="tape-empty">no trades booked</div>'; return; }
    list.innerHTML = s.history.slice().reverse().map((h) => {
      const c = h.conviction && h.conviction !== 'neutral' ? CONVICTION[h.conviction] : null;
      return `
      <div class="tape-row ${h.correct ? 'green' : 'red'}">
        <span class="t-dir">${h.direction === 'LONG' ? '▲' : '▼'}</span>
        <span class="t-pat">${h.formation}${c ? ` <i class="t-conv" style="color:${c.color}">×${c.mult}</i>` : ''}</span>
        <span class="t-pl">$${bignum(h.pl)}</span>
      </div>`;
    }).join('');
  }

  renderMarket() {
    const st = this.state, s = st.session;
    if (!s) {
      $('ticker-sym').textContent = '—';
      $('ticker-price').textContent = '';
      $('regime-name').textContent = '';
      $('regime-blurb').textContent = '';
      $('signal-arrow').textContent = '·';
      $('signal-arrow').className = 'signal-arrow hidden';
      $('signal-conf').textContent = 'desk closed';
      return;
    }
    const m = s.market;
    $('ticker-sym').textContent = '$' + m.symbol;
    $('ticker-price').textContent = '$' + m.price.toFixed(2);
    $('regime-name').textContent = m.regime.name;
    $('regime-name').style.color = m.regime.color;
    $('regime-blurb').textContent = m.regime.blurb;

    const arrow = $('signal-arrow'), conf = $('signal-conf');
    if (st.mods.hideSignal) {
      arrow.textContent = '?'; arrow.className = 'signal-arrow hidden'; conf.textContent = 'quiet period';
      return;
    }
    const sig = m.readSignal(st.mods.accuracy, { perfect: st.mods.perfectSignal });
    arrow.textContent = sig.up ? '▲' : '▼';
    arrow.className = 'signal-arrow ' + (sig.up ? 'up' : 'down');
    conf.textContent = sig.perfect ? 'certain' : Math.round(sig.accuracy * 100) + '% confidence';
  }

  renderBrokers() {
    const st = this.state;
    const row = $('broker-row');
    row.innerHTML = '';
    $('broker-count').textContent = `${S.slotsUsed(st)}/${st.mods.slots}`;
    st.brokers.forEach((b) => {
      const disabled = st.session && st.mods.disableFirstBroker && st.brokers[0] === b && !(st.session.bossGraceLeft > 0);
      const el = brokerEl(b, st, { disabled });
      el.style.setProperty('--i', st.brokers.indexOf(b));
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        this.dragUid = b.uid;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Chromium will not start a drag without payload on the transfer.
        try { e.dataTransfer.setData('text/plain', b.uid); } catch {}
        hideTip();
      });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); this.dragUid = null; });
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-target'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drop-target');
        const from = st.brokers.findIndex((q) => q.uid === this.dragUid);
        const to = st.brokers.findIndex((q) => q.uid === b.uid);
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = st.brokers.splice(from, 1);
        st.brokers.splice(to, 0, moved);
        sfx.select();
        this.hint('brokerOrder', 'Brokers fire left to right, so putting the + ones before the × ones pays more.');
        this.render();
        this.save();
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const name = BROKERS[b.key].name;
        const r = S.sellBroker(st, b.uid);
        if (r.ok) { sfx.cash(); toast(`Sold ${name} for $${r.value}`, 'good'); this.render(); this.save(); }
      });
      row.appendChild(el);
    });
    for (let i = S.slotsUsed(st); i < st.mods.slots; i++) {
      const e = document.createElement('div'); e.className = 'slot-empty';
      e.style.setProperty('--i', i); row.appendChild(e);
    }
  }

  renderConsumables() {
    const st = this.state;
    const row = $('consumable-row');
    row.innerHTML = '';
    $('cons-count').textContent = `${st.consumables.length}/${st.mods.chartSlots}`;
    st.consumables.forEach((c) => {
      const el = consumableEl(c, st);
      el.style.setProperty('--i', st.consumables.indexOf(c));
      el.onclick = () => this.useConsumable(c);
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault(); S.sellConsumable(st, c.uid); sfx.cash(); this.render(); this.save();
      });
      row.appendChild(el);
    });
    for (let i = st.consumables.length; i < st.mods.chartSlots; i++) {
      const e = document.createElement('div'); e.className = 'slot-empty narrow'; row.appendChild(e);
    }
  }

  renderBoard(animateNew = []) {
    const st = this.state, s = st.session;
    const row = $('board-row');
    row.innerHTML = '';
    this.renderPiles();
    if (!s) return;
    s.board.forEach((c, i) => {
      const idx = s.selected.indexOf(c.uid);
      const el = candleEl(c, { order: idx >= 0 ? idx + 1 : null });
      el.style.setProperty('--i', i);
      if (idx >= 0) el.classList.add('selected');
      el.onclick = () => { if (this.didDrag) { this.didDrag = false; return; } this.toggleCandle(c.uid); };
      el.draggable = true;
      el.addEventListener('dragstart', (e) => {
        this.dragCandle = c.uid; this.didDrag = false;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', c.uid); } catch {}
        hideTip();
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-target'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('drop-target');
        if (!this.dragCandle || this.dragCandle === c.uid) return;
        // Dragging one placed candle onto another reorders the placement and
        // leaves every unplaced candle exactly where it was — otherwise
        // reordering three cards shunts the other five along with them.
        // Anything else is a board tidy, which moves the card itself.
        if (s.selected.includes(this.dragCandle) && s.selected.includes(c.uid)) {
          S.movePlacement(st, this.dragCandle, s.selected.indexOf(c.uid));
        } else {
          S.moveBoardCandle(st, this.dragCandle, s.board.findIndex((x) => x.uid === c.uid));
        }
        this.didDrag = true;
        this.dragCandle = null;
        sfx.select();
        this.renderBoard();
        this.updatePreview();
      });
      row.appendChild(el);
    });
    if (animateNew.length) this.dealIn(row, animateNew);
  }

  // ------------------------------------------------------------------ piles
  /**
   * The deck and the swept pile that flank the board. Both are real places:
   * cards fly out of one and into the other, so the deal and the sweep read as
   * movement rather than as things blinking in and out of existence.
   */
  renderPiles() {
    const st = this.state, s = st?.session;
    const deck = s ? s.drawPile.length : (st ? st.book.length : 0);
    const swept = s ? s.swept.length : 0;
    const paint = (id, stackId, countId, n) => {
      const pile = $(id);
      if (!pile) return;
      $(countId).textContent = n;
      pile.classList.toggle('empty', n === 0);
      // The stack behind the top card thickens as the pile grows, capped so a
      // full 52-card deck does not run off the table.
      const layers = Math.min(5, Math.ceil(n / 6));
      const stack = $(stackId);
      if (+stack.dataset.layers !== layers) {
        stack.dataset.layers = layers;
        stack.innerHTML = Array.from({ length: layers }, (_, k) =>
          `<i style="transform:translate(${(k + 1) * 2.5}px,${(k + 1) * 2.5}px);opacity:${0.5 - k * 0.07}"></i>`).join('');
      }
    };
    paint('draw-pile', 'draw-stack', 'draw-count', deck);
    paint('swept-pile', 'swept-stack', 'swept-count', swept);
  }

  /**
   * Throw cash out of the given elements. Splitting the spray between the
   * emitters keeps the total the same as one burst while making it obvious
   * which numbers the money came out of.
   */
  cashFrom(ids, power) {
    const live = ids.map((id) => $(id)).filter((el) => el && el.getBoundingClientRect().width);
    if (!live.length) return;
    live.forEach((el) => {
      const r = el.getBoundingClientRect();
      FX.moneyBurst(r.left + r.width / 2, r.top + r.height * 0.4, power,
        { scale: 1 / live.length, aim: 0.34 });
    });
  }

  /** Kick a pile so it reacts to cards leaving or landing. */
  kickPile(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('kick'); void el.offsetWidth; el.classList.add('kick');
  }

  /**
   * Point a tile at a pile by measuring the gap between the two right now.
   * The keyframes default --dx/--dy to zero, so if either element cannot be
   * measured the tile simply fades in place rather than animating wrongly.
   */
  aimAt(el, pileId) {
    const pile = $(pileId);
    if (!el || !pile) return false;
    const p = pile.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width || !p.width) return false;
    el.style.setProperty('--dx', Math.round(p.left + p.width / 2 - (r.left + r.width / 2)) + 'px');
    el.style.setProperty('--dy', Math.round(p.top + p.height / 2 - (r.top + r.height / 2)) + 'px');
    return true;
  }

  /** Fly freshly dealt candles in from the deck, one after another. */
  dealIn(row, uids) {
    let n = 0;
    for (const uid of uids) {
      const el = row.querySelector(`[data-uid="${uid}"]`);
      if (!el) continue;
      this.aimAt(el, 'draw-pile');
      el.classList.add('dealing');
      el.style.animationDelay = (n * 55) + 'ms';
      n++;
    }
    if (n) this.kickPile('draw-pile');
  }

  /** Throw tiles onto the swept pile. Resolves once the last one lands. */
  async fileAway(els, cls = 'sweeping') {
    if (!els.length) return;
    els.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--sw', i);
      this.aimAt(el, 'swept-pile');
      el.classList.add(cls);
    });
    const step = cls === 'filing' ? 38 : 45;
    await sleep(Math.min(360, 150 + els.length * step));
    this.kickPile('swept-pile');
  }

  updatePreview() {
    const st = this.state, s = st.session;
    const sel = s ? S.selectedCandles(st) : [];
    if (!s || !sel.length) {
      $('formation-name').textContent = '—';
      $('formation-level').textContent = '';
      $('sc-volume').textContent = '0';
      $('sc-leverage').textContent = '0';
      $('sc-pl').textContent = '$0';
      $('conviction-label').innerHTML = '<span style="color:var(--ink-faint)">place candles to read conviction</span>';
      this.updateActions();
      return;
    }
    const held = s.board.filter((c) => !s.selected.includes(c.uid));
    const pv = previewTrade(st, sel, held, new RNG('preview' + s.tradeIndex));
    $('formation-name').textContent = pv.formationName;
    $('formation-level').textContent = 'lv.' + pv.level;
    this.setChip('sc-volume', bignum(pv.volume));
    this.setChip('sc-leverage', bignum(pv.leverage));
    $('sc-pl').textContent = '$' + bignum(pv.pl);

    if (st.mods.noConviction) {
      $('conviction-label').innerHTML = '<span style="color:var(--red)">CONVICTION SUPPRESSED</span>';
    } else {
      const cl = convictionOf(pv.scoringCandles, 'LONG', st.mods);
      const cs = convictionOf(pv.scoringCandles, 'SHORT', st.mods);
      const fmt = (glyph, c, col) =>
        `<b style="color:${c.mult > 1 ? c.color : 'var(--ink-faint)'}">${glyph} ×${c.mult.toFixed(2)}</b>`;
      $('conviction-label').innerHTML = `${fmt('▲', cl)} <span style="color:var(--ink-faint)">·</span> ${fmt('▼', cs)}`;
    }
    this.updateActions();
  }

  setChip(id, val) {
    const el = $(id);
    if (el.textContent === String(val)) return;
    el.textContent = val;
    el.classList.remove('chip-bump'); void el.offsetWidth; el.classList.add('chip-bump');
  }

  updateActions() {
    const st = this.state, s = st.session;
    const has = s && s.selected.length > 0;
    const canTrade = !!(has && s.tradesLeft > 0 && !this.busy);
    $('btn-long').disabled = !canTrade;
    $('btn-short').disabled = !canTrade;
    $('btn-sweep').disabled = !(has && s.discardsLeft > 0 && !this.busy);
    $('btn-arrange').disabled = !(s && s.selected.length > 1 && !this.busy);
    $('btn-arrange').textContent = S.ARRANGE_MODES[this.arrangeIndex % S.ARRANGE_MODES.length].label;
    $('btn-sort').textContent = SORT_LABEL[this.sortMode];
  }

  // ---------------------------------------------------------------- input
  toggleCandle(uid) {
    const st = this.state, s = st.session;
    if (!s || this.busy) return;
    const was = s.selected.includes(uid);
    S.toggleSelect(st, uid);
    const now = s.selected.includes(uid);
    if (now && s.selected.length === 1) {
      this.hint('place', 'The number on a candle is its placement order — marches read it left to right.');
    }
    if (now && s.selected.length === 3) {
      this.hint('conviction', 'Check the ▲/▼ line under your score: that is what each call is worth in Conviction.');
    }
    if (now !== was) (was ? sfx.deselect() : sfx.select());
    else if (!now) { sfx.err(); toast('You can place at most 5 candles', 'bad'); }
    this.renderBoard();
    this.updatePreview();
  }

  arrange() {
    const st = this.state, s = st.session;
    if (!s || this.busy || s.selected.length < 2) return;
    const mode = S.ARRANGE_MODES[this.arrangeIndex % S.ARRANGE_MODES.length];
    S.arrangeSelection(st, mode.key);
    this.arrangeIndex = (this.arrangeIndex + 1) % S.ARRANGE_MODES.length;
    sfx.select();
    toast(`${mode.label} — ${mode.hint}`, '', 'arrange');
    this.renderBoard();
    this.updatePreview();
  }

  sortBoard() {
    const st = this.state, s = st.session;
    if (!s) return;
    this.sortMode = SORT_MODES[(SORT_MODES.indexOf(this.sortMode) + 1) % SORT_MODES.length];
    s.sortMode = this.sortMode;
    s.board = sortCandles(s.board, this.sortMode);
    S.syncPlacementToBoard(st);
    sfx.select();
    this.renderBoard();
    this.updatePreview();
  }

  async sweep() {
    const st = this.state, s = st.session;
    if (!s || this.busy) return;
    if (!s.selected.length) { sfx.err(); return toast('Select candles to sweep', 'bad'); }
    if (s.discardsLeft <= 0) { sfx.err(); return toast('No sweeps left', 'bad'); }

    this.busy = true;
    this.updateActions();
    hideTip();

    // Throw the doomed candles onto the swept pile before the replacements
    // deal in off the deck, so the board is visibly emptied and refilled.
    const row = $('board-row');
    const doomed = s.selected.slice();
    const tiles = doomed.map((uid) => row.querySelector(`[data-uid="${uid}"]`));
    tiles.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTimeout(() => particles(r.left + r.width / 2, r.top + r.height * 0.4, '#6a7a95', 8, 70), i * 45);
    });
    sfx.sweep(doomed.length);
    await this.fileAway(tiles.filter(Boolean));

    const before = new Set(s.board.map((c) => c.uid));
    const r = S.sweepSelected(st);
    if (r.blocked) { this.busy = false; sfx.err(); return toast(r.blocked, 'bad'); }
    const fresh = s.board.filter((c) => !before.has(c.uid)).map((c) => c.uid);

    this.render();
    this.renderBoard(fresh);
    if (fresh.length) sfx.deal(fresh.length);
    if (r.created) toast(`${r.created} Chart filed`, 'good');
    this.busy = false;
    this.updateActions();
    this.save();
  }

  useConsumable(inst) {
    const st = this.state;
    const selected = st.session ? [...st.session.selected] : [];
    // Nothing picked on the board? Then aim it at the book instead of failing
    // on click — the same picker the Floor and packs use.
    if (!selected.length && OV.wantsCandles(inst.key)) {
      sfx.open();
      return OV.bookScreen(this, () => OV.closeOverlay(), 'all',
        { inst, onDone: () => { OV.closeOverlay(); this.render(); this.save(); } });
    }
    const r = S.useConsumable(st, inst.uid, selected);
    if (r.ok) { sfx.buy(); toast(r.msg, 'good'); this.render(); this.save(); }
    else { sfx.err(); toast(r.msg, 'bad'); }
  }

  // ---------------------------------------------------------------- the trade
  async play(direction) {
    const st = this.state, s = st.session;
    if (!s || this.busy) return;
    const legal = S.checkTradeLegal(st, direction);
    if (legal?.block) { sfx.err(); shake(); return toast(legal.block, 'bad'); }

    this.busy = true;
    this.updateActions();
    hideTip();

    const res = S.playTrade(st, direction);
    if (res.blocked) { this.busy = false; sfx.err(); return toast(res.blocked, 'bad'); }

    const area = $('played-candles');
    area.innerHTML = '';
    $('position-ghost').classList.add('hide');
    this.renderBoard();                       // the refilled board stays visible
    $('board-row').classList.add('settling');
    const scoringIds = new Set(res.scoringCandles.map((c) => c.uid));
    const els = new Map();
    res.played.forEach((c, i) => {
      const el = candleEl(c, { reveal: true, order: i + 1 });
      el.classList.add('played');
      if (!scoringIds.has(c.uid)) el.classList.add('dim');
      area.appendChild(el);
      els.set(c.uid, el);
    });
    sfx.play();
    // The tick you called against starts printing straight away, so the tape is
    // visibly deciding while the position is being revealed rather than the
    // answer simply appearing.
    const printMs = this.chart.printCandle(res.tape.candle);
    sfx.tick();
    await sleep(220);
    if (printMs > 220) await sleep(printMs - 220);

    this.chart.pulse(res.tape.up);
    this.renderMarket();
    await sleep(160);

    $('formation-name').textContent = res.formationName;
    $('formation-level').textContent = 'lv.' + res.level;

    const volChip = $('sc-volume'), levChip = $('sc-leverage'), plEl = $('sc-pl'), cashEl = $('t-cash');
    const VOL_KINDS = ['volume', 'candleVolume', 'xvolume'];
    const LEV_KINDS = ['leverage', 'xleverage'];
    let curVol = 0, curLev = 0, hits = 0;

    for (const step of res.steps) {
      const anchor = step.candleUid ? els.get(step.candleUid)
        : step.brokerUid ? $('broker-row').querySelector(`[data-uid="${step.brokerUid}"]`)
        : null;
      if (anchor) {
        anchor.classList.remove('scoring', 'trigger');
        void anchor.offsetWidth;
        anchor.classList.add(step.brokerUid ? 'trigger' : 'scoring');
      }

      const isVol = VOL_KINDS.includes(step.kind);
      const isLev = LEV_KINDS.includes(step.kind);
      const isMult = step.kind === 'xleverage' || step.kind === 'xvolume';
      const isCash = step.kind === 'money';

      if (isVol || isLev || isCash) {
        // A long resolution speeds up, so a big desk stays exciting not tedious.
        const pace = Math.max(0.5, 1 - hits / 34);
        const target = isCash ? cashEl : (isVol ? volChip : levChip);
        const flavour = isCash ? 'money' : (isVol ? 'volume' : 'leverage');
        FX.flyTo(anchor || area, target, step.text, isMult ? flavour + ' mult' : flavour);

        await sleep(110 * pace);                       // let the throw travel

        if (isCash) { FX.impact(cashEl, 1.2); sfx.coin(hits); }
        else if (isVol) {
          const to = step.volume;
          FX.countUp(volChip, curVol, to, 190 * pace, (v) => bignum(v));
          curVol = to;
          FX.impact(volChip, isMult ? 2.4 : 1);
          isMult ? sfx.multStep(hits, step.amount || 2) : sfx.volumeStep(hits);
        } else {
          const to = step.leverage;
          FX.countUp(levChip, curLev, to, 190 * pace, (v) => bignum(v));
          curLev = to;
          FX.impact(levChip, isMult ? 2.6 : 1);
          if (isMult) { sfx.multStep(hits, step.amount || 2); if ((step.amount || 1) >= 3) shake(); }
          else sfx.leverageStep(hits);
        }
        plEl.textContent = '$' + bignum(Math.floor(step.volume * step.leverage));
        hits++;
        await sleep(70 * pace);
      } else if (step.kind === 'green') {
        FX.burst('GREEN', res.saved ? 'STOP LOSS SAVED IT' : 'YOU CALLED IT', 'green');
        sfx.green();
        const r = area.getBoundingClientRect();
        particles(r.left + r.width / 2, r.top + r.height / 2, '#43e08a', 26);
        await sleep(520);
      } else if (step.kind === 'red') {
        FX.burst('RED', 'WRONG WAY', 'red');
        sfx.red(); shake();
        await sleep(520);
      } else {
        curVol = step.volume; curLev = step.leverage;
        this.setChip('sc-volume', bignum(curVol));
        this.setChip('sc-leverage', bignum(curLev));
        plEl.textContent = '$' + bignum(Math.floor(curVol * curLev));
        if (step.kind === 'base') sfx.place();
        await sleep(150);
      }
    }

    // --- the payoff -------------------------------------------------------
    const tier = res.pl < 500 ? 0 : res.pl < 3000 ? 1 : res.pl < 20000 ? 2 : res.pl < 200000 ? 3 : 4;
    FX.countUp(plEl, Math.floor(curVol * curLev), res.pl, 420, (v) => '$' + bignum(v));
    FX.impact(plEl, 2 + tier * 0.3);
    FX.burst('$' + bignum(res.pl), res.capped ? 'CAPPED BY THE CEILING' : res.formationName.toUpperCase(),
      res.correct ? 'green' : 'red');
    sfx.crescendo(tier);
    if (tier >= 2) shake(tier >= 3);
    {
      const r = $('play-area').getBoundingClientRect();
      particles(r.left + r.width / 2, r.top + r.height / 2,
        res.correct ? '#ffd24a' : '#ff5468', 18 + tier * 10, 140 + tier * 40);
    }
    await sleep(620);

    // Held for the quota-met beat: render() clears the preview chips back to
    // zero, and cash pouring out of a pair of zeroes reads like a glitch.
    this.lastScore = { volume: res.volume, leverage: res.leverage };
    if (res.money) toast(`${res.money > 0 ? '+' : '-'}$${Math.abs(res.money)} in fees & rebates`, res.money > 0 ? 'good' : 'bad');
    if (res.destroyedCandles?.length) {
      for (const c of res.destroyedCandles) els.get(c.uid)?.classList.add('shatter');
      toast(`${res.destroyedCandles.length} candle(s) destroyed`, 'bad');
      await sleep(300);
    }

    this.renderDeadlineCard();
    this.renderResources();
    this.renderTape();
    this.renderBrokers();
    await sleep(200);
    // The position is filed away onto the swept pile rather than just vanishing.
    const alive = res.played
      .filter((c) => !res.destroyedCandles?.some((d) => d.uid === c.uid))
      .map((c) => els.get(c.uid));
    sfx.sweep(alive.length);
    await this.fileAway(alive.filter(Boolean), 'filing');
    area.innerHTML = '';
    $('board-row').classList.remove('settling');
    $('position-ghost').classList.remove('hide');
    this.busy = false;
    this.render();
    this.save();

    if (res.cleared) return this.clearDeadline();
    if (res.busted) return this.gameOver();
  }

  async clearDeadline() {
    sfx.clear();
    const s = this.state.session;
    const area = $('play-area').getBoundingClientRect();
    particles(area.left + area.width / 2, area.top + area.height / 2, '#ffd94a', 40, 220);
    // Scaled by the overshoot: scraping the quota gets a handful of dollars,
    // burying it by 6x buries the screen. Full power is deliberately reached
    // well short of the biggest builds, so the ceiling is a spectacle to chase
    // rather than a wall everything looks the same past.
    if (this.lastScore) {
      $('sc-volume').textContent = bignum(this.lastScore.volume);
      $('sc-leverage').textContent = bignum(this.lastScore.leverage);
    }
    const over = s?.quota > 0 ? s.profit / s.quota : 1;
    const power = Math.max(0, Math.min(1, (over - 1) / 5));
    // Thrown by the two numbers that earned it — Volume and Leverage — rather
    // than from nowhere in particular. Each chip gets half the spray, aimed up
    // and to the right so it crosses the table instead of the sidebar edge.
    this.cashFrom(['sc-volume', 'sc-leverage'], power);
    for (let i = 0; i < Math.round(2 + power * 6); i++) setTimeout(() => sfx.coin(i), 120 + i * 90);
    FX.burst('QUOTA MET', 'CLOSE THE BOOKS', 'gold');
    await sleep(900);
    const payout = S.finishDeadline(this.state);
    this.render();
    OV.payoutScreen(this, payout);
    this.save();
  }

  /** Explain the HUD. Every number on screen should be able to say what it is. */
  bindExplainers() {
    const tip = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('mouseenter', () => showTip(el, fn()));
      el.addEventListener('mouseleave', hideTip);
    };
    const st = () => this.state;
    tip('sc-volume', () => `<h4>Volume</h4>
      <div class="tt-rarity" style="color:var(--cyan)">THE SIZE OF THE POSITION</div>
      <div class="tt-body">The formation sets a base, then <b>every candle that prints adds its body</b> on top.
      Anything that reads <em>+X Volume</em> lands here.</div>
      <div class="tt-foot">Volume × Leverage = P/L</div>`);
    tip('sc-leverage', () => `<h4>Leverage</h4>
      <div class="tt-rarity" style="color:var(--red)">THE MULTIPLIER</div>
      <div class="tt-body"><em>+X Leverage</em> adds to this number. <em>×X Leverage</em> multiplies whatever has
      already been added — which is why the order of your brokers changes the result.</div>
      <div class="tt-foot">Once Volume is large, a ×2 beats any +50</div>`);
    tip('sc-pl', () => `<h4>Projected P/L</h4>
      <div class="tt-body">Volume × Leverage, before the tape resolves. Book enough of it to clear the quota
      before your trades run out.</div>`);
    tip('conviction-row', () => `<h4>Conviction</h4>
      <div class="tt-rarity" style="color:var(--gold)">YOUR CANDLES BACKING YOUR CALL</div>
      <div class="tt-body">Every printed candle that agrees with the direction you call pays you for it.
      <b>All of them agree</b> is <em>×1.5 Leverage</em>; <b>most of them</b> is <em>×1.2</em>.</div>
      <div class="tt-foot">▲ is what LONG pays · ▼ is what SHORT pays</div>`);
    tip('formation-name', () => {
      const s = st()?.session;
      const sel = s ? S.selectedCandles(st()) : [];
      if (!sel.length) return `<h4>Formation</h4><div class="tt-body">Place candles to print one.</div>`;
      const pv = previewTrade(st(), sel, s.board.filter((c) => !s.selected.includes(c.uid)), new RNG('tip'));
      const f = FORMATIONS[pv.formationKey];
      return `<h4>${f.name}</h4>
        <div class="tt-rarity" style="color:var(--cyan)">LEVEL ${pv.level}</div>
        <div class="tt-body">Made of <b>${f.made}</b>.</div>
        <div class="tt-body">Base <em>${pv.volume ? f.volume : f.volume} Volume</em> × <em>${f.leverage} Leverage</em> at level 1.
        Contracts level it permanently.</div>`;
    });
    tip('signal-box', () => {
      const m = st()?.mods;
      if (!m) return '<h4>Desk signal</h4>';
      if (m.hideSignal) return `<h4>Desk signal</h4><div class="tt-body">Hidden by the boss this deadline. You are calling it blind.</div>`;
      return `<h4>Desk signal</h4>
        <div class="tt-rarity" style="color:var(--ink-dim)">${m.perfectSignal ? 'ALWAYS TRUTHFUL' : Math.round(m.accuracy * 100) + '% TRUTHFUL'}</div>
        <div class="tt-body">The arrow points where the tape goes next — but it lies the rest of the time.
        Terminals, feeds and burner phones raise the number.</div>`;
    });
    tip('dl-quota', () => {
      const g = st();
      const s = g?.session;
      if (!s) return `<h4>Quota</h4><div class="tt-body">Pick a deadline to begin.</div>`;
      const act = S.actOf(g.week);
      const curve = act > 1
        ? `<div class="tt-body">Week ${g.week} is in <b>act ${act}</b> — this quota is
           <em>×${bignum(S.weekGrowth(g.week))}</em> last week's, and that multiplier is bigger
           every week. A desk that is working compounds; past act 1 the quota compounds harder.</div>`
        : '';
      return `<h4>Quota</h4>
        <div class="tt-body">Book <em>${money(s.quota)}</em> in P/L before your trades run out.
        You have booked <b>${money(s.profit)}</b> with <b>${s.tradesLeft}</b> trade${s.tradesLeft === 1 ? '' : 's'} left.</div>
        ${curve}
        <div class="tt-foot">Miss it and the run ends</div>`;
    });
    tip('draw-pile', () => {
      const s = st()?.session;
      const n = s ? s.drawPile.length : (st()?.book.length ?? 0);
      return `<h4>The deck</h4>
        <div class="tt-rarity" style="color:var(--cyan)">${n} CANDLE${n === 1 ? '' : 'S'} LEFT TO DEAL</div>
        <div class="tt-body">Your whole book is shuffled in here at the bell, and the board is topped up off the
        top of it. Once it runs dry the board only shrinks.</div>
        <div class="tt-foot">Click to see exactly which candles are still in here</div>`;
    });
    tip('swept-pile', () => {
      const s = st()?.session;
      const n = s ? s.swept.length : 0;
      return `<h4>The swept pile</h4>
        <div class="tt-rarity" style="color:var(--ink-dim)">${n} CANDLE${n === 1 ? '' : 'S'} SPENT</div>
        <div class="tt-body">Everything you have traded or swept this deadline lands here. It does not shuffle
        back in — what is gone is gone until the next bell.</div>
        <div class="tt-foot">Click to open your book</div>`;
    });
    tip('r-trades', () => `<h4>Trades</h4><div class="tt-body">One placement plus one call each. Unused trades pay
      <em>$1</em> apiece when you clear the deadline.</div>`);
    tip('r-sweeps', () => `<h4>Sweeps</h4><div class="tt-body">Throw candles back and draw replacements without
      spending a trade. Use them to chase a better formation.</div>`);
    tip('r-greens', () => `<h4>Green trades</h4><div class="tt-body">Calls you got right this deadline. Several
      brokers scale off a green streak.</div>`);
    tip('regime-badge', () => {
      const s = st()?.session;
      if (!s) return '<h4>Market regime</h4>';
      const r = s.market.regime;
      return `<h4>${r.name}</h4><div class="tt-rarity" style="color:${r.color}">MARKET REGIME</div>
        <div class="tt-body">${r.blurb}</div>
        <div class="tt-foot">LONG pays ×${r.longMult} · SHORT pays ×${r.shortMult} on a correct call</div>`;
    });
  }

  // ---------------------------------------------------------------- global
  bindGlobal() {
    this.bindExplainers();
    $('btn-long').onclick = () => this.play('LONG');
    $('btn-short').onclick = () => this.play('SHORT');
    // The deck is where the question "what can I still draw?" occurs to you, so
    // it is where the answer should be — clicking it opens the book already on
    // REMAINING rather than making you find the tab.
    $('draw-pile').onclick = () => this.openBook('remaining');
    $('swept-pile').onclick = () => this.openBook('all');
    $('btn-sweep').onclick = () => this.sweep();
    $('btn-arrange').onclick = () => this.arrange();
    $('btn-sort').onclick = () => this.sortBoard();
    $('btn-help').onclick = () => OV.helpScreen(this);
    $('btn-menu').onclick = () => (this.state ? OV.menuScreen(this) : this.toHome());
    $('btn-book').onclick = () => this.openBook('all');
    $('btn-formations').onclick = () => this.state && OV.formationScreen(this, () => OV.closeOverlay());

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const st = this.state, s = st?.session;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (OV.overlayOpen()) { if (OV.overlayDismissable()) OV.closeOverlay(); }
        else if (st) OV.menuScreen(this);
        return;
      }
      if (k === 'm') { this.toggleMute(); toast(this.muted ? 'Muted' : 'Unmuted'); return; }
      // The book reads the same from the board, the Floor and a pack, so its
      // key works from all three rather than only when nothing is open.
      if (k === 'b' && st) { this.openBook('all'); return; }
      if (k === '?') { OV.helpScreen(this); return; }
      if (OV.overlayOpen() || !s || this.busy) return;
      if (k === 'l') { e.preventDefault(); this.play('LONG'); }
      else if (k === 's') { e.preventDefault(); this.play('SHORT'); }
      else if (k === 'w') { e.preventDefault(); this.sweep(); }
      else if (k === 'a') { e.preventDefault(); this.arrange(); }
      else if (k === ' ') { e.preventDefault(); this.sortBoard(); }
      else if (/^[1-9]$/.test(k)) { const c = s.board[+k - 1]; if (c) this.toggleCandle(c.uid); }
      else if (k === '0') { const c = s.board[9]; if (c) this.toggleCandle(c.uid); }
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.broker, .consumable')) e.preventDefault();
    });
  }
}

const game = new Game();
window.game = game;
SC.homeScreen(game);
// Tell the boot watchdog in index.html that the game came up.
if (window.__MC_BOOT) window.__MC_BOOT.ok = true;
