// The engine fuzzer: play thousands of runs with random — but legal — actions
// and check, after every single one, that the game is still in a state that
// makes sense. Where sim.mjs plays well to measure the difficulty curve, this
// plays badly, oddly and destructively to find what breaks.
//
//   node test/fuzz.mjs                 300 runs across every mode
//   node test/fuzz.mjs 2000            more
//   node test/fuzz.mjs 50 chaos        one mode
//   START=5000 node test/fuzz.mjs      a fresh range of seeds
//   SEED=chaos-17 node test/fuzz.mjs   replay one run, with its action log
//
// Modes:
//   natural  a fresh run, played half by the sim's bot and half at random
//   chaos    a desk seeded with random brokers, editions, licences, special
//            candles and Charts, then played at random
//   tourist  random play, but a deadline that is about to bust is forced
//            through — so the run reaches deep endless weeks and huge numbers
//
// Every few steps between deadlines the run is saved, the uid counter is reset
// the way a page reload resets it, and play continues from the loaded copy.
import { RNG } from '../src/engine/rng.js';
import { id, money, bignum } from '../src/engine/util.js';
import * as S from '../src/game/state.js';
import { bestFromBoard } from '../src/game/formations.js';
import { previewTrade } from '../src/game/scoring.js';
import { BROKERS, BROKER_KEYS, makeBroker, brokerText } from '../src/game/brokers.js';
import { ALL_CONSUMABLES, makeConsumable, consumableText } from '../src/game/consumables.js';
import { LICENSE_KEYS } from '../src/game/licenses.js';
import { ROLLABLE_ENHANCEMENTS, EDITIONS, STAMPS } from '../src/game/candles.js';

const MODES = ['natural', 'chaos', 'tourist'];

class Fail extends Error {}

