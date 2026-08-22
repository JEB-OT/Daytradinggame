import { RNG, randomSeedString } from '../engine/rng.js';
import { standardBook, makeCandle, SECTOR_KEYS, BODIES, MAX_BODY, sortCandles, isWide, ROLLABLE_ENHANCEMENTS, contributionOf, EDITIONS } from './candles.js';
import { defaultFormationLevels, FORMATION_KEYS, FORMATIONS } from './formations.js';
import { BROKERS, makeBroker, rollBrokerKey, brokerSellValue, RARITY } from './brokers.js';
import { CHARTS, CONTRACTS, RUMORS, ALL_CONSUMABLES, makeConsumable, rollChart, rollContract, rollRumor } from './consumables.js';
import { LICENSES, availableLicenses } from './licenses.js';
import { BOSSES, pickBoss } from './bosses.js';
import { Market, pickRegime } from './market.js';
import { scoreTrade } from './scoring.js';
import { clamp } from '../engine/util.js';

export const SAVE_KEY = 'margincall.save.v2';

const BASE_QUOTA = [180, 450, 1100, 2600, 6000, 13500, 30000, 65000];

// ---------------------------------------------------------------------------
// The quota curve, in ACTS of eight weeks.
//
// Act 1 is the hand-tuned table above: it grows about x2.5 a week and eases off
// to x2.17 by week 8. Past that the curve used to flatten to a constant x2.4
// forever, so endless mode stopped getting harder and only got longer — a desk
// that could clear week 12 could clear week 40.
//
// Instead the per-week growth steps up at every act boundary, so weeks 9, 17,
// 25, 33... each start a steeper stretch than the one before.
// ---------------------------------------------------------------------------
export const ACT_LENGTH = 8;
const ACT_BASE_GROWTH = 2.4;   // act 2 (weeks 9-16)
const ACT_GROWTH_STEP = 0.55;  // added for every act after that

/** Which eight-week act a week belongs to. Weeks 1-8 are act 1. */
export function actOf(week) { return Math.floor((Math.max(1, week) - 1) / ACT_LENGTH) + 1; }

/** The per-week quota multiplier inside an act. Act 1 is the table, not a curve. */
export function actGrowth(act) { return ACT_BASE_GROWTH + ACT_GROWTH_STEP * Math.max(0, act - 2); }

const weekBaseCache = new Map();
export function weekBase(week) {
  if (week <= BASE_QUOTA.length) return BASE_QUOTA[Math.max(1, week) - 1];
  if (weekBaseCache.has(week)) return weekBaseCache.get(week);
  let v = BASE_QUOTA[BASE_QUOTA.length - 1];
  for (let w = BASE_QUOTA.length + 1; w <= week; w++) {
    v *= actGrowth(actOf(w));
    // Clamping at MAX_SAFE_INTEGER would flatten the curve into a wall around
    // week 31, which is the opposite of the point. A quota is only ever
    // compared and formatted, never counted, so past 2^53 it stays a float and
    // loses precision it does not need. Only true overflow is caught.
    if (!Number.isFinite(v)) { v = Number.MAX_VALUE; break; }
  }
  const out = v < 1e15 ? Math.round(v) : v;
  weekBaseCache.set(week, out);
  return out;
}

export const DEADLINE_SLOTS = [
  { index: 0, name: 'Morning Bell',      art: '🔔', mult: 1.0, reward: 4 },
  { index: 1, name: 'Afternoon Session', art: '🕒', mult: 1.5, reward: 5 },
  { index: 2, name: 'BOSS DEADLINE',     art: '💀', mult: 2.0, reward: 7, boss: true },
];

export const BONUSES = {
  freeBroker:   { key: 'freeBroker',   name: 'Recruiter',       art: '🧑‍💼', text: 'Hire a random broker immediately' },
  uncommonBroker:{ key: 'uncommonBroker', name: 'Headhunter',   art: '🎯', text: 'Hire a random Uncommon broker' },
  rareBroker:   { key: 'rareBroker',   name: 'Star Trader',     art: '🌟', text: 'Hire a random Rare broker' },
  charts:       { key: 'charts',       name: 'Research Dump',   art: '📚', text: 'Gain 2 random Charts' },
  contract:     { key: 'contract',     name: 'Signed Contract', art: '📜', text: 'Gain a random Contract' },
  rumor:        { key: 'rumor',        name: 'Whisper Number',  art: '🗣️', text: 'Gain a random Rumor' },
  cash:         { key: 'cash',         name: 'Severance',       art: '💰', text: 'Gain $22 immediately' },
  coupon:       { key: 'coupon',       name: 'Comp Card',       art: '🎟️', text: 'Next Floor: all items are free' },
  rerolls:      { key: 'rerolls',      name: 'Rolodex',         art: '🔄', text: 'Next Floor: 3 free rerolls' },
  investment:   { key: 'investment',   name: 'Investment',      art: '📈', text: 'Gain $28 when you beat the next Boss' },
  candles:      { key: 'candles',      name: 'New Listing',     art: '🕯️', text: 'Add 2 wide-bodied candles to your book' },
  edition:      { key: 'edition',      name: 'Glossy Print',    art: '✨', text: 'A random broker gains a random edition' },
};
export const BONUS_KEYS = Object.keys(BONUSES);

