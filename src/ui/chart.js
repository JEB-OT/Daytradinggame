// Animated candlestick tape. Pure canvas, no deps.
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

    // grid
    ctx.strokeStyle = 'rgba(37,48,72,.5)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = Math.round((h / 6) * i) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 1; i < 12; i++) {
      const x = Math.round((w / 12) * i) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    const m = this.market;
    if (!m || !m.candles.length) return;

    const pad = { t: 46, b: 22, l: 8, r: 96 };
    const view = m.candles.slice(-46);
    let lo = Infinity, hi = -Infinity;
    for (const c of view) { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); }
    const span = Math.max(1e-6, hi - lo) * 1.08;
    const mid = (hi + lo) / 2;
    lo = mid - span / 2; hi = mid + span / 2;

    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const cw = Math.max(3, iw / view.length);
    const yOf = (p) => pad.t + ih - ((p - lo) / (hi - lo)) * ih;

    // area under close
    ctx.beginPath();
    view.forEach((c, i) => {
      const x = pad.l + i * cw + cw / 2;
      const y = yOf(c.close);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    const lastX = pad.l + (view.length - 1) * cw + cw / 2;
    ctx.lineTo(lastX, pad.t + ih); ctx.lineTo(pad.l + cw / 2, pad.t + ih); ctx.closePath();
    const up = view[view.length - 1].close >= view[0].close;
    const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ih);
    g.addColorStop(0, up ? 'rgba(67,224,138,.20)' : 'rgba(255,92,92,.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fill();

    // candles
    const f = this.forming;
    view.forEach((c, i) => {
      const x = pad.l + i * cw + cw / 2;
      const bw = Math.max(2, cw * 0.62);
      const isLast = i === view.length - 1;

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

      const col = up ? '#43e08a' : '#ff5c5c';
      ctx.globalAlpha = isLast ? 1 : 0.42 + 0.5 * (i / view.length);
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yOf(high)); ctx.lineTo(x, yOf(low)); ctx.stroke();
      const yo = yOf(open), yc = yOf(close);
      const top = Math.min(yo, yc), bh = Math.max(1.5, Math.abs(yc - yo));
      ctx.fillStyle = col;
      ctx.fillRect(x - bw / 2, top, bw, bh);
      if (isLast) {
        ctx.shadowColor = col; ctx.shadowBlur = f && f.candle === c ? 22 : 14;
        ctx.fillRect(x - bw / 2, top, bw, bh);
        ctx.shadowBlur = 0;
      }
    });
    ctx.globalAlpha = 1;

    // last-price rail — it ticks along with a candle that is still printing
    const last = view[view.length - 1];
    const livePx = f && f.candle === last ? this.livePrice(f) : last.close;
    const liveUp = f && f.candle === last ? livePx >= last.open : last.up;
    const ly = yOf(livePx);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = liveUp ? 'rgba(67,224,138,.55)' : 'rgba(255,92,92,.55)';
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - pad.r + 8, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = liveUp ? '#43e08a' : '#ff5c5c';
    const label = '$' + livePx.toFixed(2);
    ctx.font = '600 11px ui-monospace, monospace';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillRect(w - pad.r + 10, ly - 9, tw, 18);
    ctx.fillStyle = '#05070c';
    ctx.fillText(label, w - pad.r + 16, ly + 4);

    // resolve flash
    if (this.flash > 0) {
      ctx.fillStyle = this.flashUp
        ? `rgba(67,224,138,${0.20 * this.flash})`
        : `rgba(255,92,92,${0.20 * this.flash})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
