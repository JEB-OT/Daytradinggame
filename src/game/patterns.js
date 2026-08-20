import { matchesSector, hasRank, SECTOR_KEYS, SECTORS } from './cards.js';

// ---------------------------------------------------------------------------
// Chart patterns are this game's poker hands. Volume = chips, Leverage = mult.
// ---------------------------------------------------------------------------
export const PATTERNS = {
  flatline:      { key: 'flatline',      name: 'Flat Line',      poker: 'High Card',       volume: 5,   leverage: 1,  volInc: 10, levInc: 1, order: 0 },
  doubleBottom:  { key: 'doubleBottom',  name: 'Double Bottom',  poker: 'Pair',            volume: 10,  leverage: 2,  volInc: 15, levInc: 1, order: 1 },
  headShoulders: { key: 'headShoulders', name: 'Head & Shoulders', poker: 'Two Pair',      volume: 20,  leverage: 2,  volInc: 20, levInc: 1, order: 2 },
  tripleTop:     { key: 'tripleTop',     name: 'Triple Top',     poker: 'Three of a Kind', volume: 30,  leverage: 3,  volInc: 20, levInc: 2, order: 3 },
  breakout:      { key: 'breakout',      name: 'Breakout Rally', poker: 'Straight',        volume: 30,  leverage: 4,  volInc: 30, levInc: 3, order: 4 },
  rotation:      { key: 'rotation',      name: 'Sector Rotation', poker: 'Flush',          volume: 35,  leverage: 4,  volInc: 15, levInc: 2, order: 5 },
  bullFlag:      { key: 'bullFlag',      name: 'Bull Flag',      poker: 'Full House',      volume: 40,  leverage: 4,  volInc: 25, levInc: 2, order: 6 },
  quadWitching:  { key: 'quadWitching',  name: 'Quad Witching',  poker: 'Four of a Kind',  volume: 60,  leverage: 7,  volInc: 30, levInc: 3, order: 7 },
  goldenCross:   { key: 'goldenCross',   name: 'Golden Cross',   poker: 'Straight Flush',  volume: 100, leverage: 8,  volInc: 40, levInc: 4, order: 8 },
  insiderTip:    { key: 'insiderTip',    name: 'Insider Tip',    poker: 'Five of a Kind',  volume: 120, leverage: 12, volInc: 35, levInc: 3, order: 9,  secret: true },
  marketCorner:  { key: 'marketCorner',  name: 'Market Corner',  poker: 'Flush House',     volume: 140, leverage: 14, volInc: 40, levInc: 4, order: 10, secret: true },
  monopoly:      { key: 'monopoly',      name: 'Total Monopoly', poker: 'Flush Five',      volume: 160, leverage: 16, volInc: 50, levInc: 3, order: 11, secret: true },
};
export const PATTERN_KEYS = Object.keys(PATTERNS).sort((a, b) => PATTERNS[a].order - PATTERNS[b].order);

export function patternStats(key, level = 1) {
  const p = PATTERNS[key];
  const lv = Math.max(1, level);
  return {
    volume: p.volume + p.volInc * (lv - 1),
    leverage: p.leverage + p.levInc * (lv - 1),
    level: lv,
  };
}

