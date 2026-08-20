import { SECTORS } from './cards.js';

// ---------------------------------------------------------------------------
// BOSS DEADLINES — the third deadline of every week. Each one bends a rule.
// Hooks:
//   debuffSector           every ticker of that sector scores as if blank
//   onDeal(state, hand)    mutate the hand as it is dealt
//   beforeTrade(state, t)  { block: 'reason' } to veto a trade
//   afterTrade(state, res)
//   scoreHook(ctx)         run right before final P/L is computed
//   mods                   deltas applied to the session
// ---------------------------------------------------------------------------
const sectorBoss = (key, name, art, sector) => ({
  key, name, art, sector,
  blurb: `All ${SECTORS[sector].name} ${SECTORS[sector].glyph} tickers are blanked`,
  debuffSector: sector,
});

export const BOSSES = {
  auditor:     sectorBoss('auditor', 'The Auditor', '🔎', 'TECH'),
  regulator:   sectorBoss('regulator', 'The Regulator', '⚖️', 'FINANCE'),
  embargo:     sectorBoss('embargo', 'The Embargo', '🚧', 'ENERGY'),
  rugPull:     sectorBoss('rugPull', 'The Rug Pull', '🪤', 'CRYPTO'),

  flashCrash: { key: 'flashCrash', name: 'Flash Crash', art: '💣',
    blurb: 'Your first trade of the deadline scores nothing',
    scoreHook: (ctx) => { if (ctx.tradeIndex === 0) { ctx.xLeverage(0, { key: 'flashCrash', name: 'Flash Crash', boss: true }); } } },

  marginCall: { key: 'marginCall', name: 'Margin Call', art: '☎️',
    blurb: 'Every trade costs you $4',
    afterTrade: (state) => { state.cash = Math.max(0, state.cash - 4); } },

  circuitBreaker: { key: 'circuitBreaker', name: 'Circuit Breaker', art: '🔌',
    blurb: 'You get only 1 discard',
    mods: { setDiscards: 1 } },

  shortLadder: { key: 'shortLadder', name: 'Short Ladder Attack', art: '🪜',
    blurb: 'LONG trades score x0.4',
    scoreHook: (ctx) => { if (ctx.direction === 'LONG') ctx.xLeverage(0.4, { key: 'shortLadder', name: 'Short Ladder', boss: true }); } },

  bullTrap: { key: 'bullTrap', name: 'Bull Trap', art: '🪃',
    blurb: 'SHORT trades score x0.4',
    scoreHook: (ctx) => { if (ctx.direction === 'SHORT') ctx.xLeverage(0.4, { key: 'bullTrap', name: 'Bull Trap', boss: true }); } },

  washSale: { key: 'washSale', name: 'The Wash Sale', art: '🔁',
    blurb: 'You cannot take the same direction twice in a row',
    beforeTrade: (state, t) => {
      const last = state.session.lastDirection;
      if (last && last === t.direction) return { block: `Wash Sale: you must go ${last === 'LONG' ? 'SHORT' : 'LONG'} this trade` };
      return null;
    } },

  repeatBan: { key: 'repeatBan', name: 'Pattern Ban', art: '🚫',
    blurb: 'You cannot play the same chart pattern twice in a row',
    beforeTrade: (state, t) => {
      if (state.session.lastPattern && state.session.lastPattern === t.patternKey) {
        return { block: 'Pattern Ban: play a different pattern' };
      }
      return null;
    } },

  darkPoolBan: { key: 'darkPoolBan', name: 'Dark Pool Ban', art: '🌒',
    blurb: 'Hand size -2',
    mods: { handSize: -2 } },

  quietPeriod: { key: 'quietPeriod', name: 'Quiet Period', art: '🤫',
    blurb: 'The signal is hidden entirely',
    mods: { hideSignal: true } },

  fatFinger: { key: 'fatFinger', name: 'Fat Finger', art: '🖐️',
    blurb: 'One random ticker in your hand is blanked after every deal',
    onDeal: (state, hand, rng) => { if (hand.length) rng.pick(hand).debuffed = true; } },

  whaleWall: { key: 'whaleWall', name: 'The Whale Wall', art: '🐳',
    blurb: 'One fewer trade than usual',
    mods: { trades: -1 } },

  insiderProbe: { key: 'insiderProbe', name: 'Insider Probe', art: '🚔',
    blurb: 'All chart patterns score at level 1',
    mods: { flatPatternLevels: true } },

  taxSeason: { key: 'taxSeason', name: 'Tax Season', art: '🧾',
    blurb: 'You lose half your cash when the deadline starts',
    onStart: (state) => { state.cash = Math.floor(state.cash / 2); } },

  slippage: { key: 'slippage', name: 'Slippage', art: '🧈',
    blurb: 'Final Leverage is halved',
    scoreHook: (ctx) => ctx.xLeverage(0.5, { key: 'slippage', name: 'Slippage', boss: true }) },

  delisting: { key: 'delisting', name: 'Delisting', art: '🗑️',
    blurb: 'A random played ticker is destroyed after every trade',
    afterTrade: (state, res, rng) => {
      if (!res.played?.length) return;
      const c = rng.pick(res.played);
      const i = state.deck.findIndex((d) => d.uid === c.uid);
      if (i >= 0) state.deck.splice(i, 1);
      res.destroyed = c;
    } },

  clawback: { key: 'clawback', name: 'The Clawback', art: '🪝',
    blurb: 'Your leftmost perk is disabled',
    mods: { disableFirstPerk: true } },

  volatilityHalt: { key: 'volatilityHalt', name: 'Volatility Halt', art: '⏸️',
    blurb: 'All ticker enhancements are switched off',
    mods: { disableEnhancements: true } },

  theCeiling: { key: 'theCeiling', name: 'The Ceiling', art: '🧱',
    blurb: 'No single trade may book more than 60% of the quota',
    capFraction: 0.6 },

  faceControl: { key: 'faceControl', name: 'Face Control', art: '🎭',
    blurb: 'Face tickers (J/Q/K) are dealt face down until played',
    mods: { faceDownFaces: true } },

  hardClose: { key: 'hardClose', name: 'Hard Close', art: '⏰',
    blurb: 'Quota is 40% higher, but you get +1 trade and +1 discard',
    quotaMult: 1.4, mods: { trades: 1, discards: 1 } },

  theSpread: { key: 'theSpread', name: 'The Spread', art: '↔️',
    blurb: 'Every scored ticker contributes 0 base Volume',
    mods: { zeroCardVolume: true } },
};
export const BOSS_KEYS = Object.keys(BOSSES);

export function pickBoss(rng, seen = []) {
  const pool = BOSS_KEYS.filter((k) => !seen.includes(k));
  return rng.pick(pool.length ? pool : BOSS_KEYS);
}
