import { SECTOR_KEYS, SECTORS, makeCandle, BODIES, MAX_BODY, MIN_BODY, STAMPS } from './candles.js';
import { FORMATION_KEYS, FORMATIONS } from './formations.js';

// ---------------------------------------------------------------------------
//   CHARTS    reshape the candles in your book
//   CONTRACTS permanently level a formation
//   RUMORS    high upside, real cost
//
// use(api) where api = {
//   state, rng, selected[],
//   addCandle, destroyCandle, createChart(n), createContract(n), createRumor(n),
//   levelFormation(key, n), copyBroker(), destroyRandomBroker(), editionRandomBroker(e)
// }
// ---------------------------------------------------------------------------

const need = (api, min, max) => {
  const n = api.selected.length;
  if (n < min) return `Select ${min === max ? min : `${min}-${max}`} candle${max > 1 ? 's' : ''}`;
  if (n > max) return `Select at most ${max}`;
  return null;
};

const enhancer = (key, name, art, enh, min, max, blurb) => ({
  key, name, art, family: 'chart', cost: 3, select: [min, max], text: blurb,
  use: (api) => {
    const err = need(api, min, max); if (err) return { ok: false, msg: err };
    for (const c of api.selected) { c.enhancement = enh; c.debuffed = false; }
    return { ok: true, msg: `${api.selected.length} candle(s) → ${name}` };
  },
});

const sectorShift = (key, name, art, sector) => ({
  key, name, art, family: 'chart', cost: 3, select: [1, 3],
  text: `Rotate up to 3 selected candles into ${SECTORS[sector].name} ${SECTORS[sector].glyph}`,
  use: (api) => {
    const err = need(api, 1, 3); if (err) return { ok: false, msg: err };
    for (const c of api.selected) c.sector = sector;
    return { ok: true, msg: `Rotated into ${SECTORS[sector].name}` };
  },
});

export const CHARTS = {};
function addChart(list) { for (const c of list) CHARTS[c.key] = c; }

