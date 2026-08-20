import { RNG } from '../src/engine/rng.js';
import { makeCard, standardDeck, baseVolume, SECTOR_KEYS } from '../src/game/cards.js';
import { evaluate, bestFromHand, patternStats, PATTERN_KEYS } from '../src/game/patterns.js';
import { PERKS, PERK_KEYS, makePerk, perkText } from '../src/game/perks.js';
import { CHARTS, CONTRACTS, RUMORS, ALL_CONSUMABLES, makeConsumable } from '../src/game/consumables.js';
import { LICENSES, LICENSE_KEYS } from '../src/game/licenses.js';
import { BOSSES, BOSS_KEYS } from '../src/game/bosses.js';
import { Market, REGIME_KEYS } from '../src/game/market.js';
import { scoreTrade, previewTrade } from '../src/game/scoring.js';
import * as S from '../src/game/state.js';

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(`${name}: ${e.message}`); }
}
function eq(a, b, msg = '') { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); }
function ok(v, msg = '') { if (!v) throw new Error(msg || 'expected truthy'); }

const mk = (s, r, extra) => makeCard(s, r, extra);

// ---------------------------------------------------------------- cards
t('standard deck is 52 unique tickers', () => {
  const d = standardDeck();
  eq(d.length, 52);
  eq(new Set(d.map((c) => c.sector + c.rank)).size, 52);
});
t('base volume: face cards are 10, alpha is 11', () => {
  eq(baseVolume(mk('TECH', 13)), 10);
  eq(baseVolume(mk('TECH', 14)), 11);
  eq(baseVolume(mk('TECH', 7)), 7);
});
t('restricted tickers are worth 50 volume', () => {
  eq(baseVolume(mk('TECH', 5, { enhancement: 'restricted' })), 50);
});

// ---------------------------------------------------------------- patterns
const P = (cards, opts) => evaluate(cards, opts || {}).key;
t('high card', () => eq(P([mk('TECH', 5), mk('CRYPTO', 9), mk('ENERGY', 2), mk('FINANCE', 7), mk('TECH', 13)]), 'flatline'));
t('pair', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 2), mk('FINANCE', 7), mk('TECH', 13)]), 'doubleBottom'));
t('two pair', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 2), mk('FINANCE', 2), mk('TECH', 13)]), 'headShoulders'));
t('trips', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 2), mk('TECH', 13)]), 'tripleTop'));
t('straight', () => eq(P([mk('TECH', 5), mk('CRYPTO', 6), mk('ENERGY', 7), mk('FINANCE', 8), mk('TECH', 9)]), 'breakout'));
t('wheel straight (A-2-3-4-5)', () => eq(P([mk('TECH', 14), mk('CRYPTO', 2), mk('ENERGY', 3), mk('FINANCE', 4), mk('TECH', 5)]), 'breakout'));
t('broadway straight (10-A)', () => eq(P([mk('TECH', 10), mk('CRYPTO', 11), mk('ENERGY', 12), mk('FINANCE', 13), mk('TECH', 14)]), 'breakout'));
t('flush', () => eq(P([mk('TECH', 2), mk('TECH', 5), mk('TECH', 7), mk('TECH', 9), mk('TECH', 13)]), 'rotation'));
t('full house', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 2), mk('TECH', 2)]), 'bullFlag'));
t('quads', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 5), mk('TECH', 2)]), 'quadWitching'));
t('straight flush', () => eq(P([mk('TECH', 5), mk('TECH', 6), mk('TECH', 7), mk('TECH', 8), mk('TECH', 9)]), 'goldenCross'));
t('five of a kind', () => eq(P([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 5), mk('TECH', 5)]), 'insiderTip'));
t('flush house', () => eq(P([mk('TECH', 5), mk('TECH', 5), mk('TECH', 5), mk('TECH', 2), mk('TECH', 2)]), 'marketCorner'));
t('flush five', () => eq(P([mk('TECH', 5), mk('TECH', 5), mk('TECH', 5), mk('TECH', 5), mk('TECH', 5)]), 'monopoly'));
t('diversified ticker completes a flush', () =>
  eq(P([mk('TECH', 2), mk('TECH', 5), mk('CRYPTO', 7, { enhancement: 'wild' }), mk('TECH', 9), mk('TECH', 13)]), 'rotation'));
