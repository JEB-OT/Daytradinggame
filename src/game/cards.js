import { id } from '../engine/util.js';

// ---------------------------------------------------------------------------
// Sectors ("suits"). GROWTH vs VALUE are the two colour groups.
// ---------------------------------------------------------------------------
export const SECTORS = {
  TECH:    { key: 'TECH',    name: 'Tech',    glyph: '▲', color: '#3fd8ff', group: 'GROWTH' },
  CRYPTO:  { key: 'CRYPTO',  name: 'Crypto',  glyph: '◆', color: '#ff5cf0', group: 'GROWTH' },
  ENERGY:  { key: 'ENERGY',  name: 'Energy',  glyph: '⚡', color: '#ffb020', group: 'VALUE'  },
  FINANCE: { key: 'FINANCE', name: 'Finance', glyph: '●', color: '#43e08a', group: 'VALUE'  },
};
export const SECTOR_KEYS = Object.keys(SECTORS);

// ---------------------------------------------------------------------------
// Ranks. 2-10 numeric, then Junk / Quarterly / Blue-chip / Alpha.
// ---------------------------------------------------------------------------
export const RANKS = [
  { rank: 2,  label: '2', volume: 2 },
  { rank: 3,  label: '3', volume: 3 },
  { rank: 4,  label: '4', volume: 4 },
  { rank: 5,  label: '5', volume: 5 },
  { rank: 6,  label: '6', volume: 6 },
  { rank: 7,  label: '7', volume: 7 },
  { rank: 8,  label: '8', volume: 8 },
  { rank: 9,  label: '9', volume: 9 },
  { rank: 10, label: '10', volume: 10 },
  { rank: 11, label: 'J', volume: 10, name: 'Junk' },
  { rank: 12, label: 'Q', volume: 10, name: 'Quarterly' },
  { rank: 13, label: 'K', volume: 10, name: 'Blue Chip' },
  { rank: 14, label: 'A', volume: 11, name: 'Alpha' },
];
export const RANK_BY_VALUE = Object.fromEntries(RANKS.map((r) => [r.rank, r]));
export const FACE_RANKS = [11, 12, 13];

export function rankLabel(rank) { return RANK_BY_VALUE[rank]?.label ?? String(rank); }
export function isFace(card) { return FACE_RANKS.includes(card.rank); }

// ---------------------------------------------------------------------------
// Enhancements — printed on a ticker, changes how it scores.
// ---------------------------------------------------------------------------
export const ENHANCEMENTS = {
  leveraged:   { key: 'leveraged',   name: 'Leveraged',   short: 'LEV',  color: '#ff6b5c', desc: '+4 Leverage when scored' },
  bluechip:    { key: 'bluechip',    name: 'Blue Chip',   short: 'BLU',  color: '#6ab7ff', desc: '+30 Volume when scored' },
  wild:        { key: 'wild',        name: 'Diversified', short: 'DIV',  color: '#c9a4ff', desc: 'Counts as every sector' },
  volatile:    { key: 'volatile',    name: 'Volatile',    short: 'VOL',  color: '#7ef9ff', desc: 'x2 Leverage. 1 in 4 chance to be destroyed after the trade' },
  dividend:    { key: 'dividend',    name: 'Dividend',    short: 'DIV$', color: '#ffd94a', desc: '$3 when held in hand at end of trade' },
  hedged:      { key: 'hedged',      name: 'Hedged',      short: 'HDG',  color: '#9fb2c9', desc: 'x1.5 Leverage while held in hand' },
  penny:       { key: 'penny',       name: 'Penny Stock', short: 'PNY',  color: '#43e08a', desc: '1 in 5 for +20 Leverage, 1 in 15 for $20' },
  restricted:  { key: 'restricted',  name: 'Restricted',  short: 'RST',  color: '#6b7480', desc: '+50 Volume, no rank or sector' },
};
export const ENHANCEMENT_KEYS = Object.keys(ENHANCEMENTS);

// ---------------------------------------------------------------------------
// Editions — the shiny layer.
// ---------------------------------------------------------------------------
export const EDITIONS = {
  laminated:    { key: 'laminated',    name: 'Laminated',    desc: '+50 Volume' },
  holographic:  { key: 'holographic',  name: 'Holographic',  desc: '+10 Leverage' },
  algorithmic:  { key: 'algorithmic',  name: 'Algorithmic',  desc: 'x1.5 Leverage' },
  offbook:      { key: 'offbook',      name: 'Off-Book',     desc: 'Does not use a desk slot' },
};

// ---------------------------------------------------------------------------
// Stamps — the "seal" layer.
// ---------------------------------------------------------------------------
export const STAMPS = {
  reissue: { key: 'reissue', name: 'Reissue Stamp', color: '#ff5c5c', desc: 'Retrigger this ticker one additional time' },
  hold:    { key: 'hold',    name: 'Hold Stamp',    color: '#4aa8ff', desc: 'Stays in hand when the trade resolves' },
  payout:  { key: 'payout',  name: 'Payout Stamp',  color: '#ffd94a', desc: 'Earn $3 when this ticker scores' },
  filing:  { key: 'filing',  name: 'Filing Stamp',  color: '#c07bff', desc: 'Creates a Chart when discarded (needs room)' },
};

// ---------------------------------------------------------------------------
export function makeCard(sector, rank, extra = {}) {
  return {
    uid: id(),
    sector,
    rank,
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

export function standardDeck() {
  const cards = [];
  for (const s of SECTOR_KEYS) {
    for (const r of RANKS) cards.push(makeCard(s, r.rank));
  }
  return cards;
}

export function cardName(card) {
  if (card.enhancement === 'restricted') return 'Restricted Filing';
  return `${rankLabel(card.rank)} of ${SECTORS[card.sector].name}`;
}

export function baseVolume(card) {
  if (card.enhancement === 'restricted') return 50;
  return (RANK_BY_VALUE[card.rank]?.volume ?? 0) + (card.bonusVolume || 0);
}

// A "Diversified" ticker matches every sector; "Restricted" matches none.
export function matchesSector(card, sector) {
  if (card.debuffed) return card.sector === sector;
  if (card.enhancement === 'restricted') return false;
  if (card.enhancement === 'wild') return true;
  return card.sector === sector;
}

export function hasRank(card) {
  return card.enhancement !== 'restricted';
}

export function sectorGroup(card) {
  return SECTORS[card.sector]?.group;
}

export function sortCards(cards, mode = 'rank') {
  const copy = cards.slice();
  if (mode === 'sector') {
    copy.sort((a, b) => SECTOR_KEYS.indexOf(a.sector) - SECTOR_KEYS.indexOf(b.sector) || b.rank - a.rank);
  } else {
    copy.sort((a, b) => b.rank - a.rank || SECTOR_KEYS.indexOf(a.sector) - SECTOR_KEYS.indexOf(b.sector));
  }
  return copy;
}

export function describeCard(card) {
  const bits = [];
  if (card.edition) bits.push(EDITIONS[card.edition].name);
  if (card.enhancement) bits.push(ENHANCEMENTS[card.enhancement].name);
  if (card.stamp) bits.push(STAMPS[card.stamp].name);
  return bits.join(' · ');
}
