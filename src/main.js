import * as S from './game/state.js';
import { RNG } from './engine/rng.js';
import { money, bignum } from './engine/util.js';
import { previewTrade } from './game/scoring.js';
import { PATTERNS, patternStats } from './game/patterns.js';
import { PERKS, perkSellValue } from './game/perks.js';
import { ALL_CONSUMABLES } from './game/consumables.js';
import { BOSSES } from './game/bosses.js';
import { REGIMES } from './game/market.js';
import { sortCards, SECTORS } from './game/cards.js';
import { ChartView } from './ui/chart.js';
import { cardEl, perkEl, consumableEl, hideTip } from './ui/components.js';
import * as FX from './ui/fx.js';
import { sfx, toast, shake, burst, popText, particles } from './ui/fx.js';
import * as OV from './ui/overlays.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Game {
  constructor() {
    this.state = null;
    this.chart = new ChartView($('chart'));
    this.busy = false;
    this.muted = localStorage.getItem('margincall.muted') === '1';
    FX.setMuted(this.muted);
    this.sortMode = 'rank';
    this.pendingConsumable = null;
    this.bindGlobal();
  }

  // ---------------------------------------------------------------- lifecycle
  hasSave() { return !!localStorage.getItem(S.SAVE_KEY); }

  save() {
    if (!this.state) return;
    try { localStorage.setItem(S.SAVE_KEY, S.serialize(this.state)); } catch {}
  }
  clearSave() { localStorage.removeItem(S.SAVE_KEY); }

  toTitle() {
    this.state = null;
    OV.titleScreen(this, this.hasSave());
  }

  startRun(seed) {
    this.state = S.newRun(seed);
    this.clearSave();
    this.save();
    OV.closeOverlay();
    this.render();
    OV.deadlineSelect(this);
  }

  continueRun() {
    try {
      this.state = S.deserialize(localStorage.getItem(S.SAVE_KEY));
      OV.closeOverlay();
      this.render();
      OV.deadlineSelect(this);
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
    this.chart.setMarket(st.session.market);
    OV.closeOverlay();
    this.render();
    this.dealAnimation();
    this.save();
  }

  skipDeadline(i) {
    const r = S.skipDeadline(this.state, i);
    if (r.blocked) return toast(r.blocked, 'bad');
    this.render();
    OV.bonusScreen(this, r.bonus);
  }

  afterSkip() {
    this.render();
    OV.deadlineSelect(this);
    this.save();
  }

  openFloor() {
    S.openShop(this.state);
    this.render();
    OV.shopScreen(this);
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

  winScreen() {
    const sheet = OV.showOverlay(`
      <div class="title-wrap">
        <div class="go-title win">CASHED OUT</div>
        <div class="sub" style="margin-top:12px">
          Eight weeks. Every quota met. You survived the desk — most don't.
        </div>
        <div class="go-stats">
          <div class="deck-stat"><label>DEADLINES</label><b>${this.state.stats.deadlinesCleared}</b></div>
          <div class="deck-stat"><label>BOSSES</label><b>${this.state.stats.bossesCleared}</b></div>
          <div class="deck-stat"><label>BEST TRADE</label><b>$${bignum(this.state.stats.bestPL)}</b></div>
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
    sfx.fail();
    shake(true);
    this.clearSave();
    setTimeout(() => OV.gameOverScreen(this, false), 700);
  }

  // ---------------------------------------------------------------- rendering
  render() {
    const st = this.state;
    if (!st) return;
    const s = st.session;

    $('t-week').textContent = st.week;
    $('t-deadline').textContent = `${Math.min(3, st.deadlineIndex + 1)} / 3`;
    const cashEl = $('t-cash');
    const cashTxt = money(st.cash);
    if (cashEl.textContent !== cashTxt) {
      cashEl.textContent = cashTxt;
      cashEl.classList.remove('bump'); void cashEl.offsetWidth; cashEl.classList.add('bump');
    }
    $('t-slots').textContent = `${S.slotsUsed(st)}/${st.mods.slots}`;

    this.renderDeadlineCard();
    this.renderPerks();
    this.renderConsumables();
    this.renderHand();
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
    if (boss) { bd.hidden = false; bd.innerHTML = `<b>BOSS RULE</b>${boss.blurb}${s.bossGraceLeft > 0 ? '<br><span style="color:var(--green)">(waived this trade)</span>' : ''}`; }
    else bd.hidden = true;
    const pctv = Math.min(100, (s.profit / s.quota) * 100);
    $('dl-progress-fill').style.width = pctv + '%';
    $('dl-profit').textContent = '$' + bignum(s.profit);
  }

  renderResources() {
    const st = this.state, s = st.session;
    const set = (id, v, warn) => {
      const el = $(id); el.textContent = v;
      el.classList.toggle('zero', warn && v === 0);
    };
    set('r-trades', s ? s.tradesLeft : st.mods.trades, true);
    set('r-discards', s ? s.discardsLeft : st.mods.discards, true);
    set('r-greens', s ? s.greens : 0);
    set('r-streak', s ? s.greenStreak : 0);
    $('r-deck').textContent = st.deck.length;
    $('r-draw').textContent = s ? s.drawPile.length : st.deck.length;
  }

  renderTape() {
    const s = this.state.session;
    const list = $('tape-list');
    if (!s || !s.history.length) {
      list.innerHTML = '<div class="tape-empty">no trades booked</div>';
      return;
    }
    list.innerHTML = s.history.slice().reverse().map((h) => `
      <div class="tape-row ${h.correct ? 'green' : 'red'}">
        <span class="t-dir">${h.direction === 'LONG' ? '\u25b2' : '\u25bc'}</span>
        <span class="t-pat">${h.pattern}</span>
        <span class="t-pl">$${bignum(h.pl)}</span>
      </div>`).join('');
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

  renderPerks() {
    const st = this.state;
    const row = $('perk-row');
    row.innerHTML = '';
    $('perk-count').textContent = `${S.slotsUsed(st)}/${st.mods.slots}`;
    st.perks.forEach((p, i) => {
      const disabled = st.session && st.mods.disableFirstPerk && i === 0 && !(st.session.bossGraceLeft > 0);
      const el = perkEl(p, st, { disabled });
      el.draggable = true;
      el.addEventListener('dragstart', (e) => { this.dragUid = p.uid; e.dataTransfer.effectAllowed = 'move'; hideTip(); });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = st.perks.findIndex((q) => q.uid === this.dragUid);
        const to = st.perks.findIndex((q) => q.uid === p.uid);
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = st.perks.splice(from, 1);
        st.perks.splice(to, 0, moved);
        sfx.select(); this.render(); this.save();
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const val = perkSellValue(p, st);
        const r = S.sellPerk(st, p.uid);
        if (r.ok) { sfx.cash(); toast(`Sold ${PERKS[p.key].name} for $${val}`, 'good'); this.render(); this.save(); }
      });
      row.appendChild(el);
    });
    for (let i = S.slotsUsed(st); i < st.mods.slots; i++) {
      const e = document.createElement('div'); e.className = 'slot-empty'; row.appendChild(e);
    }
  }

  renderConsumables() {
    const st = this.state;
    const row = $('consumable-row');
    row.innerHTML = '';
    $('cons-count').textContent = `${st.consumables.length}/${st.mods.chartSlots}`;
    st.consumables.forEach((c) => {
      const el = consumableEl(c, st);
      el.onclick = () => this.useConsumable(c);
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        S.sellConsumable(st, c.uid); sfx.cash(); this.render(); this.save();
      });
      row.appendChild(el);
    });
    for (let i = st.consumables.length; i < st.mods.chartSlots; i++) {
      const e = document.createElement('div'); e.className = 'slot-empty'; row.appendChild(e);
    }
  }

  renderHand(animateNew = []) {
    const st = this.state, s = st.session;
    const row = $('hand-row');
    row.innerHTML = '';
    if (!s) return;
    s.hand.forEach((c, i) => {
      const el = cardEl(c);
      if (s.selected.includes(c.uid)) el.classList.add('selected');
      if (animateNew.includes(c.uid)) { el.classList.add('dealing'); el.style.animationDelay = (i * 45) + 'ms'; }
      el.onclick = () => this.toggleCard(c.uid);
      row.appendChild(el);
    });
  }

  updatePreview() {
    const st = this.state, s = st.session;
    const sel = s ? S.selectedCards(st) : [];
    if (!s || !sel.length) {
      $('pattern-name').textContent = '—';
      $('pattern-level').textContent = '';
      $('sc-volume').textContent = '0';
      $('sc-leverage').textContent = '0';
      $('sc-pl').textContent = '$0';
      this.updateActions();
      return;
    }
    const held = s.hand.filter((c) => !s.selected.includes(c.uid));
    const pv = previewTrade(st, sel, held, new RNG('preview' + s.tradeIndex));
    $('pattern-name').textContent = pv.patternName;
    $('pattern-level').textContent = 'lv.' + pv.level;
    this.setChip('sc-volume', bignum(pv.volume));
    this.setChip('sc-leverage', bignum(pv.leverage));
    $('sc-pl').textContent = '$' + bignum(pv.pl);
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
    $('btn-discard').disabled = !(has && s.discardsLeft > 0 && !this.busy);
    $('btn-sort').textContent = this.sortMode === 'rank' ? 'RANK' : 'SECTOR';
  }

  // ---------------------------------------------------------------- input
  toggleCard(uid) {
    const st = this.state, s = st.session;
    if (!s || this.busy) return;
    const was = s.selected.includes(uid);
    S.toggleSelect(st, uid);
    if (s.selected.includes(uid) !== was) (was ? sfx.deselect() : sfx.select());
    this.renderHand();
    this.updatePreview();
  }

  sortHand() {
    const st = this.state, s = st.session;
    if (!s) return;
    this.sortMode = this.sortMode === 'rank' ? 'sector' : 'rank';
    s.sortMode = this.sortMode;
    s.hand = sortCards(s.hand, this.sortMode);
    sfx.select();
    this.renderHand();
    this.updateActions();
  }

  discard() {
    const st = this.state, s = st.session;
    if (!s || this.busy) return;
    const cards = S.selectedCards(st);
    const r = S.discardSelected(st);
    if (r.blocked) { sfx.err(); return toast(r.blocked, 'bad'); }
    sfx.play();
    if (r.created) toast(`${r.created} Chart filed`, 'good');
    this.render();
    this.save();
  }

  useConsumable(inst) {
    const st = this.state;
    const d = ALL_CONSUMABLES[inst.key];
    const selected = st.session ? [...st.session.selected] : [];
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

    const playedCards = S.selectedCards(st);
    const res = S.playTrade(st, direction);
    if (res.blocked) { this.busy = false; sfx.err(); return toast(res.blocked, 'bad'); }

    // lay the position out on the table
    const area = $('played-cards');
    area.innerHTML = '';
    $('position-ghost').classList.add('hide');
    $('hand-row').innerHTML = '';
    const scoringIds = new Set(res.scoringCards.map((c) => c.uid));
    const els = new Map();
    playedCards.forEach((c) => {
      const el = cardEl(c, { reveal: true });
      el.classList.add('played');
      if (!scoringIds.has(c.uid)) el.classList.add('dim');
      area.appendChild(el);
      els.set(c.uid, el);
    });
    sfx.play();
    await sleep(220);

    // the tape prints
    this.chart.pulse(res.tape.up);
    this.renderMarket();
    await sleep(160);

    // walk the resolution
    $('pattern-name').textContent = res.patternName;
    $('pattern-level').textContent = 'lv.' + res.level;
    let vol = 0, lev = 0;
    for (const step of res.steps) {
      vol = step.volume; lev = step.leverage;
      this.setChip('sc-volume', bignum(vol));
      this.setChip('sc-leverage', bignum(lev));
      $('sc-pl').textContent = '$' + bignum(Math.floor(vol * lev));

      const anchor = step.cardUid ? els.get(step.cardUid)
        : step.perkUid ? $('perk-row').querySelector(`[data-uid="${step.perkUid}"]`)
        : null;
      if (anchor) {
        anchor.classList.remove('scoring', 'trigger');
        void anchor.offsetWidth;
        anchor.classList.add(step.perkUid ? 'trigger' : 'scoring');
      }
      if (['volume', 'cardVolume', 'leverage', 'xleverage', 'xvolume', 'money'].includes(step.kind)) {
        const kind = step.kind === 'cardVolume' ? 'volume' : step.kind;
        popText(anchor || area, step.text, kind);
        sfx.chipTick(res.steps.indexOf(step));
      } else if (step.kind === 'green') {
        FX.burst('GREEN', res.saved ? 'STOP LOSS SAVED IT' : 'YOU CALLED IT', 'green');
        sfx.green();
        const r = area.getBoundingClientRect();
        particles(r.left + r.width / 2, r.top + r.height / 2, '#43e08a', 26);
      } else if (step.kind === 'red') {
        FX.burst('RED', 'WRONG WAY', 'red');
        sfx.red(); shake();
      }
      await sleep(step.kind === 'green' || step.kind === 'red' ? 520 : 128);
    }

    // final number
    $('sc-pl').textContent = '$' + bignum(res.pl);
    FX.burst('$' + bignum(res.pl), res.capped ? 'CAPPED BY THE CEILING' : res.patternName.toUpperCase(),
      res.correct ? 'green' : 'red');
    if (res.correct) sfx.cash();
    await sleep(420);

    if (res.money) toast(`${res.money > 0 ? '+' : '-'}$${Math.abs(res.money)} in fees & rebates`, res.money > 0 ? 'good' : 'bad');
    if (res.destroyedCards?.length) {
      for (const c of res.destroyedCards) {
        const el = els.get(c.uid);
        if (el) el.classList.add('shatter');
      }
      toast(`${res.destroyedCards.length} ticker(s) destroyed`, 'bad');
      await sleep(300);
    }

    this.renderDeadlineCard();
    this.renderResources();
    this.renderTape();
    this.renderPerks();
    await sleep(260);
    area.innerHTML = '';
    $('position-ghost').classList.remove('hide');
    this.busy = false;
    this.render();
    this.save();

    if (res.cleared) return this.clearDeadline();
    if (res.busted) return this.gameOver();
  }

  async clearDeadline() {
    sfx.clear();
    const area = $('play-area').getBoundingClientRect();
    particles(area.left + area.width / 2, area.top + area.height / 2, '#ffd94a', 40, 220);
    FX.burst('QUOTA MET', 'CLOSE THE BOOKS', 'green');
    await sleep(900);
    const payout = S.finishDeadline(this.state);
    this.render();
    OV.payoutScreen(this, payout);
    this.save();
  }

  async dealAnimation() {
    const s = this.state.session;
    this.renderHand(s.hand.map((c) => c.uid));
    await sleep(120);
  }

  // ---------------------------------------------------------------- global
  bindGlobal() {
    $('btn-long').onclick = () => this.play('LONG');
    $('btn-short').onclick = () => this.play('SHORT');
    $('btn-discard').onclick = () => this.discard();
    $('btn-sort').onclick = () => this.sortHand();
    $('btn-help').onclick = () => OV.helpScreen(this);
    $('btn-menu').onclick = () => (this.state ? OV.menuScreen(this) : OV.titleScreen(this, this.hasSave()));
    $('btn-portfolio').onclick = () => this.state && OV.portfolioScreen(this, () => OV.closeOverlay());
    $('btn-patterns').onclick = () => this.state && OV.patternScreen(this, () => OV.closeOverlay());

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
      if (k === '?') { OV.helpScreen(this); return; }
      if (OV.overlayOpen() || !s || this.busy) return;
      if (k === 'l') { e.preventDefault(); this.play('LONG'); }
      else if (k === 's') { e.preventDefault(); this.play('SHORT'); }
      else if (k === 'd') { e.preventDefault(); this.discard(); }
      else if (k === ' ') { e.preventDefault(); this.sortHand(); }
      else if (/^[1-9]$/.test(k)) {
        const idx = +k - 1;
        if (s.hand[idx]) this.toggleCard(s.hand[idx].uid);
      } else if (k === '0') {
        if (s.hand[9]) this.toggleCard(s.hand[9].uid);
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.perk, .consumable')) e.preventDefault();
    });
  }
}

const game = new Game();
window.game = game;
OV.titleScreen(game, game.hasSave());