addChart([
  enhancer('analyst', "The Mint", '🏛️', 'bullion', 1, 1, 'Turn 1 selected candle into a Bullion (+30 Volume)'),
  enhancer('quant', "The Blade", '🗡️', 'bloodstone', 1, 1, 'Turn 1 selected candle Bloodstone (+4 Leverage)'),
  enhancer('gambler', "The Gambler", '🎰', 'glasswork', 1, 1, 'Turn 1 selected candle Glasswork (x2 Leverage, may shatter)'),
  enhancer('landlord', "The Tithe-Collector", '🏘️', 'goldleaf', 1, 2, 'Turn up to 2 selected candles into Goldleaf payers'),
  enhancer('custodian', "The Warden", '🛡️', 'wardstone', 1, 2, 'Turn up to 2 selected candles Wardstone (x1.5 Leverage while held)'),
  enhancer('wildcard', "The Shapeshifter", '🃏', 'chameleon', 1, 2, 'Turn up to 2 selected candles Chameleon (counts as every sector)'),
  enhancer('lottery', "The Wishing Well", '⛲', 'wishbone', 1, 2, 'Turn up to 2 selected candles into Wishbone candles'),
  enhancer('vault', "The Tomb", '🪦', 'obsidian', 1, 1, 'Seal 1 selected candle (+50 Volume, no body, sector or polarity)'),
  enhancer('forge', 'The Forge', '🔨', 'ember', 1, 1, 'Turn 1 selected candle into an Ember (+15 Volume, and it grows every print)'),
  enhancer('lighthouse', 'The Lighthouse', '🗼', 'beacon', 1, 2, 'Turn up to 2 selected candles into Beacons (+3 Leverage per sector-mate placed)'),
  enhancer('hex', 'The Hex', '☠️', 'cursed', 1, 1, 'Curse 1 selected candle (x3 Leverage, but $4 every print)'),
  enhancer('pivot', "The Threshold", '🚪', 'janus', 1, 2, 'Turn up to 2 selected candles into Janus candles (count as bull AND bear)'),

  sectorShift('techWave', "Surge", '💻', 'TECH'),
  sectorShift('oilShock', "Wildfire", '⛽', 'ENERGY'),
  sectorShift('bankRun', "Bank Run", '🏦', 'FINANCE'),
  sectorShift('altSeason', "Moonrise", '🌗', 'CRYPTO'),

  { key: 'pump', name: "Waxing", art: '🌔', family: 'chart', cost: 3, select: [1, 2],
    text: 'Grow the body of up to 2 selected candles by 1',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.body = c.body >= MAX_BODY ? MIN_BODY : c.body + 1;
      return { ok: true, msg: 'Bodies pumped' };
    } },

  { key: 'dump', name: "Waning", art: '🌒', family: 'chart', cost: 3, select: [1, 2],
    text: 'Shrink the body of up to 2 selected candles by 1',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.body = c.body <= MIN_BODY ? MAX_BODY : c.body - 1;
      return { ok: true, msg: 'Bodies dumped' };
    } },

  { key: 'theFlip', name: "Reversal", art: '🔁', family: 'chart', cost: 3, select: [1, 3],
    text: 'Invert the polarity of up to 3 selected candles',
    use: (api) => {
      const err = need(api, 1, 3); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.bull = !c.bull;
      return { ok: true, msg: 'Polarity flipped' };
    } },

  { key: 'greenDay', name: "Greenwake", art: '🟢', family: 'chart', cost: 3, select: [1, 3],
    text: 'Turn up to 3 selected candles BULL',
    use: (api) => {
      const err = need(api, 1, 3); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.bull = true;
      return { ok: true, msg: 'Everything is green' };
    } },

  { key: 'redDay', name: "Redwake", art: '🔴', family: 'chart', cost: 3, select: [1, 3],
    text: 'Turn up to 3 selected candles BEAR',
    use: (api) => {
      const err = need(api, 1, 3); if (err) return { ok: false, msg: err };
      for (const c of api.selected) c.bull = false;
      return { ok: true, msg: 'Everything is red' };
    } },

  { key: 'buyback', name: "The Pyre", art: '🧨', family: 'chart', cost: 3, select: [1, 2],
    text: 'Burn up to 2 selected candles out of your book',
    use: (api) => {
      const err = need(api, 1, 2); if (err) return { ok: false, msg: err };
      const n = api.selected.length;
      for (const c of api.selected.slice()) api.destroyCandle(c);
      return { ok: true, msg: `${n} candle(s) retired` };
    } },

  { key: 'split', name: "Cloning Vat", art: '👯', family: 'chart', cost: 4, select: [1, 1],
    text: 'Add a perfect copy of 1 selected candle to your book',
    use: (api) => {
      const err = need(api, 1, 1); if (err) return { ok: false, msg: err };
      const s = api.selected[0];
      api.addCandle(makeCandle(s.sector, s.body, s.bull, {
        enhancement: s.enhancement, edition: s.edition, stamp: s.stamp, bonusVolume: s.bonusVolume,
      }));
      return { ok: true, msg: 'Split' };
    } },

  { key: 'merger', name: "The Graft", art: '🧷', family: 'chart', cost: 4, select: [2, 2],
    text: 'Turn the second selected candle into a copy of the first',
    use: (api) => {
      const err = need(api, 2, 2); if (err) return { ok: false, msg: err };
      const [a, b] = api.selected;
      Object.assign(b, { sector: a.sector, body: a.body, bull: a.bull, enhancement: a.enhancement, edition: a.edition, stamp: a.stamp, bonusVolume: a.bonusVolume });
      return { ok: true, msg: 'Merged' };
    } },

  { key: 'filing', name: "The Sigil", art: '📮', family: 'chart', cost: 4, select: [1, 1],
    text: 'Add a random stamp to 1 selected candle',
    use: (api) => {
      const err = need(api, 1, 1); if (err) return { ok: false, msg: err };
      const stamp = api.rng.pick(Object.keys(STAMPS));
      api.selected[0].stamp = stamp;
      return { ok: true, msg: `${STAMPS[stamp].name} applied` };
    } },

  { key: 'insiderLeak', name: "Whispers", art: '💬', family: 'chart', cost: 3, select: [0, 0],
    text: 'Create 2 random Charts (needs room)',
    use: (api) => { const n = api.createChart(2); return n ? { ok: true, msg: `${n} Chart(s) leaked` } : { ok: false, msg: 'No room' }; } },

  { key: 'bonusRound', name: "The Pact", art: '🎁', family: 'chart', cost: 3, select: [0, 0],
    text: 'Create 1 random Contract (needs room)',
    use: (api) => { const n = api.createContract(1); return n ? { ok: true, msg: 'Contract signed' } : { ok: false, msg: 'No room' }; } },

  { key: 'fireSale', name: "Fire Sale", art: '💰', family: 'chart', cost: 3, select: [0, 0],
    text: 'Gain $4 per broker on your desk (max $30)',
    use: (api) => {
      const amt = Math.min(30, 4 * api.state.brokers.length);
      api.state.cash += amt;
      return { ok: true, msg: `+$${amt}` };
    } },

  { key: 'roadshow', name: "Gilding", art: '✨', family: 'chart', cost: 4, select: [0, 0],
    text: 'Laminate a random candle in your book',
    use: (api) => {
      const pool = api.state.book.filter((c) => !c.edition);
      if (!pool.length) return { ok: false, msg: 'Nothing to laminate' };
      api.rng.pick(pool).edition = 'laminated';
      return { ok: true, msg: 'Laminated' };
    } },

  { key: 'ipo', name: "First Light", art: '🌅', family: 'chart', cost: 4, select: [0, 0],
    text: 'Add 2 random body-13 candles to your book',
    use: (api) => {
      for (let i = 0; i < 2; i++) api.addCandle(makeCandle(api.rng.pick(SECTOR_KEYS), MAX_BODY, api.rng.chance(0.5)));
      return { ok: true, msg: 'Two marubozu listed' };
    } },

  { key: 'ladderPrint', name: "Muster", art: '⛰️', family: 'chart', cost: 4, select: [0, 0],
    text: 'Add three rising BULL candles (bodies 4, 5, 6) to your book',
    use: (api) => {
      const s = api.rng.pick(SECTOR_KEYS);
      for (const b of [4, 5, 6]) api.addCandle(makeCandle(s, b, true));
      return { ok: true, msg: 'Soldiers recruited' };
    } },

  { key: 'crowPrint', name: "Murder", art: '🖤', family: 'chart', cost: 4, select: [0, 0],
    text: 'Add three falling BEAR candles (bodies 10, 9, 8) to your book',
    use: (api) => {
      const s = api.rng.pick(SECTOR_KEYS);
      for (const b of [10, 9, 8]) api.addCandle(makeCandle(s, b, false));
      return { ok: true, msg: 'Crows released' };
    } },
]);
export const CHART_KEYS = Object.keys(CHARTS);

