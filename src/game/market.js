import { clamp } from '../engine/util.js';

// ---------------------------------------------------------------------------
// The tape. Every trade you commit resolves against one hidden tick.
// Guess the direction right -> GREEN trade (full P/L). Wrong -> RED trade.
// ---------------------------------------------------------------------------
export const REGIMES = {
  BULL:       { key: 'BULL',       name: 'Bull Run',       bias: 0.66, longMult: 1.25, shortMult: 1.0,  vol: 0.9,  color: '#43e08a', blurb: 'Tape grinds up. LONG pays x1.25.' },
  BEAR:       { key: 'BEAR',       name: 'Bear Market',    bias: 0.34, longMult: 1.0,  shortMult: 1.25, vol: 1.1,  color: '#ff5c5c', blurb: 'Sellers in control. SHORT pays x1.25.' },
  CHOP:       { key: 'CHOP',       name: 'Chop',           bias: 0.50, longMult: 1.1,  shortMult: 1.1,  vol: 1.3,  color: '#ffd94a', blurb: 'Directionless. Signal accuracy -10%.', accuracy: -0.10 },
  MELTUP:     { key: 'MELTUP',     name: 'Melt-Up',        bias: 0.80, longMult: 1.15, shortMult: 2.0,  vol: 1.5,  color: '#7ef9ff', blurb: 'Everything goes up. Correct SHORTs pay x2.' },
  CAPITUL:    { key: 'CAPITUL',    name: 'Capitulation',   bias: 0.20, longMult: 2.0,  shortMult: 1.15, vol: 1.6,  color: '#ff8a5c', blurb: 'Blood everywhere. Correct LONGs pay x2.' },
  RANGE:      { key: 'RANGE',      name: 'Range Bound',    bias: 0.50, longMult: 1.0,  shortMult: 1.0,  vol: 0.6,  color: '#9fb2c9', blurb: 'Quiet tape. Nothing special.' },
  SQUEEZE:    { key: 'SQUEEZE',    name: 'Short Squeeze',  bias: 0.72, longMult: 1.3,  shortMult: 0.6,  vol: 1.7,  color: '#ff5cf0', blurb: 'Shorts get torched. SHORT payouts x0.6.' },
  ROTATION:   { key: 'ROTATION',   name: 'Rotation',       bias: 0.50, longMult: 1.15, shortMult: 1.15, vol: 1.0,  color: '#c9a4ff', blurb: 'Money moves. Both directions x1.15.' },
};
export const REGIME_KEYS = Object.keys(REGIMES);

export const DIRECTIONS = {
  LONG:  { key: 'LONG',  name: 'LONG',  glyph: '▲', color: '#43e08a' },
  SHORT: { key: 'SHORT', name: 'SHORT', glyph: '▼', color: '#ff5c5c' },
};

const TICKER_NAMES = [
  'NVDX', 'MEME', 'HODL', 'GRND', 'BRRR', 'YOLO', 'BAGZ', 'PUMP',
  'RUGZ', 'MOON', 'TNDY', 'CHUD', 'WAGE', 'DOOM', 'FOMO', 'SPAC',
];

export class Market {
  constructor(rng, opts = {}) {
    this.rng = rng;
    this.regime = REGIMES[opts.regime] || REGIMES[rng.pick(REGIME_KEYS)];
    this.symbol = opts.symbol || rng.pick(TICKER_NAMES);
    this.price = 100 + rng.int(0, 180);
    this.candles = [];
    this.history = [];
    this.pendingUp = null;
    this.volScale = opts.volScale ?? 1;
    // Seed a little pre-history so the chart never starts empty.
    for (let i = 0; i < 18; i++) this.pushCandle(rng.chance(this.regime.bias), true);
    this.rollNext();
  }

  get biasLabel() {
    const b = this.regime.bias;
    if (b >= 0.7) return 'STRONG UP';
    if (b >= 0.58) return 'UP';
    if (b <= 0.3) return 'STRONG DOWN';
    if (b <= 0.42) return 'DOWN';
    return 'NEUTRAL';
  }

  pushCandle(up, silent = false) {
    const vol = this.regime.vol * this.volScale;
    const open = this.price;
    const body = this.rng.float(0.4, 3.4) * vol * (this.price / 100);
    const close = clamp(open + (up ? body : -body), 8, 100000);
    const wick = this.rng.float(0.2, 1.6) * vol * (this.price / 100);
    const candle = {
      open,
      close,
      high: Math.max(open, close) + wick * this.rng.float(0.2, 1),
      low: Math.min(open, close) - wick * this.rng.float(0.2, 1),
      up: close >= open,
      fresh: !silent,
    };
    this.price = close;
    this.candles.push(candle);
    if (this.candles.length > 64) this.candles.shift();
    return candle;
  }

  rollNext() {
    this.pendingUp = this.rng.chance(this.regime.bias);
  }

  /** What the desk *shows* the player. May be a lie. */
  readSignal(accuracy, opts = {}) {
    const acc = clamp(accuracy + (this.regime.accuracy || 0), 0.05, 1);
    if (opts.perfect) return { up: this.pendingUp, accuracy: 1, truthful: true, perfect: true };
    if (this._cachedFor !== this.candles.length) {
      this._cachedFor = this.candles.length;
      this._truthRoll = this.rng.next();
    }
    const truthful = this._truthRoll < acc;
    return { up: truthful ? this.pendingUp : !this.pendingUp, accuracy: acc, truthful };
  }

  /** Commit a direction; the tape prints. */
  resolve(direction) {
    const up = this.pendingUp;
    const candle = this.pushCandle(up);
    const correct = (direction === 'LONG' && up) || (direction === 'SHORT' && !up);
    const rec = { direction, up, correct, candle, price: this.price };
    this.history.push(rec);
    this.rollNext();
    return rec;
  }

  /** Payout multiplier the regime applies to a *correct* call. */
  directionMult(direction) {
    return direction === 'LONG' ? this.regime.longMult : this.regime.shortMult;
  }
}

export function pickRegime(rng, week, forced) {
  if (forced) return forced;
  const pool = [
    { item: 'BULL', weight: 14 },
    { item: 'BEAR', weight: 12 },
    { item: 'CHOP', weight: 10 },
    { item: 'RANGE', weight: 10 },
    { item: 'ROTATION', weight: 8 },
    { item: 'MELTUP', weight: week >= 2 ? 6 : 2 },
    { item: 'CAPITUL', weight: week >= 2 ? 6 : 2 },
    { item: 'SQUEEZE', weight: week >= 3 ? 6 : 1 },
  ];
  return rng.pickWeighted(pool);
}
