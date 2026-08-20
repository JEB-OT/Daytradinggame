// Headless bot that plays whole runs, used to tune the difficulty curve.
import { RNG } from '../src/engine/rng.js';
import * as S from '../src/game/state.js';
import { bestFromBoard, FORMATIONS, convictionOf } from '../src/game/formations.js';
import { previewTrade } from '../src/game/scoring.js';
import { BROKERS } from '../src/game/brokers.js';
import { ALL_CONSUMABLES } from '../src/game/consumables.js';

const opts = (st) => ({
  fourCard: st.mods.fourCard, shortcut: st.mods.shortcut,
  smeared: st.mods.smeared, marchOfThree: st.mods.marchOfThree,
});

/** Try several placements and keep the best-projected one. */
function pickPlacement(st) {
  const s = st.session;
  const o = opts(st);
  const best = bestFromBoard(s.board, o);
  if (!best) return null;
  const byBody = s.board.slice().sort((a, b) => b.body - a.body);
  const candidates = [
    best.candles,
    best.candles.slice().sort((a, b) => a.body - b.body),
    best.candles.slice().sort((a, b) => b.body - a.body),
    byBody.slice(0, 5),
    byBody.slice(0, 1),
  ];
  let top = null;
  for (const cand of candidates) {
    if (!cand.length) continue;
    const held = s.board.filter((c) => !cand.includes(c));
    const pv = previewTrade(st, cand, held, new RNG('sim'));
    if (pv && (!top || pv.pl > top.pl)) top = { pl: pv.pl, candles: cand, scoring: pv.scoringCandles };
  }
  return top;
}

/** Expected value of each call, accounting for signal accuracy and conviction. */
function chooseDirection(st, scoring) {
  const s = st.session;
  const m = st.mods;
  const acc = m.perfectSignal ? 1 : Math.min(1, Math.max(0.05, m.accuracy + (s.market.regime.accuracy || 0)));
  let signalUp = null;
  if (!m.hideSignal) signalUp = s.market.readSignal(m.accuracy, { perfect: m.perfectSignal }).up;

  const ev = (dir) => {
    const conv = m.noConviction ? 1 : convictionOf(scoring, dir, m).mult;
    let pCorrect;
    if (signalUp === null) pCorrect = dir === 'LONG' ? s.market.regime.bias : 1 - s.market.regime.bias;
    else pCorrect = (dir === 'LONG') === signalUp ? acc : 1 - acc;
    const win = s.market.directionMult(dir);
    return conv * (pCorrect * win + (1 - pCorrect) * m.redMult);
  };

  let best = ev('LONG') >= ev('SHORT') ? 'LONG' : 'SHORT';
  if (s.boss === 'washSale' && s.lastDirection) best = s.lastDirection === 'LONG' ? 'SHORT' : 'LONG';
  return best;
}

function playDeadline(st, slotIndex) {
  S.startDeadline(st, slotIndex);
  const s = st.session;
  let guard = 0;
  while (guard++ < 40) {
    if (s.profit >= s.quota) return true;
    if (s.tradesLeft <= 0) return false;

    const pick = pickPlacement(st);
    if (!pick) return false;

    const needed = s.quota - s.profit;
    const canFinish = pick.pl * 0.9 * s.tradesLeft >= needed;
    const order = FORMATIONS[bestFromBoard(s.board, opts(st)).key].order;
    if (s.discardsLeft > 0 && s.tradesLeft > 1 && (!canFinish || order <= 1)) {
      const keep = new Set();
      const counts = new Map();
      for (const c of s.board) counts.set(c.body, (counts.get(c.body) || 0) + 1);
      const sectors = new Map();
      for (const c of s.board) sectors.set(c.sector, (sectors.get(c.sector) || 0) + 1);
      const topSector = [...sectors.entries()].sort((a, b) => b[1] - a[1])[0];
      for (const c of s.board) {
        if (counts.get(c.body) > 1) keep.add(c.uid);
        else if (topSector && topSector[1] >= 3 && c.sector === topSector[0]) keep.add(c.uid);
      }
      for (const c of pick.candles) keep.add(c.uid);
      const junk = s.board.filter((c) => !keep.has(c.uid)).slice(0, 5);
      if (junk.length >= 2) { s.selected = junk.map((c) => c.uid); S.sweepSelected(st); continue; }
    }

    s.selected = pick.candles.map((c) => c.uid);
    let dir = chooseDirection(st, pick.scoring || pick.candles);
    if (S.checkTradeLegal(st, dir)?.block) {
      dir = dir === 'LONG' ? 'SHORT' : 'LONG';
      if (S.checkTradeLegal(st, dir)?.block) {
        s.selected = s.board.slice(0, 1).map((c) => c.uid);
        if (S.checkTradeLegal(st, dir)?.block) return false;
      }
    }
    const r = S.playTrade(st, dir);
    if (r.blocked) return false;
    if (r.cleared) return true;
    if (r.busted) return false;
  }
  return false;
}