function* combos(list, max) {
  const n = list.length;
  for (let k = 1; k <= Math.min(max, n); k++) {
    const idx = Array.from({ length: k }, (_, i) => i);
    for (;;) {
      yield idx.map((i) => list[i]);
      let i = k - 1;
      while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
  }
}

function fuzzRun(name, mode) {
  const r = new RNG('fuzz:' + name);
  let st = S.newRun('F' + name);
  const log = [];
  let step = 0;
  const act = (what) => { log.push(`${step++} w${st.week} ${what}`); if (log.length > 60) log.shift(); };
  const fail = (msg) => { const e = new Fail(msg); e.log = log; throw e; };

  // ------------------------------------------------------------ invariants
  const finite = (v, what) => { if (typeof v !== 'number' || Number.isNaN(v)) fail(`${what} is ${v}`); };
  const text = (s, what) => { if (/undefined|NaN|\[object/.test(String(s))) fail(`${what} renders as "${s}"`); };
  function check(where) {
    finite(st.cash, 'cash');
    if (st.cash < 0) fail(`cash went negative: ${st.cash} (${where})`);
    text(money(st.cash), 'cash');
    const uids = st.book.map((c) => c.uid);
    if (new Set(uids).size !== uids.length) {
      const dup = uids.find((u, i) => uids.indexOf(u) !== i);
      fail(`two candles in the book share uid ${dup} (${where})`);
    }
    for (const c of st.book) {
      if (!Number.isInteger(c.body) || c.body < 1) fail(`candle ${c.uid} has body ${c.body}`);
    }
    for (const [k, f] of Object.entries(st.formations)) {
      finite(f.level, `formation ${k} level`);
      if (f.level < 1) fail(`formation ${k} fell to level ${f.level}`);
    }
    for (const b of st.brokers) {
      if (!BROKERS[b.key]) fail(`unknown broker ${b.key}`);
      text(brokerText(b, st), `${b.key} text`);
    }
    for (const c of st.consumables) {
      if (!ALL_CONSUMABLES[c.key]) fail(`unknown consumable ${c.key}`);
      text(consumableText(ALL_CONSUMABLES[c.key], st), `${c.key} text`);
    }
    const s = st.session;
    if (s) {
      finite(s.profit, 'profit'); finite(s.quota, 'quota');
      text(money(s.quota), 'quota'); text(bignum(s.profit), 'profit');
      if (s.selected.length > 5) fail(`${s.selected.length} candles placed`);
      if (new Set(s.selected).size !== s.selected.length) fail('a candle is placed twice');
      for (const u of s.selected) if (!s.board.some((c) => c.uid === u)) fail(`placed candle ${u} is not on the board`);
      const inBook = new Set(st.book.map((c) => c.uid));
      for (const [list, name] of [[s.board, 'board'], [s.drawPile, 'deck'], [s.swept, 'swept']]) {
        for (const c of list) if (!inBook.has(c.uid)) fail(`a ${name} candle (${c.uid}) is not in the book (${where})`);
      }
      const places = [...s.board, ...s.drawPile].map((c) => c.uid);
      if (new Set(places).size !== places.length) fail(`a candle is in two places at once (${where})`);
      if (s.tradesLeft < 0 || s.discardsLeft < 0) fail(`trades ${s.tradesLeft} / sweeps ${s.discardsLeft}`);
      // A board can sit above the hand size — selling a +board broker mid-
      // deadline shrinks the next refill, not the cards already dealt — but it
      // can never hold more than the book does.
      if (s.board.length > st.book.length) fail(`board holds ${s.board.length} from a book of ${st.book.length}`);
      const loc = S.bookLocations(st);
      if (loc.deck.length + loc.board.length + loc.swept.length !== st.book.length) fail('book does not add up');
    }
    for (const u of st.upcoming || []) finite(S.quotaFor(st, u), 'upcoming quota');
  }

  // ------------------------------------------------------------ chaos setup
  if (mode === 'chaos') {
    st.permanent.slots = r.int(3, 8);
    st.permanent.chartSlots = r.int(1, 4);
    st.cash = r.int(0, 300);
    for (const k of r.shuffle(LICENSE_KEYS.slice()).slice(0, r.int(0, 6))) st.licenses.push(k);
    S.computeMods(st);
    const keys = r.shuffle(BROKER_KEYS.slice()).slice(0, r.int(1, st.mods.slots));
    for (const k of keys) {
      const b = makeBroker(k, r);
      if (r.chance(0.3)) b.edition = r.pick(Object.keys(EDITIONS));
      st.brokers.push(b);
    }
    for (const c of st.book) {
      if (r.chance(0.2)) c.enhancement = r.pick([...ROLLABLE_ENHANCEMENTS, 'obsidian']);
      if (r.chance(0.08)) c.edition = r.pick(Object.keys(EDITIONS).filter((e) => e !== 'offbook'));
      if (r.chance(0.08)) c.stamp = r.pick(Object.keys(STAMPS));
    }
    const cons = Object.keys(ALL_CONSUMABLES);
    for (let i = 0; i < st.mods.chartSlots; i++) if (r.chance(0.7)) st.consumables.push(makeConsumable(r.pick(cons)));
    S.computeMods(st);
    act('chaos desk: ' + st.brokers.map((b) => b.key).join(','));
  }

  // ------------------------------------------------------------ actions
  function useAConsumable(inBook) {
    if (!st.consumables.length) return;
    const inst = r.pick(st.consumables);
    const d = ALL_CONSUMABLES[inst.key];
    const [lo, hi] = d.select || [0, 0];
    const pool = inBook ? st.book : (st.session?.board || []);
    const n = Math.min(pool.length, r.int(lo, Math.max(lo, hi)));
    const pick = r.shuffle(pool.slice()).slice(0, n).map((c) => c.uid);
    act(`use ${inst.key} on ${n}`);
    const res = S.useConsumable(st, inst.uid, pick);
    text(res.msg ?? '', `${inst.key} message`);
  }

  function randomSelection() {
    const s = st.session;
    S.clearSelection(st);
    const n = r.int(1, Math.min(5, s.board.length));
    for (const c of r.shuffle(s.board.slice()).slice(0, n)) S.toggleSelect(st, c.uid);
  }

  function botSelection() {
    const s = st.session;
    const best = bestFromBoard(s.board, { fourCard: st.mods.fourCard, shortcut: st.mods.shortcut, smeared: st.mods.smeared, marchOfThree: st.mods.marchOfThree });
    S.clearSelection(st);
    for (const c of (best?.candles || s.board.slice(0, 1)).slice(0, 5)) S.toggleSelect(st, c.uid);
  }

  /** @returns 'cleared' | 'busted' | null */
  function tradeTurn() {
    const s = st.session;
    if (!s.board.length) {
      if (!S.deadEnd(st)) fail('an empty board with trades left is not reported as a dead end');
      return mode === 'tourist' ? (s.profit = s.quota, 'cleared') : 'busted';
    }
    const roll = r.next();
    if (roll < 0.06) useAConsumable(false);
    else if (roll < 0.09 && st.brokers.length) { act('sell broker'); S.sellBroker(st, r.pick(st.brokers).uid); }
    else if (roll < 0.11 && st.consumables.length) { act('sell chart'); S.sellConsumable(st, r.pick(st.consumables).uid); }
    check('after-misc');

    if (mode === 'natural' && r.chance(0.5)) botSelection(); else randomSelection();
    if (s.selected.length > 1 && r.chance(0.25)) { const m = r.pick(S.ARRANGE_MODES); act('arrange ' + m.key); S.arrangeSelection(st, m.key); }
    if (r.chance(0.15)) { act('move board candle'); S.moveBoardCandle(st, r.pick(s.board).uid, r.int(0, s.board.length - 1)); }
    if (s.selected.length > 1 && r.chance(0.15)) { act('move placement'); S.movePlacement(st, r.pick(s.selected), r.int(0, s.selected.length - 1)); }
    check('after-arrange');

    if (s.discardsLeft > 0 && r.chance(0.3)) {
      act(`sweep ${s.selected.length}`);
      const sw = S.sweepSelected(st);
      check('after-sweep');
      if (!s.board.length && !sw.deadEnd) fail('a sweep emptied the board without ending the deadline');
      if (sw.deadEnd) return mode === 'tourist' ? (s.profit = s.quota, 'cleared') : 'busted';
      randomSelection();
    }

    // Find a legal trade. If no selection and no direction is legal, the
    // player is soft-locked — which is a bug in its own right.
    let dir = r.chance(0.5) ? 'LONG' : 'SHORT';
    let legal = false;
    for (let tries = 0; tries < 12 && !legal; tries++) {
      if (!S.checkTradeLegal(st, dir)?.block) { legal = true; break; }
      dir = dir === 'LONG' ? 'SHORT' : 'LONG';
      if (!S.checkTradeLegal(st, dir)?.block) { legal = true; break; }
      if (tries > 6) { S.clearSelection(st); S.toggleSelect(st, s.board[tries % s.board.length].uid); }
      else randomSelection();
    }
    if (!legal) {
      // Random picks found nothing. Either the deadline really is dead — which
      // the game must say itself — or a legal trade exists and must be found.
      const why = S.deadEnd(st);
      if (why) { act('dead end: ' + why); return mode === 'tourist' ? (s.profit = s.quota, 'cleared') : 'busted'; }
      if (s.discardsLeft > 0) { act('sweep out of a blocked board'); randomSelection(); S.sweepSelected(st); check('after-sweep'); return null; }
      // deadEnd() promises a legal trade exists: find it the slow way.
      outer: for (const pick of combos(s.board, 5)) {
        S.clearSelection(st);
        for (const c of pick) S.toggleSelect(st, c.uid);
        for (const d of ['LONG', 'SHORT']) if (!S.checkTradeLegal(st, d)) { dir = d; legal = true; break outer; }
      }
      if (!legal) fail(`deadEnd() says there is a move, but no placement of a board of ${s.board.length} is legal (boss ${s.boss})`);
    }
    const played = S.selectedCandles(st);
    const held = s.board.filter((c) => !s.selected.includes(c.uid));
    const pv = previewTrade(st, played, held, new RNG('preview'), dir);
    if (pv && process.env.DEBUG && [pv.pl, pv.volume, pv.leverage].some((v) => Number.isNaN(v))) {
      console.log(JSON.stringify({ brokers: st.brokers.map((b) => [b.key, b.counters, b.edition]), boss: s.boss,
        played: played.map((c) => [c.body, c.sector, c.bull, c.enhancement, c.edition, c.stamp]),
        steps: pv.steps.map((x) => [x.kind, x.text, x.volume, x.leverage]) }, null, 1));
    }
    if (pv) { finite(pv.pl, 'preview P/L'); finite(pv.volume, 'preview volume'); finite(pv.leverage, 'preview leverage'); }
    // Now and then, save mid-deadline into a twin and play the same trade on
    // both. A save that loses or rerolls anything shows up as a different
    // result — a reload must be invisible.
    let twinRes = null;
    if (r.chance(0.15)) {
      const json = S.serialize(st);
      const twin = S.deserialize(json);
      const again = S.serialize(twin);
      if (again !== json) {
        const a = JSON.parse(json), b = JSON.parse(again);
        const keys = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        const sk = a.session && b.session ? Object.keys(a.session).filter((k) => JSON.stringify(a.session[k]) !== JSON.stringify(b.session[k])) : [];
        fail(`a mid-deadline save round trip changed: ${keys.join(', ')} ${sk.join(', ')}`);
      }
      if (!twin.session) fail('a mid-deadline save came back without its deadline');
      twinRes = S.playTrade(twin, dir);
    }
    act(`trade ${dir} with ${s.selected.length}`);
    const res = S.playTrade(st, dir);
    if (res.blocked) fail(`a trade judged legal was blocked: ${res.blocked}`);
    if (twinRes && (twinRes.pl !== res.pl || twinRes.correct !== res.correct || twinRes.formationKey !== res.formationKey)) {
      fail(`the same trade after a reload scored ${twinRes.pl} (${twinRes.correct}) instead of ${res.pl} (${res.correct})`);
    }
    finite(res.pl, 'trade P/L'); finite(res.volume, 'trade volume'); finite(res.leverage, 'trade leverage');
    for (const stp of res.steps || []) text(stp.text, 'scoring step');
    check('after-trade');
    if (res.cleared) return 'cleared';
    if (res.busted) {
      if (mode === 'tourist') { act('tourist forces the clear'); s.profit = s.quota; return 'cleared'; }
      return 'busted';
    }
    if (!s.board.length) fail('a trade emptied the board without ending the deadline');
    return null;
  }

  function shopTurn() {
    S.openShop(st);
    act('open shop');
    check('shop-open');
    for (let i = 0, n = r.int(0, 10); i < n; i++) {
      const shop = st.shop;
      const roll = r.next();
      if (roll < 0.35 && shop.items.length) { const k = r.int(0, shop.items.length - 1); act('buy item ' + shop.items[k].key); S.buyShopItem(st, k); }
      else if (roll < 0.45) { act('reroll'); S.rerollShop(st); }
      else if (roll < 0.52) { act('buy licence'); S.buyLicense(st); }
      else if (roll < 0.7 && shop.packs.length) {
        const k = r.int(0, shop.packs.length - 1);
        act('buy pack ' + shop.packs[k].family);
        if (S.buyPack(st, k).ok) {
          while (st.shop.pack && r.chance(0.85)) {
            const o = r.int(0, st.shop.pack.options.length - 1);
            act('pick from pack ' + o);
            S.pickFromPack(st, o);
            if (st.shop.pack && r.chance(0.2)) useAConsumable(true);
            check('in-pack');
          }
          if (st.shop.pack) { act('close pack'); S.closePack(st); }
        }
      }
      else if (roll < 0.8) useAConsumable(true);
      else if (roll < 0.85 && st.brokers.length) { act('sell broker'); S.sellBroker(st, r.pick(st.brokers).uid); }
      else if (roll < 0.9 && st.consumables.length) { act('sell chart'); S.sellConsumable(st, r.pick(st.consumables).uid); }
      else if (r.chance(0.5)) reload('on the Floor');
      check('shop');
    }
  }

  /** Save, forget every uid the way a fresh page load does, and carry on from the copy. */
  function reload(where) {
    const json = S.serialize(st);
    act('reload ' + where);
    id._n = 0;
    const back = S.deserialize(json);
    const again = S.serialize(back);
    const a = JSON.parse(json), b = JSON.parse(again);
    for (const k of ['cash', 'week', 'book', 'brokers', 'consumables', 'licenses', 'formations', 'stats', 'permanent']) {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) fail(`a save round trip changed ${k}`);
    }
    st = back;
    check('after-reload');
  }

  // ------------------------------------------------------------ the run
  const maxWeek = mode === 'tourist' ? 40 : 14;
  let deadlines = 0;
  while (st.week <= maxWeek && deadlines < 80) {
    S.normalizeProgress(st);
    const i = st.deadlineIndex;
    const slot = st.upcoming[i];
    if (!slot.boss && r.chance(0.12)) {
      act('skip deadline ' + i);
      S.skipDeadline(st, i);
      S.normalizeProgress(st);
      check('after-skip');
      continue;
    }
    act(`start deadline ${i}${slot.boss ? ' boss ' + slot.boss : ''}`);
    S.startDeadline(st, i);
    deadlines++;
    check('deadline-start');
    let outcome = null;
    for (let t = 0; t < 30 && !outcome; t++) outcome = tradeTurn();
    if (outcome !== 'cleared') return { name, mode, week: st.week, deadlines, steps: step };
    act('finish deadline');
    S.finishDeadline(st);
    if (st.session) fail('a finished deadline left its session behind');
    check('after-finish');
    if (r.chance(0.2)) {
      reload('at the payout');
      if (st.phase !== 'payout') fail(`a save at the payout came back in phase ${st.phase}`);
    }
    if (r.chance(0.3)) { S.openShop(st); reload('between deadline and Floor'); }
    shopTurn();
    S.advanceAfterDeadline(st);
    check('after-advance');
    if (r.chance(0.25)) reload('between deadlines');
  }
  return { name, mode, week: st.week, deadlines, steps: step };
}

// ---------------------------------------------------------------------------
const [nArg, modeArg] = process.argv.slice(2);
const only = process.env.SEED;
const runs = [];
if (only) runs.push(only);
else {
  const N = +(nArg || 300);
  const modes = modeArg ? [modeArg] : MODES;
  const start = +(process.env.START || 0);
  for (let i = start; i < start + N; i++) runs.push(`${modes[i % modes.length]}-${i}`);
}

const failures = new Map();
let deepest = 0, totalSteps = 0, done = 0;
for (const name of runs) {
  const mode = name.split('-')[0];
  try {
    const res = fuzzRun(name, mode);
    deepest = Math.max(deepest, res.week);
    totalSteps += res.steps;
    done++;
  } catch (e) {
    const key = e.message.replace(/\b(x[0-9a-z]+|\d+)\b/g, '#');
    if (!failures.has(key)) failures.set(key, { first: name, count: 0, message: e.message, log: e.log, stack: e.stack });
    failures.get(key).count++;
  }
}

console.log(`\n  ${done}/${runs.length} runs clean · ${totalSteps} actions · deepest week ${deepest}`);
for (const [, f] of failures) {
  console.log(`\n  ✗ ${f.message}\n    ${f.count}× — first in ${f.first} (replay: SEED=${f.first} node test/fuzz.mjs)`);
  if (only || process.env.LOG) console.log('    ' + (f.log || []).slice(-25).join('\n    '));
  if (only || process.env.STACK) console.log(f.stack);
}
process.exit(failures.size ? 1 : 0);