export const PACKS = [
  { key: 'chartS',  name: 'Chart Pack',          family: 'chart',    art: '📊', cost: 4, size: 3, choose: 1, weight: 10 },
  { key: 'chartJ',  name: 'Jumbo Chart Pack',    family: 'chart',    art: '📊', cost: 6, size: 5, choose: 1, weight: 5 },
  { key: 'chartM',  name: 'Mega Chart Pack',     family: 'chart',    art: '📊', cost: 9, size: 5, choose: 2, weight: 2 },
  { key: 'ctS',     name: 'Contract Pack',       family: 'contract', art: '📜', cost: 4, size: 3, choose: 1, weight: 8 },
  { key: 'ctJ',     name: 'Jumbo Contract Pack', family: 'contract', art: '📜', cost: 6, size: 5, choose: 1, weight: 4 },
  { key: 'ctM',     name: 'Mega Contract Pack',  family: 'contract', art: '📜', cost: 9, size: 5, choose: 2, weight: 2 },
  { key: 'rumorS',  name: 'Rumor Pack',          family: 'rumor',    art: '🗣️', cost: 6, size: 2, choose: 1, weight: 4 },
  { key: 'rumorJ',  name: 'Jumbo Rumor Pack',    family: 'rumor',    art: '🗣️', cost: 8, size: 4, choose: 1, weight: 2 },
  { key: 'rumorM',  name: 'Mega Rumor Pack',     family: 'rumor',    art: '🗣️', cost: 12, size: 4, choose: 2, weight: 1 },
  { key: 'candleS', name: 'Candle Pack',         family: 'candle',   art: '🕯️', cost: 4, size: 3, choose: 1, weight: 9 },
  { key: 'candleJ', name: 'Jumbo Candle Pack',   family: 'candle',   art: '🕯️', cost: 6, size: 5, choose: 1, weight: 5 },
  { key: 'candleM', name: 'Mega Candle Pack',    family: 'candle',   art: '🕯️', cost: 9, size: 5, choose: 2, weight: 2 },
  { key: 'brokerS', name: 'Buyout Pack',         family: 'broker',   art: '🧑‍💼', cost: 6, size: 2, choose: 1, weight: 7 },
  { key: 'brokerJ', name: 'Jumbo Buyout Pack',   family: 'broker',   art: '🧑‍💼', cost: 9, size: 4, choose: 1, weight: 3 },
  { key: 'brokerM', name: 'Mega Buyout Pack',    family: 'broker',   art: '🧑‍💼', cost: 13, size: 5, choose: 2, weight: 1 },
];

/** What a pack family is called on the tile, singular and plural. */
export const PACK_CONTENTS = {
  chart:    { one: 'Chart',    many: 'Charts',    blurb: 'reshape the candles in your book' },
  contract: { one: 'Contract', many: 'Contracts', blurb: 'permanently level up a formation' },
  rumor:    { one: 'Rumor',    many: 'Rumors',    blurb: 'high risk, high reward' },
  candle:   { one: 'Candle',   many: 'Candles',   blurb: 'added straight to your book' },
  broker:   { one: 'Broker',   many: 'Brokers',   blurb: 'hired onto your desk' },
};

/** "Keep 2 of 5 Brokers" — the headline on a pack tile. */
export function packSummary(pack) {
  const c = PACK_CONTENTS[pack.family];
  return `Keep ${pack.choose} of ${pack.size} ${pack.size > 1 ? c.many : c.one}`;
}

