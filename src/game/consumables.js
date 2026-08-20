import { SECTOR_KEYS, SECTORS, makeCard, RANKS, ENHANCEMENT_KEYS, STAMPS } from './cards.js';
import { PATTERN_KEYS, PATTERNS } from './patterns.js';

// ---------------------------------------------------------------------------
// Three consumable families:
//   CHARTS    (tarot-likes)  — reshape your portfolio
//   CONTRACTS (planet-likes) — permanently level a chart pattern
//   RUMORS    (spectral-likes) — huge upside, real cost
//
// use(api) where api = {
//   state, rng, selected[], notify(msg),
//   addCard(card), destroyCard(card), createChart(n), createContract(n),
//   createRumor(n), levelPattern(key, n), copyPerk(), destroyRandomPerk(),
//   editionRandomPerk(edition), stampCard(card, stamp)
// }
// Each returns { ok:boolean, msg?:string }
// ---------------------------------------------------------------------------

const need = (api, min, max) => {
  const n = api.selected.length;
  if (n < min) return `Select ${min === max ? min : `${min}-${max}`} ticker${max > 1 ? 's' : ''}`;
  if (n > max) return `Select at most ${max}`;
  return null;
};

const enhancer = (key, name, art, enh, min, max, blurb) => ({
  key, name, art, family: 'chart', cost: 3,
  select: [min, max],
  text: blurb,
  use: (api) => {
    const err = need(api, min, max); if (err) return { ok: false, msg: err };
    for (const c of api.selected) { c.enhancement = enh; c.debuffed = false; }
    return { ok: true, msg: `${api.selected.length} ticker(s) → ${name}` };
  },
});

const sectorShift = (key, name, art, sector) => ({
  key, name, art, family: 'chart', cost: 3,
  select: [1, 3],
  text: `Convert up to 3 selected tickers to ${SECTORS[sector].name} ${SECTORS[sector].glyph}`,
  use: (api) => {
    const err = need(api, 1, 3); if (err) return { ok: false, msg: err };
    for (const c of api.selected) c.sector = sector;
    return { ok: true, msg: `Rotated into ${SECTORS[sector].name}` };
  },
});

export const CHARTS = {};
function addChart(list) { for (const c of list) CHARTS[c.key] = c; }

