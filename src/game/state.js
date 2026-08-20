import { RNG, randomSeedString } from '../engine/rng.js';
import { standardDeck, makeCard, SECTOR_KEYS, RANKS, sortCards } from './cards.js';
import { defaultPatternLevels, PATTERN_KEYS, PATTERNS } from './patterns.js';
import { PERKS, makePerk, rollPerkKey, perkSellValue, RARITY } from './perks.js';
import { CHARTS, CONTRACTS, RUMORS, ALL_CONSUMABLES, makeConsumable, rollChart, rollContract, rollRumor, CONTRACT_KEYS } from './consumables.js';
import { LICENSES, availableLicenses } from './licenses.js';
import { BOSSES, pickBoss } from './bosses.js';
import { Market, pickRegime, REGIMES } from './market.js';
import { scoreTrade } from './scoring.js';
import { clamp } from '../engine/util.js';

export const SAVE_KEY = 'margincall.save.v1';

// Quota ladder. Week 1 is a gentle on-ramp; after week 8 it goes exponential.
const BASE_QUOTA = [180, 450, 1100, 2600, 6000, 13500, 30000, 65000];
export function weekBase(week) {
  if (week <= BASE_QUOTA.length) return BASE_QUOTA[week - 1];
  return Math.round(BASE_QUOTA[BASE_QUOTA.length - 1] * Math.pow(2.4, week - BASE_QUOTA.length));
}

export const DEADLINE_SLOTS = [
  { index: 0, name: 'Morning Bell',      art: '🔔', mult: 1.0, reward: 4 },
  { index: 1, name: 'Afternoon Session', art: '🕒', mult: 1.5, reward: 5 },
  { index: 2, name: 'BOSS DEADLINE',     art: '💀', mult: 2.0, reward: 7, boss: true },
];

export const BONUSES = {
  freePerk:     { key: 'freePerk',     name: 'Recruiter',      art: '🧑‍💼', text: 'Gain a random perk immediately' },
  uncommonPerk: { key: 'uncommonPerk', name: 'Headhunter',     art: '🎯', text: 'Gain a random Uncommon perk' },
  rarePerk:     { key: 'rarePerk',     name: 'Star Trader',    art: '🌟', text: 'Gain a random Rare perk' },
  charts:       { key: 'charts',       name: 'Research Dump',  art: '📚', text: 'Gain 2 random Charts' },
  contract:     { key: 'contract',     name: 'Signed Contract', art: '📜', text: 'Gain a random Contract' },
  rumor:        { key: 'rumor',        name: 'Whisper Number', art: '🗣️', text: 'Gain a random Rumor' },
  cash:         { key: 'cash',         name: 'Severance',      art: '💰', text: 'Gain $22 immediately' },
  coupon:       { key: 'coupon',       name: 'Comp Card',      art: '🎟️', text: 'Next Floor: all items are free' },
  rerolls:      { key: 'rerolls',      name: 'Rolodex',        art: '🔄', text: 'Next Floor: 3 free rerolls' },
  investment:   { key: 'investment',   name: 'Investment',     art: '📈', text: 'Gain $28 when you beat the next Boss' },
  ticker:       { key: 'ticker',       name: 'New Listing',    art: '🆕', text: 'Add 2 random Alpha tickers to your portfolio' },
  edition:      { key: 'edition',      name: 'Glossy Print',   art: '✨', text: 'A random perk gains a random edition' },
};
export const BONUS_KEYS = Object.keys(BONUSES);