// ---------------------------------------------------------------------------
export function newRun(seedString, opts = {}) {
  const seed = seedString || randomSeedString();
  const state = {
    seed,
    rng: new RNG(seed),
    version: 2,
    phase: 'select',
    week: 1,
    deadlineIndex: 0,
    cash: 8,
    book: standardBook(),
    brokers: [],
    consumables: [],
    licenses: [],
    formations: defaultFormationLevels(),
    discoveredFormations: [],
    permanent: { handSize: 8, discards: 3, trades: 4, slots: 5, chartSlots: 2 },
    seenBosses: [],
    pendingBonuses: [],
    shop: null,
    session: null,
    stats: { trades: 0, greens: 0, reds: 0, bestPL: 0, deadlinesCleared: 0, bossesCleared: 0, moneyEarned: 0, marches: 0 },
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
  fourCard: false, shortcut: false, smeared: false, allScore: false, marchOfThree: false,
  formationLevelBonus: 0, luckyBoost: 1, redMult: 0.35, alwaysGreen: false, saveRed: false,
  convictionBonus: 0, convictionThreshold: 0.6, noConviction: false,
  contractWeight: 1, rumorWeight: 1, rareBoost: 0, allowLegendary: false,
  disableFirstBroker: false, disableEnhancements: false, flatFormationLevels: false,
  zeroCandleVolume: false, faceDownWide: false, setDiscards: null,
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
      else if (k === 'quotaMult' || k === 'bossQuotaMult') m[k] *= v;
      else if (k === 'discountPct') m[k] += v;
      else if (k === 'convictionThreshold') m[k] = Math.min(m[k], v);
      else if (k === 'setDiscards') m[k] = v;
      else m[k] = (m[k] || 0) + v;
    }
  };

  for (const lic of state.licenses) apply(LICENSES[lic]?.mods);
  for (const b of state.brokers) {
    if (b.debuffed) continue;
    apply(BROKERS[b.key]?.mods);
    if (b.edition === 'offbook') m.slots += 1;
  }
  for (const b of state.brokers) {
    const d = BROKERS[b.key];
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

/** Keys the player already employs, unless a broker says duplicates are fine. */
export function ownedBrokerKeys(state) {
  return state.mods.allowDuplicates ? [] : state.brokers.map((b) => b.key);
}

/**
 * Every broker key currently *visible* on the Floor: unsold shelf items plus
 * the untaken options of an open pack.
 *
 * The shelf and a pack are rolled at different moments, so without this they
 * roll against each other blind — the same broker turns up in both, and taking
 * one then buying the other lands two of them on your desk. Passing this as
 * `exclude` makes the Floor de-duplicate against itself as a whole.
 */
export function brokersOnOffer(state) {
  const shop = state.shop;
  if (!shop || state.mods.allowDuplicates) return [];
  const keys = shop.items.filter((i) => i.type === 'broker' && !i.sold).map((i) => i.key);
  for (const o of shop.pack?.options || []) {
    if (o.type === 'broker' && !o.taken) keys.push(o.key);
  }
  return keys;
}

/** Would taking this broker put a second copy on the desk? */
export function alreadyEmployed(state, key) {
  return !state.mods.allowDuplicates && state.brokers.some((b) => b.key === key);
}

export function slotsUsed(state) { return state.brokers.filter((b) => b.edition !== 'offbook').length; }
export function hasBrokerRoom(state) { return slotsUsed(state) < state.mods.slots; }
export function hasConsumableRoom(state) { return state.consumables.length < state.mods.chartSlots; }

// ---------------------------------------------------------------------------
export function quotaFor(state, slot) {
  let q = weekBase(state.week) * slot.mult * state.mods.quotaMult;
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
    quota: 0, profit: 0,
    tradesLeft: 0, discardsLeft: 0, tradeIndex: 0,
    greens: 0, reds: 0, greenStreak: 0, bestStreak: 0,
    lastDirection: null, lastFormation: null, stopLossUsed: false,
    earnedThisDeadline: 0,
    board: [], drawPile: [], swept: [], selected: [],
    rng, market: null, bossGraceLeft: 0, history: [],
    sortMode: 'body',
  };
  computeMods(state);
  const bossDef = slot.boss ? BOSSES[slot.boss] : null;
  state.session.bossGraceLeft = bossDef ? (state.mods.bossGrace || 0) : 0;
  computeMods(state);

  const s = state.session;
  s.quota = Math.round((quotaFor(state, slot) * (bossDef?.quotaMult || 1)) / 10) * 10;
  s.tradesLeft = state.mods.trades;
  s.discardsLeft = state.mods.discards;
  s.market = new Market(rng.fork('market'), { regime: slot.regime });

  if (state.mods.deadlineStipend) state.cash += state.mods.deadlineStipend;
  if (bossDef?.onStart) bossDef.onStart(state);

  for (const c of state.book) { c.debuffed = false; c.faceDown = false; }
  if (bossDef?.debuffSector) for (const c of state.book) if (c.sector === bossDef.debuffSector) c.debuffed = true;
  if (bossDef?.debuffPolarity) {
    for (const c of state.book) if ((bossDef.debuffPolarity === 'bull') === !!c.bull) c.debuffed = true;
  }

  s.drawPile = rng.shuffle(state.book.slice());
  refillBoard(state);
  state.phase = 'trading';
  for (const b of state.brokers) BROKERS[b.key]?.deadlineStart?.(state, b);
  return s;
}

export function refillBoard(state) {
  const s = state.session;
  const target = state.mods.handSize;
  const bossDef = s.boss ? BOSSES[s.boss] : null;
  const fresh = [];
  while (s.board.length < target && s.drawPile.length) {
    const c = s.drawPile.pop();
    if (state.mods.faceDownWide && isWide(c)) c.faceDown = true;
    s.board.push(c);
    fresh.push(c);
  }
  if (bossDef?.onDeal && fresh.length && !(s.bossGraceLeft > 0)) bossDef.onDeal(state, fresh, s.rng);
  // The sort you picked is a standing preference, not a one-off. Rearranging a
  // placement used to latch the board into a manual mode it never left, so
  // every redraw for the rest of the deadline came back unsorted and you had to
  // press SORT again. A refill only ever happens with the placement already
  // cleared, so re-sorting here cannot disturb an arrangement in progress.
  s.board = sortCandles(s.board, s.sortMode || 'body');
  return fresh;
}

/** Selected candles, in the order the player clicked them — placement order. */
export function selectedCandles(state) {
  const s = state.session;
  return s.selected.map((uid) => s.board.find((c) => c.uid === uid)).filter(Boolean);
}

export function toggleSelect(state, uid) {
  const s = state.session;
  const i = s.selected.indexOf(uid);
  if (i >= 0) s.selected.splice(i, 1);
  else if (s.selected.length < 5) s.selected.push(uid);
  return s.selected;
}

/**
 * Rewrite the placement order so it matches what the board actually shows,
 * left to right.
 *
 * The badge on a candle is a promise about the order it will print in, and the
 * only way to keep that promise readable is for the order you *see* to be the
 * order that prints. So every action that physically moves a candle — a drag,
 * an ARRANGE, a board sort — re-derives the placement from the board rather
 * than leaving it on the order things happened to be clicked in.
 */
export function syncPlacementToBoard(state) {
  const s = state.session;
  if (!s) return false;
  const picked = new Set(s.selected);
  s.selected = s.board.filter((c) => picked.has(c.uid)).map((c) => c.uid);
  return true;
}

export const ARRANGE_MODES = [
  { key: 'rising',   label: 'RISING ▲',   hint: 'smallest body first — the shape Three White Soldiers wants' },
  { key: 'falling',  label: 'FALLING ▼',  hint: 'largest body first — the shape Three Black Crows wants' },
  { key: 'volume',   label: 'VOLUME 1st', hint: 'candles that add Volume print before ones that multiply Leverage' },
  { key: 'leverage', label: 'LEVER. 1st', hint: 'candles that multiply Leverage print before the Volume ones' },
  { key: 'reverse',  label: 'REVERSE',    hint: 'flip the current placement end to end' },
];