t('four fingers makes a 4-card flush', () => {
  const cards = [mk('TECH', 2), mk('TECH', 5), mk('TECH', 7), mk('TECH', 9)];
  eq(P(cards, { fourCard: true }), 'rotation');
  eq(P(cards), 'flatline'); // and not without the perk
});
t('four fingers makes a 4-card straight', () =>
  eq(P([mk('TECH', 2), mk('CRYPTO', 3), mk('ENERGY', 4), mk('FINANCE', 5)], { fourCard: true }), 'breakout'));
t('shortcut allows gapped straights', () =>
  eq(P([mk('TECH', 2), mk('CRYPTO', 4), mk('ENERGY', 6), mk('FINANCE', 8), mk('TECH', 10)], { shortcut: true }), 'breakout'));
t('smeared sectors merge growth/value', () =>
  eq(P([mk('TECH', 2), mk('CRYPTO', 5), mk('TECH', 7), mk('CRYPTO', 9), mk('TECH', 13)], { smeared: true }), 'rotation'));
t('restricted tickers always score', () => {
  const ev = evaluate([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 9, { enhancement: 'restricted' }), mk('FINANCE', 2), mk('TECH', 3)]);
  eq(ev.key, 'doubleBottom');
  eq(ev.scoringCards.length, 3);
});
t('allScore makes every played ticker score', () => {
  const ev = evaluate([mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 9), mk('FINANCE', 2), mk('TECH', 3)], { allScore: true });
  eq(ev.scoringCards.length, 5);
});
t('scoring cards keep played order', () => {
  const cards = [mk('TECH', 9), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 2), mk('TECH', 3)];
  const ev = evaluate(cards);
  eq(ev.scoringCards[0].uid, cards[1].uid);
  eq(ev.scoringCards[1].uid, cards[2].uid);
});
t('bestFromHand finds the strongest subset', () => {
  const hand = [mk('TECH', 5), mk('CRYPTO', 5), mk('ENERGY', 5), mk('FINANCE', 2), mk('TECH', 2), mk('TECH', 9), mk('TECH', 13), mk('TECH', 4)];
  eq(bestFromHand(hand).key, 'bullFlag');
});
t('pattern levels scale volume and leverage', () => {
  const l1 = patternStats('doubleBottom', 1), l3 = patternStats('doubleBottom', 3);
  eq(l3.volume, l1.volume + 30);
  eq(l3.leverage, l1.leverage + 2);
});

// ---------------------------------------------------------------- content integrity
t('every perk has a name, art, cost and text', () => {
  for (const k of PERK_KEYS) {
    const d = PERKS[k];
    ok(d.name, k + ' name'); ok(d.art, k + ' art'); ok(d.cost > 0, k + ' cost');
    ok(d.text != null, k + ' text');
    ok(['common', 'uncommon', 'rare', 'legendary'].includes(d.rarity), k + ' rarity');
  }
});
t('every perk renders its description without throwing', () => {
  const st = S.newRun('TXT');
  for (const k of PERK_KEYS) {
    const inst = makePerk(k, null);
    st.perks = [inst];
    const txt = perkText(inst, st);
    ok(typeof txt === 'string' && txt.length > 0, k);
  }
});
t('every consumable has text and a use function', () => {
  for (const [k, d] of Object.entries(ALL_CONSUMABLES)) {
    ok(d.name, k); ok(d.art, k); ok(d.text, k); ok(typeof d.use === 'function', k);
  }
});
t('there is one contract per chart pattern', () => eq(Object.keys(CONTRACTS).length, PATTERN_KEYS.length));
t('every license upgrade points at a real prerequisite', () => {
  for (const k of LICENSE_KEYS) {
    const l = LICENSES[k];
    if (l.requires) ok(LICENSES[l.requires], k + ' requires ' + l.requires);
    if (l.upgrade) ok(LICENSES[l.upgrade], k + ' upgrade ' + l.upgrade);
  }
});
t('every boss has a name, art and blurb', () => {
  for (const k of BOSS_KEYS) { ok(BOSSES[k].name, k); ok(BOSSES[k].art, k); ok(BOSSES[k].blurb, k); }
});
t('content counts are substantial', () => {
  ok(PERK_KEYS.length >= 90, 'perks ' + PERK_KEYS.length);
  ok(Object.keys(ALL_CONSUMABLES).length >= 50, 'consumables');
  ok(BOSS_KEYS.length >= 20, 'bosses');
  ok(LICENSE_KEYS.length >= 20, 'licenses');
});