export const PACKS = [
  { key: 'chartS',    name: 'Chart Pack',        family: 'chart',    art: '📊', cost: 4, size: 3, choose: 1, weight: 10 },
  { key: 'chartJ',    name: 'Jumbo Chart Pack',  family: 'chart',    art: '📊', cost: 6, size: 5, choose: 1, weight: 5 },
  { key: 'chartM',    name: 'Mega Chart Pack',   family: 'chart',    art: '📊', cost: 8, size: 5, choose: 2, weight: 2 },
  { key: 'ctS',       name: 'Contract Pack',     family: 'contract', art: '📜', cost: 4, size: 3, choose: 1, weight: 8 },
  { key: 'ctJ',       name: 'Jumbo Contract Pack', family: 'contract', art: '📜', cost: 6, size: 5, choose: 1, weight: 4 },
  { key: 'ctM',       name: 'Mega Contract Pack', family: 'contract', art: '📜', cost: 8, size: 5, choose: 2, weight: 2 },
  { key: 'rumorS',    name: 'Rumor Pack',        family: 'rumor',    art: '🗣️', cost: 6, size: 2, choose: 1, weight: 4 },
  { key: 'rumorJ',    name: 'Jumbo Rumor Pack',  family: 'rumor',    art: '🗣️', cost: 8, size: 4, choose: 1, weight: 2 },
  { key: 'tickerS',   name: 'Ticker Pack',       family: 'ticker',   art: '🎴', cost: 4, size: 3, choose: 1, weight: 9 },
  { key: 'tickerJ',   name: 'Jumbo Ticker Pack', family: 'ticker',   art: '🎴', cost: 6, size: 5, choose: 1, weight: 5 },
  { key: 'tickerM',   name: 'Mega Ticker Pack',  family: 'ticker',   art: '🎴', cost: 8, size: 5, choose: 2, weight: 2 },
  { key: 'perkS',     name: 'Buyout Pack',       family: 'perk',     art: '🧑‍💼', cost: 6, size: 2, choose: 1, weight: 7 },
  { key: 'perkJ',     name: 'Jumbo Buyout Pack', family: 'perk',     art: '🧑‍💼', cost: 8, size: 4, choose: 1, weight: 3 },
];

// ---------------------------------------------------------------------------
export function newRun(seedString, opts = {}) {
  const seed = seedString || randomSeedString();
  const rng = new RNG(seed);
  const state = {
    seed,
    rng,
    version: 1,
    phase: 'select',
    week: 1,
    deadlineIndex: 0,
    cash: 8,
    deck: standardDeck(),
    perks: [],
    consumables: [],
    licenses: [],
    patterns: defaultPatternLevels(),
    discoveredPatterns: [],
    permanent: { handSize: 8, discards: 3, trades: 4, slots: 5, chartSlots: 2 },
    seenBosses: [],
    pendingBonuses: [],
    shop: null,
    session: null,
    log: [],
    stats: { trades: 0, greens: 0, reds: 0, bestPL: 0, deadlinesCleared: 0, bossesCleared: 0, moneyEarned: 0 },
    difficulty: opts.difficulty || 'standard',
    mods: {},
  };
  state.upcoming = buildWeek(state);
  computeMods(state);
  return state;
}

export function buildWeek(state) {
  const rng = state.rng;
  const boss = pickBoss(rng, state.seenBosses);
  return DEADLINE_SLOTS.map((slot) => ({
    ...slot,
    boss: slot.boss ? boss : null,
    regime: pickRegime(rng, state.week),
    skipped: false,
    done: false,
  }));
}

// ---------------------------------------------------------------------------
const MOD_DEFAULTS = () => ({
  handSize: 8, discards: 3, trades: 4, slots: 5, chartSlots: 2,
  accuracy: 0.68, perfectSignal: false, hideSignal: false,
  quotaMult: 1, bossQuotaMult: 1, bossGrace: 0,
  interestRate: 5, interestCap: 5, deadlineStipend: 0,
  discount: 0, discountPct: 0, rerollDiscount: 0, freeRerolls: 0, shopSlots: 0, sellBonus: 0,
  fourCard: false, shortcut: false, smeared: false, allScore: false,
  patternLevelBonus: 0, luckyBoost: 1, redMult: 0.35, alwaysGreen: false, saveRed: false,
  contractWeight: 1, rumorWeight: 1, rareBoost: 0, allowLegendary: false,
  disableFirstPerk: false, disableEnhancements: false, flatPatternLevels: false,
  zeroCardVolume: false, faceDownFaces: false, setDiscards: null,
});

export function computeMods(state) {
  const m = MOD_DEFAULTS();
  m.handSize = state.permanent.handSize;
  m.discards = state.permanent.discards;
  m.trades = state.permanent.trades;
  m.slots = state.permanent.slots;
  m.chartSlots = state.permanent.chartSlots;

  const apply = (mods) => {
    if (!mods) return;
    for (const [k, v] of Object.entries(mods)) {
      if (typeof v === 'boolean') m[k] = m[k] || v;
      else if (k === 'quotaMult' || k === 'bossQuotaMult' || k === 'discountPct') m[k] = k === 'discountPct' ? m[k] + v : m[k] * v;
      else if (k === 'setDiscards') m[k] = v;
      else m[k] = (m[k] || 0) + v;
    }
  };

  for (const lic of state.licenses) apply(LICENSES[lic]?.mods);
  for (const p of state.perks) {
    if (p.debuffed) continue;
    apply(PERKS[p.key]?.mods);
    if (p.edition === 'offbook') m.slots += 1;
  }
  // redMult: the most generous wrong-way perk wins.
  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.redMult && d.redMult > m.redMult) m.redMult = d.redMult;
    if (d?.saveRed) m.saveRed = true;
  }
  const bossKey = state.session?.boss;
  if (bossKey && BOSSES[bossKey]) apply(BOSSES[bossKey].mods);

  m.accuracy = clamp(m.accuracy, 0.05, 1);
  m.discountPct = clamp(m.discountPct, 0, 0.85);
  m.handSize = Math.max(1, m.handSize);
  m.trades = Math.max(1, m.trades);
  m.discards = Math.max(0, m.discards);
  if (m.setDiscards != null) m.discards = m.setDiscards;
  state.mods = m;
  return m;
}

