import { matchesSector, hasBody, polarityOf, SECTOR_KEYS, SECTORS, bodyOf } from './candles.js';

// ---------------------------------------------------------------------------
// FORMATIONS — what your candles print when you commit them.
//
// Every formation is read off the SET of candles you place, never the order you
// clicked them in. Soldiers and Crows used to be the exception: they wanted the
// bodies placed rising (or falling) and unbroken, so 1-2-3-4-5 printed a march
// and 2-1-4-3-5 — the very same five cards — printed nothing. That was a test
// of clicking, not of building. Order still decides the order candles PRINT in,
// which is where it belongs: it is how you put additive brokers ahead of
// multipliers, and it is what Encore and Last Word read.
// ---------------------------------------------------------------------------
export const FORMATIONS = {
  tick:          { key: 'tick',          name: 'Single Tick',          made: 'one candle',                        volume: 5,   leverage: 1,  volInc: 10, levInc: 1, order: 0 },
  tweezer:       { key: 'tweezer',       name: 'Tweezer',              made: 'two matching bodies',               volume: 10,  leverage: 2,  volInc: 15, levInc: 1, order: 1 },
  doubleTweezer: { key: 'doubleTweezer', name: 'Double Tweezer',       made: 'two separate matching pairs',       volume: 20,  leverage: 2,  volInc: 20, levInc: 1, order: 2 },
  triple:        { key: 'triple',        name: 'Triple Tap',           made: 'three matching bodies',             volume: 30,  leverage: 3,  volInc: 20, levInc: 2, order: 3 },
  soldiers:      { key: 'soldiers',      name: 'Three White Soldiers', made: '3+ bull candles, all different bodies', volume: 30,  leverage: 4,  volInc: 25, levInc: 2, order: 4 },
  crows:         { key: 'crows',         name: 'Three Black Crows',    made: '3+ bear candles, all different bodies', volume: 30,  leverage: 4,  volInc: 25, levInc: 2, order: 4 },
  staircase:     { key: 'staircase',     name: 'Staircase',            made: 'five consecutive bodies',           volume: 35,  leverage: 4,  volInc: 30, levInc: 3, order: 5 },
  cluster:       { key: 'cluster',       name: 'Sector Cluster',       made: 'five candles from one sector',      volume: 40,  leverage: 4,  volInc: 15, levInc: 2, order: 6 },
  pillars:       { key: 'pillars',       name: 'Pillars',              made: 'three matching plus two matching',  volume: 45,  leverage: 4,  volInc: 25, levInc: 2, order: 7 },
  fourWinds:     { key: 'fourWinds',     name: 'Four Winds',           made: 'four matching bodies',              volume: 60,  leverage: 7,  volInc: 30, levInc: 3, order: 8 },
  goldenStair:   { key: 'goldenStair',   name: 'Golden Staircase',     made: 'a Staircase inside one sector',     volume: 100, leverage: 8,  volInc: 40, levInc: 4, order: 9 },
  fiveAlarm:     { key: 'fiveAlarm',     name: 'Five Alarm',           made: 'five matching bodies',              volume: 120, leverage: 12, volInc: 35, levInc: 3, order: 10, secret: true },
  megaCluster:   { key: 'megaCluster',   name: 'Mega Cluster',         made: 'Pillars inside one sector',         volume: 140, leverage: 14, volInc: 40, levInc: 4, order: 11, secret: true },
  perfectStorm:  { key: 'perfectStorm',  name: 'Perfect Storm',        made: 'five matching bodies, one sector',  volume: 160, leverage: 16, volInc: 50, levInc: 3, order: 12, secret: true },
};
export const FORMATION_KEYS = Object.keys(FORMATIONS).sort((a, b) => FORMATIONS[a].order - FORMATIONS[b].order);

export function formationStats(key, level = 1) {
  const f = FORMATIONS[key];
  const lv = Math.max(1, level);
  return { volume: f.volume + f.volInc * (lv - 1), leverage: f.leverage + f.levInc * (lv - 1), level: lv };
}

export function defaultFormationLevels() {
  const o = {};
  for (const k of FORMATION_KEYS) o[k] = { level: 1, played: 0 };
  return o;
}

