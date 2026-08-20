import { evaluate, patternStats, PATTERNS } from './patterns.js';
import { baseVolume, hasRank, isFace, matchesSector, ENHANCEMENTS } from './cards.js';
import { PERKS } from './perks.js';
import { BOSSES } from './bosses.js';

// ---------------------------------------------------------------------------
// The P/L pipeline. Volume (chips) x Leverage (mult) = P/L for the trade.
// Everything emits a `step` so the UI can animate the resolution in order.
// ---------------------------------------------------------------------------

function containsSet(played, ev) {
  const rankCards = played.filter(hasRank);
  const counts = new Map();
  for (const c of rankCards) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  const sizes = [...counts.values()].sort((a, b) => b - a);
  const set = new Set(['flatline']);
  if (sizes[0] >= 2) set.add('doubleBottom');
  if (sizes[0] >= 2 && sizes[1] >= 2) set.add('headShoulders');
  if (sizes[0] >= 3) set.add('tripleTop');
  if (sizes[0] >= 4) set.add('quadWitching');
  if (sizes[0] >= 5) set.add('insiderTip');
  if (sizes[0] >= 3 && sizes[1] >= 2) set.add('bullFlag');
  if (ev.straightSet) set.add('breakout');
  if (ev.flushSet) set.add('rotation');
  if (ev.straightSet && ev.flushSet) set.add('goldenCross');
  if (set.has('bullFlag') && ev.flushSet) set.add('marketCorner');
  if (set.has('insiderTip') && ev.flushSet) set.add('monopoly');
  set.add(ev.key);
  return set;
}

/** Resolve perk index -> {def, inst} honouring Arb Bot's copy-right. */
export function effectivePerk(state, i) {
  const inst = state.perks[i];
  if (!inst) return null;
  let d = PERKS[inst.key];
  if (d?.copiesRight) {
    const right = state.perks[i + 1];
    if (right && PERKS[right.key] && !PERKS[right.key].copiesRight) {
      return { def: PERKS[right.key], inst, copying: right, self: d };
    }
    return { def: d, inst, self: d };
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
  }
  step(kind, source, text, extra = {}) {
    this.steps.push({
      kind, text,
      label: source?.name || source?.label || '',
      art: source?.art || '',
      perkUid: source?.uid || null,
      cardUid: extra.cardUid || null,
      volume: Math.round(this.volume),
      leverage: +this.leverage.toFixed(2),
      ...extra,
    });
  }
  addVolume(n, src, card) { if (!n) return; this.volume += n; this.step('volume', src, `+${Math.round(n)} Vol`, { cardUid: card?.uid, amount: n }); }
  addLeverage(n, src, card) { if (!n) return; this.leverage += n; this.step('leverage', src, `+${(+n.toFixed(2))} Lev`, { cardUid: card?.uid, amount: n }); }
  xLeverage(n, src, card) { if (n === 1 || n == null) return; this.leverage *= n; this.step('xleverage', src, `x${n} Lev`, { cardUid: card?.uid, amount: n }); }
  xVolume(n, src, card) { if (n === 1 || n == null) return; this.volume *= n; this.step('xvolume', src, `x${n} Vol`, { cardUid: card?.uid, amount: n }); }
  earn(n, src, card) { if (!n) return; this.money += n; this.step('money', src, `${n > 0 ? '+' : '-'}$${Math.abs(n)}`, { cardUid: card?.uid, amount: n }); }
  isSector(card, sector) { return !card.debuffed && matchesSector(card, sector); }
  isFace(card) { return !card.debuffed && hasRank(card) && isFace(card); }
  hasRank(card) { return hasRank(card); }
  contains(key) { return this._contains.has(key); }
  enhOf(card) {
    if (card.debuffed) return null;
    if (this.mods.disableEnhancements) return null;
    return card.enhancement;
  }
}

function luckyRoll(ctx, odds) {
  const boost = ctx.mods.luckyBoost || 1;
  return ctx.rng.next() < (boost / odds);
}

