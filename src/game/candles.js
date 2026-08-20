import { id } from '../engine/util.js';

// ---------------------------------------------------------------------------
// A CANDLE is the play piece. Three independent axes:
//   sector    — the "suit"; drives sector formations and broker synergies
//   body      — 1..13 magnitude; contributes its value in Volume
//   polarity  — BULL or BEAR; feeds Conviction when you call the tape
// ---------------------------------------------------------------------------
export const SECTORS = {
  TECH:    { key: 'TECH',    name: 'Tech',    glyph: '▲', color: '#3fd8ff', group: 'GROWTH' },
  CRYPTO:  { key: 'CRYPTO',  name: 'Crypto',  glyph: '◆', color: '#ff5cf0', group: 'GROWTH' },
  ENERGY:  { key: 'ENERGY',  name: 'Energy',  glyph: '⚡', color: '#ffb020', group: 'VALUE'  },
  FINANCE: { key: 'FINANCE', name: 'Finance', glyph: '●', color: '#43e08a', group: 'VALUE'  },
};
export const SECTOR_KEYS = Object.keys(SECTORS);

export const MIN_BODY = 1;
export const MAX_BODY = 13;
export const BODIES = Array.from({ length: MAX_BODY }, (_, i) => i + 1);

/** Flavour bands. A body of 1 is a doji; 11+ is a wide-bodied marubozu. */
export function isDoji(c) { return bodyOf(c) === 1; }
export function isWide(c) { return bodyOf(c) >= 11; }
export function isSmall(c) { return bodyOf(c) <= 4; }
export function bodyOf(c) { return c.enhancement === 'sealed' ? 0 : c.body; }

export function bodyLabel(body) {
  if (body === 1) return 'DOJI';
  if (body >= 11) return 'WIDE';
  return '';
}

// ---------------------------------------------------------------------------
// Enhancements — printed onto a candle.
// ---------------------------------------------------------------------------
export const ENHANCEMENTS = {
  leveraged: { key: 'leveraged', name: 'Leveraged', short: 'LEV',  color: '#ff6b5c', desc: '+4 Leverage when it prints' },
  blockTick: { key: 'blockTick', name: 'Block Tick', short: 'BLK', color: '#6ab7ff', desc: '+30 Volume when it prints' },
  wild:      { key: 'wild',      name: 'Rotating',  short: 'ROT',  color: '#c9a4ff', desc: 'Counts as every sector' },
  volatile:  { key: 'volatile',  name: 'Volatile',  short: 'VOL',  color: '#7ef9ff', desc: 'x2 Leverage. 1 in 4 chance to be destroyed after the trade' },
  dividend:  { key: 'dividend',  name: 'Dividend',  short: 'DIV',  color: '#ffd94a', desc: '$3 when held on the board at the close' },
  hedged:    { key: 'hedged',    name: 'Hedged',    short: 'HDG',  color: '#9fb2c9', desc: 'x1.5 Leverage while held on the board' },
  penny:     { key: 'penny',     name: 'Penny',     short: 'PNY',  color: '#43e08a', desc: '1 in 5 for +20 Leverage, 1 in 15 for $20' },
  swing:     { key: 'swing',     name: 'Swing',     short: 'SWG',  color: '#ff9f43', desc: 'Counts as BOTH bull and bear for Conviction' },
  sealed:    { key: 'sealed',    name: 'Sealed',    short: 'SLD',  color: '#6b7480', desc: '+50 Volume, but no body, sector or polarity' },
};
export const ENHANCEMENT_KEYS = Object.keys(ENHANCEMENTS);

export const EDITIONS = {
  laminated:   { key: 'laminated',   name: 'Laminated',   desc: '+50 Volume' },
  holographic: { key: 'holographic', name: 'Holographic', desc: '+10 Leverage' },
  algorithmic: { key: 'algorithmic', name: 'Algorithmic', desc: 'x1.5 Leverage' },
  offbook:     { key: 'offbook',     name: 'Off-Book',    desc: 'Does not use a desk slot' },
};