export function slotsUsed(state) {
  return state.perks.filter((p) => p.edition !== 'offbook').length;
}
export function hasPerkRoom(state) { return slotsUsed(state) < state.mods.slots; }
export function hasConsumableRoom(state) { return state.consumables.length < state.mods.chartSlots; }

// ---------------------------------------------------------------------------
export function quotaFor(state, slot) {
  let q = weekBase(state.week) * slot.mult;
  q *= state.mods.quotaMult;
  if (slot.boss) q *= state.mods.bossQuotaMult;
  return Math.round(q / 10) * 10;
}

export function startDeadline(state, slotIndex) {
  const slot = state.upcoming[slotIndex];
  state.deadlineIndex = slotIndex;
  const rng = state.rng.fork('deadline' + state.week + '-' + slotIndex);
  state.session = {
    slot,
    boss: slot.boss,
    quota: 0,
    profit: 0,
    tradesLeft: 0,
    discardsLeft: 0,
    tradeIndex: 0,
    greens: 0,
    reds: 0,
    greenStreak: 0,
    bestStreak: 0,
    lastDirection: null,
    lastPattern: null,
    stopLossUsed: false,
    earnedThisDeadline: 0,
    hand: [],
    drawPile: [],
    discardPile: [],
    selected: [],
    rng,
    market: null,
    bossGraceLeft: 0,
    resolved: null,
    history: [],
  };
  computeMods(state);
  const bossDef = slot.boss ? BOSSES[slot.boss] : null;
  state.session.bossGraceLeft = bossDef ? (state.mods.bossGrace || 0) : 0;
  computeMods(state);

  const s = state.session;
  s.quota = quotaFor(state, slot) * (bossDef?.quotaMult || 1);
  s.quota = Math.round(s.quota / 10) * 10;
  s.tradesLeft = state.mods.trades;
  s.discardsLeft = state.mods.discards;
  s.market = new Market(rng.fork('market'), { regime: slot.regime, volScale: 1 });

  if (state.mods.deadlineStipend) { state.cash += state.mods.deadlineStipend; }
  if (bossDef?.onStart) bossDef.onStart(state);

  // Portfolio -> draw pile
  for (const c of state.deck) { c.debuffed = false; c.faceDown = false; }
  if (bossDef?.debuffSector) {
    for (const c of state.deck) if (c.sector === bossDef.debuffSector) c.debuffed = true;
  }
  s.drawPile = rng.shuffle(state.deck.slice());
  s.discardPile = [];
  s.hand = [];
  drawToFull(state);
  state.phase = 'trading';
  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.deadlineStart) d.deadlineStart(state, p);
  }
  return s;
}

export function drawToFull(state) {
  const s = state.session;
  const target = state.mods.handSize;
  const bossDef = s.boss ? BOSSES[s.boss] : null;
  const fresh = [];
  while (s.hand.length < target && s.drawPile.length) {
    const c = s.drawPile.pop();
    if (state.mods.faceDownFaces && [11, 12, 13].includes(c.rank)) c.faceDown = true;
    s.hand.push(c);
    fresh.push(c);
  }
  if (bossDef?.onDeal && fresh.length) bossDef.onDeal(state, fresh, s.rng);
  s.hand = sortCards(s.hand, s.sortMode || 'rank');
  return fresh;
}

export function selectedCards(state) {
  const s = state.session;
  return s.selected.map((uid) => s.hand.find((c) => c.uid === uid)).filter(Boolean);
}

export function toggleSelect(state, uid) {
  const s = state.session;
  const i = s.selected.indexOf(uid);
  if (i >= 0) s.selected.splice(i, 1);
  else if (s.selected.length < 5) s.selected.push(uid);
  return s.selected;
}