function triggersFor(state, ctx, card, held) {
  let n = 1;
  if (card.stamp === 'reissue' && !card.debuffed) n += 1;
  for (let i = 0; i < state.perks.length; i++) {
    if (state.mods.disableFirstPerk && i === 0) continue;
    const ep = effectivePerk(state, i);
    if (!ep?.def || ep.inst.debuffed) continue;
    const fn = held ? ep.def.retriggerHeld : ep.def.retriggerScored;
    if (fn) n += fn(ctx, card, ep.inst) || 0;
  }
  return n;
}

function scoreOneCard(state, ctx, card) {
  const src = { name: card.debuffed ? 'blanked' : '', art: '' };
  if (card.debuffed) {
    ctx.step('card', { name: 'Blanked' }, 'blanked', { cardUid: card.uid });
    return;
  }
  const enh = ctx.enhOf(card);
  if (!ctx.mods.zeroCardVolume) {
    const bv = enh === 'restricted' ? 50 : baseVolume(card);
    if (bv) { ctx.volume += bv; ctx.step('cardVolume', { name: 'Volume' }, `+${bv} Vol`, { cardUid: card.uid, amount: bv }); }
  }
  if (card.bonusLeverage) ctx.addLeverage(card.bonusLeverage, { name: 'Bonus' }, card);

  // Enhancement
  if (enh === 'bluechip') ctx.addVolume(30, { name: 'Blue Chip' }, card);
  else if (enh === 'leveraged') ctx.addLeverage(4, { name: 'Leveraged' }, card);
  else if (enh === 'volatile') {
    ctx.xLeverage(2, { name: 'Volatile' }, card);
    if (ctx.commit && ctx.rng.next() < 0.25) ctx.destroyQueue.push(card);
  } else if (enh === 'penny') {
    if (luckyRoll(ctx, 5)) ctx.addLeverage(20, { name: 'Penny Stock' }, card);
    if (luckyRoll(ctx, 15)) ctx.earn(20, { name: 'Penny Stock' }, card);
  }

  // Edition
  if (card.edition === 'laminated') ctx.addVolume(50, { name: 'Laminated' }, card);
  else if (card.edition === 'holographic') ctx.addLeverage(10, { name: 'Holographic' }, card);
  else if (card.edition === 'algorithmic') ctx.xLeverage(1.5, { name: 'Algorithmic' }, card);

  // Stamp
  if (card.stamp === 'payout') ctx.earn(3, { name: 'Payout Stamp' }, card);

  // Perks
  for (let i = 0; i < state.perks.length; i++) {
    if (state.mods.disableFirstPerk && i === 0) continue;
    const ep = effectivePerk(state, i);
    if (!ep?.def?.cardScored || ep.inst.debuffed) continue;
    ep.def.cardScored(ctx, card, ep.inst);
  }
}

function holdOneCard(state, ctx, card) {
  if (card.debuffed) return;
  const enh = ctx.enhOf(card);
  if (enh === 'dividend') ctx.earn(3, { name: 'Dividend' }, card);
  else if (enh === 'hedged') ctx.xLeverage(1.5, { name: 'Hedged' }, card);
  for (let i = 0; i < state.perks.length; i++) {
    if (state.mods.disableFirstPerk && i === 0) continue;
    const ep = effectivePerk(state, i);
    if (!ep?.def?.cardHeld || ep.inst.debuffed) continue;
    ep.def.cardHeld(ctx, card, ep.inst);
  }
}