addChart([
  enhancer('analyst', 'The Analyst', '📊', 'bluechip', 1, 1, 'Turn 1 selected ticker into a Blue Chip (+30 Volume)'),
  enhancer('quant', 'The Quant', '🧮', 'leveraged', 1, 1, 'Turn 1 selected ticker into Leveraged (+4 Leverage)'),
  enhancer('gambler', 'The Gambler', '🎰', 'volatile', 1, 1, 'Turn 1 selected ticker Volatile (x2 Leverage, may shatter)'),
  enhancer('landlord', 'The Landlord', '🏘️', 'dividend', 1, 2, 'Turn up to 2 selected tickers into Dividend payers ($3 held)'),
  enhancer('custodian', 'The Custodian', '🛡️', 'hedged', 1, 2, 'Turn up to 2 selected tickers Hedged (x1.5 Leverage in hand)'),
  enhancer('wildcard', 'The Wildcard', '🃏', 'wild', 1, 2, 'Turn up to 2 selected tickers Diversified (all sectors)'),
  enhancer('lottery', 'The Lottery', '🎟️', 'penny', 1, 2, 'Turn up to 2 selected tickers into Penny Stocks'),
  enhancer('vault', 'The Vault', '🔒', 'restricted', 1, 1, 'Turn 1 selected ticker Restricted (+50 Volume, no rank or sector)'),

  sectorShift('techWave', 'Tech Wave', '💻', 'TECH'),
  sectorShift('oilShock', 'Oil Shock', '🛢️', 'ENERGY'),
  sectorShift('bankRun', 'Bank Run', '🏛️', 'FINANCE'),
  sectorShift('altSeason', 'Alt Season', '🌕', 'CRYPTO'),

  { key: 'pump', name: 'Pump', art: '🚀', family: 'chart', cost: 3, select: [1, 2],
    text: 'Increase the rank of up to 2 selected tickers by 1',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.rank = c.rank >= 14 ? 2 : c.rank + 1;
      return { ok: true, msg: 'Ranks pumped' };
    } },

  { key: 'dump', name: 'Dump', art: '📉', family: 'chart', cost: 3, select: [1, 2],
    text: 'Decrease the rank of up to 2 selected tickers by 1',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.rank = c.rank <= 2 ? 14 : c.rank - 1;
      return { ok: true, msg: 'Ranks dumped' };
    } },

  { key: 'buyback', name: 'Buyback', art: '🔥', family: 'chart', cost: 3, select: [1, 2],
    text: 'Destroy up to 2 selected tickers',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      const n = api.selected.length;
      for (const c of api.selected.slice()) api.destroyCard(c);
      return { ok: true, msg: `${n} ticker(s) retired` };
    } },

  { key: 'split', name: 'Stock Split', art: '🪞', family: 'chart', cost: 4, select: [1, 1],
    text: 'Add a perfect copy of 1 selected ticker to your portfolio',
    use: (api) => {
      const err = need(api, 1, 1); if (err) return { ok: false, msg: err };
      const src = api.selected[0];
      api.addCard(makeCard(src.sector, src.rank, {
        enhancement: src.enhancement, edition: src.edition, stamp: src.stamp, bonusVolume: src.bonusVolume,
      }));
      return { ok: true, msg: 'Shares split' };
    } },

  { key: 'merger', name: 'Merger', art: '🤝', family: 'chart', cost: 4, select: [2, 2],
    text: 'Convert the right selected ticker into a copy of the left one',
    use: (api) => {
      const err = need(api, 2, 2); if (err) return { ok: false, msg: err };
      const [a, b] = api.selected;
      Object.assign(b, { sector: a.sector, rank: a.rank, enhancement: a.enhancement, edition: a.edition, stamp: a.stamp, bonusVolume: a.bonusVolume });
      return { ok: true, msg: 'Merged' };
    } },

  { key: 'filing', name: 'The Filing', art: '📮', family: 'chart', cost: 4, select: [1, 1],
    text: 'Add a random stamp to 1 selected ticker',
    use: (api) => {
      const err = need(api, 1, 1); if (err) return { ok: false, msg: err };
      const stamp = api.rng.pick(Object.keys(STAMPS));
      api.selected[0].stamp = stamp;
      return { ok: true, msg: `${STAMPS[stamp].name} applied` };
    } },

  { key: 'insiderLeak', name: 'Insider Leak', art: '🕳️', family: 'chart', cost: 3, select: [0, 0],
    text: 'Create 2 random Charts (needs room)',
    use: (api) => { const n = api.createChart(2); return n ? { ok: true, msg: `${n} Chart(s) leaked` } : { ok: false, msg: 'No room' }; } },

  { key: 'bonusRound', name: 'Bonus Round', art: '🎁', family: 'chart', cost: 3, select: [0, 0],
    text: 'Create 1 random Contract (needs room)',
    use: (api) => { const n = api.createContract(1); return n ? { ok: true, msg: 'Contract signed' } : { ok: false, msg: 'No room' }; } },

  { key: 'fireSale', name: 'Fire Sale', art: '💰', family: 'chart', cost: 3, select: [0, 0],
    text: 'Gain $4 per perk on your desk (max $30)',
    use: (api) => {
      const amt = Math.min(30, 4 * api.state.perks.length);
      api.state.cash += amt;
      return { ok: true, msg: `+$${amt}` };
    } },

  { key: 'roadshow', name: 'Roadshow', art: '🚌', family: 'chart', cost: 4, select: [0, 0],
    text: 'Add a Laminated edition to a random ticker in your portfolio',
    use: (api) => {
      const pool = api.state.deck.filter((c) => !c.edition);
      if (!pool.length) return { ok: false, msg: 'Nothing to laminate' };
      api.rng.pick(pool).edition = 'laminated';
      return { ok: true, msg: 'Laminated' };
    } },

  { key: 'ipo', name: 'The IPO', art: '🔔', family: 'chart', cost: 4, select: [0, 0],
    text: 'Add 2 random Alpha (A) tickers to your portfolio',
    use: (api) => {
      for (let i = 0; i < 2; i++) api.addCard(makeCard(api.rng.pick(SECTOR_KEYS), 14));
      return { ok: true, msg: 'Two Alphas listed' };
    } },
]);

export const CHART_KEYS = Object.keys(CHARTS);