/**
 * Reorder the current placement. Order is not cosmetic: candles print left to
 * right, so putting the additive ones first and the multiplying ones last is
 * usually worth more.
 */
/**
 * Seat an ordered placement back onto the board.
 *
 * The placed candles drop into the same slots they already occupied, in the new
 * order — so reordering your hand rearranges *your hand* and nothing else. The
 * candles you did not place hold station, which is what keeps a sorted board
 * looking sorted while you shuffle a placement around on top of it.
 */
export function applyPlacementOrder(state, ordered) {
  const s = state.session;
  if (!s || !ordered?.length) return false;
  const inPlacement = new Set(s.selected);
  if (ordered.length !== inPlacement.size || !ordered.every((c) => inPlacement.has(c.uid))) return false;
  const slots = [];
  s.board.forEach((c, i) => { if (inPlacement.has(c.uid)) slots.push(i); });
  if (slots.length !== ordered.length) return false;
  slots.forEach((slot, i) => { s.board[slot] = ordered[i]; });
  s.selected = ordered.map((c) => c.uid);
  return true;
}

export function arrangeSelection(state, mode) {
  const s = state.session;
  const picked = selectedCandles(state);
  if (picked.length < 2) return false;
  const byBody = (a, b) => a.body - b.body;
  let out;
  if (mode === 'reverse') out = picked.slice().reverse();
  else if (mode === 'falling') out = picked.slice().sort((a, b) => b.body - a.body);
  else if (mode === 'volume') {
    out = picked.slice().sort((a, b) =>
      (contributionOf(a) === 'volume' ? 0 : 1) - (contributionOf(b) === 'volume' ? 0 : 1) || byBody(a, b));
  } else if (mode === 'leverage') {
    out = picked.slice().sort((a, b) =>
      (contributionOf(a) === 'leverage' ? 0 : 1) - (contributionOf(b) === 'leverage' ? 0 : 1) || byBody(a, b));
  } else out = picked.slice().sort(byBody);
  // Move the cards themselves, not just the numbers on them, so the arrangement
  // you asked for is the arrangement you can see.
  return applyPlacementOrder(state, out);
}

/**
 * Drag one placed candle to a new slot in the placement.
 *
 * Only the placed candles move. Splicing it into the board instead would shove
 * every candle to one side of it along by one, which is how reordering three
 * cards used to scramble the other five.
 */
export function movePlacement(state, uid, toIndex) {
  const s = state.session;
  const from = s.selected.indexOf(uid);
  if (from < 0) return false;
  const to = clamp(toIndex, 0, s.selected.length - 1);
  if (from === to) return false;
  const order = selectedCandles(state);
  order.splice(to, 0, order.splice(from, 1)[0]);
  return applyPlacementOrder(state, order);
}

/** Drag a candle to a new spot on the board itself. */
export function moveBoardCandle(state, uid, toIndex) {
  const s = state.session;
  const from = s.board.findIndex((c) => c.uid === uid);
  if (from < 0) return false;
  const to = clamp(toIndex, 0, s.board.length - 1);
  if (from === to) return false;
  s.board.splice(to, 0, s.board.splice(from, 1)[0]);
  syncPlacementToBoard(state);
  return true;
}

export function checkTradeLegal(state, direction) {
  const s = state.session;
  const bossDef = s.boss ? BOSSES[s.boss] : null;
  if (!s.selected.length) return { block: 'Place 1-5 candles to build a position' };
  if (s.tradesLeft <= 0) return { block: 'No trades left' };
  if (bossDef?.beforeTrade && !(s.bossGraceLeft > 0)) {
    const played = selectedCandles(state);
    const preview = scoreTrade(state, {
      played, held: [], direction, correct: null, rng: new RNG('probe'), commit: false,
      tradeIndex: s.tradeIndex, tradesLeft: s.tradesLeft, greenStreak: s.greenStreak, quota: s.quota,
    });
    const r = bossDef.beforeTrade(state, { direction, formationKey: preview.formationKey });
    if (r?.block) return r;
  }
  return null;
}