export function checkTradeLegal(state, direction) {
  const s = state.session;
  const bossDef = s.boss ? BOSSES[s.boss] : null;
  if (!s.selected.length) return { block: 'Select 1-5 tickers to build a position' };
  if (s.tradesLeft <= 0) return { block: 'No trades left' };
  if (bossDef?.beforeTrade && !(s.bossGraceLeft > 0)) {
    const played = selectedCards(state);
    const preview = scoreTrade(state, {
      played, held: [], direction, correct: null, rng: new RNG('probe'), commit: false,
      tradeIndex: s.tradeIndex, tradesLeft: s.tradesLeft, greenStreak: s.greenStreak, quota: s.quota,
    });
    const r = bossDef.beforeTrade(state, { direction, patternKey: preview.patternKey });
    if (r?.block) return r;
  }
  return null;
}

/** Commit the selected tickers as a position. Returns a rich result object. */
export function playTrade(state, direction) {
  const s = state.session;
  const legal = checkTradeLegal(state, direction);
  if (legal?.block) return { blocked: legal.block };

  const played = selectedCards(state);
  const heldCards = s.hand.filter((c) => !s.selected.includes(c.uid));
  for (const c of played) c.faceDown = false;

  const tape = s.market.resolve(direction);
  const res = scoreTrade(state, {
    played,
    held: heldCards,
    direction,
    correct: tape.correct,
    regimeMult: s.market.directionMult(direction),
    regimeName: s.market.regime.name,
    rng: s.rng,
    commit: true,
    tradeIndex: s.tradeIndex,
    tradesLeft: s.tradesLeft,
    greenStreak: s.greenStreak,
    greensThisDeadline: s.greens,
    quota: s.quota,
  });
  res.played = played;
  res.tape = tape;
  res.direction = direction;

  // --- commit ----------------------------------------------------------
  s.profit += res.pl;
  s.tradesLeft -= 1;
  s.tradeIndex += 1;
  s.lastDirection = direction;
  s.lastPattern = res.patternKey;
  state.patterns[res.patternKey].played += 1;
  if (PATTERNS[res.patternKey].secret && !state.discoveredPatterns.includes(res.patternKey)) {
    state.discoveredPatterns.push(res.patternKey);
  }
  if (res.correct) { s.greens++; s.greenStreak++; state.stats.greens++; }
  else { s.reds++; s.greenStreak = 0; state.stats.reds++; }
  s.bestStreak = Math.max(s.bestStreak, s.greenStreak);
  state.stats.trades++;
  state.stats.bestPL = Math.max(state.stats.bestPL, res.pl);
  if (res.money) { state.cash = Math.max(0, state.cash + res.money); s.earnedThisDeadline += Math.max(0, res.money); }
  if (s.bossGraceLeft > 0) s.bossGraceLeft--;

  // hand bookkeeping
  for (const c of played) {
    const i = s.hand.findIndex((h) => h.uid === c.uid);
    if (i >= 0) s.hand.splice(i, 1);
  }
  s.discardPile.push(...played);
  s.selected = [];

  // destroyed tickers (Volatile shattering, boss delisting)
  const destroyed = [...res.destroyQueue];
  const bossDef = s.boss ? BOSSES[s.boss] : null;
  if (bossDef?.afterTrade && !(s.bossGraceLeft > 0)) bossDef.afterTrade(state, res, s.rng);
  if (res.destroyed) destroyed.push(res.destroyed);
  for (const c of destroyed) removeFromDeck(state, c);
  res.destroyedCards = destroyed;

  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.tradeEnd) d.tradeEnd(state, res, p);
  }

  // hold-stamped tickers stay in hand
  for (const c of played) {
    if (c.stamp === 'hold' && !c.debuffed && state.deck.includes(c)) {
      const i = s.discardPile.indexOf(c);
      if (i >= 0) s.discardPile.splice(i, 1);
      s.hand.push(c);
    }
  }

  s.history.push({ pl: res.pl, correct: res.correct, pattern: res.patternName, direction });
  computeMods(state);
  drawToFull(state);

  res.cleared = s.profit >= s.quota;
  res.busted = !res.cleared && s.tradesLeft <= 0;
  return res;
}

export function discardSelected(state) {
  const s = state.session;
  if (!s.selected.length) return { blocked: 'Select tickers to discard' };
  if (s.discardsLeft <= 0) return { blocked: 'No discards left' };
  const cards = selectedCards(state);
  s.discardsLeft -= 1;
  for (const c of cards) {
    const i = s.hand.findIndex((h) => h.uid === c.uid);
    if (i >= 0) s.hand.splice(i, 1);
    s.discardPile.push(c);
  }
  let created = 0;
  for (const c of cards) {
    if (c.stamp === 'filing' && !c.debuffed && hasConsumableRoom(state)) {
      state.consumables.push(makeConsumable(rollChart(s.rng)));
      created++;
    }
  }
  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.discarded) d.discarded(state, cards, p);
  }
  s.selected = [];
  drawToFull(state);
  return { discarded: cards.length, created };
}

