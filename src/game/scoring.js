import { evaluate, formationStats, FORMATIONS, convictionOf } from './formations.js';
import { baseVolume, hasBody, isWide, matchesSector, matchesDirection, polarityOf, bodyOf } from './candles.js';
import { BROKERS } from './brokers.js';
import { BOSSES } from './bosses.js';

// ---------------------------------------------------------------------------
// The P/L pipeline. Volume x Leverage = P/L.
// Every mutation emits a step so the UI can replay the resolution in order.
// ---------------------------------------------------------------------------

function containsSet(played, ev) {
  const bodied = played.filter(hasBody);
  const counts = new Map();
  for (const c of bodied) counts.set(bodyOf(c), (counts.get(bodyOf(c)) || 0) + 1);
  const sizes = [...counts.values()].sort((a, b) => b - a);
  const set = new Set(['tick']);
  if (sizes[0] >= 2) set.add('tweezer');
  if (sizes[0] >= 2 && sizes[1] >= 2) set.add('doubleTweezer');
  if (sizes[0] >= 3) set.add('triple');
  if (sizes[0] >= 4) set.add('fourWinds');
  if (sizes[0] >= 5) set.add('fiveAlarm');
  if (sizes[0] >= 3 && sizes[1] >= 2) set.add('pillars');
  if (ev.stairSet) set.add('staircase');
  if (ev.clusterSet) set.add('cluster');
  if (ev.stairSet && ev.clusterSet) set.add('goldenStair');
  if (set.has('pillars') && ev.clusterSet) set.add('megaCluster');
  if (set.has('fiveAlarm') && ev.clusterSet) set.add('perfectStorm');
  if (ev.soldierSet) set.add('soldiers');
  if (ev.crowSet) set.add('crows');
  set.add(ev.key);
  return set;
}

/** Resolve broker index -> {def, inst} honouring Arb Bot's copy-right. */
export function effectiveBroker(state, i) {
  const inst = state.brokers[i];
  if (!inst) return null;
  const d = BROKERS[inst.key];
  if (d?.copiesRight) {
    const right = state.brokers[i + 1];
    if (right && BROKERS[right.key] && !BROKERS[right.key].copiesRight) {
      return { def: BROKERS[right.key], inst, copying: right, self: d };
    }
  }
  return { def: d, inst, self: d };
}

class Ctx {
  constructor(state, o) {
    this.state = state;
    this.rng = o.rng;
    this.commit = !!o.commit;
    this.played = o.played;
    this.held = o.held;
    this.direction = o.direction;
    this.correct = o.correct;
    this.volume = 0;
    this.leverage = 0;
    this.money = 0;
    this.steps = [];
    this.mods = state.mods;
    this.tradeIndex = o.tradeIndex ?? 0;
    this.tradesLeft = o.tradesLeft ?? 1;
    this.greenStreak = o.greenStreak ?? 0;
    this.greensThisDeadline = o.greensThisDeadline ?? 0;
    this.destroyQueue = [];
    // Print counters — how many times candles printed beyond their first pass.
    // Brokers run after every candle has printed, so an `independent` hook can
    // read these as a finished total.
    this.extraPrints = 0;
    this.mostPrints = 0;
  }
  step(kind, source, text, extra = {}) {
    this.steps.push({
      kind, text,
      label: source?.name || source?.label || '',
      art: source?.art || '',
      brokerUid: source?.uid || null,
      candleUid: extra.candleUid || null,
      volume: Math.round(this.volume),
      leverage: +this.leverage.toFixed(2),
      ...extra,
    });
  }
  addVolume(n, src, c) { if (!n) return; this.volume += n; this.step('volume', src, `+${Math.round(n)} Vol`, { candleUid: c?.uid, amount: n }); }
  addLeverage(n, src, c) { if (!n) return; this.leverage += n; this.step('leverage', src, `+${(+n.toFixed(2))} Lev`, { candleUid: c?.uid, amount: n }); }
  xLeverage(n, src, c) { if (n === 1 || n == null) return; this.leverage *= n; this.step('xleverage', src, `x${n} Lev`, { candleUid: c?.uid, amount: n }); }
  xVolume(n, src, c) { if (n === 1 || n == null) return; this.volume *= n; this.step('xvolume', src, `x${n} Vol`, { candleUid: c?.uid, amount: n }); }
  earn(n, src, c) { if (!n) return; this.money += n; this.step('money', src, `${n > 0 ? '+' : '-'}$${Math.abs(n)}`, { candleUid: c?.uid, amount: n }); }