export function playTrade(state, direction) {
  const s = state.session;
  const legal = checkTradeLegal(state, direction);
  if (legal?.block) return { blocked: legal.block };

  const bossDef = s.boss ? BOSSES[s.boss] : null;
  let played = selectedCandles(state);
  if (bossDef?.scrambleOrder && !(s.bossGraceLeft > 0)) played = s.rng.shuffle(played);
  const held = s.board.filter((c) => !s.selected.includes(c.uid));
  for (const c of played) c.faceDown = false;

  const tape = s.market.resolve(direction);
  const res = scoreTrade(state, {
    played, held, direction, correct: tape.correct,
    regimeMult: s.market.directionMult(direction),
    regimeName: s.market.regime.name,
    rng: s.rng, commit: true,
    tradeIndex: s.tradeIndex, tradesLeft: s.tradesLeft,
    greenStreak: s.greenStreak, greensThisDeadline: s.greens,
    quota: s.quota,
  });
  res.played = played;
  res.tape = tape;
  res.direction = direction;

  s.profit += res.pl;
  s.tradesLeft -= 1;
  s.tradeIndex += 1;
  s.lastDirection = direction;
  s.lastFormation = res.formationKey;
  state.formations[res.formationKey].played += 1;
  if (FORMATIONS[res.formationKey].secret && !state.discoveredFormations.includes(res.formationKey)) {
    state.discoveredFormations.push(res.formationKey);
  }
  if (res.formationKey === 'soldiers' || res.formationKey === 'crows') state.stats.marches++;
  if (res.correct) { s.greens++; s.greenStreak++; state.stats.greens++; }
  else { s.reds++; s.greenStreak = 0; state.stats.reds++; }
  s.bestStreak = Math.max(s.bestStreak, s.greenStreak);
  state.stats.trades++;
  state.stats.bestPL = Math.max(state.stats.bestPL, res.pl);
  if (res.money) { state.cash = Math.max(0, state.cash + res.money); s.earnedThisDeadline += Math.max(0, res.money); }
  if (s.bossGraceLeft > 0) s.bossGraceLeft--;

  for (const c of played) {
    const i = s.board.findIndex((h) => h.uid === c.uid);
    if (i >= 0) s.board.splice(i, 1);
  }
  s.swept.push(...played);
  s.selected = [];

  const destroyed = [...res.destroyQueue];
  if (bossDef?.afterTrade && !(s.bossGraceLeft > 0)) bossDef.afterTrade(state, res, s.rng);
  if (res.destroyed) destroyed.push(res.destroyed);
  for (const c of destroyed) removeFromBook(state, c);
  res.destroyedCandles = destroyed;

  for (const b of state.brokers) BROKERS[b.key]?.tradeEnd?.(state, res, b);

  for (const c of played) {
    if (c.stamp === 'hold' && !c.debuffed && state.book.includes(c)) {
      const i = s.swept.indexOf(c);
      if (i >= 0) s.swept.splice(i, 1);
      s.board.push(c);
    }
  }

  s.history.push({ pl: res.pl, correct: res.correct, formation: res.formationName, direction, conviction: res.conviction?.key });
  computeMods(state);
  refillBoard(state);

  res.cleared = s.profit >= s.quota;
  res.busted = !res.cleared && s.tradesLeft <= 0;
  return res;
}

export function sweepSelected(state) {
  const s = state.session;
  if (!s.selected.length) return { blocked: 'Select candles to sweep' };
  if (s.discardsLeft <= 0) return { blocked: 'No sweeps left' };
  const candles = selectedCandles(state);
  s.discardsLeft -= 1;
  for (const c of candles) {
    const i = s.board.findIndex((h) => h.uid === c.uid);
    if (i >= 0) s.board.splice(i, 1);
    s.swept.push(c);
  }
  let created = 0;
  for (const c of candles) {
    if (c.stamp === 'filing' && !c.debuffed && hasConsumableRoom(state)) {
      state.consumables.push(makeConsumable(rollChart(s.rng)));
      created++;
    }
  }
  for (const b of state.brokers) BROKERS[b.key]?.discarded?.(state, candles, b);
  s.selected = [];
  refillBoard(state);
  return { swept: candles.length, created };
}

/**
 * Where every candle in the book physically is right now: still in the deck,
 * sitting on the board, or already spent. Between deadlines nothing has been
 * dealt, so the whole book counts as deck.
 *
 * Anything in the book that is in neither the draw pile nor the board has been
 * traded or swept, so `swept` is derived rather than read straight off the
 * session — that keeps stamps like Anchor, which put a candle back on the
 * board, from being counted twice.
 */
export function bookLocations(state) {
  const s = state.session;
  if (!s) return { deck: state.book.slice(), board: [], swept: [], dealt: false };
  const inBook = new Set(state.book.map((c) => c.uid));
  const deck = s.drawPile.filter((c) => inBook.has(c.uid));
  const board = s.board.filter((c) => inBook.has(c.uid));
  const live = new Set([...deck, ...board].map((c) => c.uid));
  const swept = state.book.filter((c) => !live.has(c.uid));
  return { deck, board, swept, dealt: true };
}

export function removeFromBook(state, candle) {
  const i = state.book.findIndex((c) => c.uid === candle.uid);
  if (i >= 0) state.book.splice(i, 1);
  const s = state.session;
  if (s) {
    for (const list of [s.board, s.drawPile, s.swept]) {
      const j = list.findIndex((c) => c.uid === candle.uid);
      if (j >= 0) list.splice(j, 1);
    }
  }
}

// ---------------------------------------------------------------------------
/**
 * What clearing right now would pay. Same maths as finishDeadline, without
 * committing anything, so the board can show the player what is waiting.
 */
export function payoutPreview(state) {
  const s = state.session;
  const lines = [];
  if (!s) return { total: 0, lines };
  let total = s.slot.reward;
  lines.push({ label: `${s.slot.name} cleared`, amount: s.slot.reward });
  const unused = Math.max(0, s.tradesLeft);
  if (unused) { total += unused; lines.push({ label: `${unused} unused trade${unused > 1 ? 's' : ''} × $1`, amount: unused }); }
  const rate = state.mods.interestRate;
  const cap = state.mods.interestCap;
  const interest = Math.min(cap, Math.floor(state.cash / rate));
  if (interest > 0) total += interest;
  lines.push({ label: `Interest — $1 per $${rate} held (max $${cap})`, amount: interest, dim: interest === 0 });
  return { total, lines, interest, interestCap: cap, interestRate: rate };
}