export function removeFromDeck(state, card) {
  const i = state.deck.findIndex((c) => c.uid === card.uid);
  if (i >= 0) state.deck.splice(i, 1);
  const s = state.session;
  if (s) {
    for (const list of [s.hand, s.drawPile, s.discardPile]) {
      const j = list.findIndex((c) => c.uid === card.uid);
      if (j >= 0) list.splice(j, 1);
    }
  }
}

// ---------------------------------------------------------------------------
export function finishDeadline(state) {
  const s = state.session;
  const slot = s.slot;
  const rng = state.rng;
  let cash = slot.reward;
  const lines = [{ label: `${slot.name} cleared`, amount: slot.reward }];

  const unused = Math.max(0, s.tradesLeft);
  if (unused) { cash += unused; lines.push({ label: `${unused} unused trade${unused > 1 ? 's' : ''}`, amount: unused }); }

  const rate = state.mods.interestRate;
  const interest = Math.min(state.mods.interestCap, Math.floor(state.cash / rate));
  if (interest > 0) { cash += interest; lines.push({ label: `Interest ($1 per $${rate})`, amount: interest }); }

  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.payout) {
      const amt = d.payout(state, p) | 0;
      if (amt) { cash += amt; lines.push({ label: d.name, amount: amt }); }
    }
  }

  if (slot.boss) {
    const inv = state.pendingBonuses.filter((b) => b === 'investment').length;
    if (inv) {
      cash += 28 * inv;
      lines.push({ label: 'Investment matured', amount: 28 * inv });
      state.pendingBonuses = state.pendingBonuses.filter((b) => b !== 'investment');
    }
    state.stats.bossesCleared++;
    if (!state.seenBosses.includes(slot.boss)) state.seenBosses.push(slot.boss);
    for (const p of state.perks) {
      const d = PERKS[p.key];
      if (d?.onBossClear && hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollChart(rng)));
      if (d?.onBossClearContract && hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollContract(rng, state.discoveredPatterns)));
    }
  }

  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.destroysCard && state.deck.length > 5) removeFromDeck(state, rng.pick(state.deck));
    if (d?.deadlineEnd) d.deadlineEnd(state, p);
  }

  state.cash = Math.max(0, state.cash + cash);
  state.stats.moneyEarned += Math.max(0, cash);
  state.stats.deadlinesCleared++;
  slot.done = true;
  const payout = { total: cash, lines, profit: s.profit, quota: s.quota, greens: s.greens, reds: s.reds };
  state.lastPayout = payout;
  computeMods(state);
  return payout;
}

export function advanceAfterDeadline(state) {
  const idx = state.deadlineIndex;
  state.session = null;
  if (idx >= 2) {
    state.week += 1;
    state.deadlineIndex = 0;
    state.upcoming = buildWeek(state);
  }
  computeMods(state);
}

export function skipDeadline(state, slotIndex) {
  const slot = state.upcoming[slotIndex];
  if (slot.boss) return { blocked: 'Boss deadlines cannot be skipped' };
  slot.skipped = true;
  slot.done = true;
  const bonusKey = slot.bonus || state.rng.pick(BONUS_KEYS);
  applyBonus(state, bonusKey);
  state.deadlineIndex = slotIndex + 1;
  return { bonus: BONUSES[bonusKey] };
}

export function applyBonus(state, key) {
  const rng = state.rng;
  switch (key) {
    case 'freePerk':
      if (hasPerkRoom(state)) state.perks.push(makePerk(rollPerkKey(rng, { allowLegendary: state.mods.allowLegendary }), rng));
      break;
    case 'uncommonPerk': {
      const pool = Object.keys(PERKS).filter((k) => PERKS[k].rarity === 'uncommon');
      if (hasPerkRoom(state)) state.perks.push(makePerk(rng.pick(pool), rng));
      break;
    }
    case 'rarePerk': {
      const pool = Object.keys(PERKS).filter((k) => PERKS[k].rarity === 'rare');
      if (hasPerkRoom(state)) state.perks.push(makePerk(rng.pick(pool), rng));
      break;
    }
    case 'charts':
      for (let i = 0; i < 2; i++) if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollChart(rng)));
      break;
    case 'contract':
      if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollContract(rng, state.discoveredPatterns)));
      break;
    case 'rumor':
      if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollRumor(rng)));
      break;
    case 'cash': state.cash += 22; break;
    case 'coupon': state.pendingBonuses.push('coupon'); break;
    case 'rerolls': state.pendingBonuses.push('rerolls'); break;
    case 'investment': state.pendingBonuses.push('investment'); break;
    case 'ticker':
      for (let i = 0; i < 2; i++) state.deck.push(makeCard(rng.pick(SECTOR_KEYS), 14));
      break;
    case 'edition': {
      const pool = state.perks.filter((p) => !p.edition);
      if (pool.length) rng.pick(pool).edition = rng.pick(['laminated', 'holographic', 'algorithmic']);
      break;
    }
  }
  computeMods(state);
}