  isSector(c, sector) { return !c.debuffed && matchesSector(c, sector); }
  isBull(c) { const p = polarityOf(c); return !c.debuffed && (p === 'bull' || p === 'both'); }
  isBear(c) { const p = polarityOf(c); return !c.debuffed && (p === 'bear' || p === 'both'); }
  isWide(c) { return !c.debuffed && hasBody(c) && isWide(c); }
  hasBody(c) { return hasBody(c); }
  matchesCall(c) { return this.direction ? matchesDirection(c, this.direction) : false; }
  contains(key) { return this._contains.has(key); }
  enhOf(c) {
    if (c.debuffed || this.mods.disableEnhancements) return null;
    return c.enhancement;
  }
}

function luckyRoll(ctx, odds) {
  return ctx.rng.next() < ((ctx.mods.luckyBoost || 1) / odds);
}

function triggersFor(state, ctx, candle, held) {
  let n = 1;
  if (candle.stamp === 'reissue' && !candle.debuffed) n += 1;
  for (let i = 0; i < state.brokers.length; i++) {
    if (state.mods.disableFirstBroker && i === 0) continue;
    const eb = effectiveBroker(state, i);
    if (!eb?.def || eb.inst.debuffed) continue;
    const fn = held ? eb.def.retriggerHeld : eb.def.retriggerScored;
    if (fn) n += fn(ctx, candle, eb.inst) || 0;
  }
  return n;
}

function printCandle(state, ctx, c) {
  if (c.debuffed) {
    ctx.step('candle', { name: 'Blanked' }, 'blanked', { candleUid: c.uid });
    return;
  }
  const enh = ctx.enhOf(c);
  if (!ctx.mods.zeroCandleVolume) {
    const bv = enh === 'obsidian' ? 50 : baseVolume(c);
    if (bv) { ctx.volume += bv; ctx.step('candleVolume', { name: 'Body' }, `+${bv} Vol`, { candleUid: c.uid, amount: bv }); }
  }
  if (c.bonusLeverage) ctx.addLeverage(c.bonusLeverage, { name: 'Bonus' }, c);

  if (enh === 'bullion') ctx.addVolume(30, { name: 'Bullion' }, c);
  else if (enh === 'bloodstone') ctx.addLeverage(4, { name: 'Bloodstone' }, c);
  else if (enh === 'ember') {
    ctx.addVolume(15, { name: 'Ember' }, c);
    if (ctx.commit) c.bonusVolume = (c.bonusVolume || 0) + 5;
  } else if (enh === 'beacon') {
    const kin = ctx.played.filter((o) => o !== c && !o.debuffed && o.sector === c.sector).length;
    if (kin) ctx.addLeverage(3 * kin, { name: 'Beacon' }, c);
  } else if (enh === 'glasswork') {
    ctx.xLeverage(2, { name: 'Glasswork' }, c);
    if (ctx.commit && ctx.rng.next() < 0.25) ctx.destroyQueue.push(c);
  } else if (enh === 'cursed') {
    ctx.xLeverage(3, { name: 'Cursed' }, c);
    ctx.earn(-4, { name: 'Cursed' }, c);
  } else if (enh === 'wishbone') {
    if (luckyRoll(ctx, 5)) ctx.addLeverage(20, { name: 'Wishbone' }, c);
    if (luckyRoll(ctx, 15)) ctx.earn(20, { name: 'Wishbone' }, c);
  }

  if (c.edition === 'laminated') ctx.addVolume(50, { name: 'Foiled' }, c);
  else if (c.edition === 'holographic') ctx.addLeverage(10, { name: 'Prismatic' }, c);
  else if (c.edition === 'algorithmic') ctx.xLeverage(1.5, { name: 'Runed' }, c);

  if (c.stamp === 'payout') ctx.earn(3, { name: 'Coin Seal' }, c);

  for (let i = 0; i < state.brokers.length; i++) {
    if (state.mods.disableFirstBroker && i === 0) continue;
    const eb = effectiveBroker(state, i);
    if (!eb?.def?.candleScored || eb.inst.debuffed) continue;
    eb.def.candleScored(ctx, c, eb.inst);
  }
}