export function finishDeadline(state) {
  const s = state.session;
  const slot = s.slot;
  const rng = state.rng;
  let cash = slot.reward;
  const lines = [{ label: `${slot.name} cleared`, amount: slot.reward }];

  const unused = Math.max(0, s.tradesLeft);
  if (unused) { cash += unused; lines.push({ label: `${unused} unused trade${unused > 1 ? 's' : ''} × $1`, amount: unused }); }

  const rate = state.mods.interestRate;
  const cap = state.mods.interestCap;
  const interest = Math.min(cap, Math.floor(state.cash / rate));
  if (interest > 0) { cash += interest; lines.push({ label: `Interest — $1 per $${rate} held (max $${cap})`, amount: interest }); }

  for (const b of state.brokers) {
    const d = BROKERS[b.key];
    if (d?.payout) {
      const amt = d.payout(state, b) | 0;
      if (amt) { cash += amt; lines.push({ label: d.name, amount: amt }); }
    }
  }

  if (slot.boss) {
    const inv = state.pendingBonuses.filter((x) => x === 'investment').length;
    if (inv) {
      cash += 28 * inv;
      lines.push({ label: 'Investment matured', amount: 28 * inv });
      state.pendingBonuses = state.pendingBonuses.filter((x) => x !== 'investment');
    }
    state.stats.bossesCleared++;
    if (!state.seenBosses.includes(slot.boss)) state.seenBosses.push(slot.boss);
    for (const b of state.brokers) {
      const d = BROKERS[b.key];
      if (d?.onBossClear && hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollChart(rng)));
      if (d?.onBossClearContract && hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollContract(rng, state.discoveredFormations)));
    }
  }

  for (const b of state.brokers) {
    const d = BROKERS[b.key];
    if (d?.destroysCard && state.book.length > 5) removeFromBook(state, rng.pick(state.book));
    d?.deadlineEnd?.(state, b);
  }

  state.cash = Math.max(0, state.cash + cash);
  state.stats.moneyEarned += Math.max(0, cash);
  state.stats.deadlinesCleared++;
  slot.done = true;
  const payout = { total: cash, lines, profit: s.profit, quota: s.quota, greens: s.greens, reds: s.reds, bestStreak: s.bestStreak };
  state.lastPayout = payout;
  computeMods(state);
  return payout;
}

/**
 * Park the run on the first deadline that still needs playing, rolling the week
 * over once all three are done.
 *
 * This is deliberately IDEMPOTENT: running it twice changes nothing. Progress
 * used to be a blind `index + 1`, which meant any state that arrived with the
 * index out of step — a save written at the payout screen or on the Floor,
 * where the slot is already cleared but the index has not moved yet — resumed
 * onto a slot that was both "current" and "done". The select screen draws that
 * as CLEARED with no button and locks everything else, so the run was
 * unplayable. Deriving the position from what is actually done removes the
 * whole class of problem.
 */
export function normalizeProgress(state) {
  if (!Array.isArray(state.upcoming) || state.upcoming.length !== DEADLINE_SLOTS.length) {
    state.upcoming = buildWeek(state);
    state.deadlineIndex = 0;
    return state;
  }
  let i = clamp(state.deadlineIndex | 0, 0, state.upcoming.length - 1);
  while (i < state.upcoming.length && state.upcoming[i].done) i++;
  if (i >= state.upcoming.length) {
    // Nothing left to play this week — including the boss. Roll over.
    state.week += 1;
    state.deadlineIndex = 0;
    state.upcoming = buildWeek(state);
    return state;
  }
  state.deadlineIndex = i;
  return state;
}

export function advanceAfterDeadline(state) {
  state.session = null;
  state.shop = null;
  state.phase = 'select';
  normalizeProgress(state);
  computeMods(state);
}

export function skipDeadline(state, slotIndex) {
  const slot = state.upcoming[slotIndex];
  if (slot.boss) return { blocked: 'Boss deadlines cannot be skipped' };
  slot.skipped = true;
  slot.done = true;
  const bonusKey = state.rng.pick(BONUS_KEYS);
  applyBonus(state, bonusKey);
  state.deadlineIndex = slotIndex + 1;
  return { bonus: BONUSES[bonusKey] };
}

export function applyBonus(state, key) {
  const rng = state.rng;
  switch (key) {
    case 'freeBroker':
      if (hasBrokerRoom(state)) {
        state.brokers.push(makeBroker(rollBrokerKey(rng, {
          allowLegendary: state.mods.allowLegendary, owned: ownedBrokerKeys(state),
          exclude: brokersOnOffer(state),
        }), rng));
      }
      break;
    case 'uncommonBroker':
      if (hasBrokerRoom(state)) {
        state.brokers.push(makeBroker(rollBrokerKey(rng,
          { rarity: 'uncommon', owned: ownedBrokerKeys(state), exclude: brokersOnOffer(state) }), rng));
      }
      break;
    case 'rareBroker':
      if (hasBrokerRoom(state)) {
        state.brokers.push(makeBroker(rollBrokerKey(rng,
          { rarity: 'rare', owned: ownedBrokerKeys(state), exclude: brokersOnOffer(state) }), rng));
      }
      break;
    case 'charts':
      for (let i = 0; i < 2; i++) if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollChart(rng)));
      break;
    case 'contract':
      if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollContract(rng, state.discoveredFormations)));
      break;
    case 'rumor':
      if (hasConsumableRoom(state)) state.consumables.push(makeConsumable(rollRumor(rng)));
      break;
    case 'cash': state.cash += 22; break;
    case 'coupon': state.pendingBonuses.push('coupon'); break;
    case 'rerolls': state.pendingBonuses.push('rerolls'); break;
    case 'investment': state.pendingBonuses.push('investment'); break;
    case 'candles':
      for (let i = 0; i < 2; i++) state.book.push(makeCandle(rng.pick(SECTOR_KEYS), MAX_BODY - rng.int(0, 2), rng.chance(0.5)));
      break;
    case 'edition': {
      const pool = state.brokers.filter((b) => !b.edition);
      if (pool.length) rng.pick(pool).edition = rng.pick(['laminated', 'holographic', 'algorithmic']);
      break;
    }
  }
  computeMods(state);
}