// ---------------------------------------------------------------------------
export const CONTRACTS = {};
const CONTRACT_ART = {
  tick: '➖', tweezer: '⑂', doubleTweezer: '⑃', triple: '⛰️', soldiers: '🎺', crows: '🐦‍⬛',
  staircase: '📶', cluster: '🔃', pillars: '🏛️', fourWinds: '🧭', goldenStair: '✨',
  fiveAlarm: '🚨', megaCluster: '🌐', perfectStorm: '🌀',
};
for (const key of FORMATION_KEYS) {
  const f = FORMATIONS[key];
  CONTRACTS['ct_' + key] = {
    key: 'ct_' + key, name: `${f.name} Contract`, art: CONTRACT_ART[key] || '📜',
    family: 'contract', cost: 3, formation: key, select: [0, 0], secret: f.secret,
    text: `Level up ${f.name} (+${f.volInc} Volume, +${f.levInc} Leverage)`,
    use: (api) => { api.levelFormation(key, 1); return { ok: true, msg: `${f.name} upgraded` }; },
  };
}
export const CONTRACT_KEYS = Object.keys(CONTRACTS);

// ---------------------------------------------------------------------------
export const RUMORS = {};
function addRumor(list) { for (const r of list) RUMORS[r.key] = { family: 'rumor', cost: 4, ...r }; }