// ---------------------------------------------------------------------------
// The Floor (shop)
// ---------------------------------------------------------------------------
export function itemPrice(state, base) {
  let p = base;
  p -= state.mods.discount;
  p = Math.ceil(p * (1 - state.mods.discountPct));
  if (state.shop?.free) p = 0;
  return Math.max(state.shop?.free ? 0 : 1, p);
}

function rollShopItem(state, rng) {
  const m = state.mods;
  const roll = rng.pickWeighted([
    { item: 'perk', weight: 20 },
    { item: 'chart', weight: 8 },
    { item: 'contract', weight: 4 * m.contractWeight },
    { item: 'rumor', weight: 1.2 * m.rumorWeight },
  ]);
  if (roll === 'perk') {
    const key = rollPerkKey(rng, { allowLegendary: m.allowLegendary && rng.chance(0.12) });
    const inst = makePerk(key, rng);
    let cost = PERKS[key].cost + (inst.edition ? 3 : 0);
    if (m.rareBoost && RARITY[PERKS[key].rarity].weight <= 5) cost += 1;
    return { type: 'perk', key, inst, cost };
  }
  if (roll === 'chart') { const key = rollChart(rng); return { type: 'chart', key, cost: CHARTS[key].cost }; }
  if (roll === 'contract') { const key = rollContract(rng, state.discoveredPatterns); return { type: 'contract', key, cost: CONTRACTS[key].cost }; }
  const key = rollRumor(rng);
  return { type: 'rumor', key, cost: RUMORS[key].cost };
}

export function openShop(state) {
  const rng = state.rng.fork('shop' + state.week + '-' + state.deadlineIndex);
  const free = state.pendingBonuses.includes('coupon');
  if (free) state.pendingBonuses = state.pendingBonuses.filter((b) => b !== 'coupon');
  const freeRerolls = (state.mods.freeRerolls || 0) + (state.pendingBonuses.includes('rerolls') ? 3 : 0);
  if (state.pendingBonuses.includes('rerolls')) state.pendingBonuses = state.pendingBonuses.filter((b) => b !== 'rerolls');

  state.shop = {
    rng, free,
    items: [],
    packs: [],
    license: null,
    rerollCost: 5,
    rerolls: 0,
    freeRerolls,
    pack: null,
  };
  const n = 2 + state.mods.shopSlots;
  for (let i = 0; i < n; i++) state.shop.items.push(rollShopItem(state, rng));
  const packPool = PACKS.map((p) => ({ item: p, weight: p.weight }));
  for (let i = 0; i < 2; i++) state.shop.packs.push({ ...rng.pickWeighted(packPool), sold: false });
  const licPool = availableLicenses(state);
  if (licPool.length && (state.deadlineIndex === 2 || rng.chance(0.4))) {
    state.shop.license = { key: rng.pick(licPool), sold: false };
  }
  state.phase = 'shop';
  for (const p of state.perks) {
    const d = PERKS[p.key];
    if (d?.shop) d.shop(state, p);
  }
  return state.shop;
}

export function rerollShop(state) {
  const shop = state.shop;
  let cost = Math.max(0, shop.rerollCost - state.mods.rerollDiscount);
  if (shop.freeRerolls > 0) { cost = 0; shop.freeRerolls--; }
  if (state.cash < cost) return { blocked: 'Not enough cash' };
  state.cash -= cost;
  shop.rerolls++;
  shop.rerollCost += 1;
  shop.items = [];
  const n = 2 + state.mods.shopSlots;
  for (let i = 0; i < n; i++) shop.items.push(rollShopItem(state, shop.rng));
  return { ok: true, cost };
}

