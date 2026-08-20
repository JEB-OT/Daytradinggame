import { isFace, SECTORS } from './cards.js';

// ---------------------------------------------------------------------------
// PERKS — the desk. These are the combo engines (Balatro's Jokers).
//
// Hook reference (all optional):
//   cardScored(ctx, card, p)     when a played ticker scores
//   cardHeld(ctx, card, p)       for each ticker still in hand
//   independent(ctx, p)          after all cards, in desk order
//   direction(ctx, p)            after LONG/SHORT resolves (ctx.correct is set)
//   retriggerScored(ctx, card,p) -> extra trigger count
//   retriggerHeld(ctx, card, p)  -> extra trigger count
//   tradeEnd(state, res, p)      after a trade fully resolves
//   discarded(state, cards, p)   when the player discards
//   deadlineStart(state, p)      / deadlineEnd(state, p)
//   payout(state, p) -> $        extra cash on clearing a deadline
//   shop(state, p)               when the Floor opens
//   mods                         static run modifiers
// ---------------------------------------------------------------------------

export const RARITY = {
  common:    { key: 'common',    name: 'Common',    color: '#6ab7ff', weight: 70 },
  uncommon:  { key: 'uncommon',  name: 'Uncommon',  color: '#43e08a', weight: 25 },
  rare:      { key: 'rare',      name: 'Rare',      color: '#ff5cf0', weight: 5  },
  legendary: { key: 'legendary', name: 'Legendary', color: '#ffd94a', weight: 0  },
};

const def = (o) => ({ rarity: 'common', cost: 5, counters: {}, ...o });
const countScored = (ctx, fn) => ctx.scoring.filter(fn).length;

export const PERKS = {};
function add(list) { for (const d of list) PERKS[d.key] = def(d); }

// --- COMMON: flat and pattern-conditional -----------------------------------
add([
  { key: 'sticky', name: 'Sticky Note', cost: 4, art: '📝',
    text: '+4 Leverage',
    independent: (ctx, p) => ctx.addLeverage(4, p) },

  { key: 'tickertape', name: 'Ticker Tape', cost: 4, art: '🧾',
    text: '+40 Volume',
    independent: (ctx, p) => ctx.addVolume(40, p) },

  { key: 'deskFan', name: 'Desk Fan', cost: 4, art: '🌀',
    text: '+4 Leverage if the trade contains a Double Bottom',
    independent: (ctx, p) => { if (ctx.contains('doubleBottom')) ctx.addLeverage(4, p); } },

  { key: 'hoodie', name: 'Lucky Hoodie', cost: 4, art: '🧥',
    text: '+5 Leverage if the trade contains a Head & Shoulders',
    independent: (ctx, p) => { if (ctx.contains('headShoulders')) ctx.addLeverage(5, p); } },

  { key: 'energyDrink', name: 'Energy Drink', cost: 4, art: '🥤',
    text: '+6 Leverage if the trade contains a Triple Top',
    independent: (ctx, p) => { if (ctx.contains('tripleTop')) ctx.addLeverage(6, p); } },

  { key: 'charting101', name: 'Charting 101', cost: 4, art: '📐',
    text: '+5 Leverage if the trade contains a Breakout Rally',
    independent: (ctx, p) => { if (ctx.contains('breakout')) ctx.addLeverage(5, p); } },

  { key: 'sectorMap', name: 'Sector Map', cost: 4, art: '🗺️',
    text: '+5 Leverage if the trade contains a Sector Rotation',
    independent: (ctx, p) => { if (ctx.contains('rotation')) ctx.addLeverage(5, p); } },

  { key: 'fullPort', name: 'Full Port', cost: 4, art: '💼',
    text: '+5 Leverage if the trade contains a Bull Flag',
    independent: (ctx, p) => { if (ctx.contains('bullFlag')) ctx.addLeverage(5, p); } },

  { key: 'roundLot', name: 'Round Lot', cost: 4, art: '📦',
    text: '+80 Volume if you played exactly 5 tickers',
    independent: (ctx, p) => { if (ctx.played.length === 5) ctx.addVolume(80, p); } },

  { key: 'scalper', name: 'Scalper', cost: 5, art: '🔪',
    text: '+9 Leverage if you played exactly 1 ticker',
    independent: (ctx, p) => { if (ctx.played.length === 1) ctx.addLeverage(9, p); } },

  { key: 'pairsTrade', name: 'Pairs Trade', cost: 5, art: '⚖️',
    text: '+6 Leverage if you played exactly 2 tickers',
    independent: (ctx, p) => { if (ctx.played.length === 2) ctx.addLeverage(6, p); } },
]);