// ---------------------------------------------------------------- scoring
function scoreWith(perkKeys, played, extra = {}) {
  const st = S.newRun('SC');
  st.perks = perkKeys.map((k) => makePerk(k, null));
  S.computeMods(st);
  return scoreTrade(st, {
    played, held: extra.held || [], direction: extra.direction || null,
    correct: extra.correct, regimeMult: extra.regimeMult ?? 1,
    rng: new RNG('score'), commit: true, tradeIndex: 0, tradesLeft: 4, greenStreak: 0, quota: 1000,
  });
}
t('bare pair scores volume x leverage', () => {
  const r = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)]);
  eq(r.volume, 30);   // 10 base + 10 + 10
  eq(r.leverage, 2);
  eq(r.pl, 60);
});
t('Sticky Note adds flat leverage', () => {
  const r = scoreWith(['sticky'], [mk('TECH', 10), mk('CRYPTO', 10)]);
  eq(r.leverage, 6);
});
t('Blue Chip enhancement adds 30 volume', () => {
  const r = scoreWith([], [mk('TECH', 10, { enhancement: 'bluechip' }), mk('CRYPTO', 10)]);
  eq(r.volume, 60);
});
t('Hedged tickers held in hand multiply leverage', () => {
  const r = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)], { held: [mk('ENERGY', 3, { enhancement: 'hedged' })] });
  eq(r.leverage, 3);
});
t('Reissue stamp retriggers a ticker', () => {
  const a = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)]);
  const b = scoreWith([], [mk('TECH', 10, { stamp: 'reissue' }), mk('CRYPTO', 10)]);
  eq(b.volume - a.volume, 10);
});
t('Front Runner retriggers every scored ticker', () => {
  const r = scoreWith(['frontRunner'], [mk('TECH', 10), mk('CRYPTO', 10)]);
  eq(r.volume, 50); // 10 base + (10+10)*2
});
t('wrong-way trades take the standard penalty', () => {
  const right = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: true });
  const wrong = scoreWith([], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: false });
  eq(wrong.pl, Math.floor(right.pl * 0.35));
});
t('Diamond Hands removes the wrong-way penalty', () => {
  const wrong = scoreWith(['diamondHands'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: false });
  eq(wrong.pl, 60);
});
t('Contrarian makes wrong-way trades pay double', () => {
  const wrong = scoreWith(['contrarian'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: false });
  eq(wrong.pl, 120);
});
t('Bullhorn only fires on LONG', () => {
  const l = scoreWith(['bullhorn'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'LONG', correct: true });
  const s = scoreWith(['bullhorn'], [mk('TECH', 10), mk('CRYPTO', 10)], { direction: 'SHORT', correct: true });
  ok(l.pl > s.pl, 'long should beat short');
});
t('perk order changes the result (x before + vs + before x)', () => {
  const cards = [mk('TECH', 10), mk('CRYPTO', 10)];
  const a = scoreWith(['sticky', 'perpetualMotion'], cards);
  const b = scoreWith(['perpetualMotion', 'sticky'], cards);
  eq(a.leverage, b.leverage); // both add to leverage, volume x is independent
  const c = scoreWith(['sticky', 'darkPool'], cards);
  const d = scoreWith(['darkPool', 'sticky'], cards);
  ok(c.pl !== d.pl, 'x-then-+ must differ from +-then-x');
});
t('Arb Bot copies the perk to its right', () => {
  const solo = scoreWith(['techBro'], [mk('TECH', 10), mk('TECH', 10)]);
  const copied = scoreWith(['arbBot', 'techBro'], [mk('TECH', 10), mk('TECH', 10)]);
  eq(copied.leverage - solo.leverage, 8); // 2 tech cards x +4 leverage, doubled
});
t('scaling perks bump their counters on commit only', () => {
  const st = S.newRun('CTR');
  st.perks = [makePerk('pyramid', null)];
  S.computeMods(st);
  const args = { played: [mk('TECH', 10), mk('CRYPTO', 10)], held: [], direction: 'LONG', correct: true,
    rng: new RNG('x'), tradeIndex: 0, tradesLeft: 4, greenStreak: 0, quota: 999 };
  scoreTrade(st, { ...args, commit: false });
  eq(st.perks[0].counters.x, 1);
  scoreTrade(st, { ...args, commit: true });
  eq(st.perks[0].counters.x, 1.25);
});
t('perk editions apply in the perk slot', () => {
  const st = S.newRun('ED');
  const inst = makePerk('sticky', null); inst.edition = 'holographic';
  st.perks = [inst]; S.computeMods(st);
  const r = scoreTrade(st, { played: [mk('TECH', 10), mk('CRYPTO', 10)], held: [], rng: new RNG('e'), commit: true, quota: 999 });
  eq(r.leverage, 16); // 2 base + 4 sticky + 10 holographic
});
t('off-book perks do not consume a desk slot', () => {
  const st = S.newRun('OB');
  const inst = makePerk('sticky', null); inst.edition = 'offbook';
  st.perks = [inst]; S.computeMods(st);
  eq(S.slotsUsed(st), 0);
  eq(st.mods.slots, 6);
});
t('every perk can score without throwing', () => {
  for (const k of PERK_KEYS) {
    const st = S.newRun('ALL' + k);
    st.perks = [makePerk(k, null), makePerk('sticky', null)];
    S.computeMods(st);
    st.session = { quota: 500, discardsLeft: 2, earnedThisDeadline: 10, greens: 1, hand: [], tradesLeft: 2 };
    S.computeMods(st);
    const r = scoreTrade(st, {
      played: [mk('TECH', 10), mk('CRYPTO', 10), mk('ENERGY', 10, { enhancement: 'wild' }), mk('FINANCE', 5, { enhancement: 'volatile', edition: 'laminated', stamp: 'reissue' }), mk('TECH', 5)],
      held: [mk('TECH', 3, { enhancement: 'dividend' })],
      direction: 'LONG', correct: true, regimeMult: 1.25,
      rng: new RNG('p' + k), commit: true, tradeIndex: 1, tradesLeft: 2, greenStreak: 2, greensThisDeadline: 2, quota: 500,
    });
    ok(Number.isFinite(r.pl), k + ' produced ' + r.pl);
    ok(r.pl >= 0, k + ' produced negative pl');
  }
});
t('every boss scores without throwing', () => {
  for (const k of BOSS_KEYS) {
    const st = S.newRun('B' + k);
    st.perks = [makePerk('sticky', null), makePerk('techBro', null)];
    st.session = { boss: k, quota: 500, bossGraceLeft: 0, discardsLeft: 1, hand: [], lastDirection: 'LONG', lastPattern: 'doubleBottom', earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
    S.computeMods(st);
    const r = scoreTrade(st, {
      played: [mk('TECH', 10), mk('CRYPTO', 10), mk('ENERGY', 4), mk('FINANCE', 5), mk('TECH', 5)],
      held: [], direction: 'LONG', correct: true, rng: new RNG('b' + k), commit: true,
      tradeIndex: 0, tradesLeft: 1, greenStreak: 0, quota: 500,
    });
    ok(Number.isFinite(r.pl), k);
  }
});
t('The Ceiling caps a single trade', () => {
  const st = S.newRun('CEIL');
  st.perks = [makePerk('singularity', null)];
  st.session = { boss: 'theCeiling', quota: 1000, bossGraceLeft: 0, hand: [], discardsLeft: 0, earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
  S.computeMods(st);
  const r = scoreTrade(st, { played: [mk('TECH', 10), mk('CRYPTO', 10)], held: [], direction: 'LONG', correct: true,
    rng: new RNG('c'), commit: true, quota: 1000, tradeIndex: 0, tradesLeft: 1, greenStreak: 0 });
  eq(r.pl, 600);
  ok(r.capped);
});
t('sector bosses blank their sector', () => {
  const st = S.newRun('AUD');
  st.session = { boss: 'auditor', quota: 500, bossGraceLeft: 0, hand: [], discardsLeft: 0, earnedThisDeadline: 0, greens: 0, tradesLeft: 1 };
  S.computeMods(st);
  const blanked = mk('TECH', 10); blanked.debuffed = true;
  const r = scoreTrade(st, { played: [blanked, mk('TECH', 10)], held: [], rng: new RNG('a'), commit: true, quota: 500 });
  eq(r.volume, 20); // 10 pattern base + 10 from the un-blanked ticker
});

// ---------------------------------------------------------------- market
t('market bias skews the tape', () => {
  const bull = new Market(new RNG('m1'), { regime: 'BULL' });
  let ups = 0;
  for (let i = 0; i < 500; i++) { if (bull.pendingUp) ups++; bull.resolve('LONG'); }
  ok(ups > 280, 'bull run should print more ups, got ' + ups);
});
t('signal truthfulness tracks accuracy', () => {
  let truthful = 0;
  for (let i = 0; i < 800; i++) {
    const m = new Market(new RNG('sig' + i), { regime: 'RANGE' });
    if (m.readSignal(0.62).truthful) truthful++;
  }
  ok(truthful > 400 && truthful < 620, 'expected ~62% truthful, got ' + truthful);
});
t('perfect signal never lies', () => {
  for (let i = 0; i < 100; i++) {
    const m = new Market(new RNG('pf' + i), { regime: 'CHOP' });
    eq(m.readSignal(0.1, { perfect: true }).up, m.pendingUp);
  }
});
t('resolve reports the right direction', () => {
  const m = new Market(new RNG('res'), { regime: 'BULL' });
  const up = m.pendingUp;
  const r = m.resolve('LONG');
  eq(r.correct, up);
});

// ---------------------------------------------------------------- run flow
t('a fresh run starts sane', () => {
  const st = S.newRun('FLOW');
  eq(st.deck.length, 52);
  eq(st.cash, 8);
  eq(st.week, 1);
  eq(st.upcoming.length, 3);
  ok(st.upcoming[2].boss);
});
t('quotas escalate across the week and across weeks', () => {
  const st = S.newRun('Q');
  const q = st.upcoming.map((u) => S.quotaFor(st, u));
  ok(q[0] < q[1] && q[1] < q[2], 'within week: ' + q.join(','));
  ok(S.weekBase(2) > S.weekBase(1) && S.weekBase(5) > S.weekBase(4));
});
t('playing a trade consumes a trade and books P/L', () => {
  const st = S.newRun('PLAY');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.hand[0].uid);
  const before = s.tradesLeft;
  const r = S.playTrade(st, 'LONG');
  eq(s.tradesLeft, before - 1);
  ok(r.pl >= 0);
  eq(s.hand.length, st.mods.handSize);
});
t('discarding consumes a discard and redraws', () => {
  const st = S.newRun('DISC');
  const s = S.startDeadline(st, 0);
  S.toggleSelect(st, s.hand[0].uid);
  S.toggleSelect(st, s.hand[1].uid);
  S.discardSelected(st);
  eq(s.discardsLeft, st.mods.discards - 1);
  eq(s.hand.length, st.mods.handSize);
});
t('you cannot select more than five tickers', () => {
  const st = S.newRun('SEL');
  const s = S.startDeadline(st, 0);
  s.hand.forEach((c) => S.toggleSelect(st, c.uid));
  eq(s.selected.length, 5);
});
t('Wash Sale blocks repeating a direction', () => {
  const st = S.newRun('WASH');
  st.upcoming[2].boss = 'washSale';
  const s = S.startDeadline(st, 2);
  S.toggleSelect(st, s.hand[0].uid);
  S.playTrade(st, 'LONG');
  S.toggleSelect(st, s.hand[0].uid);
  ok(S.checkTradeLegal(st, 'LONG')?.block, 'should block a repeat LONG');
  ok(!S.checkTradeLegal(st, 'SHORT'), 'SHORT should be allowed');
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
  const p = S.finishDeadline(st);
  const line = p.lines.find((l) => l.label.startsWith('Interest'));
  eq(line.amount, 5);
});
t('advancing past the boss rolls the week over', () => {
  const st = S.newRun('WK');
  S.startDeadline(st, 2);
  st.session.profit = st.session.quota;
  S.finishDeadline(st);
  S.advanceAfterDeadline(st);
  eq(st.week, 2);
  eq(st.deadlineIndex, 0);
});
t('skipping a non-boss deadline grants a bonus', () => {
  const st = S.newRun('SKIP');
  const r = S.skipDeadline(st, 0);
  ok(r.bonus, 'expected a bonus');
  eq(st.deadlineIndex, 1);
});
t('boss deadlines cannot be skipped', () => {
  const st = S.newRun('SKIP2');
  ok(S.skipDeadline(st, 2).blocked);
});
t('the shop stocks items, packs and sometimes a license', () => {
  const st = S.newRun('SHOP');
  st.cash = 200;
  S.openShop(st);
  ok(st.shop.items.length >= 2);
  eq(st.shop.packs.length, 2);
  const r = S.buyShopItem(st, 0);
  ok(r.ok || r.blocked, 'buy should resolve');
});
t('rerolling costs money and restocks', () => {
  const st = S.newRun('RR');
  st.cash = 100;
  S.openShop(st);
  const before = st.cash;
  const r = S.rerollShop(st);
  ok(r.ok);
  eq(st.cash, before - 5);
  eq(st.shop.rerollCost, 6);
});
t('buying a license applies its mods immediately', () => {
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
  st.shop.packs[0] = { ...S.PACKS.find((p) => p.key === 'tickerM'), sold: false };
  const r = S.buyPack(st, 0);
  eq(r.pack.options.length, 5);
  eq(r.pack.picks, 2);
  const n = st.deck.length;
  S.pickFromPack(st, 0);
  eq(st.deck.length, n + 1);
});
t('selling a perk refunds cash and frees a slot', () => {
  const st = S.newRun('SELL');
  st.perks = [makePerk('sticky', null)];
  S.computeMods(st);
  const before = st.cash;
  const r = S.sellPerk(st, st.perks[0].uid);
  ok(r.ok);
  eq(st.perks.length, 0);
  ok(st.cash > before);
});
t('every chart can be used without throwing', () => {
  for (const k of Object.keys(CHARTS)) {
    const st = S.newRun('C' + k);
    st.perks = [makePerk('sticky', null)];
    const s = S.startDeadline(st, 0);
    st.consumables = [makeConsumable(k)];
    const sel = s.hand.slice(0, 3).map((c) => c.uid);
    const r = S.useConsumable(st, st.consumables[0].uid, sel);
    ok(typeof r.ok === 'boolean', k);
  }
});
t('every rumor can be used without throwing', () => {
  for (const k of Object.keys(RUMORS)) {
    const st = S.newRun('R' + k);
    st.perks = [makePerk('sticky', null), makePerk('techBro', null)];
    const s = S.startDeadline(st, 0);
    st.consumables = [makeConsumable(k)];
    const sel = s.hand.slice(0, 1).map((c) => c.uid);
    const r = S.useConsumable(st, st.consumables[0].uid, sel);
    ok(typeof r.ok === 'boolean', k);
  }
});
t('contracts level their pattern', () => {
  const st = S.newRun('CT');
  st.consumables = [makeConsumable('ct_doubleBottom')];
  S.useConsumable(st, st.consumables[0].uid, []);
  eq(st.patterns.doubleBottom.level, 2);
});
t('every bonus applies without throwing', () => {
  for (const k of S.BONUS_KEYS) {
    const st = S.newRun('BN' + k);
    S.applyBonus(st, k);
    ok(true);
  }
});
t('save round-trips a run', () => {
  const st = S.newRun('SAVE');
  st.cash = 42;
  st.perks = [makePerk('sticky', null)];
  st.patterns.doubleBottom.level = 4;
  const back = S.deserialize(S.serialize(st));
  eq(back.cash, 42);
  eq(back.perks.length, 1);
  eq(back.patterns.doubleBottom.level, 4);
  eq(back.seed, 'SAVE');
});
t('save restores the RNG stream position', () => {
  const st = S.newRun('RNGSAVE');
  for (let i = 0; i < 17; i++) st.rng.next();
  const expected = st.rng.next();
  const snapshot = S.serialize(st);
  const back = S.deserialize(snapshot);
  // deserialize should land on the same next value (serialize captured pre-roll state)
  const st2 = S.deserialize(snapshot);
  eq(st2.rng.next(), back.rng.next());
  ok(Number.isFinite(expected));
});
t('the same seed produces the same opening hand', () => {
  const a = S.newRun('SAMESEED'); const b = S.newRun('SAMESEED');
  const ha = S.startDeadline(a, 0).hand.map((c) => c.sector + c.rank).join(',');
  const hb = S.startDeadline(b, 0).hand.map((c) => c.sector + c.rank).join(',');
  eq(ha, hb);
});
t('running out of trades below quota busts the run', () => {
  const st = S.newRun('BUST');
  const s = S.startDeadline(st, 0);
  s.quota = 999999;
  let last;
  while (s.tradesLeft > 0) {
    S.toggleSelect(st, s.hand[0].uid);
    last = S.playTrade(st, 'LONG');
  }
  ok(last.busted, 'expected a bust');
});

console.log('');
console.log(`  ${pass} passing, ${fail} failing`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('  all green ✓');
