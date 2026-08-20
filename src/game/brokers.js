import { SECTORS, isWide, isDoji, isSmall, bodyOf, polarityOf } from './candles.js';

// ---------------------------------------------------------------------------
// BROKERS — the people on your desk. They trigger left to right and they are
// where a run's identity comes from.
//
// Hooks (all optional):
//   candleScored(ctx, c, b)      when a placed candle prints
//   candleHeld(ctx, c, b)        for each candle left on the board
//   independent(ctx, b)          after all candles, in desk order
//   direction(ctx, b)            after the tape resolves (ctx.correct is set)
//   retriggerScored(ctx, c, b)   -> extra print count
//   retriggerHeld(ctx, c, b)     -> extra print count
//   tradeEnd(state, res, b)      after a trade fully resolves
//   discarded(state, candles, b) when candles are swept
//   deadlineStart / deadlineEnd(state, b)
//   payout(state, b) -> $        extra cash on clearing a deadline
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

export const BROKERS = {};
function add(list) { for (const d of list) BROKERS[d.key] = def(d); }

// --- COMMON: flat and formation-conditional ---------------------------------
add([
  { key: 'sticky', name: 'Scribble', cost: 4, art: '📝',
    text: '+4 Leverage',
    independent: (ctx, b) => ctx.addLeverage(4, b) },

  { key: 'tickertape', name: 'Streamer', cost: 4, art: '🎏',
    text: '+40 Volume',
    independent: (ctx, b) => ctx.addVolume(40, b) },

  { key: 'deskFan', name: 'Jolly Charm', cost: 4, art: '🍀',
    text: '+4 Leverage if the print contains a Tweezer',
    independent: (ctx, b) => { if (ctx.contains('tweezer')) ctx.addLeverage(4, b); } },

  { key: 'hoodie', name: 'Zany Charm', cost: 4, art: '🎭',
    text: '+5 Leverage if the print contains a Double Tweezer',
    independent: (ctx, b) => { if (ctx.contains('doubleTweezer')) ctx.addLeverage(5, b); } },

  { key: 'energyDrink', name: 'Mad Charm', cost: 4, art: '🤪',
    text: '+6 Leverage if the print contains a Triple Tap',
    independent: (ctx, b) => { if (ctx.contains('triple')) ctx.addLeverage(6, b); } },

  { key: 'charting101', name: 'Crazy Charm', cost: 4, art: '🌀',
    text: '+5 Leverage if the print contains a Staircase',
    independent: (ctx, b) => { if (ctx.contains('staircase')) ctx.addLeverage(5, b); } },

  { key: 'sectorMap', name: 'Droll Charm', cost: 4, art: '🃏',
    text: '+5 Leverage if the print contains a Sector Cluster',
    independent: (ctx, b) => { if (ctx.contains('cluster')) ctx.addLeverage(5, b); } },

  { key: 'fullPort', name: 'Sly Charm', cost: 4, art: '🦊',
    text: '+5 Leverage if the print contains Pillars',
    independent: (ctx, b) => { if (ctx.contains('pillars')) ctx.addLeverage(5, b); } },

  { key: 'roundLot', name: 'Full Moon', cost: 4, art: '🌕',
    text: '+80 Volume if you placed exactly 5 candles',
    independent: (ctx, b) => { if (ctx.played.length === 5) ctx.addVolume(80, b); } },

  { key: 'scalper', name: 'The Hermit', cost: 5, art: '🕯',
    text: '+9 Leverage if you placed exactly 1 candle',
    independent: (ctx, b) => { if (ctx.played.length === 1) ctx.addLeverage(9, b); } },

  { key: 'pairsTrade', name: 'The Lovers', cost: 5, art: '💞',
    text: '+6 Leverage if you placed exactly 2 candles',
    independent: (ctx, b) => { if (ctx.played.length === 2) ctx.addLeverage(6, b); } },

  { key: 'openOutcry', name: 'Barker', cost: 5, art: '📢',
    text: '+3 Leverage for every candle you placed',
    independent: (ctx, b) => ctx.addLeverage(3 * ctx.played.length, b) },
]);

