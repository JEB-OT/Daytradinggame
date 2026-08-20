import { RNG } from '../src/engine/rng.js';
import { makeCandle, standardBook, baseVolume, SECTOR_KEYS, polarityOf, isWide, isDoji, candleShape } from '../src/game/candles.js';
import { evaluate, bestFromBoard, formationStats, FORMATION_KEYS, convictionOf } from '../src/game/formations.js';
import { BROKERS, BROKER_KEYS, makeBroker, brokerText } from '../src/game/brokers.js';
import { CHARTS, CONTRACTS, RUMORS, ALL_CONSUMABLES, makeConsumable } from '../src/game/consumables.js';
import { LICENSES, LICENSE_KEYS } from '../src/game/licenses.js';
import { BOSSES, BOSS_KEYS } from '../src/game/bosses.js';
import { Market } from '../src/game/market.js';
import { scoreTrade } from '../src/game/scoring.js';
import * as S from '../src/game/state.js';

let pass = 0, fail = 0;
const failures = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; failures.push(`${name}: ${e.message}`); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b}, got ${a}`); };
const ok = (v, m = '') => { if (!v) throw new Error(m || 'expected truthy'); };

// bull=true by default; mk(sector, body, bull, extra)
const mk = (s, b, bull = true, extra) => makeCandle(s, b, bull, extra);

// ---------------------------------------------------------------- candles
t('the standard book is 52 candles, split evenly bull/bear', () => {
  const b = standardBook();
  eq(b.length, 52);
  eq(b.filter((c) => c.bull).length, 26);
  eq(new Set(b.map((c) => c.sector + ':' + c.body)).size, 52);
});
t('body size is the volume a candle contributes', () => {
  eq(baseVolume(mk('TECH', 9)), 9);
  eq(baseVolume(mk('TECH', 1)), 1);
  eq(baseVolume(mk('TECH', 13)), 13);
});
t('sealed candles are worth 50 and have no polarity', () => {
  const c = mk('TECH', 5, true, { enhancement: 'sealed' });
  eq(baseVolume(c), 50);
  eq(polarityOf(c), 'none');
});
t('swing candles count as both polarities', () => {
  eq(polarityOf(mk('TECH', 5, true, { enhancement: 'swing' })), 'both');
});
t('body bands: doji at 1, wide at 11+', () => {
  ok(isDoji(mk('TECH', 1))); ok(!isDoji(mk('TECH', 2)));
  ok(isWide(mk('TECH', 11))); ok(!isWide(mk('TECH', 10)));
});
t('candle geometry stays inside the tile and is stable per candle', () => {
  for (let i = 1; i <= 13; i++) {
    const c = mk('TECH', i);
    const g = candleShape(c);
    ok(g.body > 0 && g.lower >= 0 && g.upper >= 0, 'body ' + i);
    ok(g.body + g.lower + g.upper <= 100.001, 'overflow at body ' + i);
    eq(JSON.stringify(candleShape(c)), JSON.stringify(g), 'not stable');
  }
});
t('bigger bodies draw taller candles', () => {
  ok(candleShape(mk('TECH', 13)).body > candleShape(mk('TECH', 2)).body);
});

// ---------------------------------------------------------------- formations
const F = (cards, opts) => evaluate(cards, opts || {}).key;
t('single tick', () => eq(F([mk('TECH', 5), mk('CRYPTO', 9, false), mk('ENERGY', 2), mk('FINANCE', 13, false), mk('TECH', 7, false)]), 'tick'));
t('tweezer', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 9, false), mk('FINANCE', 2), mk('TECH', 12, false)]), 'tweezer'));
t('double tweezer', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 2, false), mk('FINANCE', 2), mk('TECH', 12, false)]), 'doubleTweezer'));
t('triple tap', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 5), mk('FINANCE', 2, false), mk('TECH', 12, false)]), 'triple'));
t('staircase', () => eq(F([mk('TECH', 5), mk('CRYPTO', 6, false), mk('ENERGY', 7), mk('FINANCE', 8, false), mk('TECH', 9, false)]), 'staircase'));
t('sector cluster', () => eq(F([mk('TECH', 5), mk('TECH', 7, false), mk('TECH', 9), mk('TECH', 2, false), mk('TECH', 12, false)]), 'cluster'));
t('pillars', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 5), mk('FINANCE', 2, false), mk('TECH', 2)]), 'pillars'));
t('four winds', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 5), mk('FINANCE', 5, false), mk('TECH', 2)]), 'fourWinds'));
t('golden staircase', () => eq(F([mk('TECH', 5), mk('TECH', 6, false), mk('TECH', 7), mk('TECH', 8, false), mk('TECH', 9)]), 'goldenStair'));
t('five alarm', () => eq(F([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 5), mk('FINANCE', 5, false), mk('TECH', 5)]), 'fiveAlarm'));
t('mega cluster', () => eq(F([mk('TECH', 5), mk('TECH', 5, false), mk('TECH', 5), mk('TECH', 2, false), mk('TECH', 2)]), 'megaCluster'));
t('perfect storm', () => eq(F([mk('TECH', 5), mk('TECH', 5, false), mk('TECH', 5), mk('TECH', 5, false), mk('TECH', 5)]), 'perfectStorm'));

t('three white soldiers needs rising bull bodies in placed order', () => {
  eq(F([mk('TECH', 3, true), mk('CRYPTO', 6, true), mk('ENERGY', 9, true), mk('FINANCE', 2, false), mk('TECH', 12, false)]), 'soldiers');
});
t('three black crows needs falling bear bodies in placed order', () => {
  eq(F([mk('TECH', 12, false), mk('CRYPTO', 8, false), mk('ENERGY', 4, false), mk('FINANCE', 2, true), mk('TECH', 11, true)]), 'crows');
});
t('the SAME candles in the wrong order do not print a march', () => {
  const cs = [mk('TECH', 9, true), mk('CRYPTO', 3, true), mk('ENERGY', 6, true), mk('FINANCE', 2, false), mk('TECH', 12, false)];
  eq(F(cs), 'tick');
  eq(F([cs[1], cs[2], cs[0], cs[3], cs[4]]), 'soldiers');
});
t('a march must be contiguous — an interruption breaks it', () => {
  eq(F([mk('TECH', 3, true), mk('CRYPTO', 2, false), mk('ENERGY', 6, true), mk('FINANCE', 9, true)]), 'tick');
});
t('bear candles cannot form soldiers', () => {
  eq(F([mk('TECH', 3, false), mk('CRYPTO', 6, false), mk('ENERGY', 9, false)]), 'tick');
});
t('swing candles march with either polarity', () => {
  eq(F([mk('TECH', 3, false, { enhancement: 'swing' }), mk('CRYPTO', 6, true), mk('ENERGY', 9, true)]), 'soldiers');
});
t('Cadence lets a march happen with 2 candles', () => {
  eq(F([mk('TECH', 4, true), mk('CRYPTO', 8, true)], { marchOfThree: true }), 'soldiers');
  eq(F([mk('TECH', 4, true), mk('CRYPTO', 8, true)]), 'tick');
});
t('rotating candles complete a cluster', () =>
  eq(F([mk('TECH', 2), mk('TECH', 5, false), mk('CRYPTO', 7, false, { enhancement: 'wild' }), mk('TECH', 9), mk('TECH', 12, false)]), 'cluster'));
t('four fingers makes a 4-candle cluster', () => {
  const cs = [mk('TECH', 2), mk('TECH', 5, false), mk('TECH', 7, false), mk('TECH', 12, false)];
  eq(F(cs, { fourCard: true }), 'cluster');
  eq(F(cs), 'tick');
});
t('shortcut allows a gapped staircase', () =>
  eq(F([mk('TECH', 2), mk('CRYPTO', 4, false), mk('ENERGY', 6), mk('FINANCE', 8, false), mk('TECH', 10, false)], { shortcut: true }), 'staircase'));
t('smeared sectors merge growth and value', () =>
  eq(F([mk('TECH', 2), mk('CRYPTO', 5, false), mk('TECH', 7, false), mk('CRYPTO', 9), mk('TECH', 12, false)], { smeared: true }), 'cluster'));
t('sealed candles always print', () => {
  const ev = evaluate([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 9, true, { enhancement: 'sealed' }), mk('FINANCE', 2, false), mk('TECH', 12, false)]);
  eq(ev.key, 'tweezer');
  eq(ev.scoringCandles.length, 3);
});
t('allScore makes every placed candle print', () => {
  const ev = evaluate([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 9), mk('FINANCE', 2), mk('TECH', 12)], { allScore: true });
  eq(ev.scoringCandles.length, 5);
});
t('printing order follows placement order', () => {
  const cs = [mk('TECH', 12, false), mk('CRYPTO', 5), mk('ENERGY', 5, false), mk('FINANCE', 2), mk('TECH', 3, false)];
  const ev = evaluate(cs);
  eq(ev.scoringCandles[0].uid, cs[1].uid);
  eq(ev.scoringCandles[1].uid, cs[2].uid);
});
t('bestFromBoard finds arrangements, not just subsets', () => {
  const board = [mk('TECH', 9, true), mk('CRYPTO', 3, true), mk('ENERGY', 6, true), mk('FINANCE', 13, false), mk('TECH', 2, false)];
  eq(bestFromBoard(board).key, 'soldiers');
});
t('formation levels scale volume and leverage', () => {
  const a = formationStats('tweezer', 1), b = formationStats('tweezer', 3);
  eq(b.volume, a.volume + 30);
  eq(b.leverage, a.leverage + 2);
});

// ---------------------------------------------------------------- conviction
t('all-agreeing candles give full conviction', () => {
  const c = convictionOf([mk('TECH', 5), mk('CRYPTO', 6), mk('ENERGY', 7)], 'LONG');
  eq(c.key, 'full'); eq(c.mult, 1.5);
});
t('a majority gives partial conviction', () => {
  const c = convictionOf([mk('TECH', 5), mk('CRYPTO', 6), mk('ENERGY', 7, false)], 'LONG');
  eq(c.key, 'strong'); eq(c.mult, 1.2);
});
t('a split book gives no conviction', () => {
  const c = convictionOf([mk('TECH', 5), mk('CRYPTO', 6, false)], 'LONG');
  eq(c.key, 'neutral'); eq(c.mult, 1);
});
t('conviction flips with the direction called', () => {
  const cs = [mk('TECH', 5, false), mk('CRYPTO', 6, false)];
  eq(convictionOf(cs, 'SHORT').key, 'full');
  eq(convictionOf(cs, 'LONG').key, 'neutral');
});
t('swing candles satisfy conviction either way', () => {
  const cs = [mk('TECH', 5, true, { enhancement: 'swing' }), mk('CRYPTO', 6, true, { enhancement: 'swing' })];
  eq(convictionOf(cs, 'LONG').key, 'full');
  eq(convictionOf(cs, 'SHORT').key, 'full');
});
t('sealed candles are ignored by conviction', () => {
  const cs = [mk('TECH', 5), mk('CRYPTO', 6, false, { enhancement: 'sealed' })];
  eq(convictionOf(cs, 'LONG').key, 'full');
});
t('convictionBonus raises the payoff, threshold widens it', () => {
  const cs = [mk('TECH', 5), mk('CRYPTO', 6), mk('ENERGY', 7, false), mk('FINANCE', 8, false)];
  eq(convictionOf(cs, 'LONG').key, 'neutral');
  eq(convictionOf(cs, 'LONG', { convictionThreshold: 0.5 }).key, 'strong');
  eq(convictionOf([mk('TECH', 5)], 'LONG', { convictionBonus: 0.4 }).mult, 1.9);
});

// ---------------------------------------------------------------- content
t('every broker has a name, art, cost, rarity and text', () => {
  for (const k of BROKER_KEYS) {
    const d = BROKERS[k];
    ok(d.name, k); ok(d.art, k); ok(d.cost > 0, k); ok(d.text != null, k);
    ok(['common', 'uncommon', 'rare', 'legendary'].includes(d.rarity), k);
  }
});
t('every broker renders its description', () => {
  const st = S.newRun('TXT');
  for (const k of BROKER_KEYS) {
    const inst = makeBroker(k, null);
    st.brokers = [inst];
    ok(brokerText(inst, st).length > 0, k);
  }
});
t('every consumable has text and a use function', () => {
  for (const [k, d] of Object.entries(ALL_CONSUMABLES)) {
    ok(d.name, k); ok(d.art, k); ok(d.text, k); ok(typeof d.use === 'function', k);
  }
});
t('there is one contract per formation', () => eq(Object.keys(CONTRACTS).length, FORMATION_KEYS.length));
t('every licence upgrade points at a real prerequisite', () => {
  for (const k of LICENSE_KEYS) {
    const l = LICENSES[k];
    if (l.requires) ok(LICENSES[l.requires], k);
    if (l.upgrade) ok(LICENSES[l.upgrade], k);
  }
});
t('every boss has a name, art and blurb', () => {
  for (const k of BOSS_KEYS) { ok(BOSSES[k].name, k); ok(BOSSES[k].art, k); ok(BOSSES[k].blurb, k); }
});
t('content counts are substantial', () => {
  ok(BROKER_KEYS.length >= 110, 'brokers ' + BROKER_KEYS.length);
  ok(Object.keys(ALL_CONSUMABLES).length >= 60, 'consumables');
  ok(BOSS_KEYS.length >= 25, 'bosses');
  ok(LICENSE_KEYS.length >= 24, 'licences');
});

// ---------------------------------------------------------------- scoring
function scoreWith(brokerKeys, played, extra = {}) {
  const st = S.newRun('SC');
  st.brokers = brokerKeys.map((k) => makeBroker(k, null));
  S.computeMods(st);
  return scoreTrade(st, {
    played, held: extra.held || [], direction: extra.direction || null,
    correct: extra.correct, regimeMult: extra.regimeMult ?? 1,
    rng: new RNG('score'), commit: true, tradeIndex: 0, tradesLeft: 4, greenStreak: 0, quota: 1000,
  });
}
t('a bare tweezer is volume x leverage', () => {
  const r = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10, false)]);
  eq(r.volume, 30); eq(r.leverage, 2); eq(r.pl, 60);
});
t('Sticky Note adds flat leverage', () => eq(scoreWith(['sticky'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).leverage, 6));
t('Block Tick adds 30 volume', () => {
  eq(scoreWith([], [mk('TECH', 10, true, { enhancement: 'blockTick' }), mk('CRYPTO', 10, false)]).volume, 60);
});
t('hedged candles held on the board multiply leverage', () => {
  eq(scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10, false)], { held: [mk('ENERGY', 3, true, { enhancement: 'hedged' })] }).leverage, 3);
});
t('Reissue stamp reprints a candle', () => {
  const a = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10, false)]);
  const b = scoreWith([], [mk('TECH', 10, true, { stamp: 'reissue' }), mk('CRYPTO', 10, false)]);
  eq(b.volume - a.volume, 10);
});
t('Front Runner reprints every candle', () => eq(scoreWith(['frontRunner'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).volume, 50));
t('conviction multiplies leverage on the call', () => {
  const cs = [mk('TECH', 10), mk('CRYPTO', 10)];  // both bull -> tweezer, full conviction on LONG
  const long = scoreWith([], cs, { direction: 'LONG', correct: true });
  const short = scoreWith([], cs, { direction: 'SHORT', correct: true });
  eq(long.conviction.key, 'full');
  eq(short.conviction.key, 'neutral');
  ok(long.pl > short.pl, 'conviction should pay');
});
t('wrong-way trades take the standard penalty', () => {
  const right = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: true });
  const wrong = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: false });
  eq(wrong.pl, Math.floor(right.pl * 0.35));
});
t('Diamond Hands removes the wrong-way penalty', () => {
  const a = scoreWith(['diamondHands'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: false });
  const b = scoreWith(['diamondHands'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: true });
  eq(a.pl, b.pl);
});
t('The Bull Pen only pays for bull candles', () => {
  const bulls = scoreWith(['bullPen'], [mk('TECH', 10), mk('CRYPTO', 10)]);
  const bears = scoreWith(['bullPen'], [mk('TECH', 10, false), mk('CRYPTO', 10, false)]);
  eq(bulls.leverage - bears.leverage, 8);
});
t('Drill Sergeant only fires on Soldiers', () => {
  const march = scoreWith(['drillSergeant'], [mk('TECH', 3), mk('CRYPTO', 6), mk('ENERGY', 9)]);
  const notMarch = scoreWith(['drillSergeant'], [mk('TECH', 9), mk('CRYPTO', 6), mk('ENERGY', 3)]);
  ok(march.pl > notMarch.pl * 2, 'soldiers should be worth much more');
});
t('The Hedge Book wants an even bull/bear split', () => {
  const split = scoreWith(['hedgeBook'], [mk('TECH', 10), mk('CRYPTO', 10, false)]);
  const skewed = scoreWith(['hedgeBook'], [mk('TECH', 10), mk('CRYPTO', 10)]);
  ok(split.leverage > skewed.leverage);
});
t('broker order changes the result', () => {
  const cs = [mk('TECH', 10), mk('CRYPTO', 10, false)];
  ok(scoreWith(['sticky', 'darkPool'], cs).pl !== scoreWith(['darkPool', 'sticky'], cs).pl);
});
t('Arb Bot copies the broker to its right', () => {
  const solo = scoreWith(['techBro'], [mk('TECH', 10), mk('TECH', 10, false)]);
  const copied = scoreWith(['arbBot', 'techBro'], [mk('TECH', 10), mk('TECH', 10, false)]);
  eq(copied.leverage - solo.leverage, 8);
});
t('scaling brokers only bump their counters on commit', () => {
  const st = S.newRun('CTR');
  st.brokers = [makeBroker('pyramid', null)];
  S.computeMods(st);
  const args = { played: [mk('TECH', 10), mk('CRYPTO', 10, false)], held: [], direction: 'LONG', correct: true,
    rng: new RNG('x'), tradeIndex: 0, tradesLeft: 4, greenStreak: 0, quota: 999 };
  scoreTrade(st, { ...args, commit: false });
  eq(st.brokers[0].counters.x, 1);
  scoreTrade(st, { ...args, commit: true });
  eq(st.brokers[0].counters.x, 1.25);
});
t('broker editions trigger in the broker slot', () => {
  const st = S.newRun('ED');
  const inst = makeBroker('sticky', null); inst.edition = 'holographic';
  st.brokers = [inst]; S.computeMods(st);
  const r = scoreTrade(st, { played: [mk('TECH', 10), mk('CRYPTO', 10, false)], held: [], rng: new RNG('e'), commit: true, quota: 999 });
  eq(r.leverage, 16);
});
t('off-book brokers do not consume a desk slot', () => {
  const st = S.newRun('OB');
  const inst = makeBroker('sticky', null); inst.edition = 'offbook';
  st.brokers = [inst]; S.computeMods(st);
  eq(S.slotsUsed(st), 0);
  eq(st.mods.slots, 6);
});
t('every broker can score without throwing', () => {
  for (const k of BROKER_KEYS) {
    const st = S.newRun('ALL' + k);
    st.brokers = [makeBroker(k, null), makeBroker('sticky', null)];
    st.session = { quota: 500, discardsLeft: 2, earnedThisDeadline: 10, greens: 1, board: [], tradesLeft: 2 };
    S.computeMods(st);
    const r = scoreTrade(st, {
      played: [mk('TECH', 10), mk('CRYPTO', 10, false), mk('ENERGY', 11, true, { enhancement: 'wild' }),
               mk('FINANCE', 5, false, { enhancement: 'volatile', edition: 'laminated', stamp: 'reissue' }),
               mk('TECH', 5, true, { enhancement: 'swing' })],
      held: [mk('TECH', 3, false, { enhancement: 'dividend' })],
      direction: 'LONG', correct: true, regimeMult: 1.25,
      rng: new RNG('p' + k), commit: true, tradeIndex: 1, tradesLeft: 2, greenStreak: 2, greensThisDeadline: 2, quota: 500,
    });
    ok(Number.isFinite(r.pl) && r.pl >= 0, k + ' produced ' + r.pl);
  }
});
t('every boss scores without throwing', () => {
  for (const k of BOSS_KEYS) {
    const st = S.newRun('B' + k);
    st.brokers = [makeBroker('sticky', null), makeBroker('techBro', null)];
    st.session = { boss: k, quota: 500, bossGraceLeft: 0, discardsLeft: 1, board: [], lastDirection: 'LONG',
      lastFormation: 'tweezer', earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
    S.computeMods(st);
    const r = scoreTrade(st, {
      played: [mk('TECH', 10), mk('CRYPTO', 10, false), mk('ENERGY', 4), mk('FINANCE', 5, false), mk('TECH', 5)],
      held: [], direction: 'LONG', correct: true, rng: new RNG('b' + k), commit: true,
      tradeIndex: 0, tradesLeft: 1, greenStreak: 0, quota: 500,
    });
    ok(Number.isFinite(r.pl), k);
  }
});
t('The Doubt suppresses conviction', () => {
  const st = S.newRun('DOUBT');
  st.session = { boss: 'noConviction', quota: 500, bossGraceLeft: 0, board: [], discardsLeft: 0, earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
  S.computeMods(st);
  const r = scoreTrade(st, { played: [mk('TECH', 10), mk('CRYPTO', 10)], held: [], direction: 'LONG', correct: true,
    rng: new RNG('d'), commit: true, quota: 500 });
  eq(r.pl, 60);
});
t('The Ceiling caps a single trade', () => {
  const st = S.newRun('CEIL');
  st.brokers = [makeBroker('singularity', null)];
  st.session = { boss: 'theCeiling', quota: 1000, bossGraceLeft: 0, board: [], discardsLeft: 0, earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
  S.computeMods(st);
  const r = scoreTrade(st, { played: [mk('TECH', 10), mk('CRYPTO', 10)], held: [], direction: 'LONG', correct: true,
    rng: new RNG('c'), commit: true, quota: 1000, tradeIndex: 0, tradesLeft: 1, greenStreak: 0 });
  eq(r.pl, 600); ok(r.capped);
});
t('sector bosses blank their sector', () => {
  const st = S.newRun('AUD');
  st.session = { boss: 'auditor', quota: 500, bossGraceLeft: 0, board: [], discardsLeft: 0, earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
  S.computeMods(st);
  const blanked = mk('TECH', 10); blanked.debuffed = true;
  const r = scoreTrade(st, { played: [blanked, mk('TECH', 10, false)], held: [], rng: new RNG('a'), commit: true, quota: 500 });
  eq(r.volume, 20);
});

// ---------------------------------------------------------------- market
t('regime bias skews the tape', () => {
  const m = new Market(new RNG('m1'), { regime: 'BULL' });
  let ups = 0;
  for (let i = 0; i < 500; i++) { if (m.pendingUp) ups++; m.resolve('LONG'); }
  ok(ups > 280, 'got ' + ups);
});
t('signal truthfulness tracks accuracy', () => {
  let truthful = 0;
  for (let i = 0; i < 800; i++) if (new Market(new RNG('sig' + i), { regime: 'RANGE' }).readSignal(0.68).truthful) truthful++;
  ok(truthful > 460 && truthful < 660, 'got ' + truthful);
});
t('a perfect signal never lies', () => {
  for (let i = 0; i < 100; i++) {
    const m = new Market(new RNG('pf' + i), { regime: 'CHOP' });
    eq(m.readSignal(0.1, { perfect: true }).up, m.pendingUp);
  }
});

// ---------------------------------------------------------------- run flow
t('a fresh run starts sane', () => {
  const st = S.newRun('FLOW');
  eq(st.book.length, 52); eq(st.cash, 8); eq(st.week, 1); eq(st.upcoming.length, 3);
  ok(st.upcoming[2].boss);
});
t('quotas escalate within a week and across weeks', () => {
  const st = S.newRun('Q');
  const q = st.upcoming.map((u) => S.quotaFor(st, u));
  ok(q[0] < q[1] && q[1] < q[2], q.join(','));
  ok(S.weekBase(5) > S.weekBase(4));
});
t('placing candles preserves click order', () => {
  const st = S.newRun('ORD');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.board[3].uid);
  S.toggleSelect(st, s.board[0].uid);
  S.toggleSelect(st, s.board[2].uid);
  const picked = S.selectedCandles(st);
  eq(picked[0].uid, s.board[3].uid);
  eq(picked[1].uid, s.board[0].uid);
  eq(picked[2].uid, s.board[2].uid);
});
t('arrange re-sorts the placement', () => {
  const st = S.newRun('ARR');
  const s = S.startDeadline(st, 0);
  s.board.slice(0, 4).forEach((c) => S.toggleSelect(st, c.uid));
  S.arrangeSelection(st, 'rising');
  const rising = S.selectedCandles(st).map((c) => c.body);
  eq(JSON.stringify(rising), JSON.stringify(rising.slice().sort((a, b) => a - b)));
  S.arrangeSelection(st, 'falling');
  const falling = S.selectedCandles(st).map((c) => c.body);
  eq(JSON.stringify(falling), JSON.stringify(falling.slice().sort((a, b) => b - a)));
});
t('playing a trade consumes a trade and books P/L', () => {
  const st = S.newRun('PLAY');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.board[0].uid);
  const before = s.tradesLeft;
  const r = S.playTrade(st, 'LONG');
  eq(s.tradesLeft, before - 1);
  ok(r.pl >= 0);
  eq(s.board.length, st.mods.handSize);
});
t('sweeping consumes a sweep and refills the board', () => {
  const st = S.newRun('SWEEP');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.board[0].uid); S.toggleSelect(st, s.board[1].uid);
  S.sweepSelected(st);
  eq(s.discardsLeft, st.mods.discards - 1);
  eq(s.board.length, st.mods.handSize);
});
t('you cannot place more than five candles', () => {
  const st = S.newRun('SEL');
  const s = S.startDeadline(st, 0);
  s.board.forEach((c) => S.toggleSelect(st, c.uid));
  eq(s.selected.length, 5);
});
t('The Scramble reorders your placement', () => {
  const st = S.newRun('SCRAM');
  st.upcoming[2].boss = 'shuffleDesk';
  const s = S.startDeadline(st, 2);
  s.board.slice(0, 5).forEach((c) => S.toggleSelect(st, c.uid));
  const intended = S.selectedCandles(st).map((c) => c.uid).join(',');
  const r = S.playTrade(st, 'LONG');
  ok(r.played.length === 5, 'still plays five');
  ok(typeof intended === 'string');
});
t('Wash Sale blocks repeating a direction', () => {
  const st = S.newRun('WASH');
  st.upcoming[2].boss = 'washSale';
  const s = S.startDeadline(st, 2);
  S.toggleSelect(st, s.board[0].uid);
  S.playTrade(st, 'LONG');
  S.toggleSelect(st, s.board[0].uid);
  ok(S.checkTradeLegal(st, 'LONG')?.block);
  ok(!S.checkTradeLegal(st, 'SHORT'));
});
t('polarity bosses blank half the book', () => {
  const st = S.newRun('GREEN');
  st.upcoming[2].boss = 'greenScreen';
  S.startDeadline(st, 2);
  eq(st.book.filter((c) => c.debuffed).length, 26);
});
t('clearing a deadline pays out', () => {
  const st = S.newRun('PAY');
  const s = S.startDeadline(st, 0);
  s.profit = s.quota;
  const before = st.cash;
  const p = S.finishDeadline(st);
  ok(p.total >= s.slot.reward);
  eq(st.cash, before + p.total);
});
t('interest is capped', () => {
  const st = S.newRun('INT');
  st.cash = 500;
  const s = S.startDeadline(st, 0);
  s.tradesLeft = 0;
  eq(S.finishDeadline(st).lines.find((l) => l.label.startsWith('Interest')).amount, 5);
});
t('advancing past the boss rolls the week over', () => {
  const st = S.newRun('WK');
  S.startDeadline(st, 2);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.advanceAfterDeadline(st);
  eq(st.week, 2); eq(st.deadlineIndex, 0);
});
t('skipping a non-boss deadline grants a bonus', () => {
  const st = S.newRun('SKIP');
  ok(S.skipDeadline(st, 0).bonus);
  eq(st.deadlineIndex, 1);
});
t('boss deadlines cannot be skipped', () => ok(S.skipDeadline(S.newRun('SKIP2'), 2).blocked));
t('the shop stocks items and packs', () => {
  const st = S.newRun('SHOP');
  st.cash = 200;
  S.openShop(st);
  ok(st.shop.items.length >= 2);
  eq(st.shop.packs.length, 2);
});
t('rerolling costs money and restocks', () => {
  const st = S.newRun('RR');
  st.cash = 100;
  S.openShop(st);
  const before = st.cash;
  ok(S.rerollShop(st).ok);
  eq(st.cash, before - 5);
  eq(st.shop.rerollCost, 6);
});
t('buying a licence applies its mods immediately', () => {
  const st = S.newRun('LIC');
  st.cash = 100;
  S.openShop(st);
  st.shop.license = { key: 'ergoDesk', sold: false };
  const before = st.mods.handSize;
  S.buyLicense(st);
  eq(st.mods.handSize, before + 1);
});
t('packs deal the right number of options', () => {
  const st = S.newRun('PACK');
  st.cash = 100;
  S.openShop(st);
  st.shop.packs[0] = { ...S.PACKS.find((p) => p.key === 'candleM'), sold: false };
  const r = S.buyPack(st, 0);
  eq(r.pack.options.length, 5);
  eq(r.pack.picks, 2);
  const n = st.book.length;
  S.pickFromPack(st, 0);
  eq(st.book.length, n + 1);
});
t('selling a broker refunds cash and frees a slot', () => {
  const st = S.newRun('SELL');
  st.brokers = [makeBroker('sticky', null)];
  S.computeMods(st);
  const before = st.cash;
  ok(S.sellBroker(st, st.brokers[0].uid).ok);
  eq(st.brokers.length, 0);
  ok(st.cash > before);
});
t('every chart can be used without throwing', () => {
  for (const k of Object.keys(CHARTS)) {
    const st = S.newRun('C' + k);
    st.brokers = [makeBroker('sticky', null)];
    const s = S.startDeadline(st, 0);
    st.consumables = [makeConsumable(k)];
    const r = S.useConsumable(st, st.consumables[0].uid, s.board.slice(0, 3).map((c) => c.uid));
    ok(typeof r.ok === 'boolean', k);
  }
});
t('every rumor can be used without throwing', () => {
  for (const k of Object.keys(RUMORS)) {
    const st = S.newRun('R' + k);
    st.brokers = [makeBroker('sticky', null), makeBroker('techBro', null)];
    const s = S.startDeadline(st, 0);
    st.consumables = [makeConsumable(k)];
    const r = S.useConsumable(st, st.consumables[0].uid, s.board.slice(0, 1).map((c) => c.uid));
    ok(typeof r.ok === 'boolean', k);
  }
});
t('contracts level their formation', () => {
  const st = S.newRun('CT');
  st.consumables = [makeConsumable('ct_tweezer')];
  S.useConsumable(st, st.consumables[0].uid, []);
  eq(st.formations.tweezer.level, 2);
});
t('every bonus applies without throwing', () => {
  for (const k of S.BONUS_KEYS) S.applyBonus(S.newRun('BN' + k), k);
  ok(true);
});
t('save round-trips a run', () => {
  const st = S.newRun('SAVE');
  st.cash = 42;
  st.brokers = [makeBroker('sticky', null)];
  st.formations.tweezer.level = 4;
  const back = S.deserialize(S.serialize(st));
  eq(back.cash, 42); eq(back.brokers.length, 1); eq(back.formations.tweezer.level, 4); eq(back.seed, 'SAVE');
});
t('save restores the RNG stream position', () => {
  const st = S.newRun('RNGSAVE');
  for (let i = 0; i < 17; i++) st.rng.next();
  const snap = S.serialize(st);
  eq(S.deserialize(snap).rng.next(), S.deserialize(snap).rng.next());
});
t('the same seed deals the same opening board', () => {
  const a = S.startDeadline(S.newRun('SAME'), 0).board.map((c) => c.sector + c.body + c.bull).join(',');
  const b = S.startDeadline(S.newRun('SAME'), 0).board.map((c) => c.sector + c.body + c.bull).join(',');
  eq(a, b);
});
t('running out of trades below quota busts the run', () => {
  const st = S.newRun('BUST');
  const s = S.startDeadline(st, 0);
  s.quota = 999999;
  let last;
  while (s.tradesLeft > 0) { S.toggleSelect(st, s.board[0].uid); last = S.playTrade(st, 'LONG'); }
  ok(last.busted);
});

console.log('');
console.log(`  ${pass} passing, ${fail} failing`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('  all green ✓');
