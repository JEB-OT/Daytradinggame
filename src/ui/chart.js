// Animated candlestick tape. Pure canvas, no deps.
//
// Drawn the way the rest of the interface is: chalk on a slate. Grid lines
// waver, the area under the price is hatched rather than shaded, and every
// candle is a flat body in an ink line with a band of light down one side.
// The waver is seeded — by grid position, and by each candle's index in the
// whole tape rather than its slot on screen — so a line keeps its shape from
// frame to frame and a candle keeps its shape as the window scrolls past it.
// Nothing here may use Math.random: a shimmer every frame reads as noise, not
// as a hand.

const PEN = '#0a0e1a';
const UP = '#3fd17f', UP_LIT = '#9dffc9';
const DOWN = '#ef4a5f', DOWN_LIT = '#ffb0ba';

/** A repeatable 0..1 from any number — the same input always wavers the same way. */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A straight line as a pen draws one: a few gentle bends along its length. */
function wobbleLine(ctx, x1, y1, x2, y2, seed, amp = 1.2, step = 46) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.round(len / step));
  const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const o = i === 0 || i === n ? (hash(seed + i) - 0.5) * amp : (hash(seed + i) - 0.5) * 2 * amp;
    pts.push([x1 + (x2 - x1) * t + nx * o, y1 + (y2 - y1) * t + ny * o]);
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