export function buyShopItem(state, index) {
  const shop = state.shop;
  const item = shop.items[index];
  if (!item || item.sold) return { blocked: 'Gone' };
  const price = itemPrice(state, item.cost);
  if (state.cash < price) return { blocked: 'Not enough cash' };
  if (item.type === 'perk' && !hasPerkRoom(state) && item.inst.edition !== 'offbook') return { blocked: 'No desk slots left' };
  if (item.type !== 'perk' && !hasConsumableRoom(state)) return { blocked: 'No Chart slots left' };
  state.cash -= price;
  if (item.type === 'perk') {
    state.perks.push(item.inst);
    const d = PERKS[item.key];
    if (d?.onBuy) d.onBuy(state, item.inst);
  } else {
    state.consumables.push(makeConsumable(item.key));
  }
  item.sold = true;
  computeMods(state);
  return { ok: true, price };
}

export function buyLicense(state) {
  const shop = state.shop;
  if (!shop.license || shop.license.sold) return { blocked: 'Gone' };
  const lic = LICENSES[shop.license.key];
  const price = itemPrice(state, lic.cost);
  if (state.cash < price) return { blocked: 'Not enough cash' };
  state.cash -= price;
  state.licenses.push(lic.key);
  shop.license.sold = true;
  computeMods(state);
  return { ok: true };
}

export function buyPack(state, index) {
  const shop = state.shop;
  const pack = shop.packs[index];
  if (!pack || pack.sold) return { blocked: 'Gone' };
  const price = itemPrice(state, pack.cost);
  if (state.cash < price) return { blocked: 'Not enough cash' };
  state.cash -= price;
  pack.sold = true;
  const rng = shop.rng;
  const options = [];
  for (let i = 0; i < pack.size; i++) {
    if (pack.family === 'chart') options.push({ type: 'chart', key: rollChart(rng, options.map((o) => o.key)) });
    else if (pack.family === 'contract') options.push({ type: 'contract', key: rollContract(rng, state.discoveredPatterns) });
    else if (pack.family === 'rumor') options.push({ type: 'rumor', key: rollRumor(rng) });
    else if (pack.family === 'perk') {
      const key = rollPerkKey(rng, { allowLegendary: state.mods.allowLegendary && rng.chance(0.15), exclude: options.map((o) => o.key) });
      options.push({ type: 'perk', key, inst: makePerk(key, rng) });
    } else {
      const card = makeCard(rng.pick(SECTOR_KEYS), rng.pick(RANKS).rank);
      const r = rng.next();
      if (r < 0.28) card.enhancement = rng.pick(['bluechip', 'leveraged', 'wild', 'volatile', 'dividend', 'hedged', 'penny']);
      if (rng.next() < 0.16) card.edition = rng.pickWeighted([
        { item: 'laminated', weight: 6 }, { item: 'holographic', weight: 3 }, { item: 'algorithmic', weight: 1 },
      ]);
      if (rng.next() < 0.10) card.stamp = rng.pick(['reissue', 'hold', 'payout', 'filing']);
      options.push({ type: 'ticker', card });
    }
  }
  shop.pack = { pack, options, picks: pack.choose, taken: [] };
  return { ok: true, pack: shop.pack };
}

export function pickFromPack(state, optionIndex) {
  const open = state.shop?.pack;
  if (!open) return { blocked: 'No pack open' };
  const opt = open.options[optionIndex];
  if (!opt || opt.taken) return { blocked: 'Already taken' };
  if (opt.type === 'perk') {
    if (!hasPerkRoom(state) && opt.inst.edition !== 'offbook') return { blocked: 'No desk slots left' };
    state.perks.push(opt.inst);
  } else if (opt.type === 'ticker') {
    state.deck.push(opt.card);
  } else if (opt.type === 'chart' || opt.type === 'contract' || opt.type === 'rumor') {
    // Consumables from packs may be used immediately instead of stored.
    if (!hasConsumableRoom(state)) return { blocked: 'No Chart slots left' };
    state.consumables.push(makeConsumable(opt.key));
  }
  opt.taken = true;
  open.picks -= 1;
  computeMods(state);
  if (open.picks <= 0) state.shop.pack = null;
  return { ok: true };
}

export function closePack(state) { if (state.shop) state.shop.pack = null; }

export function sellPerk(state, uid) {
  const i = state.perks.findIndex((p) => p.uid === uid);
  if (i < 0) return { blocked: 'Not found' };
  const inst = state.perks[i];
  const val = perkSellValue(inst, state);
  state.perks.splice(i, 1);
  state.cash += val;
  computeMods(state);
  return { ok: true, value: val };
}