// ---------------------------------------------------------------------------
export function itemPrice(state, base) {
  let p = base - state.mods.discount;
  p = Math.ceil(p * (1 - state.mods.discountPct));
  if (state.shop?.free) return 0;
  return Math.max(1, p);
}

function rollShopItem(state, rng) {
  const m = state.mods;
  const roll = rng.pickWeighted([
    { item: 'broker', weight: 20 },
    { item: 'chart', weight: 8 },
    { item: 'contract', weight: 4 * m.contractWeight },
    { item: 'rumor', weight: 1.2 * m.rumorWeight },
  ]);
  if (roll === 'broker') {
    const key = rollBrokerKey(rng, {
      allowLegendary: m.allowLegendary && rng.chance(0.12),
      owned: ownedBrokerKeys(state),
      exclude: brokersOnOffer(state),
    });
    const inst = makeBroker(key, rng);
    let cost = BROKERS[key].cost + (inst.edition ? 3 : 0);
    if (m.rareBoost && RARITY[BROKERS[key].rarity].weight <= 5) cost += 1;
    return { type: 'broker', key, inst, cost };
  }
  if (roll === 'chart') { const key = rollChart(rng); return { type: 'chart', key, cost: CHARTS[key].cost }; }
  if (roll === 'contract') { const key = rollContract(rng, state.discoveredFormations); return { type: 'contract', key, cost: CONTRACTS[key].cost }; }
  const key = rollRumor(rng);
  return { type: 'rumor', key, cost: RUMORS[key].cost };
}

export function openShop(state) {
  const rng = state.rng.fork('shop' + state.week + '-' + state.deadlineIndex);
  const free = state.pendingBonuses.includes('coupon');
  if (free) state.pendingBonuses = state.pendingBonuses.filter((b) => b !== 'coupon');
  let freeRerolls = state.mods.freeRerolls || 0;
  if (state.pendingBonuses.includes('rerolls')) {
    freeRerolls += 3;
    state.pendingBonuses = state.pendingBonuses.filter((b) => b !== 'rerolls');
  }

  state.shop = { rng, free, items: [], packs: [], license: null, rerollCost: 5, rerolls: 0, freeRerolls, pack: null };
  const n = 2 + state.mods.shopSlots;
  for (let i = 0; i < n; i++) state.shop.items.push(rollShopItem(state, rng));
  const packPool = PACKS.map((p) => ({ item: p, weight: p.weight }));
  for (let i = 0; i < 2; i++) state.shop.packs.push({ ...rng.pickWeighted(packPool), sold: false });
  const licPool = availableLicenses(state);
  if (licPool.length && (state.deadlineIndex === 2 || rng.chance(0.4))) {
    state.shop.license = { key: rng.pick(licPool), sold: false };
  }
  state.phase = 'shop';
  for (const b of state.brokers) BROKERS[b.key]?.shop?.(state, b);
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
  const item = state.shop.items[index];
  if (!item || item.sold) return { blocked: 'Gone' };
  const price = itemPrice(state, item.cost);
  if (state.cash < price) return { blocked: 'Not enough cash' };
  if (item.type === 'broker' && alreadyEmployed(state, item.key)) return { blocked: 'You already employ them' };
  if (item.type === 'broker' && !hasBrokerRoom(state) && item.inst.edition !== 'offbook') return { blocked: 'No desk slots left' };
  if (item.type !== 'broker' && !hasConsumableRoom(state)) return { blocked: 'No Chart slots left' };
  state.cash -= price;
  if (item.type === 'broker') state.brokers.push(item.inst);
  else state.consumables.push(makeConsumable(item.key));
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
    else if (pack.family === 'contract') options.push({ type: 'contract', key: rollContract(rng, state.discoveredFormations) });
    else if (pack.family === 'rumor') options.push({ type: 'rumor', key: rollRumor(rng) });
    else if (pack.family === 'broker') {
      const key = rollBrokerKey(rng, {
        allowLegendary: state.mods.allowLegendary && rng.chance(0.15),
        owned: ownedBrokerKeys(state),
        exclude: [...brokersOnOffer(state), ...options.map((o) => o.key)],
      });
      options.push({ type: 'broker', key, inst: makeBroker(key, rng) });
    } else {
      const candle = makeCandle(rng.pick(SECTOR_KEYS), rng.pick(BODIES), rng.chance(0.5));
      const r = rng.next();
      if (r < 0.32) candle.enhancement = rng.pick(ROLLABLE_ENHANCEMENTS);
      if (rng.next() < 0.16) candle.edition = rng.pickWeighted([
        { item: 'laminated', weight: 6 }, { item: 'holographic', weight: 3 }, { item: 'algorithmic', weight: 1 },
      ]);
      if (rng.next() < 0.10) candle.stamp = rng.pick(['reissue', 'hold', 'payout', 'filing']);
      options.push({ type: 'candle', candle });
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
  if (opt.type === 'broker') {
    if (alreadyEmployed(state, opt.key)) return { blocked: 'You already employ them' };
    if (!hasBrokerRoom(state) && opt.inst.edition !== 'offbook') return { blocked: 'No desk slots left' };
    state.brokers.push(opt.inst);
  } else if (opt.type === 'candle') {
    state.book.push(opt.candle);
  } else {
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

export function sellBroker(state, uid) {
  const i = state.brokers.findIndex((b) => b.uid === uid);
  if (i < 0) return { blocked: 'Not found' };
  const val = brokerSellValue(state.brokers[i], state);
  state.brokers.splice(i, 1);
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

// ---------------------------------------------------------------------------
export function consumableApi(state, selected) {
  const rng = state.rng;
  return {
    state, rng, selected,
    addCandle: (c) => state.book.push(c),
    destroyCandle: (c) => removeFromBook(state, c),
    createChart: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollChart(rng))); k++; } return k; },
    createContract: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollContract(rng, state.discoveredFormations))); k++; } return k; },
    createRumor: (n) => { let k = 0; for (let i = 0; i < n; i++) if (hasConsumableRoom(state)) { state.consumables.push(makeConsumable(rollRumor(rng))); k++; } return k; },
    levelFormation: (key, n) => { state.formations[key].level += n; },
    copyBroker: () => {
      if (!state.brokers.length) return { ok: false, msg: 'No brokers to clone' };
      if (!hasBrokerRoom(state)) return { ok: false, msg: 'No desk slots left' };
      const src = rng.pick(state.brokers);
      const copy = makeBroker(src.key, null);
      copy.counters = JSON.parse(JSON.stringify(src.counters));
      state.brokers.push(copy);
      return { ok: true, msg: `Cloned ${BROKERS[src.key].name}` };
    },
    destroyRandomBroker: (spare) => {
      const pool = state.brokers.filter((b) => b !== spare);
      if (!pool.length) return null;
      const victim = rng.pick(pool);
      state.brokers.splice(state.brokers.indexOf(victim), 1);
      return victim;
    },
    /**
     * Put an edition on a broker, and seal it there.
     *
     * These used to be able to land on a broker a rumor had already decorated,
     * quietly replacing what you spent a card on — the Foiled broker you were
     * building around turning Prismatic, with no way to refuse it. An edition
     * a rumor grants is now sealed: nothing overwrites it for the rest of the
     * run, and selling the broker is the only way to be rid of it. Editions a
     * broker simply turned up with are not sealed, so there is still something
     * for a later rumor to land on.
     */
    editionRandomBroker: (edition) => {
      const pool = state.brokers.filter((b) => b.edition !== edition && !b.editionSealed);
      if (!pool.length) {
        const msg = !state.brokers.length ? 'No brokers on your desk'
          : state.brokers.some((b) => b.editionSealed) ? 'Every broker already carries a sealed edition'
          : 'No eligible broker';
        return { ok: false, msg };
      }
      const target = rng.pick(pool);
      target.edition = edition;
      target.editionSealed = true;
      computeMods(state);
      return {
        ok: true,
        msg: `${BROKERS[target.key].name} is now ${EDITIONS[edition].name} (${EDITIONS[edition].desc}) — sealed for the run`,
        spared: target,
      };
    },
  };
}

