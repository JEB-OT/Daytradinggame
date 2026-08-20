// Headless bot that plays whole runs, to sanity-check the difficulty curve.
import { RNG, randomSeedString } from '../src/engine/rng.js';
import * as S from '../src/game/state.js';
import { bestFromHand, PATTERNS } from '../src/game/patterns.js';
import { previewTrade } from '../src/game/scoring.js';
import { PERKS } from '../src/game/perks.js';
import { ALL_CONSUMABLES } from '../src/game/consumables.js';

function pickPlay(st) {
  const s = st.session;
  const opts = { fourCard: st.mods.fourCard, shortcut: st.mods.shortcut, smeared: st.mods.smeared };
  const best = bestFromHand(s.hand, opts);
  if (!best) return null;
  // Try the raw best plus a few greedy variants; keep the highest projected P/L.
  let bestScore = -1, bestSel = best.cards;
  const candidates = [best.cards];
  const byRank = s.hand.slice().sort((a, b) => b.rank - a.rank);
  candidates.push(byRank.slice(0, 5));
  candidates.push(byRank.slice(0, 1));
  for (const cand of candidates) {
    if (!cand.length) continue;
    const held = s.hand.filter((c) => !cand.includes(c));
    const pv = previewTrade(st, cand, held, new RNG('sim'));
    if (pv && pv.pl > bestScore) { bestScore = pv.pl; bestSel = cand; }
  }
  return { cards: bestSel, projected: bestScore };
}

function chooseDirection(st) {
  const s = st.session;
  if (st.mods.hideSignal) return s.market.regime.bias >= 0.5 ? 'LONG' : 'SHORT';
  const sig = s.market.readSignal(st.mods.accuracy, { perfect: st.mods.perfectSignal });
  const wantLong = sig.up;
  // Respect the Wash Sale boss.
  if (s.boss === 'washSale' && s.lastDirection) {
    return s.lastDirection === 'LONG' ? 'SHORT' : 'LONG';
  }
  return wantLong ? 'LONG' : 'SHORT';
}

function playDeadline(st, slotIndex) {
  S.startDeadline(st, slotIndex);
  const s = st.session;
  let guard = 0;
  while (guard++ < 40) {
    if (s.profit >= s.quota) return true;
    if (s.tradesLeft <= 0) return false;

    const pick = pickPlay(st);
    if (!pick) return false;

    // Chase a better pattern while there is still runway to do so.
    const needed = s.quota - s.profit;
    const expected = pick.projected * 0.8; // rough direction haircut
    const canFinish = expected * s.tradesLeft >= needed;
    const order = PATTERNS[bestFromHand(s.hand, {}).key].order;
    if (s.discardsLeft > 0 && s.tradesLeft > 1 && (!canFinish || order <= 1)) {
      const keep = new Set();
      // Keep whatever is already paired/suited, throw the rest.
      const counts = new Map();
      for (const c of s.hand) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
      const sectorCounts = new Map();
      for (const c of s.hand) sectorCounts.set(c.sector, (sectorCounts.get(c.sector) || 0) + 1);
      const topSector = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      for (const c of s.hand) {
        if (counts.get(c.rank) > 1) keep.add(c.uid);
        else if (topSector && topSector[1] >= 3 && c.sector === topSector[0]) keep.add(c.uid);
      }
      const junk = s.hand.filter((c) => !keep.has(c.uid)).slice(0, 5);
      if (junk.length >= 2) {
        s.selected = junk.map((c) => c.uid);
        S.discardSelected(st);
        continue;
      }
    }
    s.selected = pick.cards.map((c) => c.uid);
    let dir = chooseDirection(st);
    let legal = S.checkTradeLegal(st, dir);
    if (legal?.block) {
      dir = dir === 'LONG' ? 'SHORT' : 'LONG';
      legal = S.checkTradeLegal(st, dir);
      if (legal?.block) {
        // Pattern ban: play something else.
        const alt = s.hand.slice(0, 1);
        s.selected = alt.map((c) => c.uid);
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
  // Buy a license when we can comfortably afford it.
  if (shop.license && !shop.license.sold && st.cash >= 14) S.buyLicense(st);
  // Greedily buy perks, then consumables.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < shop.items.length; i++) {
      const it = shop.items[i];
      if (it.sold) continue;
      const price = S.itemPrice(st, it.cost);
      const keepReserve = 4;
      if (st.cash - price < keepReserve) continue;
      if (it.type === 'perk' && !S.hasPerkRoom(st)) {
        // Replace the cheapest perk if the new one is rarer.
        const rank = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
        const worst = st.perks.slice().sort((a, b) => rank[PERKS[a.key].rarity] - rank[PERKS[b.key].rarity])[0];
        if (worst && rank[PERKS[it.key].rarity] > rank[PERKS[worst.key].rarity]) S.sellPerk(st, worst.uid);
        else continue;
      }
      S.buyShopItem(st, i);
    }
  }
  // Buy one pack if flush.
  if (st.cash >= 12) {
    for (let i = 0; i < shop.packs.length; i++) {
      if (shop.packs[i].sold) continue;
      const r = S.buyPack(st, i);
      if (r.ok) {
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
  // Use any consumables that need no selection.
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
      const won = playDeadline(st, i);
      if (!won) {
        return { week: st.week, deadline: i, cleared: st.stats.deadlinesCleared, bosses: st.stats.bossesCleared,
          best: st.stats.bestPL, perks: st.perks.length, seed: st.seed };
      }
      S.finishDeadline(st);
      shopTurn(st);
      S.advanceAfterDeadline(st);
    }
    if (st.week > 9) break;
  }
  return { week: st.week, deadline: 3, cleared: st.stats.deadlinesCleared, bosses: st.stats.bossesCleared,
    best: st.stats.bestPL, perks: st.perks.length, won: true, seed: st.seed };
}

const N = +(process.argv[2] || 200);
const results = [];
for (let i = 0; i < N; i++) {
  try { results.push(simulate('SIM' + i)); }
  catch (e) { console.log('CRASH on SIM' + i + ':', e.message); if (process.env.STACK) console.log(e.stack); }
}
const hist = {};
for (const r of results) hist[r.week] = (hist[r.week] || 0) + 1;
const deaths = {};
for (const r of results) if (!r.won) { const k = `w${r.week}d${r.deadline + 1}`; deaths[k] = (deaths[k] || 0) + 1; }
console.log('\n  deaths by deadline: ' + Object.entries(deaths).sort().map(([k, v]) => `${k}:${v}`).join('  '));
const wins = results.filter((r) => r.won).length;
const avgDl = results.reduce((a, r) => a + r.cleared, 0) / results.length;

console.log(`\n  ${results.length}/${N} runs completed without crashing`);
console.log(`  reached week: ` + Object.keys(hist).sort((a, b) => a - b).map((w) => `w${w}:${hist[w]}`).join('  '));
console.log(`  avg deadlines cleared: ${avgDl.toFixed(1)}`);
console.log(`  full clears (week 9+): ${wins} (${(100 * wins / results.length).toFixed(0)}%)`);
console.log(`  median best trade: $${results.map(r=>r.best).sort((a,b)=>a-b)[Math.floor(results.length/2)]}`);
