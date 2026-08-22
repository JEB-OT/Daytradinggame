import { RNG } from '../src/engine/rng.js';
import { makeCandle, standardBook, baseVolume, SECTOR_KEYS, SECTORS, sortCandles, polarityOf, isWide, isDoji, candleShape } from '../src/game/candles.js';
import { evaluate, bestFromBoard, formationStats, FORMATION_KEYS, convictionOf } from '../src/game/formations.js';
import { BROKERS, BROKER_KEYS, makeBroker, brokerText, rollBrokerKey } from '../src/game/brokers.js';
import { CHARTS, CONTRACTS, RUMORS, ALL_CONSUMABLES, makeConsumable, consumableText, consumableDownside, needsBoard } from '../src/game/consumables.js';
import { LICENSES, LICENSE_KEYS } from '../src/game/licenses.js';
import { BOSSES, BOSS_KEYS } from '../src/game/bosses.js';
import { Market } from '../src/game/market.js';
import { scoreTrade } from '../src/game/scoring.js';
import * as S from '../src/game/state.js';
import { VERSION, CHANGELOG } from '../src/engine/version.js';
import { notesFor, versionsInChangelog } from '../scripts/release-notes.mjs';
import { bookRowCells, lapFor, LAP_MIN, LAP_MAX } from '../src/ui/overlays.js';
import { MAX_BODY as BODY_SIZES } from '../src/game/candles.js';

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
  const c = mk('TECH', 5, true, { enhancement: 'obsidian' });
  eq(baseVolume(c), 50);
  eq(polarityOf(c), 'none');
});
t('swing candles count as both polarities', () => {
  eq(polarityOf(mk('TECH', 5, true, { enhancement: 'janus' })), 'both');
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
  eq(F([mk('TECH', 3, false, { enhancement: 'janus' }), mk('CRYPTO', 6, true), mk('ENERGY', 9, true)]), 'soldiers');
});
t('Cadence lets a march happen with 2 candles', () => {
  eq(F([mk('TECH', 4, true), mk('CRYPTO', 8, true)], { marchOfThree: true }), 'soldiers');
  eq(F([mk('TECH', 4, true), mk('CRYPTO', 8, true)]), 'tick');
});
t('rotating candles complete a cluster', () =>
  eq(F([mk('TECH', 2), mk('TECH', 5, false), mk('CRYPTO', 7, false, { enhancement: 'chameleon' }), mk('TECH', 9), mk('TECH', 12, false)]), 'cluster'));
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
  const ev = evaluate([mk('TECH', 5), mk('CRYPTO', 5, false), mk('ENERGY', 9, true, { enhancement: 'obsidian' }), mk('FINANCE', 2, false), mk('TECH', 12, false)]);
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
  const cs = [mk('TECH', 5, true, { enhancement: 'janus' }), mk('CRYPTO', 6, true, { enhancement: 'janus' })];
  eq(convictionOf(cs, 'LONG').key, 'full');
  eq(convictionOf(cs, 'SHORT').key, 'full');
});
t('sealed candles are ignored by conviction', () => {
  const cs = [mk('TECH', 5), mk('CRYPTO', 6, false, { enhancement: 'obsidian' })];
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
  eq(scoreWith([], [mk('TECH', 10, true, { enhancement: 'bullion' }), mk('CRYPTO', 10, false)]).volume, 60);
});
t('hedged candles held on the board multiply leverage', () => {
  eq(scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10, false)], { held: [mk('ENERGY', 3, true, { enhancement: 'wardstone' })] }).leverage, 3);
});
t('Reissue stamp reprints a candle', () => {
  const a = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10, false)]);
  const b = scoreWith([], [mk('TECH', 10, true, { stamp: 'reissue' }), mk('CRYPTO', 10, false)]);
  eq(b.volume - a.volume, 10);
});
t('Front Runner reprints every candle', () => eq(scoreWith(['frontRunner'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).volume, 50));

// ---------------------------------------------------------------- the print shop
t('Fine Print reprints bodies 2-5 and leaves the rest alone', () => {
  // A tweezer of 4s prints each body twice: base 10 + (4+4)*2 = 26.
  eq(scoreWith(['finePrint'], [mk('TECH', 4), mk('CRYPTO', 4, false)]).volume, 26);
  // Bodies outside 2-5 are untouched.
  eq(scoreWith(['finePrint'], [mk('TECH', 6), mk('CRYPTO', 6, false)]).volume, 22);
  eq(scoreWith(['finePrint'], [mk('TECH', 1), mk('CRYPTO', 1, false)]).volume, 12);
});
t('Press Run prints wide candles three times each', () => {
  eq(scoreWith(['pressRun'], [mk('TECH', 12), mk('CRYPTO', 12, false)]).volume, 10 + 12 * 6);
  eq(scoreWith(['pressRun'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).volume, 30);
});
t('Hairline prints a doji four times', () => {
  eq(scoreWith(['hairline'], [mk('TECH', 1), mk('CRYPTO', 1, false)]).volume, 10 + 1 * 8);
});
t('Last Word reprints the final candle, Encore the first', () => {
  // Overspill makes every placed candle print, so the two hooks land on
  // different bodies and the difference between them is readable.
  const played = [mk('TECH', 2), mk('CRYPTO', 9, false), mk('ENERGY', 5)];
  const plain = scoreWith(['splitter'], played).volume;
  eq(scoreWith(['splitter', 'lastWord'], played).volume - plain, 5);
  eq(scoreWith(['splitter', 'caffeinated'], played).volume - plain, 2);
});
t('Kerning reprints candles whose body is matched', () => {
  // The pair of 7s prints twice each; the lone 2 is not part of the tweezer.
  eq(scoreWith(['kerning'], [mk('TECH', 7), mk('CRYPTO', 7, false)]).volume, 10 + 7 * 4);
  // Unmatched bodies print a Single Tick, which scores the biggest one once.
  eq(scoreWith(['kerning'], [mk('TECH', 7), mk('CRYPTO', 8, false)]).volume, 5 + 8);
});
t('Misprint reprints candles carrying an edition', () => {
  const plain = scoreWith(['misprint'], [mk('TECH', 9), mk('CRYPTO', 9, false)]);
  const foiled = scoreWith(['misprint'], [mk('TECH', 9, true, { edition: 'laminated' }), mk('CRYPTO', 9, false)]);
  eq(plain.volume, 28);
  eq(foiled.volume - plain.volume, 9 + 50 * 2, 'body and Foiled both print twice');
});
t('Run-Off and Ink Press are paid per extra print', () => {
  // Echo gives every candle one extra print: two candles -> two extra prints.
  eq(scoreWith(['frontRunner', 'runOff'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).volume, 50 + 70);
  eq(scoreWith(['frontRunner', 'inkPress'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).leverage, 2 + 10);
  // With nothing reprinting they are dead weight, which is the trade-off.
  eq(scoreWith(['runOff'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).volume, 30);
});
t('Print Shop pays a dollar per extra print', () => {
  eq(scoreWith(['frontRunner', 'printShop'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).money, 2);
});
t('Overprint needs a candle that printed three times', () => {
  eq(scoreWith(['frontRunner', 'overprint'], [mk('TECH', 10), mk('CRYPTO', 10, false)]).leverage, 2);
  // Echo + Understudy on a wide candle is three prints.
  const r = scoreWith(['frontRunner', 'blueSuit', 'overprint'], [mk('TECH', 12), mk('CRYPTO', 12, false)]);
  eq(+r.leverage.toFixed(2), 3.2);
});
t('Split Run wants one small candle and one wide one', () => {
  eq(scoreWith(['splitRun'], [mk('TECH', 3), mk('CRYPTO', 3, false)]).leverage, 2);
  // Pillars — three 3s and two 12s — prints all five, so both bands are there.
  const mixed = scoreWith(['splitRun'],
    [mk('TECH', 3), mk('CRYPTO', 3, false), mk('ENERGY', 3), mk('FINANCE', 12), mk('TECH', 12, false)]);
  eq(mixed.formationKey, 'pillars');
  eq(mixed.leverage, 8, 'x2 on the base x4');
});
t('Serial Number banks volume from every extra print', () => {
  const st = S.newRun('SER');
  st.brokers = [makeBroker('frontRunner', null), makeBroker('serialNumber', null)];
  S.computeMods(st);
  const played = [mk('TECH', 10), mk('CRYPTO', 10, false)];
  const go = () => scoreTrade(st, {
    played, held: [], direction: null, correct: null, rng: new RNG('ser'),
    commit: true, tradeIndex: 0, tradesLeft: 4, greenStreak: 0, quota: 1000,
  });
  eq(go().volume, 50, 'nothing banked on the first trade yet');
  eq(st.brokers[1].counters.v, 12, 'two extra prints x 6');
  eq(go().volume, 62, 'the banked volume lands on the next trade');
});
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
      played: [mk('TECH', 10), mk('CRYPTO', 10, false), mk('ENERGY', 11, true, { enhancement: 'chameleon' }),
               mk('FINANCE', 5, false, { enhancement: 'glasswork', edition: 'laminated', stamp: 'reissue' }),
               mk('TECH', 5, true, { enhancement: 'janus' })],
      held: [mk('TECH', 3, false, { enhancement: 'goldleaf' })],
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
t('bookLocations accounts for every candle exactly once', () => {
  const st = S.newRun('LOC');
  // Nothing dealt yet: the whole book is still deck.
  let w = S.bookLocations(st);
  eq(w.dealt, false);
  eq(w.deck.length, 52); eq(w.board.length, 0); eq(w.swept.length, 0);

  const s = S.startDeadline(st, 0);
  w = S.bookLocations(st);
  eq(w.dealt, true);
  eq(w.board.length, st.mods.handSize);
  eq(w.deck.length, 52 - st.mods.handSize);
  eq(w.swept.length, 0);
  eq(w.deck.length + w.board.length + w.swept.length, st.book.length);

  // Sweeping moves candles out of the deck's reach for the rest of the bell.
  S.toggleSelect(st, s.board[0].uid); S.toggleSelect(st, s.board[1].uid);
  S.sweepSelected(st);
  w = S.bookLocations(st);
  eq(w.swept.length, 2);
  eq(w.board.length, st.mods.handSize);
  eq(w.deck.length + w.board.length + w.swept.length, st.book.length);
  const seen = new Set([...w.deck, ...w.board, ...w.swept].map((c) => c.uid));
  eq(seen.size, st.book.length, 'no candle counted twice');
});
t('bookLocations does not double-count an Anchor-sealed candle', () => {
  const st = S.newRun('ANCH');
  const s = S.startDeadline(st, 0);
  s.board[0].stamp = 'hold';                 // Anchor: goes back to the board
  S.toggleSelect(st, s.board[0].uid);
  S.playTrade(st, 'LONG');
  const w = S.bookLocations(st);
  eq(w.deck.length + w.board.length + w.swept.length, st.book.length);
  ok(w.board.some((c) => c.stamp === 'hold'), 'the anchored candle is on the board');
  ok(!w.swept.some((c) => c.stamp === 'hold'), 'and not also in the swept pile');
});
t('a destroyed candle leaves every pile', () => {
  const st = S.newRun('DEST');
  const s = S.startDeadline(st, 0);
  const doomed = s.drawPile[0];
  S.removeFromBook(st, doomed);
  const w = S.bookLocations(st);
  eq(st.book.length, 51);
  eq(w.deck.length + w.board.length + w.swept.length, 51);
  ok(!w.deck.some((c) => c.uid === doomed.uid), 'gone from the deck');
});
t('dragging a candle on the board changes the print order', () => {
  const st = S.newRun('DRAG');
  const s = S.startDeadline(st, 0);
  // Select three, deliberately clicked out of left-to-right order.
  const [a, b, c] = [s.board[2], s.board[0], s.board[4]];
  S.toggleSelect(st, a.uid); S.toggleSelect(st, b.uid); S.toggleSelect(st, c.uid);
  eq(S.selectedCandles(st).map((x) => x.uid).join(), [a, b, c].map((x) => x.uid).join(),
     'click order stands until something is moved');

  // Drag the last one to the front of the board; the placement follows.
  S.moveBoardCandle(st, c.uid, 0);
  const order = S.selectedCandles(st).map((x) => x.uid);
  const boardOrder = s.board.filter((x) => s.selected.includes(x.uid)).map((x) => x.uid);
  eq(order.join(), boardOrder.join(), 'placement order is the board order');
  eq(order[0], c.uid, 'the dragged candle now prints first');
});
t('ARRANGE moves the cards, not just the badges', () => {
  const st = S.newRun('ARR');
  const s = S.startDeadline(st, 0);
  s.board = [mk('TECH', 9), mk('CRYPTO', 2), mk('ENERGY', 13), mk('FINANCE', 5)];
  s.board.forEach((c) => S.toggleSelect(st, c.uid));
  S.arrangeSelection(st, 'rising');
  eq(s.board.map((c) => c.body).join(), '2,5,9,13', 'the board itself is now rising');
  eq(S.selectedCandles(st).map((c) => c.body).join(), '2,5,9,13', 'and the placement agrees');
  S.arrangeSelection(st, 'falling');
  eq(s.board.map((c) => c.body).join(), '13,9,5,2');
  eq(S.selectedCandles(st).map((c) => c.body).join(), '13,9,5,2');
});
t('ARRANGE leaves unselected candles where they are', () => {
  const st = S.newRun('ARR2');
  const s = S.startDeadline(st, 0);
  s.board = [mk('TECH', 9), mk('CRYPTO', 2), mk('ENERGY', 13), mk('FINANCE', 5)];
  // Only the outer two are placed; the middle pair must not shuffle.
  S.toggleSelect(st, s.board[0].uid); S.toggleSelect(st, s.board[3].uid);
  S.arrangeSelection(st, 'rising');
  eq(s.board.map((c) => c.body).join(), '5,2,13,9', 'placed candles swapped, the rest held station');
  eq(S.selectedCandles(st).map((c) => c.body).join(), '5,9');
});
t('syncPlacementToBoard drops candles that left the board', () => {
  const st = S.newRun('SYNC');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.board[0].uid); S.toggleSelect(st, s.board[1].uid);
  const gone = s.board.splice(0, 1)[0];
  S.syncPlacementToBoard(st);
  eq(s.selected.length, 1);
  ok(!s.selected.includes(gone.uid));
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
t('interest pays $1 per $5 held and caps at $5', () => {
  const st = S.newRun('INT0');
  const s = S.startDeadline(st, 0);
  s.tradesLeft = 0;
  const at = (cash) => { st.cash = cash; return S.payoutPreview(st).interest; };
  eq(at(0), 0); eq(at(4), 0); eq(at(5), 1); eq(at(12), 2); eq(at(25), 5); eq(at(90), 5);
});
t('interest licences raise the ceiling to $10, $15 and $25', () => {
  const st = S.newRun('INT1');
  st.cash = 500;
  const cap = () => { S.computeMods(st); return st.mods.interestCap; };
  eq(cap(), 5);
  st.licenses.push('retirement'); eq(cap(), 10);
  st.licenses.push('trustFund');  eq(cap(), 15);
  st.licenses.push('vaultKeys');  eq(cap(), 25);
  // and the cap is reached at cap x rate held
  S.startDeadline(st, 0);
  st.cash = 25 * 5;
  eq(S.payoutPreview(st).interest, 25);
  st.cash = 25 * 5 - 5;
  eq(S.payoutPreview(st).interest, 24);
});
t('every unused trade pays $1', () => {
  const st = S.newRun('TR');
  const s = S.startDeadline(st, 0);
  st.cash = 0;
  s.tradesLeft = 3;
  const line = S.payoutPreview(st).lines.find((l) => l.label.includes('unused'));
  eq(line.amount, 3);
  s.profit = s.quota;
  const paid = S.finishDeadline(st);
  eq(paid.lines.find((l) => l.label.includes('unused')).amount, 3);
});
t('packs advertise what is inside', () => {
  for (const p of S.PACKS) {
    const sum = S.packSummary(p);
    ok(sum.includes(String(p.choose)) && sum.includes(String(p.size)), p.key + ': ' + sum);
    ok(S.PACK_CONTENTS[p.family], 'family blurb for ' + p.family);
  }
  const multi = S.PACKS.filter((p) => p.choose > 1);
  ok(multi.length >= 5, 'expected several keep-two packs, got ' + multi.length);
  ok(multi.some((p) => p.family === 'broker'), 'a keep-two broker pack must exist');
  ok(multi.every((p) => p.cost >= 9), 'keep-two packs should cost more');
});
t('a keep-two pack really hands over two', () => {
  const st = S.newRun('P2');
  st.cash = 200;
  S.openShop(st);
  st.shop.packs[0] = { ...S.PACKS.find((p) => p.key === 'brokerM'), sold: false };
  const r = S.buyPack(st, 0);
  eq(r.pack.picks, 2);
  eq(r.pack.options.length, 5);
  S.pickFromPack(st, 0);
  eq(st.shop.pack.picks, 1, 'still one to take');
  S.pickFromPack(st, 1);
  eq(st.shop.pack, null, 'pack closes after the second pick');
  eq(st.brokers.length, 2);
});
t('arrange orders Volume-feeders before Leverage-feeders', () => {
  const st = S.newRun('ARR2');
  const s = S.startDeadline(st, 0);
  s.board = [
    makeCandle('TECH', 9, true, { enhancement: 'bloodstone' }),
    makeCandle('TECH', 3, true, { enhancement: 'bullion' }),
    makeCandle('TECH', 7, true, { enhancement: 'cursed' }),
  ];
  s.board.forEach((c) => S.toggleSelect(st, c.uid));
  S.arrangeSelection(st, 'volume');
  eq(S.selectedCandles(st)[0].enhancement, 'bullion');
  S.arrangeSelection(st, 'leverage');
  ok(['bloodstone', 'cursed'].includes(S.selectedCandles(st)[0].enhancement));
});
t('reordering a placement leaves every unplaced candle where it was', () => {
  const st = S.newRun('DRAG');
  const s = S.startDeadline(st, 0);
  s.board = [mk('TECH', 13), mk('CRYPTO', 11), mk('ENERGY', 9), mk('FINANCE', 7),
             mk('TECH', 5), mk('CRYPTO', 3), mk('ENERGY', 2), mk('FINANCE', 1)];
  // Place the 13, the 9 and the 5 — slots 0, 2 and 4.
  [0, 2, 4].forEach((i) => S.toggleSelect(st, s.board[i].uid));
  const untouched = [1, 3, 5, 6, 7].map((i) => s.board[i].uid);

  const third = S.selectedCandles(st)[2].uid;        // the 5
  S.movePlacement(st, third, 0);
  eq(S.selectedCandles(st).map((c) => c.body).join(), '5,13,9', 'the placement reordered');
  eq(s.board.map((c) => c.body).join(), '5,11,13,7,9,3,2,1', 'only the placed slots changed');
  eq([1, 3, 5, 6, 7].map((i) => s.board[i].uid).join(), untouched.join(),
     'the unplaced candles never moved');
});
t('rearranging does not latch the board out of its sort', () => {
  const st = S.newRun('STICK');
  const s = S.startDeadline(st, 0);
  s.sortMode = 'body';
  s.board = sortCandles(s.board, 'body');

  // Rearrange a placement, then a plain board tidy — neither is a sort choice.
  s.board.slice(0, 3).forEach((c) => S.toggleSelect(st, c.uid));
  S.arrangeSelection(st, 'rising');
  eq(s.sortMode, 'body', 'ARRANGE is not a sort mode');
  S.movePlacement(st, S.selectedCandles(st)[2].uid, 0);
  eq(s.sortMode, 'body', 'nor is dragging within the placement');
  S.moveBoardCandle(st, s.board[s.board.length - 1].uid, 0);
  eq(s.sortMode, 'body', 'nor is tidying the board');

  // Play the hand; the redraw comes back in the sort that was chosen, so the
  // player never has to press SORT again.
  S.playTrade(st, 'LONG');
  const bodies = s.board.map((c) => c.body);
  eq(bodies.join(), bodies.slice().sort((a, b) => b - a).join(),
     'the board redrew already sorted by body');
});
t('a sweep also redraws into the chosen sort', () => {
  const st = S.newRun('STICK2');
  const s = S.startDeadline(st, 0);
  s.sortMode = 'sector';
  s.board.slice(0, 2).forEach((c) => S.toggleSelect(st, c.uid));
  S.arrangeSelection(st, 'falling');
  S.sweepSelected(st);
  const order = s.board.map((c) => Object.keys(SECTORS).indexOf(c.sector));
  eq(order.join(), order.slice().sort((a, b) => a - b).join(), 'sector order restored');
  eq(s.sortMode, 'sector');
});
t('interest is capped', () => {
  const st = S.newRun('INT');
  st.cash = 500;
  const s = S.startDeadline(st, 0);
  s.tradesLeft = 0;
  eq(S.finishDeadline(st).lines.find((l) => l.label.startsWith('Interest')).amount, 5);
});
t('clearing a deadline unlocks the next one', () => {
  const st = S.newRun('ADV');
  S.startDeadline(st, 0);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.openShop(st);
  st.shop = null;
  S.advanceAfterDeadline(st);
  eq(st.deadlineIndex, 1, 'should be on deadline 2');
  eq(st.week, 1);
  ok(st.upcoming[0].done, 'first is cleared');
  ok(!st.upcoming[1].done, 'second is playable');
  // and it must actually start
  const s = S.startDeadline(st, 1);
  eq(s.board.length, st.mods.handSize);
});
t('a whole week can be played end to end', () => {
  const st = S.newRun('WEEKLOOP');
  for (let i = 0; i < 3; i++) {
    eq(st.deadlineIndex, i, `expected to be on deadline ${i + 1}`);
    ok(!st.upcoming[i].done, `deadline ${i + 1} should be playable`);
    S.startDeadline(st, i);
    st.session.profit = st.session.quota;
    S.finishDeadline(st);
    S.advanceAfterDeadline(st);
  }
  eq(st.week, 2);
  eq(st.deadlineIndex, 0);
  ok(st.upcoming.every((u) => !u.done), 'a fresh week is all playable');
});
t('skipping then clearing still walks forward', () => {
  const st = S.newRun('MIXED');
  S.skipDeadline(st, 0);
  eq(st.deadlineIndex, 1);
  S.startDeadline(st, 1);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.advanceAfterDeadline(st);
  eq(st.deadlineIndex, 2);
  ok(st.upcoming[2].boss, 'lands on the boss');
});
t('a run saved at the payout screen resumes playable', () => {
  const st = S.newRun('RES1');
  S.startDeadline(st, 0);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);                       // autosave fires here
  const back = S.deserialize(S.serialize(st));
  eq(back.deadlineIndex, 1, 'must have stepped off the cleared slot');
  ok(!back.upcoming[1].done, 'next deadline is playable');
  eq(S.startDeadline(back, 1).board.length, back.mods.handSize);
});
t('a run saved on the Floor resumes on the Floor with its stock', () => {
  const st = S.newRun('RES2');
  S.startDeadline(st, 0);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.openShop(st);
  const items = st.shop.items.length;
  const back = S.deserialize(S.serialize(st));
  eq(back.phase, 'shop');
  eq(back.shop.items.length, items);
  ok(back.shop.rng, 'shop RNG is re-forked so rerolls still work');
  ok(S.rerollShop(back).ok || back.cash < 5);
  // and leaving it still lands on the next deadline exactly once
  back.shop = null;
  S.advanceAfterDeadline(back);
  eq(back.deadlineIndex, 1);
});
t('leaving the Floor clears the shop phase', () => {
  const st = S.newRun('PHASE');
  S.startDeadline(st, 0);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.openShop(st);
  eq(st.phase, 'shop');
  S.advanceAfterDeadline(st);
  eq(st.phase, 'select');
  eq(st.shop, null);
  eq(S.deserialize(S.serialize(st)).phase, 'select');
});
t('normalising progress is idempotent', () => {
  const st = S.newRun('IDEM');
  S.startDeadline(st, 0);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.advanceAfterDeadline(st);
  eq(st.deadlineIndex, 1);
  S.advanceAfterDeadline(st);
  eq(st.deadlineIndex, 1, 'a second advance must not skip a deadline');
  S.normalizeProgress(st);
  eq(st.deadlineIndex, 1);
});
t('a week whose slots are all done rolls over on its own', () => {
  const st = S.newRun('ROLL');
  st.upcoming.forEach((u) => { u.done = true; });
  S.normalizeProgress(st);
  eq(st.week, 2);
  eq(st.deadlineIndex, 0);
  ok(st.upcoming.every((u) => !u.done));
});
t('a corrupt index cannot lock the player out', () => {
  const st = S.newRun('CORRUPT');
  st.upcoming[0].done = true;
  st.deadlineIndex = 0;            // the exact broken state players hit
  S.normalizeProgress(st);
  eq(st.deadlineIndex, 1);
  st.deadlineIndex = 99;
  S.normalizeProgress(st);
  ok(st.deadlineIndex >= 0 && st.deadlineIndex <= 2);
});
t('advancing past the boss rolls the week over', () => {
  const st = S.newRun('WK');
  S.startDeadline(st, 2);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.advanceAfterDeadline(st);
  eq(st.week, 2); eq(st.deadlineIndex, 0);
});
t('quotas get steeper at every eight-week act boundary', () => {
  eq(S.actOf(1), 1); eq(S.actOf(8), 1);
  eq(S.actOf(9), 2); eq(S.actOf(16), 2);
  eq(S.actOf(17), 3); eq(S.actOf(24), 3); eq(S.actOf(25), 4);
  // Each act grows faster per week than the one before it.
  for (let a = 2; a < 10; a++) ok(S.actGrowth(a + 1) > S.actGrowth(a), 'act ' + a);

  const step = (w) => S.weekBase(w) / S.weekBase(w - 1);
  // Inside an act the rate holds; crossing a boundary it jumps.
  ok(Math.abs(step(10) - step(16)) < 1e-6, 'flat inside act 2');
  ok(step(17) > step(16) + 0.4, 'act 3 is steeper than act 2');
  ok(step(25) > step(24) + 0.4, 'act 4 is steeper than act 3');
  ok(step(33) > step(32) + 0.4, 'act 5 is steeper than act 4');
  // And the old flat x2.4-forever curve is gone.
  ok(step(40) > 4, 'late acts are far steeper than the old constant 2.4');
});
t('the quota curve stays finite and strictly rising deep into endless', () => {
  let prev = 0;
  for (let w = 1; w <= 200; w++) {
    const v = S.weekBase(w);
    ok(Number.isFinite(v), 'week ' + w + ' overflowed');
    ok(v > prev, 'week ' + w + ' did not rise');
    prev = v;
  }
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
t('the same broker is never offered twice', () => {
  const st = S.newRun('NODUP');
  st.brokers = ['sticky', 'techBro', 'bullPen', 'scalper'].map((k) => makeBroker(k, null));
  S.computeMods(st);
  const owned = S.ownedBrokerKeys(st);
  eq(owned.length, 4);
  for (let i = 0; i < 600; i++) {
    const k = rollBrokerKey(new RNG('nd' + i), { owned });
    ok(!owned.includes(k), 'offered a duplicate: ' + k);
  }
});
t('a shop restock never stocks a broker you employ', () => {
  const st = S.newRun('NODUP2');
  st.cash = 100000;
  st.brokers = ['sticky', 'tickertape', 'techBro'].map((k) => makeBroker(k, null));
  S.computeMods(st);
  S.openShop(st);
  for (let i = 0; i < 120; i++) {
    for (const it of st.shop.items) {
      if (it.type === 'broker') ok(!st.brokers.some((b) => b.key === it.key), 'shop offered ' + it.key);
    }
    st.shop.rerollCost = 0;          // keep rerolling without going broke
    ok(S.rerollShop(st).ok);
  }
});
t('a shop restock never repeats within its own stock', () => {
  const st = S.newRun('NODUP3');
  st.cash = 100000;
  st.permanent.slots = 5;
  S.computeMods(st);
  S.openShop(st);
  for (let i = 0; i < 200; i++) {
    const keys = st.shop.items.filter((it) => it.type === 'broker').map((it) => it.key);
    eq(new Set(keys).size, keys.length, 'the same broker appeared twice on one Floor');
    st.shop.rerollCost = 0;
    S.rerollShop(st);
  }
});
t('the Floor never shows the same broker on the shelf and inside a pack', () => {
  // The shelf and a pack are rolled at different moments. Without a Floor-wide
  // exclusion the same broker turns up in both, and taking one then buying the
  // other lands two of them on the desk.
  let overlaps = 0, checked = 0;
  for (let i = 0; i < 250; i++) {
    const st = S.newRun('FLOOR' + i);
    st.cash = 99999;
    st.permanent.slots = 40;
    S.computeMods(st);
    S.openShop(st);
    const pi = st.shop.packs.findIndex((p) => p.family === 'broker');
    if (pi < 0) continue;
    const r = S.buyPack(st, pi);
    if (!r.ok) continue;
    checked++;
    const shelf = st.shop.items.filter((x) => x.type === 'broker' && !x.sold).map((x) => x.key);
    const opts = r.pack.options.filter((o) => o.type === 'broker').map((o) => o.key);
    if (opts.some((k) => shelf.includes(k))) overlaps++;
  }
  ok(checked > 20, 'expected some broker packs to test, saw ' + checked);
  eq(overlaps, 0, 'a broker was on the shelf and in the pack at once');
});
t('you cannot end up employing the same broker twice', () => {
  for (let i = 0; i < 250; i++) {
    const st = S.newRun('TWICE' + i);
    st.cash = 99999;
    st.permanent.slots = 40;
    S.computeMods(st);
    S.openShop(st);
    // Take everything the Floor will give: every pack option, then every item.
    for (let p = 0; p < st.shop.packs.length; p++) {
      const r = S.buyPack(st, p);
      if (!r.ok) continue;
      for (let o = 0; o < r.pack.options.length; o++) S.pickFromPack(st, o);
      S.closePack(st);
    }
    for (let n = 0; n < st.shop.items.length; n++) S.buyShopItem(st, n);
    const keys = st.brokers.map((b) => b.key);
    eq(new Set(keys).size, keys.length, 'desk holds two of the same broker, seed ' + i);
  }
});
t('an already-employed broker is refused rather than duplicated', () => {
  const st = S.newRun('EMPL');
  st.cash = 999;
  st.permanent.slots = 40;
  S.computeMods(st);
  S.openShop(st);
  // Simulate the one route that reaches this: buy a duplicate under Hall of
  // Mirrors, then sell the Mirrors so the rule snaps back on.
  st.shop.items = [{ type: 'broker', key: 'sticky', inst: makeBroker('sticky', null), cost: 4 }];
  st.brokers = [makeBroker('sticky', null)];
  S.computeMods(st);
  ok(S.alreadyEmployed(st, 'sticky'));
  eq(S.buyShopItem(st, 0).blocked, 'You already employ them');
  eq(st.brokers.length, 1);
  // With Hall of Mirrors held it goes through again.
  st.brokers.push(makeBroker('hallOfMirrors', null));
  S.computeMods(st);
  ok(!S.alreadyEmployed(st, 'sticky'));
  ok(S.buyShopItem(st, 0).ok);
  eq(st.brokers.filter((b) => b.key === 'sticky').length, 2);
});
t('brokersOnOffer reads the shelf and any open pack', () => {
  const st = S.newRun('OFFER');
  eq(S.brokersOnOffer(st).length, 0, 'no Floor open');
  st.cash = 99999;
  S.openShop(st);
  st.shop.items = [{ type: 'broker', key: 'sticky', inst: makeBroker('sticky', null), cost: 4, sold: false }];
  st.shop.pack = { pack: {}, options: [{ type: 'broker', key: 'techBro', inst: makeBroker('techBro', null) }], picks: 1 };
  eq(S.brokersOnOffer(st).sort().join(','), 'sticky,techBro');
  st.shop.items[0].sold = true;               // sold stock is no longer on offer
  st.shop.pack.options[0].taken = true;
  eq(S.brokersOnOffer(st).length, 0);
});
t('rollBrokerKey gives up exclude before it gives up owned', () => {
  // Own everything but one broker, and put that one on the exclude list. The
  // roll must still avoid the owned pile rather than dropping both rules.
  const all = Object.keys(BROKERS);
  const spare = all[7];
  const owned = all.filter((k) => k !== spare);
  for (let i = 0; i < 60; i++) {
    eq(rollBrokerKey(new RNG('relax' + i), { owned, exclude: [spare] }), spare);
  }
});
t('Hall of Mirrors re-opens the duplicate pool', () => {
  const st = S.newRun('MIRROR');
  st.brokers = [makeBroker('sticky', null), makeBroker('hallOfMirrors', null)];
  S.computeMods(st);
  ok(st.mods.allowDuplicates);
  eq(S.ownedBrokerKeys(st).length, 0);
  const owned = ['sticky', 'techBro', 'bullPen', 'scalper', 'tickertape'];
  let dupes = 0;
  for (let i = 0; i < 1500; i++) if (owned.includes(rollBrokerKey(new RNG('hm' + i), { owned: [] }))) dupes++;
  ok(dupes > 40, 'expected duplicates to become reachable, saw ' + dupes);
});
t('bonus broker rolls respect rarity and ownership', () => {
  const st = S.newRun('BONUS');
  st.brokers = Object.keys(BROKERS).filter((k) => BROKERS[k].rarity === 'rare').slice(0, 5)
    .map((k) => makeBroker(k, null));
  st.permanent.slots = 40;
  S.computeMods(st);
  const before = st.brokers.map((b) => b.key);
  S.applyBonus(st, 'rareBroker');
  const added = st.brokers[st.brokers.length - 1];
  eq(BROKERS[added.key].rarity, 'rare');
  ok(!before.includes(added.key), 'bonus handed out a duplicate');
});
t('rolling never returns undefined even with everything owned', () => {
  const k = rollBrokerKey(new RNG('all'), { owned: Object.keys(BROKERS) });
  ok(k && BROKERS[k], 'got ' + k);
});
t('Reshuffle costs one more board slot every time', () => {
  const st = S.newRun('RECALL');
  const costs = [];
  for (let i = 0; i < 3; i++) {
    const before = st.permanent.handSize;
    st.consumables = [makeConsumable('totalRecall')];
    S.useConsumable(st, st.consumables[0].uid, []);
    costs.push(before - st.permanent.handSize);
  }
  eq(JSON.stringify(costs), JSON.stringify([1, 2, 3]));
  eq(st.permanent.slots, 8);
  eq(st.permanent.chartSlots, 5);
});
t('Reshuffle never drops the board below one', () => {
  const st = S.newRun('RECALL2');
  for (let i = 0; i < 8; i++) {
    st.consumables = [makeConsumable('totalRecall')];
    S.useConsumable(st, st.consumables[0].uid, []);
  }
  ok(st.permanent.handSize >= 1, 'board size went to ' + st.permanent.handSize);
  S.computeMods(st);
  ok(st.mods.handSize >= 1);
});
t('consumable text can depend on run state', () => {
  const st = S.newRun('CTXT');
  const d = ALL_CONSUMABLES.totalRecall;
  // Reshuffle's price is the escalating half, so it lives in the downside.
  const a = consumableDownside(d, st);
  st.permanent.recallUses = 3;
  const b = consumableDownside(d, st);
  ok(a !== b, 'Reshuffle downside should reflect how often it has been used');
  for (const [k, def] of Object.entries(ALL_CONSUMABLES)) {
    ok(consumableText(def, st).length > 0, k + ' has no text');
  }
});
t('every stated downside renders as text', () => {
  const st = S.newRun('DOWN');
  let stated = 0;
  for (const [k, def] of Object.entries(ALL_CONSUMABLES)) {
    const down = consumableDownside(def, st);
    if (!def.downside) { ok(down === '', k + ' invented a downside'); continue; }
    stated++;
    ok(typeof down === 'string' && down.length > 0, k + ' has an empty downside');
    ok(!down.includes('undefined'), k + ' downside leaked an undefined');
  }
  ok(stated >= 10, 'expected the rebalanced rumors to state their cost, got ' + stated);
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

// ---------------------------------------------------------------------------
// Every card, used from both places you can be holding one. A Chart that only
// works mid-deadline is a Chart you cannot use in the pack that sold it to
// you, so the rule is: unless the card says it needs a board, it works with a
// selection out of the book, on the Floor, with no session at all.
// ---------------------------------------------------------------------------
function armed(withSession, key) {
  const st = S.newRun('AUDIT' + key);
  st.cash = 40;
  if (withSession) S.startDeadline(st, 0);
  else S.openShop(st);
  st.brokers = [makeBroker('sticky', null), makeBroker('tickertape', null)];
  S.computeMods(st);
  const inst = makeConsumable(key);
  st.consumables = [inst];
  S.computeMods(st);
  const d = ALL_CONSUMABLES[key];
  let uids = [];
  if (d.select && d.select[1] > 0) {
    const pool = withSession ? st.session.board : st.book;
    uids = pool.slice(0, Math.max(d.select[0], 1)).map((c) => c.uid);
    if (withSession) st.session.selected = uids;
  }
  return { st, inst, uids };
}

t('every consumable works mid-deadline', () => {
  for (const key of Object.keys(ALL_CONSUMABLES)) {
    const { st, inst, uids } = armed(true, key);
    const r = S.useConsumable(st, inst.uid, uids);
    ok(r.ok, key + ' failed on a live board: ' + r.msg);
    ok(!st.consumables.some((c) => c.uid === inst.uid), key + ' was not spent');
  }
});

t('every consumable that does not need a board works on the Floor', () => {
  for (const key of Object.keys(ALL_CONSUMABLES)) {
    const { st, inst, uids } = armed(false, key);
    ok(!st.session, 'the Floor should have no session');
    const r = S.useConsumable(st, inst.uid, uids);
    if (needsBoard(key)) {
      ok(!r.ok, key + ' claims to need a board but ran without one');
      ok(/deadline/.test(r.msg), key + ' blocked without saying why: ' + r.msg);
    } else {
      ok(r.ok, key + ' failed on the Floor: ' + r.msg);
      ok(!st.consumables.some((c) => c.uid === inst.uid), key + ' was not spent on the Floor');
    }
  }
});

t('a selecting card can be aimed at a candle that is still in the deck', () => {
  const st = S.newRun('DECKPICK');
  const s = S.startDeadline(st, 0);
  const target = s.drawPile.find((c) => !s.board.includes(c));
  ok(target, 'expected candles left in the draw pile');
  const inst = makeConsumable('nakedShort');   // Blood Pact — stamps one candle
  st.consumables = [inst];
  S.computeMods(st);
  // Nothing selected on the board: the uid comes straight out of the book.
  const r = S.useConsumable(st, inst.uid, [target.uid]);
  ok(r.ok, 'aiming into the deck was refused: ' + r.msg);
  eq(st.book.find((c) => c.uid === target.uid).stamp, 'reissue');
});

// --------------------------------------------------- print-shop multipliers
// These land inside printCandle, so they multiply once per print rather than
// once per trade — which is what makes them worth pairing with anything that
// makes a candle print again.

t('a print multiplier lands once for every matching print', () => {
  const cases = [
    ['emberDesk',  1.6,  1, () => [mk('TECH', 10, true, { enhancement: 'ember' }), mk('CRYPTO', 10, false)]],
    ['beaconDesk', 1.6,  1, () => [mk('TECH', 10, true, { enhancement: 'beacon' }), mk('CRYPTO', 10, false)]],
    ['cursedDesk', 2.2,  1, () => [mk('TECH', 10, true, { enhancement: 'cursed' }), mk('CRYPTO', 10, false)]],
    ['wishDesk',   1.8,  1, () => [mk('TECH', 10, true, { enhancement: 'wishbone' }), mk('CRYPTO', 10, false)]],
    ['stampPress', 1.35, 1, () => [mk('TECH', 10, true, { stamp: 'hold' }), mk('CRYPTO', 10, false)]],
    ['colophon',   1.3,  1, () => [mk('TECH', 10, true, { edition: 'laminated' }), mk('CRYPTO', 10, false)]],
    ['stillPoint', 1.3,  2, () => [mk('TECH', 1), mk('CRYPTO', 1, false)]],
    ['longShadow', 1.7,  2, () => [mk('TECH', 13), mk('CRYPTO', 13, false)]],
  ];
  for (const [key, mult, hits, make] of cases) {
    // Fresh candles each time: Ember writes its growth back onto the card.
    const off = scoreWith([], make()).leverage;
    const on = scoreWith([key], make()).leverage;
    const want = off * mult ** hits;
    ok(Math.abs(on - want) < 1e-6, `${key}: got x${(on / off).toFixed(3)}, wanted x${(mult ** hits).toFixed(3)}`);
  }
});

t('a print multiplier ignores a candle it does not match', () => {
  const plain = () => [mk('TECH', 10), mk('CRYPTO', 10, false)];
  for (const key of ['emberDesk', 'beaconDesk', 'cursedDesk', 'wishDesk', 'stampPress', 'colophon', 'stillPoint', 'longShadow']) {
    eq(scoreWith([key], plain()).leverage, scoreWith([], plain()).leverage, key);
  }
});

t('a print multiplier compounds with an extra print', () => {
  const make = () => [mk('TECH', 1), mk('CRYPTO', 1, false)];
  // Hairline gives every Doji three extra prints, so each of the two dojis
  // prints four times and Still Point multiplies on each of them.
  const off = scoreWith(['hairline'], make()).leverage;
  const on = scoreWith(['hairline', 'stillPoint'], make()).leverage;
  ok(Math.abs(on - off * 1.3 ** 8) < 1e-6, `got x${(on / off).toFixed(2)}, wanted x${(1.3 ** 8).toFixed(2)}`);
});

t('a debuffed candle earns no print multiplier', () => {
  const make = (debuffed) => [mk('TECH', 13, true, { debuffed }), mk('CRYPTO', 13, false)];
  const on = scoreWith(['longShadow'], make(true)).leverage;
  const off = scoreWith([], make(true)).leverage;
  eq(on, off * 1.7, 'only the candle that was not blanked should have multiplied');
});

// ------------------------------------------------------------ broker rarity
t('of the two RED-trade brokers, the better one is the rarer', () => {
  const rank = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  const red = BROKER_KEYS.filter((k) => BROKERS[k].redMult != null)
    .sort((a, b) => BROKERS[b].redMult - BROKERS[a].redMult);
  ok(red.length >= 2, 'expected at least two RED-trade brokers');
  ok(rank[BROKERS[red[0]].rarity] > rank[BROKERS[red[1]].rarity],
    `${BROKERS[red[0]].name} keeps more of a RED trade than ${BROKERS[red[1]].name} but is not the rarer of the two`);
});

t('Shapeshifter and Hairline are rare', () => {
  eq(BROKERS.algoDesk.rarity, 'rare');
  eq(BROKERS.hairline.rarity, 'rare');
});

// ------------------------------------------------------- sealed broker editions
t('a rumor seals the edition it puts on a broker', () => {
  const st = S.newRun('SEAL');
  st.brokers = [makeBroker('sticky', null)];
  st.consumables = [makeConsumable('gilding')];
  const r = S.useConsumable(st, st.consumables[0].uid, []);
  ok(r.ok, r.msg);
  eq(st.brokers[0].edition, 'laminated');
  ok(st.brokers[0].editionSealed, 'the edition was not sealed');
});

t('nothing replaces an edition a rumor sealed', () => {
  const st = S.newRun('SEAL2');
  st.brokers = [makeBroker('sticky', null)];
  st.consumables = [makeConsumable('gilding')];
  S.useConsumable(st, st.consumables[0].uid, []);

  for (const key of ['nakedCall', 'quantModel', 'gilding', 'offBookDeal']) {
    st.consumables = [makeConsumable(key)];
    const r = S.useConsumable(st, st.consumables[0].uid, []);
    ok(!r.ok, `${key} was allowed to work on a sealed broker`);
    eq(st.brokers[0].edition, 'laminated', `${key} replaced a sealed edition`);
    eq(st.consumables.length, 1, `${key} was spent for nothing`);
  }
  // and the deadline bonus that hands out editions cannot reach it either
  ok(typeof S.applyBonus === 'function', 'applyBonus is not exported any more');
  for (let i = 0; i < 20; i++) S.applyBonus(st, 'edition');
  eq(st.brokers[0].edition, 'laminated', 'the deadline bonus overwrote a sealed edition');
});

t('a sealed broker does not stop a rumor finding an unsealed one', () => {
  const st = S.newRun('SEAL3');
  st.brokers = [makeBroker('sticky', null), makeBroker('tickertape', null)];
  st.consumables = [makeConsumable('gilding')];
  ok(S.useConsumable(st, st.consumables[0].uid, []).ok);
  const sealed = st.brokers.find((b) => b.editionSealed);

  st.consumables = [makeConsumable('nakedCall')];
  const r = S.useConsumable(st, st.consumables[0].uid, []);
  ok(r.ok, r.msg);
  eq(sealed.edition, 'laminated', 'the sealed broker was hit anyway');
  eq(st.brokers.find((b) => b !== sealed).edition, 'holographic');
});

t('a sealed edition survives a save and load', () => {
  const st = S.newRun('SEAL4');
  st.brokers = [makeBroker('sticky', null)];
  st.consumables = [makeConsumable('gilding')];
  S.useConsumable(st, st.consumables[0].uid, []);
  const back = S.deserialize(S.serialize(st));
  eq(back.brokers[0].edition, 'laminated');
  ok(back.brokers[0].editionSealed, 'the seal did not survive the save');
});

// ---------------------------------------------------------------- the book
// Copies used to collapse into one square with a ×N badge, which hid the very
// thing the badge was pointing at: two body-7s are rarely the same card once
// one of them is Foiled, stamped or enhanced.

t('every copy of a body size gets its own card', () => {
  const book = [
    mk('TECH', 7),
    mk('TECH', 7, true, { enhancement: 'bullion' }),
    mk('TECH', 7, true, { edition: 'laminated', stamp: 'hold' }),
    mk('TECH', 3),
  ];
  const cells = bookRowCells(book, book);
  const sevens = cells.filter((c) => c.body === 7);
  eq(sevens.length, 3, 'the three body-7s did not each get a card');
  eq(sevens.filter((c) => c.candle).length, 3);
  eq(new Set(sevens.map((c) => c.candle.uid)).size, 3, 'the same candle was drawn twice');
  // one card per candle, plus a ghost for each body size held of nothing
  eq(cells.length, book.length + BODY_SIZES - 2);
});

t('a body size you hold nothing of is still a square', () => {
  const book = [mk('TECH', 7)];
  const cells = bookRowCells(book, book);
  const empty = cells.filter((c) => !c.candle);
  eq(empty.length, BODY_SIZES - 1);
  ok(empty.every((c) => c.body !== 7));
});

t('the plainest copy is laid down first, the most decorated last', () => {
  const fancy = mk('TECH', 7, true, { enhancement: 'bullion', edition: 'laminated', stamp: 'hold' });
  const plain = mk('TECH', 7);
  const cells = bookRowCells([fancy, plain], [fancy, plain]).filter((c) => c.body === 7);
  eq(cells[0].candle.uid, plain.uid);
  eq(cells[cells.length - 1].candle.uid, fancy.uid);
  ok(cells[0].opensBody, 'the first copy does not open the body group');
  ok(!cells[1].opensBody);
});

t('the fan tightens as a row gets longer, and stops before cards vanish', () => {
  eq(lapFor(1), LAP_MIN);
  eq(lapFor(13), LAP_MIN, 'a plain 13-card row should keep the original overlap');
  ok(lapFor(20) > lapFor(13), 'a longer row did not tighten');
  ok(lapFor(200) <= LAP_MAX, 'the overlap ran past its own limit');
  for (let n = 1; n <= 200; n++) {
    const l = lapFor(n);
    ok(l >= LAP_MIN && l <= LAP_MAX, `lapFor(${n}) = ${l}`);
  }
});

// ---------------------------------------------------------------- releasing
// A version that ships without release notes cannot be published: the release
// script and the workflow both refuse to tag one, so it silently never becomes
// a thing anyone can download. Catch that here instead of on release day.

t('the current version has a section in CHANGELOG.md', () => {
  const found = notesFor(VERSION);
  ok(found, `CHANGELOG.md has no section for ${VERSION} — add one before shipping it`);
  ok(found.body.length > 0, `the ${VERSION} section in CHANGELOG.md is empty`);
  ok(found.heading.startsWith(VERSION), `the ${VERSION} heading reads "${found.heading}"`);
});

t('the in-game changelog and CHANGELOG.md list the same versions', () => {
  const inGame = CHANGELOG.map((e) => e.version);
  const inFile = versionsInChangelog();
  for (const v of inGame) ok(inFile.includes(v), `${v} is in the game but not in CHANGELOG.md`);
  for (const v of inFile) ok(inGame.includes(v), `${v} is in CHANGELOG.md but not in the game`);
});

t('the in-game changelog leads with the version being run', () => {
  eq(CHANGELOG[0].version, VERSION, 'the newest changelog entry is not the current version');
});

t('release notes are matched on the whole version, not a prefix', () => {
  ok(!notesFor('v1.3'), 'v1.3 matched a section it should not have');
  ok(notesFor('v1.3.0'), 'v1.3.0 did not find its own section');
});

t('a version can be asked for with or without the leading v', () => {
  eq(notesFor('1.3.0').heading, notesFor('v1.3.0').heading);
});

console.log('');
console.log(`  ${pass} passing, ${fail} failing`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('  all green ✓');