export function useConsumable(state, uid, selectedUids = []) {
  const idx = state.consumables.findIndex((c) => c.uid === uid);
  if (idx < 0) return { ok: false, msg: 'Not found' };
  const inst = state.consumables[idx];
  const d = ALL_CONSUMABLES[inst.key];
  // Selection comes off the board during a deadline and out of the book on the
  // Floor or inside a pack — the book picker is how a Chart that wants candles
  // gets used when there is no board. Board candles are book candles, so the
  // union resolves either kind of uid without one shadowing the other.
  const pool = state.session ? [...state.session.board, ...state.book] : state.book;
  const selected = selectedUids.map((u) => pool.find((c) => c.uid === u)).filter(Boolean);
  const result = d.use(consumableApi(state, selected));
  if (result.ok) {
    state.consumables.splice(idx, 1);
    computeMods(state);
    if (state.session) { state.session.selected = []; refillBoard(state); }
  }
  return result;
}

// ---------------------------------------------------------------------------
export function serialize(state) {
  // The shop is plain data apart from its RNG, which is re-forked on load.
  const shop = state.shop ? { ...state.shop, rng: undefined } : null;
  return JSON.stringify({
    seed: state.seed, rngState: state.rng.state, rngCalls: state.rng.calls,
    phase: state.phase, shop, week: state.week, deadlineIndex: state.deadlineIndex, cash: state.cash,
    book: state.book, brokers: state.brokers, consumables: state.consumables, licenses: state.licenses,
    formations: state.formations, discoveredFormations: state.discoveredFormations, permanent: state.permanent,
    seenBosses: state.seenBosses, pendingBonuses: state.pendingBonuses, stats: state.stats,
    upcoming: state.upcoming?.map((u) => ({ ...u })),
  });
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  const state = newRun(raw.seed);
  Object.assign(state, {
    phase: 'select',
    week: raw.week, deadlineIndex: raw.deadlineIndex, cash: raw.cash,
    book: raw.book, brokers: raw.brokers, consumables: raw.consumables, licenses: raw.licenses,
    formations: raw.formations, discoveredFormations: raw.discoveredFormations || [], permanent: raw.permanent,
    seenBosses: raw.seenBosses || [], pendingBonuses: raw.pendingBonuses || [], stats: raw.stats,
    upcoming: raw.upcoming,
  });
  if (typeof raw.rngState === 'number') { state.rng.state = raw.rngState; state.rng.calls = raw.rngCalls || 0; }
  state.session = null;

  // A run saved on the Floor comes back to the Floor, with the same stock.
  if (raw.phase === 'shop' && raw.shop) {
    state.shop = { ...raw.shop, rng: state.rng.fork('shop-resume') };
    state.phase = 'shop';
  } else {
    state.shop = null;
    state.phase = 'select';
    // Anything else resumes between deadlines, on whichever one is still owed.
    normalizeProgress(state);
  }
  computeMods(state);
  return state;
}