// --- COMMON: per-card sector / rank scalers ---------------------------------
add([
  { key: 'techBro', name: 'Tech Bro', cost: 5, art: '🕶️',
    text: 'Each scored Tech ▲ ticker gives +4 Leverage',
    cardScored: (ctx, c, p) => { if (ctx.isSector(c, 'TECH')) ctx.addLeverage(4, p, c); } },

  { key: 'oilBaron', name: 'Oil Baron', cost: 5, art: '🛢️',
    text: 'Each scored Energy ⚡ ticker gives +35 Volume',
    cardScored: (ctx, c, p) => { if (ctx.isSector(c, 'ENERGY')) ctx.addVolume(35, p, c); } },

  { key: 'bankTeller', name: 'Bank Teller', cost: 5, art: '🏦',
    text: 'Each scored Finance ● ticker gives +2 Leverage and $1',
    cardScored: (ctx, c, p) => { if (ctx.isSector(c, 'FINANCE')) { ctx.addLeverage(2, p, c); ctx.earn(1, p); } } },

  { key: 'degenTrader', name: 'Degenerate', cost: 5, art: '🎲',
    text: 'Each scored Crypto ◆ ticker gives +5 Leverage',
    cardScored: (ctx, c, p) => { if (ctx.isSector(c, 'CRYPTO')) ctx.addLeverage(5, p, c); } },

  { key: 'evenSplit', name: 'Even Split', cost: 5, art: '➗',
    text: 'Each scored even-rank ticker gives +30 Volume and +3 Leverage',
    cardScored: (ctx, c, p) => { if (ctx.hasRank(c) && c.rank % 2 === 0 && c.rank <= 10) { ctx.addVolume(30, p, c); ctx.addLeverage(3, p, c); } } },

  { key: 'oddLot', name: 'Odd Lot', cost: 5, art: '🔢',
    text: 'Each scored odd-rank ticker (A,9,7,5,3) gives +30 Volume and +3 Leverage',
    cardScored: (ctx, c, p) => { if (ctx.hasRank(c) && (c.rank === 14 || (c.rank % 2 === 1 && c.rank <= 9))) { ctx.addVolume(30, p, c); ctx.addLeverage(3, p, c); } } },

  { key: 'faceValue', name: 'Face Value', cost: 5, art: '👔',
    text: 'Each scored face ticker (J/Q/K) gives +40 Volume',
    cardScored: (ctx, c, p) => { if (ctx.isFace(c)) ctx.addVolume(40, p, c); } },

  { key: 'alphaSeeker', name: 'Alpha Seeker', cost: 6, rarity: 'uncommon', art: '🅰️',
    text: 'Each scored Alpha (A) gives +25 Volume and +4 Leverage',
    cardScored: (ctx, c, p) => { if (c.rank === 14 && ctx.hasRank(c)) { ctx.addVolume(25, p, c); ctx.addLeverage(4, p, c); } } },

  { key: 'pennyJar', name: 'Penny Jar', cost: 5, art: '🪙',
    text: 'Each scored 2, 3 or 4 gives +6 Leverage',
    cardScored: (ctx, c, p) => { if (ctx.hasRank(c) && c.rank <= 4) ctx.addLeverage(6, p, c); } },

  { key: 'growthFund', name: 'Growth Fund', cost: 6, rarity: 'uncommon', art: '🌱',
    text: 'x1.4 Leverage if every scored ticker is Growth (Tech ▲ / Crypto ◆)',
    independent: (ctx, p) => { if (ctx.scoring.length && ctx.scoring.every((c) => SECTORS[c.sector]?.group === 'GROWTH')) ctx.xLeverage(1.4, p); } },

  { key: 'valueFund', name: 'Value Fund', cost: 6, rarity: 'uncommon', art: '🏛️',
    text: 'x1.4 Leverage if every scored ticker is Value (Energy ⚡ / Finance ●)',
    independent: (ctx, p) => { if (ctx.scoring.length && ctx.scoring.every((c) => SECTORS[c.sector]?.group === 'VALUE')) ctx.xLeverage(1.4, p); } },
]);