export function defaultPatternLevels() {
  const o = {};
  for (const k of PATTERN_KEYS) o[k] = { level: 1, played: 0 };
  return o;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
function sectorKeyOf(card, smeared) {
  if (!smeared) return card.sector;
  return SECTORS[card.sector].group;
}

function findFlush(cards, need, smeared) {
  const buckets = smeared ? ['GROWTH', 'VALUE'] : SECTOR_KEYS;
  let best = null;
  for (const b of buckets) {
    const hit = cards.filter((c) => {
      if (c.debuffed) return sectorKeyOf(c, smeared) === b;
      if (c.enhancement === 'wild') return true;
      return sectorKeyOf(c, smeared) === b;
    });
    if (hit.length >= need && (!best || hit.length > best.length)) best = hit;
  }
  return best;
}

function findStraight(cards, need, shortcut) {
  if (cards.length < need) return null;
  // Map rank -> first card of that rank (straights use distinct ranks).
  const byRank = new Map();
  for (const c of cards) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  // Ace can be low.
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  const candidates = [ranks];
  if (byRank.has(14)) {
    const low = ranks.filter((r) => r !== 14);
    candidates.push([1, ...low]);
  }
  let best = null;
  for (const list of candidates) {
    let run = [];
    for (let i = 0; i < list.length; i++) {
      if (run.length === 0) { run = [list[i]]; continue; }
      const gap = list[i] - run[run.length - 1];
      if (gap === 1 || (shortcut && gap === 2)) run.push(list[i]);
      else { if (run.length >= need && (!best || run.length > best.length)) best = run; run = [list[i]]; }
    }
    if (run.length >= need && (!best || run.length > best.length)) best = run;
  }
  if (!best) return null;
  return best.map((r) => byRank.get(r === 1 ? 14 : r));
}

function rankGroups(cards) {
  const m = new Map();
  for (const c of cards) {
    if (!m.has(c.rank)) m.set(c.rank, []);
    m.get(c.rank).push(c);
  }
  return [...m.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
}

/**
 * Evaluate a set of played tickers into a chart pattern.
 * opts: { fourCard, shortcut, smeared, allScore }
 */
export function evaluate(played, opts = {}) {
  const need = opts.fourCard ? 4 : 5;
  const rankCards = played.filter(hasRank);
  const restricted = played.filter((c) => !hasRank(c));
  const groups = rankGroups(rankCards);

  const flushSet = findFlush(rankCards, need, !!opts.smeared);
  const straightSet = findStraight(rankCards, need, !!opts.shortcut);
  const isFlush = !!flushSet;

  const g0 = groups[0]?.length ?? 0;
  const g1 = groups[1]?.length ?? 0;
  const fullHouseSet = (g0 >= 3 && g1 >= 2) ? [...groups[0].slice(0, 3), ...groups[1].slice(0, 2)] : null;

  let key, scoring;
  if (g0 >= 5 && isFlush && flushSet.length >= 5 && groups[0].every((c) => flushSet.includes(c))) {
    key = 'monopoly'; scoring = groups[0].slice(0, 5);
  } else if (fullHouseSet && isFlush && fullHouseSet.every((c) => flushSet.includes(c))) {
    key = 'marketCorner'; scoring = fullHouseSet;
  } else if (g0 >= 5) {
    key = 'insiderTip'; scoring = groups[0].slice(0, 5);
  } else if (straightSet && isFlush && straightSet.every((c) => flushSet.includes(c))) {
    key = 'goldenCross'; scoring = straightSet;
  } else if (g0 >= 4) {
    key = 'quadWitching'; scoring = groups[0].slice(0, 4);
  } else if (fullHouseSet) {
    key = 'bullFlag'; scoring = fullHouseSet;
  } else if (isFlush) {
    key = 'rotation'; scoring = flushSet;
  } else if (straightSet) {
    key = 'breakout'; scoring = straightSet;
  } else if (g0 >= 3) {
    key = 'tripleTop'; scoring = groups[0].slice(0, 3);
  } else if (g0 >= 2 && g1 >= 2) {
    key = 'headShoulders'; scoring = [...groups[0].slice(0, 2), ...groups[1].slice(0, 2)];
  } else if (g0 >= 2) {
    key = 'doubleBottom'; scoring = groups[0].slice(0, 2);
  } else {
    key = 'flatline';
    const high = rankCards.slice().sort((a, b) => b.rank - a.rank)[0];
    scoring = high ? [high] : [];
  }

  let scoringCards = opts.allScore ? played.slice() : [...scoring, ...restricted];
  // Preserve the played order so left-to-right resolution stays intuitive.
  const set = new Set(scoringCards.map((c) => c.uid));
  scoringCards = played.filter((c) => set.has(c.uid));

  return {
    key,
    name: PATTERNS[key].name,
    poker: PATTERNS[key].poker,
    scoringCards,
    unscored: played.filter((c) => !set.has(c.uid)),
    flushSet,
    straightSet,
  };
}

/** Best pattern obtainable from a hand (used for the "hint" readout). */
export function bestFromHand(hand, opts = {}) {
  if (!hand.length) return null;
  let best = null;
  const n = hand.length;
  const limit = Math.min(5, n);
  // Enumerate subsets up to 5 cards; hands are <= ~12 cards so this is cheap.
  const idxs = [];
  const rec = (start, depth) => {
    if (depth > 0) {
      const cards = idxs.map((i) => hand[i]);
      const ev = evaluate(cards, opts);
      const order = PATTERNS[ev.key].order;
      if (!best || order > best.order || (order === best.order && cards.length > best.cards.length)) {
        best = { order, key: ev.key, cards };
      }
    }
    if (depth === limit) return;
    for (let i = start; i < n; i++) { idxs.push(i); rec(i + 1, depth + 1); idxs.pop(); }
  };
  rec(0, 0);
  return best;
}