// --- COMMON: sector, body and polarity scalers -------------------------------
add([
  { key: 'techBro', name: 'Wireborn', cost: 5, art: '👾',
    text: 'Each printed Tech ▲ candle gives +4 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.isSector(c, 'TECH')) ctx.addLeverage(4, b, c); } },

  { key: 'oilBaron', name: 'Ashwalker', cost: 5, art: '🔥',
    text: 'Each printed Energy ⚡ candle gives +35 Volume',
    candleScored: (ctx, c, b) => { if (ctx.isSector(c, 'ENERGY')) ctx.addVolume(35, b, c); } },

  { key: 'bankTeller', name: 'The Tallyman', cost: 5, art: '🪙',
    text: 'Each printed Finance ● candle gives +2 Leverage and $1',
    candleScored: (ctx, c, b) => { if (ctx.isSector(c, 'FINANCE')) { ctx.addLeverage(2, b, c); ctx.earn(1, b); } } },

  { key: 'degenTrader', name: 'Gremlin', cost: 5, art: '👺',
    text: 'Each printed Crypto ◆ candle gives +5 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.isSector(c, 'CRYPTO')) ctx.addLeverage(5, b, c); } },

  { key: 'bullPen', name: 'Horned Idol', cost: 5, art: '🐂',
    text: 'Each printed BULL candle gives +4 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.isBull(c)) ctx.addLeverage(4, b, c); } },

  { key: 'bearCave', name: 'Den Mother', cost: 5, art: '🐻',
    text: 'Each printed BEAR candle gives +4 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.isBear(c)) ctx.addLeverage(4, b, c); } },

  { key: 'evenSplit', name: 'The Twins', cost: 5, art: '♊',
    text: 'Each printed even-bodied candle gives +30 Volume and +3 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.hasBody(c) && bodyOf(c) % 2 === 0) { ctx.addVolume(30, b, c); ctx.addLeverage(3, b, c); } } },

  { key: 'oddLot', name: 'Oddments', cost: 5, art: '🎲',
    text: 'Each printed odd-bodied candle gives +30 Volume and +3 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.hasBody(c) && bodyOf(c) % 2 === 1) { ctx.addVolume(30, b, c); ctx.addLeverage(3, b, c); } } },

  { key: 'wideLoad', name: 'Fat Tail', cost: 5, art: '🐘',
    text: 'Each printed WIDE candle (body 11+) gives +45 Volume',
    candleScored: (ctx, c, b) => { if (ctx.isWide(c)) ctx.addVolume(45, b, c); } },

  { key: 'wideSeeker', name: 'Crown Jewel', cost: 6, rarity: 'uncommon', art: '👑',
    text: 'Each printed body-13 candle gives +25 Volume and +5 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.hasBody(c) && bodyOf(c) === 13) { ctx.addVolume(25, b, c); ctx.addLeverage(5, b, c); } } },

  { key: 'dojiMonk', name: 'Candlewick', cost: 5, art: '🕯️',
    text: 'Each printed DOJI (body 1) gives +10 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.hasBody(c) && isDoji(c)) ctx.addLeverage(10, b, c); } },

  { key: 'pennyJar', name: 'Coin Purse', cost: 5, art: '👛',
    text: 'Each printed candle with a body of 4 or less gives +6 Leverage',
    candleScored: (ctx, c, b) => { if (ctx.hasBody(c) && isSmall(c)) ctx.addLeverage(6, b, c); } },

  { key: 'growthFund', name: 'Verdant Pact', cost: 6, rarity: 'uncommon', art: '🌱',
    text: 'x1.4 Leverage if every printed candle is Growth (Tech ▲ / Crypto ◆)',
    independent: (ctx, b) => { if (ctx.scoring.length && ctx.scoring.every((c) => SECTORS[c.sector]?.group === 'GROWTH')) ctx.xLeverage(1.4, b); } },

  { key: 'valueFund', name: 'Iron Pact', cost: 6, rarity: 'uncommon', art: '⚒️',
    text: 'x1.4 Leverage if every printed candle is Value (Energy ⚡ / Finance ●)',
    independent: (ctx, b) => { if (ctx.scoring.length && ctx.scoring.every((c) => SECTORS[c.sector]?.group === 'VALUE')) ctx.xLeverage(1.4, b); } },
]);

// --- Conviction and the marches ---------------------------------------------
add([
  { key: 'convictionDesk', name: "Zealot's Badge", cost: 8, rarity: 'uncommon', art: '🎖️',
    text: 'Conviction bonuses are worth an extra x0.4',
    mods: { convictionBonus: 0.4 } },

  { key: 'trueBeliever', name: 'The Convert', cost: 8, rarity: 'uncommon', art: '🙏',
    text: 'Conviction triggers at half your candles instead of most of them',
    mods: { convictionThreshold: 0.5 } },

  { key: 'hedgeBook', name: 'Janus Ledger', cost: 9, rarity: 'rare', art: '🎎',
    text: 'x2.6 Leverage if your printed candles split evenly bull and bear',
    independent: (ctx, b) => {
      const live = ctx.scoring.filter((c) => ctx.hasBody(c) && !c.debuffed);
      if (live.length < 2 || live.length % 2) return;
      const bulls = live.filter((c) => ctx.isBull(c)).length;
      if (bulls * 2 === live.length) ctx.xLeverage(2.6, b);
    } },

  { key: 'reversalDesk', name: 'Mirror Rite', cost: 9, rarity: 'rare', art: '🪞',
    text: 'x2 Leverage when every printed candle opposes the call you made',
    direction: (ctx, b) => {
      const live = ctx.scoring.filter((c) => ctx.hasBody(c) && !c.debuffed);
      if (live.length && live.every((c) => !ctx.matchesCall(c))) ctx.xLeverage(2, b);
    } },

  { key: 'drillSergeant', name: 'Drillmaster', cost: 8, rarity: 'uncommon', art: '🎺',
    text: 'x2.2 Leverage on Three White Soldiers',
    independent: (ctx, b) => { if (ctx.formationKey === 'soldiers') ctx.xLeverage(2.2, b); } },

  { key: 'crowKeeper', name: 'Crowfather', cost: 8, rarity: 'uncommon', art: '🐦‍⬛',
    text: 'x2.2 Leverage on Three Black Crows',
    independent: (ctx, b) => { if (ctx.formationKey === 'crows') ctx.xLeverage(2.2, b); } },

  { key: 'cadence', name: 'Marching Drum', cost: 9, rarity: 'rare', art: '🥁',
    text: 'Soldiers and Crows can be made with only 2 candles',
    mods: { marchOfThree: true } },

  { key: 'momentumRider', name: 'Coattails', cost: 7, rarity: 'uncommon', art: '🧥',
    text: '+35 Volume for every candle in a Soldiers or Crows march',
    independent: (ctx, b) => {
      const n = Math.max(ctx.marchLength, 0);
      if (n) ctx.addVolume(35 * n, b);
    } },

  { key: 'stepLadder', name: "Jacob's Ladder", cost: 7, rarity: 'uncommon', art: '🪜',
    text: '+4 Leverage for every body-step between your smallest and largest printed candle',
    independent: (ctx, b) => {
      const bodies = ctx.scoring.filter((c) => ctx.hasBody(c)).map(bodyOf);
      if (bodies.length < 2) return;
      ctx.addLeverage(4 * (Math.max(...bodies) - Math.min(...bodies)), b);
    } },
]);

// --- Direction, streaks, risk -------------------------------------------------
add([
  { key: 'momentum', name: 'Hot Hand', cost: 6, rarity: 'uncommon', art: '♨️',
    text: (b, s) => `+3 Leverage per consecutive GREEN trade (currently ${s?.session?.greenStreak ?? 0})`,
    independent: (ctx, b) => { if (ctx.greenStreak > 0) ctx.addLeverage(3 * ctx.greenStreak, b); } },

  { key: 'contrarian', name: 'The Fool', cost: 7, rarity: 'uncommon', art: '🤡',
    text: 'RED trades keep x2 of their P/L instead of the usual penalty',
    redMult: 2 },

  { key: 'diamondHands', name: 'Stone Grip', cost: 8, rarity: 'rare', art: '💎',
    text: 'RED trades pay in full — no wrong-way penalty',
    redMult: 1 },

  { key: 'hedgeFund', name: 'The Widow', cost: 7, rarity: 'uncommon', art: '🕸️',
    text: 'x1.6 Leverage on SHORT calls',
    direction: (ctx, b) => { if (ctx.direction === 'SHORT') ctx.xLeverage(1.6, b); } },

  { key: 'bullhorn', name: 'The Herald', cost: 7, rarity: 'uncommon', art: '📣',
    text: 'x1.6 Leverage on LONG calls',
    direction: (ctx, b) => { if (ctx.direction === 'LONG') ctx.xLeverage(1.6, b); } },

  { key: 'burnerPhone', name: 'Ghost Line', cost: 8, rarity: 'uncommon', art: '📞',
    text: 'The signal never lies',
    mods: { perfectSignal: true } },

  { key: 'bloomberg', name: 'The Almanac', cost: 7, rarity: 'uncommon', art: '📖',
    text: '+20% signal accuracy',
    mods: { accuracy: 0.20 } },

  { key: 'stopLoss', name: 'Cheat Death', cost: 7, rarity: 'uncommon', art: '🪬',
    text: 'The first RED trade of each deadline is treated as GREEN',
    saveRed: true },

  { key: 'pyramid', name: 'Ascendant', cost: 8, rarity: 'uncommon', art: '🔺',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.25 on each GREEN trade`,
    direction: (ctx, b) => { ctx.xLeverage(b.counters.x, b); if (ctx.commit && ctx.correct) b.counters.x = +(b.counters.x + 0.25).toFixed(2); } },

  { key: 'volSurface', name: 'Scar Tissue', cost: 8, rarity: 'uncommon', art: '🩹',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.35 on each RED trade`,
    direction: (ctx, b) => { ctx.xLeverage(b.counters.x, b); if (ctx.commit && !ctx.correct) b.counters.x = +(b.counters.x + 0.35).toFixed(2); } },

  { key: 'blackSwan', name: 'Black Swan', cost: 9, rarity: 'rare', art: '🦢',
    counters: { n: 0 },
    text: (b) => `x${(1 + 0.5 * b.counters.n).toFixed(2)} Leverage — x0.5 per RED trade this run (${b.counters.n})`,
    independent: (ctx, b) => ctx.xLeverage(1 + 0.5 * b.counters.n, b),
    tradeEnd: (state, res, b) => { if (!res.correct) b.counters.n++; } },

  { key: 'theTape', name: 'Blood Scent', cost: 7, rarity: 'uncommon', art: '🩸',
    text: (b, s) => `+60 Volume per consecutive GREEN trade (currently ${s?.session?.greenStreak ?? 0})`,
    independent: (ctx, b) => { if (ctx.greenStreak > 0) ctx.addVolume(60 * ctx.greenStreak, b); } },

  { key: 'firstMover', name: 'Opening Gambit', cost: 7, rarity: 'uncommon', art: '♟️',
    text: 'x2.5 Leverage on the first trade of a deadline',
    independent: (ctx, b) => { if (ctx.tradeIndex === 0) ctx.xLeverage(2.5, b); } },

  { key: 'deadlineDread', name: 'Last Rites', cost: 8, rarity: 'uncommon', art: '⚰️',
    text: 'x3 Leverage on your final available trade',
    independent: (ctx, b) => { if (ctx.tradesLeft <= 1) ctx.xLeverage(3, b); } },

  { key: 'quantumDesk', name: 'Paradox Engine', cost: 10, rarity: 'rare', art: '🧪',
    text: 'Every trade resolves GREEN, but x0.45 Leverage',
    mods: { alwaysGreen: true },
    independent: (ctx, b) => ctx.xLeverage(0.45, b) },
]);

// --- Retriggers and the candle layers ----------------------------------------
add([
  { key: 'blueSuit', name: 'Understudy', cost: 7, rarity: 'uncommon', art: '🤵',
    text: 'Every printed WIDE candle (body 11+) prints again',
    retriggerScored: (ctx, c) => (ctx.isWide(c) ? 1 : 0) },

  { key: 'caffeinated', name: 'Encore', cost: 6, rarity: 'uncommon', art: '🎬',
    text: 'The first candle you placed prints again',
    retriggerScored: (ctx, c) => (ctx.scoring[0] === c ? 1 : 0) },

  { key: 'hftRack', name: 'The Swarm', cost: 8, rarity: 'uncommon', art: '🐝',
    text: 'Every printed candle with a body of 5 or less prints again',
    retriggerScored: (ctx, c) => (ctx.hasBody(c) && bodyOf(c) <= 5 ? 1 : 0) },

  { key: 'stampCollector', name: 'Sigil Collector', cost: 8, rarity: 'uncommon', art: '🔖',
    text: 'Every printed candle carrying a stamp prints again',
    retriggerScored: (ctx, c) => (c.stamp ? 1 : 0) },

  { key: 'frontRunner', name: 'Echo', cost: 10, rarity: 'rare', art: '🔊',
    text: 'Every printed candle prints one extra time',
    retriggerScored: () => 1 },

  { key: 'flashBoy', name: 'Sleight of Hand', cost: 9, rarity: 'rare', art: '🤹',
    text: 'Every candle held on the board triggers twice more',
    retriggerHeld: () => 2 },

  { key: 'laminator', name: 'The Gilder', cost: 7, rarity: 'uncommon', art: '🖌️',
    text: 'Each printed candle with an edition gives +5 Leverage',
    candleScored: (ctx, c, b) => { if (c.edition) ctx.addLeverage(5, b, c); } },

  { key: 'algoDesk', name: 'Shapeshifter', cost: 8, rarity: 'uncommon', art: '🦎',
    text: 'x1.5 Leverage for each printed Chameleon candle',
    candleScored: (ctx, c, b) => { if (c.enhancement === 'chameleon' && !c.debuffed) ctx.xLeverage(1.5, b, c); } },

  { key: 'volDesk', name: 'Powder Keg', cost: 9, rarity: 'rare', art: '💥',
    text: 'x2 Leverage for each printed Glasswork candle',
    candleScored: (ctx, c, b) => { if (c.enhancement === 'glasswork' && !c.debuffed) ctx.xLeverage(2, b, c); } },

  { key: 'swingDesk', name: 'Fencesitter', cost: 8, rarity: 'uncommon', art: '🔀',
    text: 'x1.7 Leverage for each printed Janus candle',
    candleScored: (ctx, c, b) => { if (c.enhancement === 'janus' && !c.debuffed) ctx.xLeverage(1.7, b, c); } },

  { key: 'ladder', name: 'Hoardling', cost: 6, rarity: 'uncommon', art: '🧗',
    text: '+2 Leverage for each candle left on your board',
    independent: (ctx, b) => { if (ctx.held.length) ctx.addLeverage(2 * ctx.held.length, b); } },

  { key: 'bagholder', name: 'Bagman', cost: 6, rarity: 'uncommon', art: '🎒',
    text: '+55 Volume for each placed candle that did NOT print',
    independent: (ctx, b) => { if (ctx.unscored.length) ctx.addVolume(55 * ctx.unscored.length, b); } },

  { key: 'divTrap', name: 'The Tithe', cost: 6, rarity: 'uncommon', art: '💵',
    text: '$2 for each candle held on the board at the close',
    candleHeld: (ctx, c, b) => ctx.earn(2, b) },

  { key: 'synthetic', name: 'Smudge', cost: 9, rarity: 'rare', art: '🧬',
    text: 'Tech ▲ / Crypto ◆ count as one sector, and Energy ⚡ / Finance ● count as one',
    mods: { smeared: true } },
]);

// --- Rare / build-defining ----------------------------------------------------
add([
  { key: 'theWhale', name: 'Leviathan', cost: 10, rarity: 'rare', art: '🐋',
    text: 'x4 Leverage if you placed 5 candles and all 5 printed',
    independent: (ctx, b) => { if (ctx.played.length === 5 && ctx.unscored.length === 0) ctx.xLeverage(4, b); } },

  { key: 'darkPool', name: 'Nightfall', cost: 9, rarity: 'rare', art: '🌘',
    text: 'x3 Leverage if you placed 3 or fewer candles',
    independent: (ctx, b) => { if (ctx.played.length <= 3) ctx.xLeverage(3, b); } },

  { key: 'rotationDesk', name: 'The Quartet', cost: 9, rarity: 'rare', art: '🎻',
    text: 'x2.5 Leverage if the printed candles cover all four sectors',
    independent: (ctx, b) => {
      const s = new Set(ctx.scoring.filter((c) => ctx.hasBody(c)).map((c) => c.sector));
      if (s.size >= 4) ctx.xLeverage(2.5, b);
    } },

  { key: 'monoDesk', name: 'Monolith', cost: 8, rarity: 'rare', art: '🗿',
    text: 'x2.2 Leverage if every printed candle shares one sector',
    independent: (ctx, b) => {
      const cs = ctx.scoring.filter((c) => ctx.hasBody(c));
      if (cs.length >= 2 && new Set(cs.map((c) => c.sector)).size === 1) ctx.xLeverage(2.2, b);
    } },

  { key: 'muddyWaters', name: 'The Vulture', cost: 9, rarity: 'rare', art: '🦅',
    text: 'SHORT calls x2.2 Leverage. LONG calls x0.8 Leverage',
    direction: (ctx, b) => ctx.xLeverage(ctx.direction === 'SHORT' ? 2.2 : 0.8, b) },

  { key: 'perma', name: 'Sun Chaser', cost: 9, rarity: 'rare', art: '☀️',
    text: 'LONG calls x2.2 Leverage. SHORT calls x0.8 Leverage',
    direction: (ctx, b) => ctx.xLeverage(ctx.direction === 'LONG' ? 2.2 : 0.8, b) },

  { key: 'theOracle', name: 'The Oracle', cost: 10, rarity: 'rare', art: '🔮',
    text: 'Signal never lies. +x0.4 Leverage per GREEN trade this deadline',
    mods: { perfectSignal: true },
    independent: (ctx, b) => ctx.xLeverage(1 + 0.4 * ctx.greensThisDeadline, b) },

  { key: 'arbBot', name: 'Mimic', cost: 9, rarity: 'rare', art: '🧿',
    text: 'Copies the ability of the broker immediately to its right',
    copiesRight: true },

  { key: 'hallOfMirrors', name: 'Hall of Mirrors', cost: 10, rarity: 'rare', art: '🎪',
    text: 'Brokers you already employ can turn up on the Floor again — duplicates allowed',
    mods: { allowDuplicates: true } },

  { key: 'quantIntern', name: 'Apprentice', cost: 7, rarity: 'uncommon', art: '🎓',
    text: '+3 Leverage per level of the formation you printed',
    independent: (ctx, b) => ctx.addLeverage(3 * ctx.formationLevel, b) },

  { key: 'chartist', name: 'Cartographer', cost: 8, rarity: 'uncommon', art: '🗺️',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.2 whenever you print a Golden Staircase or better`,
    independent: (ctx, b) => {
      ctx.xLeverage(b.counters.x, b);
      if (ctx.commit && ctx.formationOrder >= 9) b.counters.x = +(b.counters.x + 0.2).toFixed(2);
    } },

  { key: 'siliconValley', name: 'Silicon Bloom', cost: 8, rarity: 'uncommon', art: '🌸',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.1 for each Tech ▲ candle printed`,
    independent: (ctx, b) => {
      ctx.xLeverage(b.counters.x, b);
      if (ctx.commit) {
        const n = countScored(ctx, (c) => ctx.isSector(c, 'TECH'));
        if (n) b.counters.x = +(b.counters.x + 0.1 * n).toFixed(2);
      }
    } },

  { key: 'oilFutures', name: 'Ember Hoard', cost: 7, rarity: 'uncommon', art: '🛢️',
    counters: { v: 0 },
    text: (b) => `+${b.counters.v} Volume. Gains +12 Volume for each Energy ⚡ candle printed`,
    independent: (ctx, b) => {
      if (b.counters.v) ctx.addVolume(b.counters.v, b);
      if (ctx.commit) b.counters.v += 12 * countScored(ctx, (c) => ctx.isSector(c, 'ENERGY'));
    } },

  { key: 'stampede', name: 'Bull Rush', cost: 8, rarity: 'uncommon', art: '🐃',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.12 for each BULL candle printed`,
    independent: (ctx, b) => {
      ctx.xLeverage(b.counters.x, b);
      if (ctx.commit) {
        const n = countScored(ctx, (c) => ctx.isBull(c));
        if (n) b.counters.x = +(b.counters.x + 0.12 * n).toFixed(2);
      }
    } },

  { key: 'permafrost', name: 'Permafrost', cost: 8, rarity: 'uncommon', art: '🧊',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.12 for each BEAR candle printed`,
    independent: (ctx, b) => {
      ctx.xLeverage(b.counters.x, b);
      if (ctx.commit) {
        const n = countScored(ctx, (c) => ctx.isBear(c));
        if (n) b.counters.x = +(b.counters.x + 0.12 * n).toFixed(2);
      }
    } },

  { key: 'newsWire', name: 'Rumormonger', cost: 6, rarity: 'uncommon', art: '📰',
    counters: { v: 0 },
    text: (b) => `+${b.counters.v} Volume. Gains +18 Volume after every trade`,
    independent: (ctx, b) => { if (b.counters.v) ctx.addVolume(b.counters.v, b); },
    tradeEnd: (state, res, b) => { b.counters.v += 18; } },

  { key: 'patternRecog', name: 'D\u00e9j\u00e0 Vu', cost: 7, rarity: 'uncommon', art: '🧠',
    counters: { last: null, x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. +x0.3 when you repeat the previous formation, resets otherwise`,
    independent: (ctx, b) => {
      ctx.xLeverage(b.counters.x, b);
      if (ctx.commit) {
        b.counters.x = b.counters.last === ctx.formationKey ? +(b.counters.x + 0.3).toFixed(2) : 1;
        b.counters.last = ctx.formationKey;
      }
    } },

  { key: 'shredder', name: 'Ashcan', cost: 6, rarity: 'uncommon', art: '🗑️',
    text: '+4 Leverage for each sweep you have left',
    independent: (ctx, b) => { const d = ctx.state.session?.discardsLeft ?? 0; if (d) ctx.addLeverage(4 * d, b); } },

  { key: 'compounder', name: 'Miser', cost: 7, rarity: 'uncommon', art: '🧮',
    text: '+1 Leverage for every $8 you hold',
    independent: (ctx, b) => { const n = Math.floor(ctx.state.cash / 8); if (n) ctx.addLeverage(n, b); } },

  { key: 'rogueTrader', name: 'The Rogue', cost: 18, rarity: 'legendary', art: '😈',
    text: 'x1 Leverage, +x1 for every $50 you hold',
    independent: (ctx, b) => ctx.xLeverage(1 + Math.floor(ctx.state.cash / 50), b) },

  { key: 'singularity', name: 'Singularity', cost: 20, rarity: 'legendary', art: '🌌',
    text: 'x28 Leverage. Costs $9 on every trade',
    independent: (ctx, b) => { ctx.xLeverage(28, b); ctx.earn(-9, b); } },

  { key: 'theWolf', name: 'The Wolf', cost: 18, rarity: 'legendary', art: '🐺',
    text: 'x1.6 Leverage for every Rare or Legendary broker on your desk',
    independent: (ctx, b) => {
      const n = ctx.state.brokers.filter((q) => ['rare', 'legendary'].includes(BROKERS[q.key]?.rarity)).length;
      ctx.xLeverage(Math.pow(1.6, n), b);
    } },

  { key: 'thePonzi', name: 'Ouroboros', cost: 18, rarity: 'legendary', art: '♾️',
    counters: { x: 1 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage. Gains x0.75 for each deadline you clear`,
    independent: (ctx, b) => ctx.xLeverage(b.counters.x, b),
    deadlineEnd: (state, b) => { b.counters.x = +(b.counters.x + 0.75).toFixed(2); } },

  { key: 'closingBell', name: 'The Last Bell', cost: 16, rarity: 'legendary', art: '🔔',
    text: 'All deadline quotas are 25% lower',
    mods: { quotaMult: 0.75 } },

  { key: 'unlimitedMargin', name: "Devil's Bargain", cost: 16, rarity: 'legendary', art: '⚱️',
    text: '+2 trades and +2 sweeps each deadline, but quotas are 25% higher',
    mods: { trades: 2, discards: 2, quotaMult: 1.25 } },
]);

// --- Economy / utility ---------------------------------------------------------
add([
  { key: 'riskDesk', name: 'Safety Net', cost: 6, rarity: 'uncommon', art: '🧯',
    text: '+1 sweep each deadline and +30 Volume',
    mods: { discards: 1 },
    independent: (ctx, b) => ctx.addVolume(30, b) },

  { key: 'bigBoard', name: 'Wide Berth', cost: 7, rarity: 'uncommon', art: '🖼️',
    text: '+1 board size',
    mods: { handSize: 1 } },

  { key: 'overtime', name: 'Night Shift', cost: 8, rarity: 'uncommon', art: '🌙',
    text: '+1 trade each deadline. Costs $4 when a deadline ends',
    mods: { trades: 1 },
    payout: () => -4 },

  { key: 'boardSeat', name: 'Extra Seat', cost: 10, rarity: 'rare', art: '🪑',
    text: '+1 desk slot',
    mods: { slots: 1 } },

  { key: 'savingsBond', name: 'Piggy Bank', cost: 5, art: '🐷',
    text: '+$5 when you clear a deadline',
    payout: () => 5 },

  { key: 'ramenBudget', name: 'Ramen Budget', cost: 6, rarity: 'uncommon', art: '🍜',
    text: 'Interest pays $1 per $4 held instead of per $5',
    mods: { interestRate: 4 } },

  { key: 'creditLine', name: 'IOU', cost: 7, rarity: 'uncommon', art: '💳',
    text: 'Interest cap raised by $4',
    mods: { interestCap: 4 } },

  { key: 'hoarder', name: 'Squirrel', cost: 6, rarity: 'uncommon', art: '🐿️',
    text: '+$2 for every unused trade when a deadline ends',
    payout: (state) => 2 * (state.session?.tradesLeft ?? 0) },

  { key: 'taxLoss', name: 'Salvager', cost: 6, rarity: 'uncommon', art: '🧾',
    text: 'Earn $5 on every RED trade',
    direction: (ctx, b) => { if (!ctx.correct) ctx.earn(5, b); } },

  { key: 'marketMaker', name: 'Toll Keeper', cost: 6, rarity: 'uncommon', art: '🛎️',
    text: 'Earn $1 for each printed candle',
    candleScored: (ctx, c, b) => ctx.earn(1, b) },

  { key: 'angelInvestor', name: 'Pawnbroker', cost: 6, rarity: 'uncommon', art: '💍',
    text: 'Brokers sell for $3 more',
    mods: { sellBonus: 3 } },

  { key: 'theMole', name: 'The Mole', cost: 9, rarity: 'rare', art: '🕵️',
    text: '+$6 when you clear a deadline, and +x0.1 Leverage per $25 held',
    payout: () => 6,
    independent: (ctx, b) => ctx.xLeverage(1 + 0.1 * Math.floor(ctx.state.cash / 25), b) },

  { key: 'shellCorp', name: 'The Fixer', cost: 7, rarity: 'uncommon', art: '🐚',
    text: 'The first reroll on every visit to the Floor is free',
    mods: { freeRerolls: 1 } },

  { key: 'brokerFriend', name: 'Friend of a Friend', cost: 7, rarity: 'uncommon', art: '🤝',
    text: 'Floor items cost $2 less (minimum $1)',
    mods: { discount: 2 } },

  { key: 'archivist', name: 'Archivist', cost: 7, rarity: 'uncommon', art: '🗃️',
    text: '+1 Chart slot',
    mods: { chartSlots: 1 } },

  { key: 'paperShuffler', name: 'Ragpicker', cost: 6, rarity: 'uncommon', art: '📄',
    text: 'Earn $1 for every candle you sweep',
    discarded: (state, candles, b) => { state.cash += candles.length; } },

  { key: 'insiderMemo', name: 'Sealed Letter', cost: 8, rarity: 'uncommon', art: '✉️',
    text: 'Creates a random Chart when a Boss deadline is beaten (needs room)',
    onBossClear: true },

  { key: 'contractLawyer', name: 'The Notary', cost: 8, rarity: 'uncommon', art: '🖋️',
    text: 'Creates a random Contract when a Boss deadline is beaten (needs room)',
    onBossClearContract: true },
]);

// --- Formation-bending / oddball -----------------------------------------------
add([
  { key: 'tapeReader', name: 'Seer', cost: 8, rarity: 'uncommon', art: '👁️',
    text: 'The formation you print counts as one level higher',
    mods: { formationLevelBonus: 1 } },

  { key: 'fourFingers', name: 'Nine Fingers', cost: 9, rarity: 'rare', art: '✋',
    text: 'Staircases and Sector Clusters can be made with 4 candles',
    mods: { fourCard: true } },

  { key: 'shortcut', name: 'Skipping Stone', cost: 9, rarity: 'rare', art: '🪨',
    text: 'Staircases can skip one body size',
    mods: { shortcut: true } },

  { key: 'splitter', name: 'Overspill', cost: 8, rarity: 'uncommon', art: '🌊',
    text: 'Every placed candle prints, even ones outside the formation',
    mods: { allScore: true } },

  { key: 'luckyStreak', name: "Rabbit's Foot", cost: 7, rarity: 'uncommon', art: '🐰',
    text: 'Wishbone candles trigger twice as often',
    mods: { luckyBoost: 2 } },

  { key: 'goldRush', name: 'Prospector', cost: 7, rarity: 'uncommon', art: '⛏️',
    text: '+2 Leverage for each $10 earned during this deadline',
    independent: (ctx, b) => { const n = Math.floor((ctx.state.session?.earnedThisDeadline ?? 0) / 10); if (n) ctx.addLeverage(2 * n, b); } },

  { key: 'burnout', name: 'Guttering Flame', cost: 5, art: '🪫',
    counters: { x: 3 },
    text: (b) => `x${b.counters.x.toFixed(2)} Leverage, losing x0.25 after every trade`,
    independent: (ctx, b) => {
      ctx.xLeverage(Math.max(1, b.counters.x), b);
      if (ctx.commit) b.counters.x = Math.max(1, +(b.counters.x - 0.25).toFixed(2));
    } },

  { key: 'sunkCost', name: 'Sunk Cost', cost: 6, rarity: 'uncommon', art: '⚓',
    text: '+15 Volume for each candle missing from your book (below 52)',
    independent: (ctx, b) => { const n = Math.max(0, 52 - ctx.state.book.length); if (n) ctx.addVolume(15 * n, b); } },

  { key: 'indexFund', name: 'The Congregation', cost: 8, rarity: 'uncommon', art: '👥',
    text: '+3 Leverage for every 5 candles in your book',
    independent: (ctx, b) => ctx.addLeverage(3 * Math.floor(ctx.state.book.length / 5), b) },

  { key: 'auditRisk', name: 'Cursed Ledger', cost: 6, rarity: 'uncommon', art: '📕',
    text: 'x2 Leverage, but a random candle is destroyed when a deadline ends',
    independent: (ctx, b) => ctx.xLeverage(2, b),
    destroysCard: true },

  { key: 'perpetualMotion', name: 'Perpetual Motion', cost: 9, rarity: 'rare', art: '⚙️',
    text: 'x1.6 Volume',
    independent: (ctx, b) => ctx.xVolume(1.6, b) },

  { key: 'darkAlpha', name: 'Void Pact', cost: 10, rarity: 'rare', art: '🕳️',
    text: 'x1 Leverage, +x0.35 for each desk slot you leave empty',
    independent: (ctx, b) => {
      const empty = Math.max(0, ctx.mods.slots - ctx.state.brokers.length);
      ctx.xLeverage(1 + 0.35 * empty, b);
    } },
]);

export const BROKER_KEYS = Object.keys(BROKERS);

export function brokerText(inst, state) {
  const d = BROKERS[inst.key];
  if (!d) return '';
  return typeof d.text === 'function' ? d.text(inst, state) : d.text;
}

export function makeBroker(key, rng) {
  const d = BROKERS[key];
  const inst = {
    key,
    uid: 'b' + Math.random().toString(36).slice(2, 9),
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

export function brokerSellValue(inst, state) {
  const base = Math.max(1, Math.ceil((BROKERS[inst.key]?.cost ?? 4) / 2));
  return base + (state?.mods?.sellBonus ?? 0);
}

/**
 * @param opts.exclude    keys already on offer in this same batch
 * @param opts.owned      keys the player already employs — never offered twice
 *                        unless Hall of Mirrors is on the desk
 * @param opts.rarity     restrict to one rarity band
 * If filtering leaves nothing at all, the restrictions are dropped rather than
 * handing back undefined.
 */
export function rollBrokerKey(rng, opts = {}) {
  const base = BROKER_KEYS.filter((k) => {
    const d = BROKERS[k];
    if (opts.rarity && d.rarity !== opts.rarity) return false;
    if (d.rarity === 'legendary' && !opts.allowLegendary && !opts.rarity) return false;
    return true;
  });
  const filtered = base.filter((k) =>
    !opts.exclude?.includes(k) && !opts.owned?.includes(k));
  const pool = filtered.length ? filtered : (base.length ? base : BROKER_KEYS);
  return rng.pickWeighted(pool.map((k) => ({ item: k, weight: RARITY[BROKERS[k].rarity].weight || 1 })));
}
