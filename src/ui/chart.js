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

  setMarket(m) { this.market = m; this.t = 0; }
  pulse(up) { this.flash = 1; this.flashUp = up; }

  loop() {
    this.t += 1 / 60;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.02);
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
    view.forEach((c, i) => {
      const x = pad.l + i * cw + cw / 2;
      const bw = Math.max(2, cw * 0.62);
      const col = c.up ? '#43e08a' : '#ff5c5c';
      const isLast = i === view.length - 1;
      ctx.globalAlpha = isLast ? 1 : 0.42 + 0.5 * (i / view.length);
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yOf(c.high)); ctx.lineTo(x, yOf(c.low)); ctx.stroke();
      const yo = yOf(c.open), yc = yOf(c.close);
      const top = Math.min(yo, yc), bh = Math.max(1.5, Math.abs(yc - yo));
      ctx.fillStyle = col;
      ctx.fillRect(x - bw / 2, top, bw, bh);
      if (isLast) {
        ctx.shadowColor = col; ctx.shadowBlur = 14;
        ctx.fillRect(x - bw / 2, top, bw, bh);
        ctx.shadowBlur = 0;
      }
    });
    ctx.globalAlpha = 1;

    // last-price rail
    const last = view[view.length - 1];
    const ly = yOf(last.close);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = last.up ? 'rgba(67,224,138,.55)' : 'rgba(255,92,92,.55)';
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w - pad.r + 8, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = last.up ? '#43e08a' : '#ff5c5c';
    const label = '$' + last.close.toFixed(2);
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