/**
 * @param {object} state run state
 * @param {object} o { played, held, direction, correct, rng, commit, tradeIndex, tradesLeft, greenStreak, quota }
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
  });

  const ctx = new Ctx(state, o);
  ctx.pattern = ev;
  ctx.patternKey = ev.key;
  ctx.patternOrder = PATTERNS[ev.key].order;
  ctx.scoring = ev.scoringCards;
  ctx.unscored = ev.unscored;
  ctx._contains = containsSet(o.played, ev);

  const rawLevel = state.patterns[ev.key]?.level ?? 1;
  const level = mods.flatPatternLevels && bossActive ? 1 : rawLevel + (mods.patternLevelBonus || 0);
  ctx.patternLevel = level;
  const base = patternStats(ev.key, level);
  ctx.volume = base.volume;
  ctx.leverage = base.leverage;
  ctx.step('base', { name: PATTERNS[ev.key].name }, `${base.volume} x ${base.leverage}`, { patternKey: ev.key, level });

  // --- scored tickers, left to right -----------------------------------
  for (const card of ev.scoringCards) {
    const n = triggersFor(state, ctx, card, false);
    for (let t = 0; t < n; t++) {
      if (t > 0) ctx.step('retrigger', { name: 'Retrigger' }, 'again', { cardUid: card.uid });
      scoreOneCard(state, ctx, card);
    }
  }

  // --- tickers held in hand --------------------------------------------
  for (const card of o.held) {
    const n = triggersFor(state, ctx, card, true);
    for (let t = 0; t < n; t++) holdOneCard(state, ctx, card);
  }

  // --- perks, left to right --------------------------------------------
  for (let i = 0; i < state.perks.length; i++) {
    if (mods.disableFirstPerk && bossActive && i === 0) {
      ctx.step('disabled', { name: 'Clawed back' }, 'disabled');
      continue;
    }
    const ep = effectivePerk(state, i);
    if (!ep?.def || ep.inst.debuffed) continue;
    const src = { name: (ep.copying ? 'Arb Bot → ' : '') + ep.def.name, art: ep.self.art, uid: ep.inst.uid };
    if (ep.def.independent) ep.def.independent(ctx, ep.inst, src);
    // Perk editions trigger in the perk's slot.
    if (ep.inst.edition === 'laminated') ctx.addVolume(50, src);
    else if (ep.inst.edition === 'holographic') ctx.addLeverage(10, src);
    else if (ep.inst.edition === 'algorithmic') ctx.xLeverage(1.5, src);
  }

  // --- direction ---------------------------------------------------------
  let correct = o.correct;
  let saved = false;
  if (o.direction) {
    if (mods.alwaysGreen) correct = true;
    if (correct === false && mods.saveRed && !state.session?.stopLossUsed) {
      correct = true; saved = true;
      if (ctx.commit && state.session) state.session.stopLossUsed = true;
    }
    ctx.correct = correct;

    for (let i = 0; i < state.perks.length; i++) {
      if (mods.disableFirstPerk && bossActive && i === 0) continue;
      const ep = effectivePerk(state, i);
      if (!ep?.def?.direction || ep.inst.debuffed) continue;
      ep.def.direction(ctx, ep.inst, { name: ep.def.name, art: ep.self.art, uid: ep.inst.uid });
    }

    if (bossActive && boss.scoreHook) boss.scoreHook(ctx);

    const regimeMult = o.regimeMult ?? 1;
    if (correct) {
      if (regimeMult !== 1) ctx.xLeverage(regimeMult, { name: (o.regimeName || 'Regime'), art: '🌡️' });
      ctx.step('green', { name: saved ? 'Stop Loss' : 'GREEN TRADE', art: '✅' }, saved ? 'saved' : 'called it');
    } else {
      const red = mods.redMult ?? 0.35;
      ctx.xLeverage(red, { name: 'WRONG WAY', art: '❌' });
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
    pattern: ev,
    patternKey: ev.key,
    patternName: PATTERNS[ev.key].name,
    level,
    volume: ctx.volume,
    leverage: ctx.leverage,
    pl: Math.floor(pl),
    money: ctx.money,
    steps: ctx.steps,
    correct,
    saved,
    capped,
    destroyQueue: ctx.destroyQueue,
    scoringCards: ev.scoringCards,
  };
}

/** Cheap read-only preview used for the live readout above the hand. */
export function previewTrade(state, played, held, rng) {
  if (!played.length) return null;
  return scoreTrade(state, {
    played, held, direction: null, correct: null,
    rng, commit: false,
    tradeIndex: state.session?.tradeIndex ?? 0,
    tradesLeft: state.session?.tradesLeft ?? 1,
    greenStreak: state.session?.greenStreak ?? 0,
    greensThisDeadline: state.session?.greens ?? 0,
    quota: state.session?.quota,
  });
}