function holdCandle(state, ctx, c) {
  if (c.debuffed) return;
  const enh = ctx.enhOf(c);
  if (enh === 'goldleaf') ctx.earn(3, { name: 'Goldleaf' }, c);
  else if (enh === 'wardstone') ctx.xLeverage(1.5, { name: 'Wardstone' }, c);
  for (let i = 0; i < state.brokers.length; i++) {
    if (state.mods.disableFirstBroker && i === 0) continue;
    const eb = effectiveBroker(state, i);
    if (!eb?.def?.candleHeld || eb.inst.debuffed) continue;
    eb.def.candleHeld(ctx, c, eb.inst);
  }
}

/**
 * @param o { played, held, direction, correct, rng, commit, tradeIndex,
 *            tradesLeft, greenStreak, greensThisDeadline, quota,
 *            regimeMult, regimeName }
 */
export function scoreTrade(state, o) {
  const mods = state.mods;
  const boss = state.session?.boss ? BOSSES[state.session.boss] : null;
  const bossActive = boss && !(state.session?.bossGraceLeft > 0);

  const ev = evaluate(o.played, {
    fourCard: mods.fourCard,
    shortcut: mods.shortcut,
    smeared: mods.smeared,
    allScore: mods.allScore,
    marchOfThree: mods.marchOfThree,
  });

  const ctx = new Ctx(state, o);
  ctx.formation = ev;
  ctx.formationKey = ev.key;
  ctx.formationOrder = FORMATIONS[ev.key].order;
  ctx.scoring = ev.scoringCandles;
  ctx.unscored = ev.unscored;
  ctx.marchLength = Math.max(ev.soldierSet?.length || 0, ev.crowSet?.length || 0);
  ctx._contains = containsSet(o.played, ev);

  const rawLevel = state.formations[ev.key]?.level ?? 1;
  const level = mods.flatFormationLevels && bossActive ? 1 : rawLevel + (mods.formationLevelBonus || 0);
  ctx.formationLevel = level;
  const base = formationStats(ev.key, level);
  ctx.volume = base.volume;
  ctx.leverage = base.leverage;
  ctx.step('base', { name: FORMATIONS[ev.key].name }, `${base.volume} x ${base.leverage}`, { formationKey: ev.key, level });

  // --- candles print, in the order you arranged them ---------------------
  for (const c of ev.scoringCandles) {
    const n = triggersFor(state, ctx, c, false);
    ctx.extraPrints += Math.max(0, n - 1);
    ctx.mostPrints = Math.max(ctx.mostPrints, n);
    for (let t = 0; t < n; t++) {
      if (t > 0) ctx.step('retrigger', { name: 'Echo' }, 'again', { candleUid: c.uid });
      printCandle(state, ctx, c);
    }
  }

  // --- candles still on the board ----------------------------------------
  for (const c of o.held) {
    const n = triggersFor(state, ctx, c, true);
    for (let t = 0; t < n; t++) holdCandle(state, ctx, c);
  }

  // --- brokers, left to right ---------------------------------------------
  for (let i = 0; i < state.brokers.length; i++) {
    if (mods.disableFirstBroker && bossActive && i === 0) {
      ctx.step('disabled', { name: 'Clawed back' }, 'disabled');
      continue;
    }
    const eb = effectiveBroker(state, i);
    if (!eb?.def || eb.inst.debuffed) continue;
    const src = { name: (eb.copying ? 'Arb Bot → ' : '') + eb.def.name, art: eb.self.art, uid: eb.inst.uid };
    if (eb.def.independent) eb.def.independent(ctx, eb.inst, src);
    if (eb.inst.edition === 'laminated') ctx.addVolume(50, src);
    else if (eb.inst.edition === 'holographic') ctx.addLeverage(10, src);
    else if (eb.inst.edition === 'algorithmic') ctx.xLeverage(1.5, src);
  }

  // --- the call ------------------------------------------------------------
  let correct = o.correct;
  let saved = false;
  let conviction = convictionOf(ev.scoringCandles, o.direction, mods);

  if (o.direction) {
    if (mods.alwaysGreen) correct = true;
    if (correct === false && mods.saveRed && !state.session?.stopLossUsed) {
      correct = true; saved = true;
      if (ctx.commit && state.session) state.session.stopLossUsed = true;
    }
    ctx.correct = correct;

    for (let i = 0; i < state.brokers.length; i++) {
      if (mods.disableFirstBroker && bossActive && i === 0) continue;
      const eb = effectiveBroker(state, i);
      if (!eb?.def?.direction || eb.inst.debuffed) continue;
      eb.def.direction(ctx, eb.inst, { name: eb.def.name, art: eb.self.art, uid: eb.inst.uid });
    }

    if (conviction.mult !== 1 && !mods.noConviction) {
      ctx.xLeverage(+conviction.mult.toFixed(2), { name: conviction.label, art: '🎯' });
    }

    if (bossActive && boss.scoreHook) boss.scoreHook(ctx);

    const regimeMult = o.regimeMult ?? 1;
    if (correct) {
      if (regimeMult !== 1) ctx.xLeverage(regimeMult, { name: o.regimeName || 'Regime', art: '🌡️' });
      ctx.step('green', { name: saved ? 'Stop Loss' : 'GREEN TRADE', art: '✅' }, saved ? 'saved' : 'called it');
    } else {
      ctx.xLeverage(mods.redMult ?? 0.35, { name: 'WRONG WAY', art: '❌' });
      ctx.step('red', { name: 'RED TRADE', art: '❌' }, 'tape went the other way');
    }
  } else if (bossActive && boss.scoreHook) {
    boss.scoreHook(ctx);
  }

  ctx.volume = Math.max(0, ctx.volume);
  ctx.leverage = Math.max(0, ctx.leverage);
  let pl = ctx.volume * ctx.leverage;

  let capped = false;
  if (bossActive && boss?.capFraction && o.quota) {
    const cap = o.quota * boss.capFraction;
    if (pl > cap) { pl = cap; capped = true; }
  }

  return {
    formation: ev,
    formationKey: ev.key,
    formationName: FORMATIONS[ev.key].name,
    level,
    volume: ctx.volume,
    leverage: ctx.leverage,
    pl: Math.floor(pl),
    money: ctx.money,
    steps: ctx.steps,
    correct,
    saved,
    capped,
    conviction,
    destroyQueue: ctx.destroyQueue,
    scoringCandles: ev.scoringCandles,
  };
}

/** Read-only projection for the live readout. */
export function previewTrade(state, played, held, rng, direction = null) {
  if (!played.length) return null;
  return scoreTrade(state, {
    played, held, direction, correct: null,
    rng, commit: false,
    tradeIndex: state.session?.tradeIndex ?? 0,
    tradesLeft: state.session?.tradesLeft ?? 1,
    greenStreak: state.session?.greenStreak ?? 0,
    greensThisDeadline: state.session?.greens ?? 0,
    quota: state.session?.quota,
  });
}