addRumor([
  { key: 'nakedShort', name: "Blood Pact", art: '🗡️', select: [1, 1],
    text: 'Add a Reissue Stamp to 1 selected candle, then burn a random one',
    use: (api) => {
      const e = need(api, 1, 1); if (e) return { ok: false, msg: e };
      api.selected[0].stamp = 'reissue';
      const pool = api.state.book.filter((c) => c !== api.selected[0]);
      if (pool.length) api.destroyCandle(api.rng.pick(pool));
      return { ok: true, msg: 'Reissued' };
    } },

  { key: 'blockTrade', name: "Anchor Rite", art: '🧱', select: [1, 1],
    text: 'Add a Hold Stamp to 1 selected candle',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'hold'; return { ok: true, msg: 'Held' }; } },

  { key: 'kickback', name: "Bribe", art: '🤑', select: [1, 1],
    text: 'Add a Payout Stamp to 1 selected candle',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'payout'; return { ok: true, msg: 'Stamped' }; } },

  { key: 'paperTrail', name: "Rune Scrawl", art: '📜', select: [1, 1],
    text: 'Add a Filing Stamp to 1 selected candle',
    use: (api) => { const e = need(api, 1, 1); if (e) return { ok: false, msg: e }; api.selected[0].stamp = 'filing'; return { ok: true, msg: 'Filed' }; } },

  { key: 'gilding', name: "Foil Press", art: '✨', select: [0, 0],
    text: 'Laminate a random broker (+50 Volume)',
    use: (api) => api.editionRandomBroker('laminated') },

  { key: 'nakedCall', name: "Prism", art: '🌈', select: [0, 0],
    text: 'Make a random broker Holographic (+10 Leverage)',
    use: (api) => api.editionRandomBroker('holographic') },

  { key: 'quantModel', name: "Runecarver", art: '🔷', select: [0, 0],
    text: 'Make a random broker Algorithmic (x1.5 Leverage)',
    use: (api) => api.editionRandomBroker('algorithmic') },

  { key: 'offBookDeal', name: "Faustian Deal", art: '🕶️', select: [0, 0],
    text: 'Make a random broker Off-Book (+1 slot), then fire another at random',
    use: (api) => {
      const r = api.editionRandomBroker('offbook');
      if (!r.ok) return r;
      api.destroyRandomBroker(r.spared);
      return { ok: true, msg: 'Kept off the books' };
    } },

  { key: 'hostileTakeover', name: "Doppelgänger", art: '⚔️', select: [0, 0],
    text: 'Clone a random broker on your desk (needs a slot)',
    use: (api) => api.copyBroker() },

  { key: 'restructure', name: "Upheaval", art: '🏗️', select: [0, 0],
    text: 'Rotate every candle on your board into one random sector',
    use: (api) => {
      const board = api.state.session?.board || [];
      if (!board.length) return { ok: false, msg: 'No board to restructure' };
      const s = api.rng.pick(SECTOR_KEYS);
      for (const c of board) c.sector = s;
      return { ok: true, msg: `Board rotated to ${SECTORS[s].name}` };
    } },

  { key: 'squeezePlay', name: "Ascension", art: '🕊️', select: [0, 0],
    text: 'Turn every candle on your board BULL and step their bodies into a rising ladder',
    use: (api) => {
      const board = api.state.session?.board || [];
      if (!board.length) return { ok: false, msg: 'No board' };
      board.forEach((c, i) => { c.bull = true; c.body = Math.min(MAX_BODY, 2 + i); });
      return { ok: true, msg: 'Ladder printed' };
    } },

  { key: 'capitulation', name: "Descent", art: '🩸', select: [0, 0],
    text: 'Turn every candle on your board BEAR and step their bodies into a falling ladder',
    use: (api) => {
      const board = api.state.session?.board || [];
      if (!board.length) return { ok: false, msg: 'No board' };
      board.forEach((c, i) => { c.bull = false; c.body = Math.max(MIN_BODY, MAX_BODY - i); });
      return { ok: true, msg: 'Crows released' };
    } },

  { key: 'insiderWhisper', name: "Hive Mind", art: '🤐', select: [0, 0],
    text: 'Turn every candle on your board into a copy of a random one of them',
    use: (api) => {
      const board = api.state.session?.board || [];
      if (board.length < 2) return { ok: false, msg: 'Need a board' };
      const src = api.rng.pick(board);
      for (const c of board) if (c !== src) Object.assign(c, { sector: src.sector, body: src.body, bull: src.bull, enhancement: src.enhancement, edition: src.edition });
      return { ok: true, msg: 'Everyone got the same tip' };
    } },

  { key: 'shellGame', name: "Shell Game", art: '🥥', select: [0, 0],
    text: 'Permanently +2 board size, then burn 2 random candles',
    use: (api) => {
      api.state.permanent.handSize += 2;
      for (let i = 0; i < 2; i++) if (api.state.book.length > 5) api.destroyCandle(api.rng.pick(api.state.book));
      return { ok: true, msg: '+2 board size' };
    } },

  { key: 'blackout', name: "Eclipse", art: '🌑', select: [0, 0],
    text: 'Seal every candle on your board (+50 Volume each, no body or polarity)',
    use: (api) => {
      const board = api.state.session?.board || [];
      if (!board.length) return { ok: false, msg: 'No board' };
      for (const c of board) c.enhancement = 'obsidian';
      return { ok: true, msg: 'Board went dark' };
    } },

  { key: 'dilution', name: "Spawn", art: '💧', select: [0, 0],
    text: 'Add 4 random candles sharing one random body size to your book',
    use: (api) => {
      const body = api.rng.pick(BODIES);
      for (let i = 0; i < 4; i++) api.addCandle(makeCandle(api.rng.pick(SECTOR_KEYS), body, api.rng.chance(0.5)));
      return { ok: true, msg: 'Book diluted' };
    } },

  { key: 'chapter11', name: "Sacrifice", art: '🔻', select: [0, 0],
    text: 'Lose all cash, then level up your most-printed formation by 3',
    use: (api) => {
      const lost = api.state.cash;
      api.state.cash = 0;
      let best = FORMATION_KEYS[0], n = -1;
      for (const k of FORMATION_KEYS) { const c = api.state.formations[k].played; if (c > n) { n = c; best = k; } }
      api.levelFormation(best, 3);
      return { ok: true, msg: `Lost $${lost}, ${FORMATIONS[best].name} +3` };
    } },

  { key: 'frontOffice', name: "Expansion", art: '🏢', select: [0, 0],
    text: 'Permanently +1 desk slot, then lose half your cash',
    use: (api) => {
      api.state.permanent.slots += 1;
      api.state.cash = Math.floor(api.state.cash / 2);
      return { ok: true, msg: '+1 desk slot' };
    } },

  { key: 'totalRecall', name: "Reshuffle", art: '🔄', select: [0, 0],
    // The trade gets worse every time: -1 board, then -2, then -3...
    text: (state) => {
      const next = (state?.permanent?.recallUses || 0) + 1;
      return `+1 desk slot and +1 Chart slot, at the cost of ${next} board size. ` +
             `The board cost grows by one with every Reshuffle you use` +
             (next > 1 ? ` (you have used ${next - 1})` : '');
    },
    use: (api) => {
      const n = (api.state.permanent.recallUses || 0) + 1;
      api.state.permanent.recallUses = n;
      api.state.permanent.handSize = Math.max(1, api.state.permanent.handSize - n);
      api.state.permanent.slots += 1;
      api.state.permanent.chartSlots += 1;
      return { ok: true, msg: `+1 desk slot, +1 Chart slot, -${n} board size` };
    } },

  { key: 'theSqueeze', name: "Apotheosis", art: '🌡️', select: [0, 0], cost: 6,
    text: 'Level up every formation by 1',
    use: (api) => { for (const k of FORMATION_KEYS) api.levelFormation(k, 1); return { ok: true, msg: 'Everything levelled' }; } },
]);
export const RUMOR_KEYS = Object.keys(RUMORS);

export const ALL_CONSUMABLES = { ...CHARTS, ...CONTRACTS, ...RUMORS };

/** Consumable blurbs may depend on run state, exactly like broker text. */
export function consumableText(d, state) {
  if (!d) return '';
  return typeof d.text === 'function' ? d.text(state) : d.text;
}

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
  const pool = CONTRACT_KEYS.filter((k) => !CONTRACTS[k].secret || discovered.includes(CONTRACTS[k].formation));
  return rng.pick(pool.length ? pool : CONTRACT_KEYS.slice(0, 11));
}
export function rollRumor(rng) { return rng.pick(RUMOR_KEYS); }