export class ChartView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.market = null;
    this.t = 0;
    this.flash = 0;
    this.flashUp = true;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(200, r.width);
    this.h = Math.max(80, r.height);
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.grid = null;   // redrawn at the new size on the next frame
  }

  /**
   * The chalked grid only changes when the canvas does, so it is drawn once
   * into its own canvas and stamped down every frame.
   */
  gridLayer() {
    if (this.grid) return this.grid;
    const { w, h, dpr } = this;
    const c = document.createElement('canvas');
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round';
    // two passes a pixel apart, the way chalk drags a second edge
    for (const [alpha, width, salt] of [[0.13, 1.4, 0], [0.07, 1, 500]]) {
      g.strokeStyle = `rgba(150,180,235,${alpha})`;
      g.lineWidth = width;
      g.beginPath();
      for (let i = 1; i < 6; i++) {
        const y = (h / 6) * i;
        wobbleLine(g, -4, y, w + 4, y, 1000 + i * 37 + salt, 1.6);
      }
      for (let i = 1; i < 12; i++) {
        const x = (w / 12) * i;
        wobbleLine(g, x, -4, x, h + 4, 2000 + i * 53 + salt, 1.6);
      }
      g.stroke();
    }
    this.grid = c;
    return c;
  }

  setMarket(m) { this.market = m; this.t = 0; this.forming = null; }
  pulse(up) { this.flash = 1; this.flashUp = up; }

  /**
   * Print the freshest candle live instead of having it appear finished.
   *
   * It opens flat, wanders through a few waypoints inside its own high/low, and
   * settles on its close — so the tick you called against visibly happens. The
   * waypoints are bounded by the candle's real range and the last one IS its
   * real close, so the shape it lands on is the honest one; nothing here can
   * change the result, and it deliberately uses Math.random rather than the
   * run's seeded RNG so a replayed seed still plays out identically.
   *
   * Roughly one call in four goes straight to the close with no wandering,
   * which keeps the flourish from becoming a tic.
   *
   * @returns {number} how long the print takes, in ms, for the caller to await.
   */
  printCandle(candle) {
    if (!candle) return 0;
    const legs = Math.random() < 0.26 ? 0 : 1 + Math.floor(Math.random() * 3);
    const pts = [candle.open];
    const range = candle.high - candle.low;
    for (let i = 0; i < legs; i++) pts.push(candle.low + Math.random() * range);
    pts.push(candle.close);
    const dur = 0.34 + legs * 0.16;
    this.forming = { candle, pts, t: 0, dur, hi: candle.open, lo: candle.open };
    return Math.round(dur * 1000);
  }

  /** Where the forming candle is trading this frame. */
  livePrice(f) {
    const p = Math.min(1, f.t / f.dur);
    const n = f.pts.length - 1;
    const seg = Math.min(n - 1, Math.floor(p * n));
    const local = Math.min(1, p * n - seg);
    const e = local * local * (3 - 2 * local);     // ease each leg, not the whole run
    return f.pts[seg] + (f.pts[seg + 1] - f.pts[seg]) * e;
  }

  loop() {
    this.t += 1 / 60;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.02);
    if (this.forming) {
      this.forming.t += 1 / 60;
      const live = this.livePrice(this.forming);
      this.forming.hi = Math.max(this.forming.hi, live);
      this.forming.lo = Math.min(this.forming.lo, live);
      if (this.forming.t >= this.forming.dur) this.forming = null;
    }
    this.draw();
    requestAnimationFrame(this.loop);
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.gridLayer(), 0, 0, w, h);

    const m = this.market;
    if (!m || !m.candles.length) return;

    const pad = { t: 50, b: 22, l: 8, r: 100 };
    const first = Math.max(0, m.candles.length - 46);
    const view = m.candles.slice(first);
    let lo = Infinity, hi = -Infinity;
    for (const c of view) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); }
    const span = Math.max(1e-6, hi - lo) * 1.08;
    const mid = (hi + lo) / 2;
    lo = mid - span / 2; hi = mid + span / 2;

    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const cw = Math.max(3, iw / view.length);
    const yOf = (p) => pad.t + ih - ((p - lo) / (hi - lo)) * ih;
    const xOf = (i) => pad.l + i * cw + cw / 2;

    // area under close — hatched in, not airbrushed
    const up = view[view.length - 1].close >= view[0].close;
    ctx.save();
    ctx.beginPath();
    view.forEach((c, i) => (i === 0 ? ctx.moveTo(xOf(i), yOf(c.close)) : ctx.lineTo(xOf(i), yOf(c.close))));
    ctx.lineTo(xOf(view.length - 1), pad.t + ih); ctx.lineTo(xOf(0), pad.t + ih); ctx.closePath();
    ctx.fillStyle = up ? 'rgba(63,209,127,.07)' : 'rgba(239,74,95,.07)';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = up ? 'rgba(63,209,127,.2)' : 'rgba(239,74,95,.2)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let x = -h; x < w; x += 8) { ctx.moveTo(x, h); ctx.lineTo(x + h, 0); }
    ctx.stroke();
    ctx.restore();

    // candles
    const f = this.forming;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    view.forEach((c, i) => {
      const x = xOf(i);
      const bw = Math.max(3, cw * 0.62);
      const isLast = i === view.length - 1;
      const seed = (first + i) * 7.31;

      // A candle still printing is drawn from where it is trading right now.
      // The wick reaches for its real extremes as the print runs, so it lands
      // exactly on the finished shape with nothing to snap into place.
      let { open, close, high, low, up } = c;
      if (f && f.candle === c) {
        const p = Math.min(1, f.t / f.dur);
        close = this.livePrice(f);
        high = Math.max(f.hi, close, c.high * p + Math.max(open, close) * (1 - p));
        low = Math.min(f.lo, close, c.low * p + Math.min(open, close) * (1 - p));
        up = close >= open;
      }

      const col = up ? UP : DOWN;
      const lit = up ? UP_LIT : DOWN_LIT;
      ctx.globalAlpha = isLast ? 1 : 0.5 + 0.5 * (i / view.length);

      // wick: a slightly crooked stroke in the candle's own light colour
      const wx = x + (hash(seed) - 0.5) * 0.8;
      ctx.strokeStyle = lit; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(wx, yOf(high)); ctx.lineTo(x + (hash(seed + 1) - 0.5) * 0.8, yOf(low)); ctx.stroke();

      // body: four corners each nudged a hair, so no two are quite square
      const yo = yOf(open), yc = yOf(close);
      const top = Math.min(yo, yc), bh = Math.max(2, Math.abs(yc - yo));
      const j = (k) => (hash(seed + k) - 0.5) * Math.min(1.4, bw * 0.12);
      const l = x - bw / 2, r = x + bw / 2, b = top + bh;
      ctx.beginPath();
      ctx.moveTo(l + j(2), top + j(3)); ctx.lineTo(r + j(4), top + j(5));
      ctx.lineTo(r + j(6), b + j(7)); ctx.lineTo(l + j(8), b + j(9)); ctx.closePath();
      if (isLast) { ctx.shadowColor = col; ctx.shadowBlur = f && f.candle === c ? 20 : 12; }
      ctx.fillStyle = col; ctx.fill();
      ctx.shadowBlur = 0;
      if (bw >= 5 && bh >= 4) {
        ctx.fillStyle = 'rgba(255,255,255,.38)';
        ctx.fillRect(l + 1, top + 1, Math.max(1, bw * 0.26), bh - 2);
      }
      ctx.strokeStyle = PEN; ctx.lineWidth = bw >= 6 ? 1.6 : 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // last-price rail — it ticks along with a candle that is still printing
    const last = view[view.length - 1];
    const livePx = f && f.candle === last ? this.livePrice(f) : last.close;
    const liveUp = f && f.candle === last ? livePx >= last.open : last.up;
    const ly = yOf(livePx);
    ctx.setLineDash([7, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = liveUp ? 'rgba(63,209,127,.6)' : 'rgba(239,74,95,.6)';
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - pad.r + 8, ly); ctx.stroke();
    ctx.setLineDash([]);

    // the price tag: a flat chip in an ink line, lettered like the rest
    const label = '$' + livePx.toFixed(2);
    ctx.font = '16px Bangers, Impact, sans-serif';
    const tw = ctx.measureText(label).width + 16;
    const tx = w - pad.r + 12, th = 22;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(tx, ly - th / 2, tw, th, 6) : ctx.rect(tx, ly - th / 2, tw, th);
    ctx.fillStyle = liveUp ? UP : DOWN; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = PEN; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(tx + 2, ly - th / 2 + 2, tw - 4, th * 0.36);
    ctx.lineWidth = 3; ctx.strokeStyle = PEN; ctx.fillStyle = '#fff';
    ctx.strokeText(label, tx + 8, ly + 6);
    ctx.fillText(label, tx + 8, ly + 6);

    // resolve flash
    if (this.flash > 0) {
      ctx.fillStyle = this.flashUp
        ? `rgba(63,209,127,${0.18 * this.flash})`
        : `rgba(239,74,95,${0.18 * this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