// ---------------------------------------------------------------------------
export const CONTRACTS = {};
const CONTRACT_ART = {
  flatline: '➖', doubleBottom: '⑂', headShoulders: '👤', tripleTop: '⛰️', breakout: '📶',
  rotation: '🔃', bullFlag: '🚩', quadWitching: '🧙', goldenCross: '✝️', insiderTip: '🤫',
  marketCorner: '📐', monopoly: '👑',
};
for (const key of PATTERN_KEYS) {
  const p = PATTERNS[key];
  CONTRACTS['ct_' + key] = {
    key: 'ct_' + key, name: `${p.name} Contract`, art: CONTRACT_ART[key] || '📜',
    family: 'contract', cost: 3, pattern: key, select: [0, 0], secret: p.secret,
    text: `Level up ${p.name} (+${p.volInc} Volume, +${p.levInc} Leverage)`,
    use: (api) => { api.levelPattern(key, 1); return { ok: true, msg: `${p.name} upgraded` }; },
  };
}
export const CONTRACT_KEYS = Object.keys(CONTRACTS);

// ---------------------------------------------------------------------------
export const RUMORS = {};
function addRumor(list) { for (const r of list) RUMORS[r.key] = { family: 'rumor', cost: 4, ...r }; }

addRumor([
  { key: 'nakedShort', name: 'Naked Short', art: '🩲', select: [1, 1],
    text: 'Add a Reissue Stamp to 1 selected ticker, then destroy 1 random ticker',
    use: (api) => {
      const err = need(api, 1, 1); if (err) return { ok: false, msg: err };
      api.selected[0].stamp = 'reissue';
      const pool = api.state.deck.filter((c) => c !== api.selected[0]);
      if (pool.length) api.destroyCard(api.rng.pick(pool));
      return { ok: true, msg: 'Reissued' };
    } },

  { key: 'blockTrade', name: 'Block Trade', art: '🧱', select: [1, 1],
    text: 'Add a Hold Stamp to 1 selected ticker',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'hold'; return { ok: true, msg: 'Held' }; } },

  { key: 'kickback', name: 'Kickback', art: '🤑', select: [1, 1],
    text: 'Add a Payout Stamp to 1 selected ticker',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'payout'; return { ok: true, msg: 'Stamped' }; } },

  { key: 'paperTrail', name: 'Paper Trail', art: '🧻', select: [1, 1],
    text: 'Add a Filing Stamp to 1 selected ticker',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'filing'; return { ok: true, msg: 'Filed' }; } },

  { key: 'gilding', name: 'Gilding', art: '✨', select: [0, 0],
    text: 'Add a Laminated edition to a random perk (+50 Volume)',
    use: (api) => api.editionRandomPerk('laminated') },

  { key: 'nakedCall', name: 'Naked Call', art: '🌈', select: [0, 0],
    text: 'Add a Holographic edition to a random perk (+10 Leverage)',
    use: (api) => api.editionRandomPerk('holographic') },

  { key: 'quantModel', name: 'Quant Model', art: '🧊', select: [0, 0],
    text: 'Add an Algorithmic edition to a random perk (x1.5 Leverage)',
    use: (api) => api.editionRandomPerk('algorithmic') },

  { key: 'offBookDeal', name: 'Off-Book Deal', art: '🕶️', select: [0, 0],
    text: 'Add an Off-Book edition to a random perk (+1 slot), then destroy another random perk',
    use: (api) => {
      const r = api.editionRandomPerk('offbook');
      if (!r.ok) return r;
      api.destroyRandomPerk(r.spared);
      return { ok: true, msg: 'Kept off the books' };
    } },

  { key: 'hostileTakeover', name: 'Hostile Takeover', art: '⚔️', select: [0, 0],
    text: 'Create a copy of a random perk on your desk (needs a slot)',
    use: (api) => api.copyPerk() },

  { key: 'restructure', name: 'Restructure', art: '🏗️', select: [0, 0],
    text: 'Convert all tickers in your hand to a single random sector',
    use: (api) => {
      const hand = api.state.session?.hand || [];
      if (!hand.length) return { ok: false, msg: 'No hand to restructure' };
      const s = api.rng.pick(SECTOR_KEYS);
      for (const c of hand) c.sector = s;
      return { ok: true, msg: `Hand rotated to ${SECTORS[s].name}` };
    } },

  { key: 'insiderWhisper', name: 'Insider Whisper', art: '🤐', select: [0, 0],
    text: 'Convert all tickers in your hand into copies of a random one of them',
    use: (api) => {
      const hand = api.state.session?.hand || [];
      if (hand.length < 2) return { ok: false, msg: 'Need a hand' };
      const src = api.rng.pick(hand);
      for (const c of hand) if (c !== src) Object.assign(c, { sector: src.sector, rank: src.rank, enhancement: src.enhancement, edition: src.edition });
      return { ok: true, msg: 'Everyone got the same tip' };
    } },

  { key: 'shellGame', name: 'Shell Game', art: '🥥', select: [0, 0],
    text: 'Permanently +2 hand size, then destroy 2 random tickers',
    use: (api) => {
      api.state.permanent.handSize += 2;
      for (let i = 0; i < 2; i++) { const pool = api.state.deck; if (pool.length > 5) api.destroyCard(api.rng.pick(pool)); }
      return { ok: true, msg: '+2 hand size' };
    } },

  { key: 'blackout', name: 'Blackout', art: '⬛', select: [0, 0],
    text: 'Turn every ticker in your hand Restricted (+50 Volume, no rank or sector)',
    use: (api) => {
      const hand = api.state.session?.hand || [];
      if (!hand.length) return { ok: false, msg: 'No hand' };
      for (const c of hand) c.enhancement = 'restricted';
      return { ok: true, msg: 'Hand went dark' };
    } },

  { key: 'dilution', name: 'Dilution', art: '💧', select: [0, 0],
    text: 'Add 4 random tickers of the same random rank to your portfolio',
    use: (api) => {
      const rank = api.rng.pick(RANKS).rank;
      for (let i = 0; i < 4; i++) api.addCard(makeCard(api.rng.pick(SECTOR_KEYS), rank));
      return { ok: true, msg: 'Shares diluted' };
    } },

  { key: 'chapter11', name: 'Chapter 11', art: '🧨', select: [0, 0],
    text: 'Lose all cash, then level up the pattern you have played the most by 3',
    use: (api) => {
      const lost = api.state.cash;
      api.state.cash = 0;
      let best = PATTERN_KEYS[0], n = -1;
      for (const k of PATTERN_KEYS) { const c = api.state.patterns[k].played; if (c > n) { n = c; best = k; } }
      api.levelPattern(best, 3);
      return { ok: true, msg: `Lost $${lost}, ${PATTERNS[best].name} +3` };
    } },

  { key: 'frontOffice', name: 'Front Office', art: '🏢', select: [0, 0],
    text: 'Permanently +1 desk slot, then lose half your cash',
    use: (api) => {
      api.state.permanent.slots += 1;
      api.state.cash = Math.floor(api.state.cash / 2);
      return { ok: true, msg: '+1 desk slot' };
    } },

  { key: 'totalRecall', name: 'Total Recall', art: '🌀', select: [0, 0],
    text: 'Permanently -1 hand size, +1 desk slot, +1 Chart slot',
    use: (api) => {
      api.state.permanent.handSize -= 1;
      api.state.permanent.slots += 1;
      api.state.permanent.chartSlots += 1;
      return { ok: true, msg: 'Desk reorganised' };
    } },

  { key: 'theSqueeze', name: 'The Squeeze', art: '🗜️', select: [0, 0],
    text: 'Level up every chart pattern by 1',
    cost: 6,
    use: (api) => { for (const k of PATTERN_KEYS) api.levelPattern(k, 1); return { ok: true, msg: 'Everything levelled' }; } },
]);
export const RUMOR_KEYS = Object.keys(RUMORS);

export const ALL_CONSUMABLES = { ...CHARTS, ...CONTRACTS, ...RUMORS };

export function makeConsumable(key) {
  const d = ALL_CONSUMABLES[key];
  if (!d) throw new Error('unknown consumable ' + key);
  return { key, uid: 'u' + Math.random().toString(36).slice(2, 9), family: d.family };
}

export function rollChart(rng, exclude = []) {
  const pool = CHART_KEYS.filter((k) => !exclude.includes(k));
  return rng.pick(pool.length ? pool : CHART_KEYS);
}
export function rollContract(rng, discovered = []) {
  const pool = CONTRACT_KEYS.filter((k) => !CONTRACTS[k].secret || discovered.includes(CONTRACTS[k].pattern));
  return rng.pick(pool.length ? pool : CONTRACT_KEYS.slice(0, 9));
}
export function rollRumor(rng) { return rng.pick(RUMOR_KEYS); }