// --- UNCOMMON: direction, streaks, risk -------------------------------------
add([
  { key: 'momentum', name: 'Momentum Algo', cost: 6, rarity: 'uncommon', art: '📈',
    text: (p, s) => `+3 Leverage per consecutive GREEN trade (currently ${s?.session?.greenStreak ?? 0})`,
    independent: (ctx, p) => { if (ctx.greenStreak > 0) ctx.addLeverage(3 * ctx.greenStreak, p); } },

  { key: 'contrarian', name: 'Contrarian', cost: 7, rarity: 'uncommon', art: '🙃',
    text: 'RED trades keep x2 of their P/L instead of the usual penalty',
    redMult: 2 },

  { key: 'diamondHands', name: 'Diamond Hands', cost: 8, rarity: 'rare', art: '💎',
    text: 'RED trades pay in full — no wrong-way penalty',
    redMult: 1 },

  { key: 'hedgeFund', name: 'Hedge Fund', cost: 7, rarity: 'uncommon', art: '🩳',
    text: 'x1.6 Leverage on SHORT trades',
    direction: (ctx, p) => { if (ctx.direction === 'SHORT') ctx.xLeverage(1.6, p); } },

  { key: 'bullhorn', name: 'Bullhorn', cost: 7, rarity: 'uncommon', art: '📣',
    text: 'x1.6 Leverage on LONG trades',
    direction: (ctx, p) => { if (ctx.direction === 'LONG') ctx.xLeverage(1.6, p); } },

  { key: 'burnerPhone', name: 'Burner Phone', cost: 8, rarity: 'uncommon', art: '📞',
    text: 'The signal never lies',
    mods: { perfectSignal: true } },

  { key: 'bloomberg', name: 'Bloomberg Terminal', cost: 7, rarity: 'uncommon', art: '🖥️',
    text: '+20% signal accuracy',
    mods: { accuracy: 0.20 } },

  { key: 'stopLoss', name: 'Stop Loss', cost: 7, rarity: 'uncommon', art: '🛑',
    text: 'The first RED trade of each deadline is treated as GREEN',
    saveRed: true },

  { key: 'pyramid', name: 'Pyramid Scheme', cost: 8, rarity: 'uncommon', art: '🔺',
    counters: { x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. Gains x0.25 on each GREEN trade`,
    direction: (ctx, p) => { ctx.xLeverage(p.counters.x, p); if (ctx.commit && ctx.correct) p.counters.x = +(p.counters.x + 0.25).toFixed(2); } },

  { key: 'volSurface', name: 'Vol Surface', cost: 8, rarity: 'uncommon', art: '🌊',
    counters: { x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. Gains x0.35 on each RED trade`,
    direction: (ctx, p) => { ctx.xLeverage(p.counters.x, p); if (ctx.commit && !ctx.correct) p.counters.x = +(p.counters.x + 0.35).toFixed(2); } },

  { key: 'blackSwan', name: 'Black Swan', cost: 9, rarity: 'rare', art: '🦢',
    counters: { n: 0 },
    text: (p) => `x${(1 + 0.5 * p.counters.n).toFixed(2)} Leverage — x0.5 per RED trade this run (${p.counters.n})`,
    independent: (ctx, p) => ctx.xLeverage(1 + 0.5 * p.counters.n, p),
    tradeEnd: (state, res, p) => { if (!res.correct) p.counters.n++; } },

  { key: 'theTape', name: 'Reading the Tape', cost: 7, rarity: 'uncommon', art: '🎞️',
    text: (p, s) => `+60 Volume per consecutive GREEN trade (currently ${s?.session?.greenStreak ?? 0})`,
    independent: (ctx, p) => { if (ctx.greenStreak > 0) ctx.addVolume(60 * ctx.greenStreak, p); } },

  { key: 'firstMover', name: 'First Mover', cost: 7, rarity: 'uncommon', art: '🥇',
    text: 'x2.5 Leverage on the first trade of a deadline',
    independent: (ctx, p) => { if (ctx.tradeIndex === 0) ctx.xLeverage(2.5, p); } },

  { key: 'deadlineDread', name: 'Deadline Dread', cost: 8, rarity: 'uncommon', art: '⏳',
    text: 'x3 Leverage on your final available trade',
    independent: (ctx, p) => { if (ctx.tradesLeft <= 1) ctx.xLeverage(3, p); } },

  { key: 'quantumDesk', name: 'Quantum Desk', cost: 10, rarity: 'rare', art: '🧪',
    text: 'Every trade resolves GREEN, but x0.45 Leverage',
    mods: { alwaysGreen: true },
    independent: (ctx, p) => ctx.xLeverage(0.45, p) },
]);

// --- UNCOMMON/RARE: retriggers and card-layer synergies ---------------------
add([
  { key: 'blueSuit', name: 'Blue Suit', cost: 7, rarity: 'uncommon', art: '🤵',
    text: 'Retrigger every scored face ticker',
    retriggerScored: (ctx, c) => (ctx.isFace(c) ? 1 : 0) },

  { key: 'caffeinated', name: 'Caffeinated', cost: 6, rarity: 'uncommon', art: '☕',
    text: 'Retrigger the first scored ticker',
    retriggerScored: (ctx, c) => (ctx.scoring[0] === c ? 1 : 0) },

  { key: 'hftRack', name: 'HFT Rack', cost: 8, rarity: 'uncommon', art: '🗄️',
    text: 'Retrigger every scored ticker of rank 5 or lower',
    retriggerScored: (ctx, c) => (ctx.hasRank(c) && c.rank <= 5 ? 1 : 0) },

  { key: 'stampCollector', name: 'Stamp Collector', cost: 8, rarity: 'uncommon', art: '📮',
    text: 'Retrigger every scored ticker that carries a stamp',
    retriggerScored: (ctx, c) => (c.stamp ? 1 : 0) },

  { key: 'frontRunner', name: 'Front Runner', cost: 10, rarity: 'rare', art: '🏃',
    text: 'Retrigger all scored tickers one extra time',
    retriggerScored: () => 1 },

  { key: 'flashBoy', name: 'Flash Boy', cost: 9, rarity: 'rare', art: '⚡',
    text: 'Retrigger every ticker held in hand twice',
    retriggerHeld: () => 2 },

  { key: 'laminator', name: 'Laminator', cost: 7, rarity: 'uncommon', art: '📔',
    text: 'Each scored ticker with an edition gives +5 Leverage',
    cardScored: (ctx, c, p) => { if (c.edition) ctx.addLeverage(5, p, c); } },

  { key: 'algoDesk', name: 'Algo Desk', cost: 8, rarity: 'uncommon', art: '🤖',
    text: 'x1.5 Leverage for each scored Diversified ticker',
    cardScored: (ctx, c, p) => { if (c.enhancement === 'wild' && !c.debuffed) ctx.xLeverage(1.5, p, c); } },

  { key: 'volDesk', name: 'Vol Desk', cost: 9, rarity: 'rare', art: '💥',
    text: 'x2 Leverage for each scored Volatile ticker',
    cardScored: (ctx, c, p) => { if (c.enhancement === 'volatile' && !c.debuffed) ctx.xLeverage(2, p, c); } },

  { key: 'ladder', name: 'Ladder Orders', cost: 6, rarity: 'uncommon', art: '🪜',
    text: '+2 Leverage for each ticker left in your hand',
    independent: (ctx, p) => { if (ctx.held.length) ctx.addLeverage(2 * ctx.held.length, p); } },

  { key: 'bagholder', name: 'Bagholder', cost: 6, rarity: 'uncommon', art: '🎒',
    text: '+55 Volume for each played ticker that did NOT score',
    independent: (ctx, p) => { if (ctx.unscored.length) ctx.addVolume(55 * ctx.unscored.length, p); } },

  { key: 'divTrap', name: 'Dividend Trap', cost: 6, rarity: 'uncommon', art: '💵',
    text: '$2 for each ticker held in hand when the trade resolves',
    cardHeld: (ctx, c, p) => ctx.earn(2, p) },

  { key: 'synthetic', name: 'Synthetic Position', cost: 9, rarity: 'rare', art: '🧬',
    text: 'Tech ▲ / Crypto ◆ count as one sector, and Energy ⚡ / Finance ● count as one',
    mods: { smeared: true } },
]);

// --- RARE / build-defining --------------------------------------------------
add([
  { key: 'theWhale', name: 'The Whale', cost: 10, rarity: 'rare', art: '🐋',
    text: 'x4 Leverage if you played 5 tickers and all 5 scored',
    independent: (ctx, p) => { if (ctx.played.length === 5 && ctx.unscored.length === 0) ctx.xLeverage(4, p); } },

  { key: 'darkPool', name: 'Dark Pool', cost: 9, rarity: 'rare', art: '🕳️',
    text: 'x3 Leverage if you played 3 or fewer tickers',
    independent: (ctx, p) => { if (ctx.played.length <= 3) ctx.xLeverage(3, p); } },

  { key: 'rotationDesk', name: 'Rotation Desk', cost: 9, rarity: 'rare', art: '🔄',
    text: 'x2.5 Leverage if the scored tickers cover all four sectors',
    independent: (ctx, p) => {
      const s = new Set(ctx.scoring.filter((c) => ctx.hasRank(c)).map((c) => c.sector));
      if (s.size >= 4) ctx.xLeverage(2.5, p);
    } },

  { key: 'monoDesk', name: 'Mono Desk', cost: 8, rarity: 'rare', art: '🎯',
    text: 'x2.2 Leverage if every scored ticker shares one sector',
    independent: (ctx, p) => {
      const cards = ctx.scoring.filter((c) => ctx.hasRank(c));
      if (cards.length >= 2 && new Set(cards.map((c) => c.sector)).size === 1) ctx.xLeverage(2.2, p);
    } },

  { key: 'muddyWaters', name: 'Muddy Waters', cost: 9, rarity: 'rare', art: '🐻',
    text: 'SHORT trades x2.2 Leverage. LONG trades x0.8 Leverage',
    direction: (ctx, p) => ctx.xLeverage(ctx.direction === 'SHORT' ? 2.2 : 0.8, p) },

  { key: 'perma', name: 'Permabull', cost: 9, rarity: 'rare', art: '🐂',
    text: 'LONG trades x2.2 Leverage. SHORT trades x0.8 Leverage',
    direction: (ctx, p) => ctx.xLeverage(ctx.direction === 'LONG' ? 2.2 : 0.8, p) },

  { key: 'theOracle', name: 'The Oracle', cost: 10, rarity: 'rare', art: '🔮',
    text: 'Signal never lies. +x0.4 Leverage per GREEN trade this deadline',
    mods: { perfectSignal: true },
    independent: (ctx, p) => ctx.xLeverage(1 + 0.4 * ctx.greensThisDeadline, p) },

  { key: 'arbBot', name: 'Arb Bot', cost: 9, rarity: 'rare', art: '🧿',
    text: 'Copies the ability of the perk immediately to its right',
    copiesRight: true },

  { key: 'quantIntern', name: 'Quant Intern', cost: 7, rarity: 'uncommon', art: '🎓',
    text: '+3 Leverage per level of the pattern you played',
    independent: (ctx, p) => ctx.addLeverage(3 * ctx.patternLevel, p) },

  { key: 'chartist', name: 'Chartist', cost: 8, rarity: 'uncommon', art: '✏️',
    counters: { x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. Gains x0.2 whenever you play a Golden Cross or better`,
    independent: (ctx, p) => {
      ctx.xLeverage(p.counters.x, p);
      if (ctx.commit && ctx.patternOrder >= 8) p.counters.x = +(p.counters.x + 0.2).toFixed(2);
    } },

  { key: 'siliconValley', name: 'Silicon Valley', cost: 8, rarity: 'uncommon', art: '🏙️',
    counters: { x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. Gains x0.1 for each Tech ▲ ticker scored`,
    independent: (ctx, p) => {
      ctx.xLeverage(p.counters.x, p);
      if (ctx.commit) {
        const n = countScored(ctx, (c) => ctx.isSector(c, 'TECH'));
        if (n) p.counters.x = +(p.counters.x + 0.1 * n).toFixed(2);
      }
    } },

  { key: 'oilFutures', name: 'Oil Futures', cost: 7, rarity: 'uncommon', art: '⛽',
    counters: { v: 0 },
    text: (p) => `+${p.counters.v} Volume. Gains +12 Volume for each Energy ⚡ ticker scored`,
    independent: (ctx, p) => {
      if (p.counters.v) ctx.addVolume(p.counters.v, p);
      if (ctx.commit) p.counters.v += 12 * countScored(ctx, (c) => ctx.isSector(c, 'ENERGY'));
    } },

  { key: 'newsWire', name: 'News Wire', cost: 6, rarity: 'uncommon', art: '📰',
    counters: { v: 0 },
    text: (p) => `+${p.counters.v} Volume. Gains +18 Volume after every trade`,
    independent: (ctx, p) => { if (p.counters.v) ctx.addVolume(p.counters.v, p); },
    tradeEnd: (state, res, p) => { p.counters.v += 18; } },

  { key: 'patternRecog', name: 'Pattern Recognition', cost: 7, rarity: 'uncommon', art: '🧠',
    counters: { last: null, x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. +x0.3 when you repeat the previous pattern, resets otherwise`,
    independent: (ctx, p) => {
      ctx.xLeverage(p.counters.x, p);
      if (ctx.commit) {
        if (p.counters.last === ctx.patternKey) p.counters.x = +(p.counters.x + 0.3).toFixed(2);
        else p.counters.x = 1;
        p.counters.last = ctx.patternKey;
      }
    } },

  { key: 'shredder', name: 'Shredder', cost: 6, rarity: 'uncommon', art: '🗑️',
    text: '+4 Leverage for each discard you have left',
    independent: (ctx, p) => { const d = ctx.state.session?.discardsLeft ?? 0; if (d) ctx.addLeverage(4 * d, p); } },

  { key: 'compounder', name: 'Compounder', cost: 7, rarity: 'uncommon', art: '🧮',
    text: '+1 Leverage for every $8 you hold',
    independent: (ctx, p) => { const n = Math.floor(ctx.state.cash / 8); if (n) ctx.addLeverage(n, p); } },

  { key: 'rogueTrader', name: 'Rogue Trader', cost: 18, rarity: 'legendary', art: '😈',
    text: 'x1 Leverage, +x1 for every $50 you hold',
    independent: (ctx, p) => ctx.xLeverage(1 + Math.floor(ctx.state.cash / 50), p) },

  { key: 'singularity', name: 'Singularity', cost: 20, rarity: 'legendary', art: '🌌',
    text: 'x28 Leverage. Costs $9 on every trade',
    independent: (ctx, p) => { ctx.xLeverage(28, p); ctx.earn(-9, p); } },

  { key: 'theWolf', name: 'The Wolf', cost: 18, rarity: 'legendary', art: '🐺',
    text: 'x1.6 Leverage for every Rare or Legendary perk on your desk',
    independent: (ctx, p) => {
      const n = ctx.state.perks.filter((q) => ['rare', 'legendary'].includes(PERKS[q.key]?.rarity)).length;
      ctx.xLeverage(Math.pow(1.6, n), p);
    } },

  { key: 'thePonzi', name: 'The Ponzi', cost: 18, rarity: 'legendary', art: '♾️',
    counters: { x: 1 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage. Gains x0.75 for each deadline you clear`,
    independent: (ctx, p) => ctx.xLeverage(p.counters.x, p),
    deadlineEnd: (state, p) => { p.counters.x = +(p.counters.x + 0.75).toFixed(2); } },

  { key: 'closingBell', name: 'The Closing Bell', cost: 16, rarity: 'legendary', art: '🔔',
    text: 'All deadline quotas are 25% lower',
    mods: { quotaMult: 0.75 } },

  { key: 'unlimitedMargin', name: 'Unlimited Margin', cost: 16, rarity: 'legendary', art: '🏧',
    text: '+2 trades and +2 discards each deadline, but quotas are 25% higher',
    mods: { trades: 2, discards: 2, quotaMult: 1.25 } },
]);

// --- Economy / utility ------------------------------------------------------
add([
  { key: 'riskDesk', name: 'Risk Desk', cost: 6, rarity: 'uncommon', art: '🧯',
    text: '+1 discard each deadline and +30 Volume',
    mods: { discards: 1 },
    independent: (ctx, p) => ctx.addVolume(30, p) },

  { key: 'bigBoard', name: 'Big Board', cost: 7, rarity: 'uncommon', art: '🖼️',
    text: '+1 hand size',
    mods: { handSize: 1 } },

  { key: 'overtime', name: 'Overtime', cost: 8, rarity: 'uncommon', art: '🌙',
    text: '+1 trade each deadline. Costs $4 when a deadline ends',
    mods: { trades: 1 },
    payout: () => -4 },

  { key: 'boardSeat', name: 'Board Seat', cost: 10, rarity: 'rare', art: '🪑',
    text: '+1 desk slot',
    mods: { slots: 1 } },

  { key: 'savingsBond', name: 'Savings Bond', cost: 5, art: '🏷️',
    text: '+$5 when you clear a deadline',
    payout: () => 5 },

  { key: 'ramenBudget', name: 'Ramen Budget', cost: 6, rarity: 'uncommon', art: '🍜',
    text: 'Interest pays $1 per $4 held instead of per $5',
    mods: { interestRate: 4 } },

  { key: 'creditLine', name: 'Credit Line', cost: 7, rarity: 'uncommon', art: '💳',
    text: 'Interest cap raised by $4',
    mods: { interestCap: 4 } },

  { key: 'hoarder', name: 'Hoarder', cost: 6, rarity: 'uncommon', art: '🧺',
    text: '+$2 for every unused trade when a deadline ends',
    payout: (state) => 2 * (state.session?.tradesLeft ?? 0) },

  { key: 'taxLoss', name: 'Tax-Loss Harvest', cost: 6, rarity: 'uncommon', art: '🧾',
    text: 'Earn $5 on every RED trade',
    direction: (ctx, p) => { if (!ctx.correct) ctx.earn(5, p); } },

  { key: 'marketMaker', name: 'Market Maker', cost: 6, rarity: 'uncommon', art: '🎪',
    text: 'Earn $1 for each scored ticker',
    cardScored: (ctx, c, p) => ctx.earn(1, p) },

  { key: 'angelInvestor', name: 'Angel Investor', cost: 6, rarity: 'uncommon', art: '👼',
    text: 'Perks sell for $3 more',
    mods: { sellBonus: 3 } },

  { key: 'theMole', name: 'The Mole', cost: 9, rarity: 'rare', art: '🕵️',
    text: '+$6 when you clear a deadline, and +x0.1 Leverage per $25 held',
    payout: () => 6,
    independent: (ctx, p) => ctx.xLeverage(1 + 0.1 * Math.floor(ctx.state.cash / 25), p) },

  { key: 'shellCorp', name: 'Shell Corp', cost: 7, rarity: 'uncommon', art: '🐚',
    text: 'Reroll cost is $0 for the first reroll of every visit to the Floor',
    mods: { freeRerolls: 1 } },

  { key: 'brokerFriend', name: 'Broker Friend', cost: 7, rarity: 'uncommon', art: '🤝',
    text: 'Shop items cost $2 less (minimum $1)',
    mods: { discount: 2 } },

  { key: 'archivist', name: 'Archivist', cost: 7, rarity: 'uncommon', art: '🗃️',
    text: '+1 Chart slot',
    mods: { chartSlots: 1 } },

  { key: 'paperShuffler', name: 'Paper Shuffler', cost: 6, rarity: 'uncommon', art: '📄',
    text: 'Discarding creates nothing, but earns $1 per ticker discarded',
    discarded: (state, cards, p) => { state.cash += cards.length; } },

  { key: 'insiderMemo', name: 'Insider Memo', cost: 8, rarity: 'uncommon', art: '✉️',
    text: 'Creates a random Chart when a Boss deadline is defeated (needs room)',
    onBossClear: true },

  { key: 'contractLawyer', name: 'Contract Lawyer', cost: 8, rarity: 'uncommon', art: '⚖️',
    text: 'Creates a random Contract when a Boss deadline is defeated (needs room)',
    onBossClearContract: true },
]);

// --- Pattern upgrade / oddball ----------------------------------------------
add([
  { key: 'tapeReader', name: 'Tape Reader', cost: 8, rarity: 'uncommon', art: '👁️',
    text: 'The played pattern counts as one level higher',
    mods: { patternLevelBonus: 1 } },

  { key: 'fourFingers', name: 'Four Fingers', cost: 9, rarity: 'rare', art: '🖖',
    text: 'Rallies and Rotations can be made with 4 tickers',
    mods: { fourCard: true } },

  { key: 'shortcut', name: 'Shortcut', cost: 9, rarity: 'rare', art: '↔️',
    text: 'Breakout Rallies can be made with gaps of one rank',
    mods: { shortcut: true } },

  { key: 'splitter', name: 'Splitter', cost: 8, rarity: 'uncommon', art: '✂️',
    text: 'Every played ticker scores, even ones outside the pattern',
    mods: { allScore: true } },

  { key: 'luckyStreak', name: 'Lucky Streak', cost: 7, rarity: 'uncommon', art: '🍀',
    text: 'Penny Stock tickers trigger twice as often',
    mods: { luckyBoost: 2 } },

  { key: 'goldRush', name: 'Gold Rush', cost: 7, rarity: 'uncommon', art: '🏅',
    text: '+2 Leverage for each $10 earned during this deadline',
    independent: (ctx, p) => { const n = Math.floor((ctx.state.session?.earnedThisDeadline ?? 0) / 10); if (n) ctx.addLeverage(2 * n, p); } },

  { key: 'burnout', name: 'Burnout', cost: 5, art: '🥱',
    counters: { x: 3 },
    text: (p) => `x${p.counters.x.toFixed(2)} Leverage, losing x0.25 after every trade`,
    independent: (ctx, p) => {
      ctx.xLeverage(Math.max(1, p.counters.x), p);
      if (ctx.commit) p.counters.x = Math.max(1, +(p.counters.x - 0.25).toFixed(2));
    } },

  { key: 'sunkCost', name: 'Sunk Cost', cost: 6, rarity: 'uncommon', art: '⚓',
    text: '+15 Volume for each ticker missing from your portfolio (below 52)',
    independent: (ctx, p) => { const n = Math.max(0, 52 - ctx.state.deck.length); if (n) ctx.addVolume(15 * n, p); } },

  { key: 'indexFund', name: 'Index Fund', cost: 8, rarity: 'uncommon', art: '🧊',
    text: '+3 Leverage for every 5 tickers in your portfolio',
    independent: (ctx, p) => ctx.addLeverage(3 * Math.floor(ctx.state.deck.length / 5), p) },

  { key: 'auditRisk', name: 'Audit Risk', cost: 6, rarity: 'uncommon', art: '🔍',
    text: 'x2 Leverage, but a random ticker is destroyed when a deadline ends',
    independent: (ctx, p) => ctx.xLeverage(2, p),
    destroysCard: true },

  { key: 'perpetualMotion', name: 'Perpetual Motion', cost: 9, rarity: 'rare', art: '⚙️',
    text: 'x1.6 Volume',
    independent: (ctx, p) => ctx.xVolume(1.6, p) },

  { key: 'darkAlpha', name: 'Dark Alpha', cost: 10, rarity: 'rare', art: '🌑',
    text: 'x1 Leverage, +x0.35 for each unsold perk slot left empty',
    independent: (ctx, p) => {
      const empty = Math.max(0, ctx.mods.slots - ctx.state.perks.length);
      ctx.xLeverage(1 + 0.35 * empty, p);
    } },
]);

export const PERK_KEYS = Object.keys(PERKS);

export function perkText(inst, state) {
  const d = PERKS[inst.key];
  if (!d) return '';
  return typeof d.text === 'function' ? d.text(inst, state) : d.text;
}

export function makePerk(key, rng) {
  const d = PERKS[key];
  const inst = {
    key,
    uid: 'p' + Math.random().toString(36).slice(2, 9),
    counters: JSON.parse(JSON.stringify(d.counters || {})),
    edition: null,
    cost: d.cost,
    debuffed: false,
  };
  if (rng) {
    const roll = rng.next();
    if (roll < 0.014) inst.edition = 'offbook';
    else if (roll < 0.045) inst.edition = 'algorithmic';
    else if (roll < 0.09) inst.edition = 'holographic';
    else if (roll < 0.15) inst.edition = 'laminated';
  }
  return inst;
}

export function perkSellValue(inst, state) {
  const base = Math.max(1, Math.ceil((PERKS[inst.key]?.cost ?? 4) / 2));
  return base + (state?.mods?.sellBonus ?? 0);
}

export function rollPerkKey(rng, opts = {}) {
  const pool = PERK_KEYS.filter((k) => {
    const d = PERKS[k];
    if (opts.exclude?.includes(k)) return false;
    if (d.rarity === 'legendary' && !opts.allowLegendary) return false;
    return true;
  });
  const entries = pool.map((k) => ({ item: k, weight: RARITY[PERKS[k].rarity].weight || 1 }));
  return rng.pickWeighted(entries);
}