export function sellConsumable(state, uid) {
  const i = state.consumables.findIndex((c) => c.uid === uid);
  if (i < 0) return { blocked: 'Not found' };
  const d = ALL_CONSUMABLES[state.consumables[i].key];
  state.consumables.splice(i, 1);
  state.cash += Math.max(1, Math.ceil((d?.cost ?? 3) / 2));
  return { ok: true };
}

export function movePerk(state, uid, dir) {
  const i = state.perks.findIndex((p) => p.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.perks.length) return;
  [state.perks[i], state.perks[j]] = [state.perks[j], state.perks[i]];
}

// ---------------------------------------------------------------------------
export function consumableApi(state, selected) {
  const rng = state.rng;
  return {
    state, rng, selected,
    addCard: (c) => state.deck.push(c),
    destroyCard: (c) => removeFromDeck(state, c),
    createChart: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollChart(rng))); k++; } return k; },
    createContract: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollContract(rng, state.discoveredPatterns))); k++; } return k; },
    createRumor: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollRumor(rng))); k++; } return k; },
    levelPattern: (key, n) => { state.patterns[key].level += n; },
    copyPerk: () => {
      if (!state.perks.length) return { ok: false, msg: 'No perks to copy' };
      if (!hasPerkRoom(state)) return { ok: false, msg: 'No desk slots left' };
      const src = rng.pick(state.perks);
      const copy = makePerk(src.key, null);
      copy.counters = JSON.parse(JSON.stringify(src.counters));
      state.perks.push(copy);
      return { ok: true, msg: `Copied ${PERKS[src.key].name}` };
    },
    destroyRandomPerk: (spare) => {
      const pool = state.perks.filter((p) => p !== spare);
      if (!pool.length) return null;
      const victim = rng.pick(pool);
      state.perks.splice(state.perks.indexOf(victim), 1);
      return victim;
    },
    editionRandomPerk: (edition) => {
      const pool = state.perks.filter((p) => p.edition !== edition);
      if (!pool.length) return { ok: false, msg: 'No eligible perk' };
      const target = rng.pick(pool);
      target.edition = edition;
      computeMods(state);
      return { ok: true, msg: `${PERKS[target.key].name} is now ${edition}`, spared: target };
    },
  };
}

export function useConsumable(state, uid, selectedUids = []) {
  const idx = state.consumables.findIndex((c) => c.uid === uid);
  if (idx < 0) return { ok: false, msg: 'Not found' };
  const inst = state.consumables[idx];
  const d = ALL_CONSUMABLES[inst.key];
  const pool = state.session ? state.session.hand : state.deck;
  const selected = selectedUids.map((u) => pool.find((c) => c.uid === u)).filter(Boolean);
  const api = consumableApi(state, selected);
  const result = d.use(api);
  if (result.ok) {
    state.consumables.splice(idx, 1);
    computeMods(state);
    if (state.session) {
      state.session.selected = [];
      drawToFull(state);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
export function serialize(state) {
  const clone = {
    seed: state.seed, rngState: state.rng.state, rngCalls: state.rng.calls,
    phase: state.phase, week: state.week, deadlineIndex: state.deadlineIndex, cash: state.cash,
    deck: state.deck, perks: state.perks, consumables: state.consumables, licenses: state.licenses,
    patterns: state.patterns, discoveredPatterns: state.discoveredPatterns, permanent: state.permanent,
    seenBosses: state.seenBosses, pendingBonuses: state.pendingBonuses, stats: state.stats,
    upcoming: state.upcoming?.map((u) => ({ ...u })),
  };
  return JSON.stringify(clone);
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  const state = newRun(raw.seed);
  Object.assign(state, {
    phase: raw.phase === 'trading' ? 'select' : raw.phase,
    week: raw.week, deadlineIndex: raw.deadlineIndex, cash: raw.cash,
    deck: raw.deck, perks: raw.perks, consumables: raw.consumables, licenses: raw.licenses,
    patterns: raw.patterns, discoveredPatterns: raw.discoveredPatterns || [], permanent: raw.permanent,
    seenBosses: raw.seenBosses || [], pendingBonuses: raw.pendingBonuses || [], stats: raw.stats,
    upcoming: raw.upcoming,
  });
  // Restore the RNG stream exactly, so a continued run rolls what it would have.
  if (typeof raw.rngState === 'number') {
    state.rng.state = raw.rngState;
    state.rng.calls = raw.rngCalls || 0;
  }
  state.session = null;
  if (state.phase === 'shop') state.phase = 'select';
  computeMods(state);
  return state;
}