// ---------------------------------------------------------------------------
function sectorBucket(c, smeared) { return smeared ? SECTORS[c.sector].group : c.sector; }

function findCluster(candles, need, smeared) {
  const buckets = smeared ? ['GROWTH', 'VALUE'] : SECTOR_KEYS;
  let best = null;
  for (const b of buckets) {
    const hit = candles.filter((c) => {
      if (c.debuffed) return sectorBucket(c, smeared) === b;
      if (c.enhancement === 'chameleon') return true;
      return sectorBucket(c, smeared) === b;
    });
    if (hit.length >= need && (!best || hit.length > best.length)) best = hit;
  }
  return best;
}

function findStaircase(candles, need, shortcut) {
  if (candles.length < need) return null;
  const byBody = new Map();
  for (const c of candles) if (!byBody.has(bodyOf(c))) byBody.set(bodyOf(c), c);
  const bodies = [...byBody.keys()].sort((a, b) => a - b);
  let best = null, run = [];
  for (let i = 0; i < bodies.length; i++) {
    if (!run.length) { run = [bodies[i]]; continue; }
    const gap = bodies[i] - run[run.length - 1];
    if (gap === 1 || (shortcut && gap === 2)) run.push(bodies[i]);
    else { if (run.length >= need && (!best || run.length > best.length)) best = run; run = [bodies[i]]; }
  }
  if (run.length >= need && (!best || run.length > best.length)) best = run;
  return best ? best.map((b) => byBody.get(b)) : null;
}

/**
 * A march: candles of one polarity, each on a different body. `dir` is 'bull'
 * (Soldiers) or 'bear' (Crows).
 *
 * The march climbs (or falls) through whatever bodies you hold — the engine
 * lines them up, you do not have to. A repeated body cannot be a second step,
 * so each body counts once; everything else about the placement is irrelevant.
 */
function findMarch(candles, need, dir) {
  const fits = (c) => { const p = polarityOf(c); return p === dir || p === 'both'; };
  const byBody = new Map();
  for (const c of candles) {
    if (hasBody(c) && fits(c) && !byBody.has(bodyOf(c))) byBody.set(bodyOf(c), c);
  }
  if (byBody.size < need) return null;
  const bodies = [...byBody.keys()].sort((a, b) => (dir === 'bull' ? a - b : b - a));
  return bodies.map((b) => byBody.get(b));
}

function bodyGroups(candles) {
  const m = new Map();
  for (const c of candles) {
    const b = bodyOf(c);
    if (!m.has(b)) m.set(b, []);
    m.get(b).push(c);
  }
  return [...m.values()].sort((a, b) => b.length - a.length || bodyOf(b[0]) - bodyOf(a[0]));
}

/**
 * @param played candles in the order the player arranged them
 * @param opts { fourCard, shortcut, smeared, allScore, marchOfThree }
 */
