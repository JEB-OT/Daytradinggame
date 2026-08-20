import { SECTORS } from './candles.js';

// ---------------------------------------------------------------------------
// BOSS DEADLINES — the third deadline of every week. Each bends one rule.
// Hooks:
//   debuffSector / debuffPolarity  blank matching candles for the deadline
//   onDeal(state, fresh, rng)      mutate candles as they hit the board
//   beforeTrade(state, t)          { block: 'reason' } to veto a trade
//   afterTrade(state, res, rng)
//   scoreHook(ctx)                 runs just before final P/L
//   mods                           session deltas
// ---------------------------------------------------------------------------
const sectorBoss = (key, name, art, sector) => ({
  key, name, art, sector,
  blurb: `All ${SECTORS[sector].name} ${SECTORS[sector].glyph} candles are blanked`,
  debuffSector: sector,
});

export const BOSSES = {
  auditor:   sectorBoss('auditor', 'The Auditor', '🔎', 'TECH'),
  regulator: sectorBoss('regulator', 'The Regulator', '⚖️', 'FINANCE'),
  embargo:   sectorBoss('embargo', 'The Embargo', '🚧', 'ENERGY'),
  rugPull:   sectorBoss('rugPull', 'The Rug Pull', '🪤', 'CRYPTO'),

  greenScreen: { key: 'greenScreen', name: 'Green Screen', art: '🟩',
    blurb: 'All BULL candles are blanked', debuffPolarity: 'bull' },

  redScreen: { key: 'redScreen', name: 'Red Screen', art: '🟥',
    blurb: 'All BEAR candles are blanked', debuffPolarity: 'bear' },

  noConviction: { key: 'noConviction', name: 'The Doubt', art: '😶‍🌫️',
    blurb: 'Conviction bonuses do nothing', mods: { noConviction: true } },

  shuffleDesk: { key: 'shuffleDesk', name: 'The Scramble', art: '🎲',
    blurb: 'Your candles print in a random order, not the one you set',
    scrambleOrder: true },

  flashCrash: { key: 'flashCrash', name: 'Flash Crash', art: '💣',
    blurb: 'Your first trade of the deadline prints nothing',
    scoreHook: (ctx) => { if (ctx.tradeIndex === 0) ctx.xLeverage(0, { name: 'Flash Crash', boss: true }); } },

  marginCall: { key: 'marginCall', name: 'Margin Call', art: '☎️',
    blurb: 'Every trade costs you $4',
    afterTrade: (state) => { state.cash = Math.max(0, state.cash - 4); } },

  circuitBreaker: { key: 'circuitBreaker', name: 'Circuit Breaker', art: '🔌',
    blurb: 'You get only 1 sweep', mods: { setDiscards: 1 } },

  shortLadder: { key: 'shortLadder', name: 'Short Ladder Attack', art: '🪜',
    blurb: 'LONG calls score x0.4',
    scoreHook: (ctx) => { if (ctx.direction === 'LONG') ctx.xLeverage(0.4, { name: 'Short Ladder', boss: true }); } },

  bullTrap: { key: 'bullTrap', name: 'Bull Trap', art: '🪃',
    blurb: 'SHORT calls score x0.4',
    scoreHook: (ctx) => { if (ctx.direction === 'SHORT') ctx.xLeverage(0.4, { name: 'Bull Trap', boss: true }); } },

  washSale: { key: 'washSale', name: 'The Wash Sale', art: '🔁',
    blurb: 'You cannot call the same direction twice in a row',
    beforeTrade: (state, t) => {
      const last = state.session.lastDirection;
      if (last && last === t.direction) return { block: `Wash Sale: you must go ${last === 'LONG' ? 'SHORT' : 'LONG'} this trade` };
      return null;
    } },

  repeatBan: { key: 'repeatBan', name: 'Formation Ban', art: '🚫',
    blurb: 'You cannot print the same formation twice in a row',
    beforeTrade: (state, t) => {
      if (state.session.lastFormation && state.session.lastFormation === t.formationKey) {
        return { block: 'Formation Ban: print something else' };
      }
      return null;
    } },

  darkPoolBan: { key: 'darkPoolBan', name: 'Dark Pool Ban', art: '🌒',
    blurb: 'Board size -2', mods: { handSize: -2 } },

  quietPeriod: { key: 'quietPeriod', name: 'Quiet Period', art: '🤫',
    blurb: 'The signal is hidden entirely', mods: { hideSignal: true } },

  fatFinger: { key: 'fatFinger', name: 'Fat Finger', art: '🖐️',
    blurb: 'One random candle is blanked every time the board refills',
    onDeal: (state, fresh, rng) => { if (fresh.length) rng.pick(fresh).debuffed = true; } },

  whaleWall: { key: 'whaleWall', name: 'The Whale Wall', art: '🐳',
    blurb: 'One fewer trade than usual', mods: { trades: -1 } },

  insiderProbe: { key: 'insiderProbe', name: 'Insider Probe', art: '🚔',
    blurb: 'All formations score at level 1', mods: { flatFormationLevels: true } },

  taxSeason: { key: 'taxSeason', name: 'Tax Season', art: '🧾',
    blurb: 'You lose half your cash when the deadline starts',
    onStart: (state) => { state.cash = Math.floor(state.cash / 2); } },

  slippage: { key: 'slippage', name: 'Slippage', art: '🧈',
    blurb: 'Final Leverage is halved',
    scoreHook: (ctx) => ctx.xLeverage(0.5, { name: 'Slippage', boss: true }) },

  delisting: { key: 'delisting', name: 'Delisting', art: '🗑️',
    blurb: 'A random printed candle is destroyed after every trade',
    afterTrade: (state, res, rng) => {
      if (!res.played?.length) return;
      const c = rng.pick(res.played);
      const i = state.book.findIndex((d) => d.uid === c.uid);
      if (i >= 0) state.book.splice(i, 1);
      res.destroyed = c;
    } },

  clawback: { key: 'clawback', name: 'The Clawback', art: '🪝',
    blurb: 'Your leftmost broker is disabled', mods: { disableFirstBroker: true } },

  volatilityHalt: { key: 'volatilityHalt', name: 'Volatility Halt', art: '⏸️',
    blurb: 'All candle enhancements are switched off', mods: { disableEnhancements: true } },

  theCeiling: { key: 'theCeiling', name: 'The Ceiling', art: '🧱',
    blurb: 'No single trade may book more than 60% of the quota', capFraction: 0.6 },

  wideControl: { key: 'wideControl', name: 'Position Limits', art: '🎭',
    blurb: 'WIDE candles (body 11+) are dealt face down until placed',
    mods: { faceDownWide: true } },

  hardClose: { key: 'hardClose', name: 'Hard Close', art: '⏰',
    blurb: 'Quota is 40% higher, but you get +1 trade and +1 sweep',
    quotaMult: 1.4, mods: { trades: 1, discards: 1 } },

  theSpread: { key: 'theSpread', name: 'The Spread', art: '↔️',
    blurb: 'Every printed candle contributes 0 base Volume',
    mods: { zeroCandleVolume: true } },
};
export const BOSS_KEYS = Object.keys(BOSSES);

export function pickBoss(rng, seen = []) {
  const pool = BOSS_KEYS.filter((k) => !seen.includes(k));
  return rng.pick(pool.length ? pool : BOSS_KEYS);
}