export const STAMPS = {
  reissue: { key: 'reissue', name: 'Reissue Stamp', color: '#ff5c5c', desc: 'This candle prints one extra time' },
  hold:    { key: 'hold',    name: 'Hold Stamp',    color: '#4aa8ff', desc: 'Stays on the board when the trade resolves' },
  payout:  { key: 'payout',  name: 'Payout Stamp',  color: '#ffd94a', desc: 'Earn $3 when this candle prints' },
  filing:  { key: 'filing',  name: 'Filing Stamp',  color: '#c07bff', desc: 'Creates a Chart when swept (needs room)' },
};

// ---------------------------------------------------------------------------
export function makeCandle(sector, body, bull, extra = {}) {
  return {
    uid: id(),
    sector,
    body,
    bull,
    enhancement: null,
    edition: null,
    stamp: null,
    bonusVolume: 0,
    bonusLeverage: 0,
    debuffed: false,
    faceDown: false,
    ...extra,
  };
}

/** 52 candles: every sector x body once, split exactly 26 bull / 26 bear. */
export function standardBook() {
  const out = [];
  SECTOR_KEYS.forEach((s, si) => {
    for (const body of BODIES) out.push(makeCandle(s, body, (body + si) % 2 === 0));
  });
  return out;
}

export function candleName(c) {
  if (c.enhancement === 'sealed') return 'Sealed Candle';
  const band = bodyLabel(c.body);
  return `${c.bull ? 'Bull' : 'Bear'} ${band ? band + ' ' : ''}${c.body} of ${SECTORS[c.sector].name}`;
}

export function baseVolume(c) {
  if (c.enhancement === 'sealed') return 50;
  return c.body + (c.bonusVolume || 0);
}

export function hasBody(c) { return c.enhancement !== 'sealed'; }

export function matchesSector(c, sector) {
  if (c.debuffed) return c.sector === sector;
  if (c.enhancement === 'sealed') return false;
  if (c.enhancement === 'wild') return true;
  return c.sector === sector;
}

/** 'bull' | 'bear' | 'both' | 'none' */
export function polarityOf(c) {
  if (c.enhancement === 'sealed') return 'none';
  if (c.enhancement === 'swing' && !c.debuffed) return 'both';
  return c.bull ? 'bull' : 'bear';
}

export function matchesDirection(c, direction) {
  const p = polarityOf(c);
  if (p === 'none') return false;
  if (p === 'both') return true;
  return direction === 'LONG' ? p === 'bull' : p === 'bear';
}

export function sectorGroup(c) { return SECTORS[c.sector]?.group; }

export function sortCandles(list, mode = 'body') {
  const copy = list.slice();
  if (mode === 'sector') {
    copy.sort((a, b) => SECTOR_KEYS.indexOf(a.sector) - SECTOR_KEYS.indexOf(b.sector) || b.body - a.body);
  } else if (mode === 'polarity') {
    copy.sort((a, b) => (a.bull === b.bull ? b.body - a.body : (a.bull ? -1 : 1)));
  } else {
    copy.sort((a, b) => b.body - a.body || SECTOR_KEYS.indexOf(a.sector) - SECTOR_KEYS.indexOf(b.sector));
  }
  return copy;
}

export function describeCandle(c) {
  const bits = [];
  if (c.edition) bits.push(EDITIONS[c.edition].name);
  if (c.enhancement) bits.push(ENHANCEMENTS[c.enhancement].name);
  if (c.stamp) bits.push(STAMPS[c.stamp].name);
  return bits.join(' · ');
}

/**
 * Deterministic drawing proportions for one candle, as percentages of the
 * tile's chart area. Wick lengths jitter per-uid so a board never looks flat.
 */
export function candleShape(c) {
  let h = 0;
  const s = String(c.uid);
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  const jitterA = ((h >>> 3) % 100) / 100;
  const jitterB = ((h >>> 11) % 100) / 100;
  const body = c.enhancement === 'sealed' ? 34 : 12 + (c.body / MAX_BODY) * 58;
  const room = Math.max(0, 100 - body);
  const upper = room * (0.18 + jitterA * 0.5);
  const lower = Math.max(0, room - upper) * (0.35 + jitterB * 0.55);
  return { body, upper, lower, bottom: lower };
}