export function evaluate(played, opts = {}) {
  const need = opts.fourCard ? 4 : 5;
  const marchNeed = opts.marchOfThree ? 2 : 3;
  const bodied = played.filter(hasBody);
  const sealed = played.filter((c) => !hasBody(c));
  const groups = bodyGroups(bodied);

  const clusterSet = findCluster(bodied, need, !!opts.smeared);
  const stairSet = findStaircase(bodied, need, !!opts.shortcut);
  const soldierSet = findMarch(played, marchNeed, 'bull');
  const crowSet = findMarch(played, marchNeed, 'bear');
  const isCluster = !!clusterSet;

  const g0 = groups[0]?.length ?? 0;
  const g1 = groups[1]?.length ?? 0;
  const pillarSet = (g0 >= 3 && g1 >= 2) ? [...groups[0].slice(0, 3), ...groups[1].slice(0, 2)] : null;

  let key, scoring;
  if (g0 >= 5 && isCluster && clusterSet.length >= 5 && groups[0].every((c) => clusterSet.includes(c))) {
    key = 'perfectStorm'; scoring = groups[0].slice(0, 5);
  } else if (pillarSet && isCluster && pillarSet.every((c) => clusterSet.includes(c))) {
    key = 'megaCluster'; scoring = pillarSet;
  } else if (g0 >= 5) {
    key = 'fiveAlarm'; scoring = groups[0].slice(0, 5);
  } else if (stairSet && isCluster && stairSet.every((c) => clusterSet.includes(c))) {
    key = 'goldenStair'; scoring = stairSet;
  } else if (g0 >= 4) {
    key = 'fourWinds'; scoring = groups[0].slice(0, 4);
  } else if (pillarSet) {
    key = 'pillars'; scoring = pillarSet;
  } else if (isCluster) {
    key = 'cluster'; scoring = clusterSet;
  } else if (stairSet) {
    key = 'staircase'; scoring = stairSet;
  } else if (soldierSet && (!crowSet || soldierSet.length >= crowSet.length)) {
    key = 'soldiers'; scoring = soldierSet;
  } else if (crowSet) {
    key = 'crows'; scoring = crowSet;
  } else if (g0 >= 3) {
    key = 'triple'; scoring = groups[0].slice(0, 3);
  } else if (g0 >= 2 && g1 >= 2) {
    key = 'doubleTweezer'; scoring = [...groups[0].slice(0, 2), ...groups[1].slice(0, 2)];
  } else if (g0 >= 2) {
    key = 'tweezer'; scoring = groups[0].slice(0, 2);
  } else {
    key = 'tick';
    const high = bodied.slice().sort((a, b) => bodyOf(b) - bodyOf(a))[0];
    scoring = high ? [high] : [];
  }

  let scoringCandles = opts.allScore ? played.slice() : [...scoring, ...sealed];
  const set = new Set(scoringCandles.map((c) => c.uid));
  scoringCandles = played.filter((c) => set.has(c.uid));

  return {
    key,
    name: FORMATIONS[key].name,
    made: FORMATIONS[key].made,
    scoringCandles,
    unscored: played.filter((c) => !set.has(c.uid)),
    clusterSet, stairSet, soldierSet, crowSet,
  };
}

/**
 * Best formation reachable from a board, used for the hint readout. No
 * formation reads placement order, so every subset only needs trying once.
 */
export function bestFromBoard(board, opts = {}) {
  if (!board.length) return null;
  let best = null;
  const n = board.length;
  const limit = Math.min(5, n);
  const idxs = [];
  const consider = (cands) => {
    const ev = evaluate(cands, opts);
    const order = FORMATIONS[ev.key].order;
    if (!best || order > best.order || (order === best.order && cands.length > best.candles.length)) {
      best = { order, key: ev.key, candles: cands };
    }
  };
  const rec = (start, depth) => {
    if (depth > 0) {
      consider(idxs.map((i) => board[i]));
    }
    if (depth === limit) return;
    for (let i = start; i < n; i++) { idxs.push(i); rec(i + 1, depth + 1); idxs.pop(); }
  };
  rec(0, 0);
  return best;
}

// ---------------------------------------------------------------------------
// CONVICTION — how hard your own candles agree with the call you made.
// ---------------------------------------------------------------------------
export const CONVICTION = {
  full:    { key: 'full',    label: 'FULL CONVICTION', mult: 1.5, color: '#ffd94a' },
  strong:  { key: 'strong',  label: 'CONVICTION',      mult: 1.2, color: '#43e08a' },
  neutral: { key: 'neutral', label: 'MIXED BOOK',      mult: 1.0, color: '#8ea0bb' },
};

export function convictionOf(scoringCandles, direction, mods = {}) {
  if (!direction) return { ...CONVICTION.neutral, matching: 0, total: 0 };
  const live = scoringCandles.filter((c) => polarityOf(c) !== 'none' && !c.debuffed);
  if (!live.length) return { ...CONVICTION.neutral, matching: 0, total: 0 };
  const want = direction === 'LONG' ? 'bull' : 'bear';
  const matching = live.filter((c) => { const p = polarityOf(c); return p === want || p === 'both'; }).length;
  const ratio = matching / live.length;
  let tier = CONVICTION.neutral;
  if (ratio >= 1) tier = CONVICTION.full;
  else if (ratio >= (mods.convictionThreshold ?? 0.6)) tier = CONVICTION.strong;
  const bonus = mods.convictionBonus || 0;
  return { ...tier, mult: tier.mult === 1 ? 1 : tier.mult + bonus, matching, total: live.length, ratio };
}