function shopTurn(st) {
  S.openShop(st);
  const shop = st.shop;
  if (shop.license && !shop.license.sold && st.cash >= 14) S.buyLicense(st);
  const rank = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < shop.items.length; i++) {
      const it = shop.items[i];
      if (it.sold) continue;
      const price = S.itemPrice(st, it.cost);
      if (st.cash - price < 4) continue;
      if (it.type === 'broker' && !S.hasBrokerRoom(st)) {
        const worst = st.brokers.slice().sort((a, b) => rank[BROKERS[a.key].rarity] - rank[BROKERS[b.key].rarity])[0];
        if (worst && rank[BROKERS[it.key].rarity] > rank[BROKERS[worst.key].rarity]) S.sellBroker(st, worst.uid);
        else continue;
      }
      S.buyShopItem(st, i);
    }
  }
  if (st.cash >= 12) {
    for (let i = 0; i < shop.packs.length; i++) {
      if (shop.packs[i].sold) continue;
      if (S.buyPack(st, i).ok) {
        while (st.shop.pack) {
          let took = false;
          for (let o = 0; o < st.shop.pack.options.length; o++) {
            if (st.shop.pack.options[o].taken) continue;
            if (S.pickFromPack(st, o).ok) { took = true; break; }
          }
          if (!took) { S.closePack(st); break; }
        }
      }
      break;
    }
  }
  for (const c of [...st.consumables]) {
    const d = ALL_CONSUMABLES[c.key];
    if (d.select && d.select[1] === 0) S.useConsumable(st, c.uid, []);
  }
  st.shop = null;
}

export function simulate(seed) {
  const st = S.newRun(seed);
  let guard = 0;
  while (guard++ < 200) {
    for (let i = 0; i < 3; i++) {
      st.deadlineIndex = i;
      if (!playDeadline(st, i)) {
        return { week: st.week, deadline: i, cleared: st.stats.deadlinesCleared, bosses: st.stats.bossesCleared,
          best: st.stats.bestPL, marches: st.stats.marches, seed: st.seed };
      }
      S.finishDeadline(st);
      shopTurn(st);
      S.advanceAfterDeadline(st);
    }
    if (st.week > 9) break;
  }
  return { week: st.week, deadline: 3, cleared: st.stats.deadlinesCleared, bosses: st.stats.bossesCleared,
    best: st.stats.bestPL, marches: st.stats.marches, won: true, seed: st.seed };
}

const N = +(process.argv[2] || 200);
const results = [];
for (let i = 0; i < N; i++) {
  try { results.push(simulate('SIM' + i)); }
  catch (e) { console.log('CRASH on SIM' + i + ':', e.message); if (process.env.STACK) console.log(e.stack); }
}
const hist = {}, deaths = {};
for (const r of results) {
  hist[r.week] = (hist[r.week] || 0) + 1;
  if (!r.won) { const k = `w${r.week}d${r.deadline + 1}`; deaths[k] = (deaths[k] || 0) + 1; }
}
const wins = results.filter((r) => r.won).length;
const avgDl = results.reduce((a, r) => a + r.cleared, 0) / results.length;
const avgMarch = results.reduce((a, r) => a + r.marches, 0) / results.length;

console.log('\n  deaths by deadline: ' + Object.entries(deaths).sort().map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`\n  ${results.length}/${N} runs completed without crashing`);
console.log('  reached week: ' + Object.keys(hist).sort((a, b) => a - b).map((w) => `w${w}:${hist[w]}`).join('  '));
console.log(`  avg deadlines cleared: ${avgDl.toFixed(1)} · avg marches printed: ${avgMarch.toFixed(1)}`);
console.log(`  full clears (week 9+): ${wins} (${(100 * wins / results.length).toFixed(0)}%)`);
console.log(`  median best trade: $${results.map((r) => r.best).sort((a, b) => a - b)[Math.floor(results.length / 2)]}`);
