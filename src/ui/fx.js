import { bignum, money } from '../engine/util.js';

const root = () => document.getElementById('app');

export function shake(big = false) {
  const el = root();
  el.classList.remove('shake', 'shake-big');
  void el.offsetWidth;
  el.classList.add(big ? 'shake-big' : 'shake');
  setTimeout(() => el.classList.remove('shake', 'shake-big'), big ? 1300 : 400);
}

/**
 * @param key give repeated notices of the same sort a key and each one replaces
 *            the last, instead of stacking into an unreadable pile.
 */
export function toast(msg, kind = '', key = null) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  if (key) stack.querySelectorAll(`[data-key="${key}"]`).forEach((n) => n.remove());
  while (stack.children.length >= 3) stack.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  if (key) el.dataset.key = key;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function popText(anchor, text, kind = 'info') {
  const layer = document.getElementById('play-area');
  if (!layer || !anchor) return;
  const a = anchor.getBoundingClientRect();
  const l = layer.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'pop ' + kind;
  el.textContent = text;
  el.style.left = (a.left - l.left + a.width / 2) + 'px';
  el.style.top = (a.top - l.top - 6) + 'px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

export function burst(text, sub, kind) {
  const layer = document.getElementById('score-burst');
  if (!layer) return;
  layer.innerHTML = '';   // never stack two callouts on the same spot
  const el = document.createElement('div');
  el.className = 'burst ' + kind;
  el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export function particles(x, y, color, n = 18, spread = 120) {
  const layer = document.getElementById('fx-layer');
  if (!layer) return;
  const r = layer.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.background = color;
    p.style.left = (x - r.left) + 'px';
    p.style.top = (y - r.top) + 'px';
    const ang = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * spread;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 30;
    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0)`, opacity: 0 },
    ], { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' });
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1150);
  }
}

/**
 * Cash erupting out of a number that beat its quota.
 *
 * @param power 0 for scraping the quota, 1 for burying it. Scales the count,
 *              the spread, the size and how long it hangs in the air, so just
 *              clearing gives a modest handful and a blowout buries the screen.
 */
export function moneyBurst(x, y, power = 0, opts = {}) {
  const layer = document.getElementById('fx-layer');
  if (!layer) return 0;
  const k = Math.max(0, Math.min(1, power));
  // Web Animations are not touched by the `no-motion` stylesheet rule, so the
  // reduced-motion setting has to be honoured here by hand.
  const calm = document.body.classList.contains('no-motion');
  const n = calm ? Math.round(3 + k * 7) : Math.round(7 + k * 45);
  const r = layer.getBoundingClientRect();
  // Notes are heavier and rarer than loose dollar signs, so the spray reads as
  // money rather than as confetti that happens to be green.
  const notes = ['💵', '💸', '🤑'];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const isNote = Math.random() < 0.22 + k * 0.2;
    const el = document.createElement('div');
    el.className = 'cashbit' + (isNote ? ' note' : '');
    el.textContent = isNote ? notes[Math.floor(Math.random() * notes.length)] : '$';
    el.style.left = (x - r.left) + 'px';
    el.style.top = (y - r.top) + 'px';
    el.style.fontSize = (13 + Math.random() * (10 + k * 16)) + 'px';

    // Fire mostly upward in a fan, then let gravity take it.
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * (1.5 + k * 1.1);
    const speed = 90 + Math.random() * (110 + k * 260);
    const dx = Math.cos(ang) * speed;
    const rise = Math.sin(ang) * speed;
    const fall = 320 + Math.random() * 260;
    const spin = (Math.random() - 0.5) * (540 + k * 720);
    const dur = calm ? 320 : 950 + Math.random() * (500 + k * 700);
    last = Math.max(last, dur);
    el.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.5)', opacity: 0 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.35}px,${rise * 0.55}px) rotate(${spin * 0.3}deg) scale(1)`,
        opacity: 1, offset: 0.18 },
      { transform: `translate(-50%,-50%) translate(${dx * 0.8}px,${rise + fall * 0.18}px) rotate(${spin * 0.7}deg) scale(1)`,
        opacity: 1, offset: 0.6 },
      { transform: `translate(-50%,-50%) translate(${dx}px,${rise + fall}px) rotate(${spin}deg) scale(.85)`, opacity: 0 },
    ], { duration: dur, delay: Math.random() * (120 + k * 260), easing: 'cubic-bezier(.16,.62,.4,1)' });
    layer.appendChild(el);
    setTimeout(() => el.remove(), dur + 500);
  }
  return last;
}

// ---------------------------------------------------------------------------
// Synth kit. No assets — every sound is generated, so the scoring sequence can
// climb in pitch step by step the way a good slot machine does.
// ---------------------------------------------------------------------------
let ac = null;
let master = null;
let muted = false;
export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

function actx() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
    } catch { ac = null; }
  }
  if (ac?.state === 'suspended') ac.resume();
  return ac;
}

/** One shaped voice. */
function voice(o = {}) {
  if (muted) return;
  const a = actx(); if (!a) return;
  const t = a.currentTime + (o.delay || 0);
  const dur = o.dur ?? 0.09;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.freq || 440, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t + dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);

  const peak = (o.gain ?? 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.006));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  let node = osc;
  if (o.filter) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.filter, t);
    node.connect(f); node = f;
  }
  node.connect(gain); gain.connect(master);
  osc.start(t); osc.stop(t + dur + 0.02);
}

/** Short filtered noise — used for whooshes and impacts. */
function noise(o = {}) {
  if (muted) return;
  const a = actx(); if (!a) return;
  const t = a.currentTime + (o.delay || 0);
  const dur = o.dur ?? 0.16;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.from ?? 700, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, o.to ?? 2400), t + dur);
  f.Q.value = o.q ?? 1.2;
  const g = a.createGain();
  g.gain.setValueAtTime(o.gain ?? 0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur);
}

export function blip(freq = 440, dur = 0.07, type = 'square', gain = 0.05) {
  voice({ freq, dur, type, gain });
}

// A pentatonic ladder keeps a long scoring run musical instead of shrill.
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const step2freq = (base, i) => base * Math.pow(2, LADDER[Math.min(i, LADDER.length - 1)] / 12);

export const sfx = {
  select:   () => voice({ freq: 620, dur: 0.04, type: 'square', gain: 0.035 }),
  deselect: () => voice({ freq: 400, dur: 0.04, type: 'square', gain: 0.028 }),

  /** A candle's body landing in the Volume chip. Climbs as the run goes on. */
  volumeStep: (i = 0) => {
    voice({ freq: step2freq(392, i), dur: 0.075, type: 'triangle', gain: 0.05, filter: 3800 });
    voice({ freq: step2freq(392, i) * 2, dur: 0.045, type: 'sine', gain: 0.022 });
  },
  /** Additive Leverage — brighter and a touch sharper. */
  leverageStep: (i = 0) => {
    voice({ freq: step2freq(523, i), dur: 0.08, type: 'square', gain: 0.042, filter: 4600 });
  },
  /** A multiplier. Bigger, with a rising whoosh under it. */
  multStep: (i = 0, size = 2) => {
    const f = step2freq(330, i);
    noise({ from: 400, to: 3200, dur: 0.2, gain: 0.045 });
    voice({ freq: f, slideTo: f * (1 + Math.min(1.4, size * 0.28)), dur: 0.24, type: 'sawtooth', gain: 0.055, filter: 2600 });
    voice({ freq: f * 1.5, dur: 0.14, type: 'triangle', gain: 0.03, delay: 0.03 });
  },
  coin: (i = 0) => {
    voice({ freq: step2freq(880, i % 6), dur: 0.06, type: 'triangle', gain: 0.04 });
    voice({ freq: step2freq(1320, i % 6), dur: 0.05, type: 'sine', gain: 0.028, delay: 0.035 });
  },
  place:  () => { noise({ from: 900, to: 300, dur: 0.1, gain: 0.04 }); voice({ freq: 300, dur: 0.07, type: 'square', gain: 0.04 }); },
  play:   () => { noise({ from: 300, to: 2600, dur: 0.22, gain: 0.05 }); voice({ freq: 220, slideTo: 520, dur: 0.2, type: 'sawtooth', gain: 0.045, filter: 2200 }); },
  green:  () => [0, 4, 7, 12].forEach((n, i) => voice({ freq: 523 * Math.pow(2, n / 12), dur: 0.15, type: 'triangle', gain: 0.055, delay: i * 0.06 })),
  red:    () => { noise({ from: 1800, to: 120, dur: 0.34, gain: 0.05 });
                  [0, -3, -7].forEach((n, i) => voice({ freq: 330 * Math.pow(2, n / 12), dur: 0.2, type: 'sawtooth', gain: 0.05, detune: -14, delay: i * 0.08 })); },
  /** The payoff. Scales with how big the number was. */
  crescendo: (tier = 1) => {
    const notes = [0, 4, 7, 12, 16, 19, 24].slice(0, 3 + Math.min(4, tier));
    notes.forEach((n, i) => voice({ freq: 392 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', gain: 0.06, delay: i * 0.055 }));
    noise({ from: 600, to: 5200, dur: 0.5, gain: 0.05 });
  },
  cash:   () => [0, 1, 2].forEach((i) => voice({ freq: 880 * (1 + i * 0.25), dur: 0.07, type: 'triangle', gain: 0.04, delay: i * 0.05 })),
  clear:  () => [0, 4, 7, 12, 16, 19].forEach((n, i) => voice({ freq: 523 * Math.pow(2, n / 12), dur: 0.3, type: 'triangle', gain: 0.06, delay: i * 0.085 })),
  fail:   () => { noise({ from: 900, to: 60, dur: 0.9, gain: 0.06 });
                  [220, 175, 139, 110].forEach((f, i) => voice({ freq: f, dur: 0.5, type: 'sawtooth', gain: 0.06, detune: -20, delay: i * 0.16 })); },
  buy:    () => { voice({ freq: 740, dur: 0.06, type: 'square', gain: 0.04 }); voice({ freq: 1108, dur: 0.08, type: 'square', gain: 0.035, delay: 0.055 }); },
  err:    () => { voice({ freq: 150, dur: 0.14, type: 'sawtooth', gain: 0.05 }); voice({ freq: 140, dur: 0.14, type: 'square', gain: 0.03, detune: 30 }); },
  open:   () => [392, 523, 659].forEach((f, i) => voice({ freq: f, dur: 0.13, type: 'triangle', gain: 0.05, delay: i * 0.07 })),
  tick:   () => voice({ freq: 1200, dur: 0.02, type: 'square', gain: 0.02 }),
  /** Paper being swept off the desk. */
  sweep:  (n = 1) => {
    noise({ from: 2600, to: 500, dur: 0.26, gain: 0.05, q: 0.8 });
    for (let i = 0; i < Math.min(5, n); i++) {
      noise({ from: 1800, to: 300, dur: 0.12, gain: 0.028, delay: i * 0.045 });
      voice({ freq: 260 - i * 18, dur: 0.06, type: 'square', gain: 0.022, delay: i * 0.045 });
    }
  },
  /** Fresh candles landing. */
  deal:   (n = 1) => {
    for (let i = 0; i < Math.min(6, n); i++) {
      voice({ freq: 520 + i * 40, dur: 0.045, type: 'triangle', gain: 0.03, delay: i * 0.05 });
      noise({ from: 900, to: 2200, dur: 0.05, gain: 0.02, delay: i * 0.05 });
    }
  },
};
// kept for older call sites
sfx.chipTick = (i) => sfx.volumeStep(i);

// ---------------------------------------------------------------------------
// Scoring motion
// ---------------------------------------------------------------------------
/** Throw a value from a candle or broker into the chip it feeds. */
export function flyTo(fromEl, toEl, text, kind = 'volume') {
  if (!fromEl || !toEl) return Promise.resolve();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly fly-' + kind;
  el.textContent = text;
  el.style.left = (a.left + a.width / 2) + 'px';
  el.style.top = (a.top + a.height * 0.32) + 'px';
  document.body.appendChild(el);
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height / 2) - (a.top + a.height * 0.32);
  const lift = -Math.max(30, Math.min(90, Math.abs(dx) * 0.28 + 30));
  const anim = el.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.18)', opacity: 1, offset: 0.16 },
    { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.5 + lift}px)) scale(1.02)`, opacity: 1, offset: 0.62 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`, opacity: 0 },
  ], { duration: 400, easing: 'cubic-bezier(.34,.65,.35,1)' });
  return anim.finished.then(() => el.remove()).catch(() => el.remove());
}

/** Pop a chip when something lands in it. Strength scales the kick. */
export function impact(el, strength = 1) {
  if (!el) return;
  const k = Math.max(1, Math.min(3, strength));
  el.animate([
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: `scale(${1 + 0.09 * k}) rotate(${(Math.random() - 0.5) * 2.4 * k}deg)`, filter: `brightness(${1 + 0.35 * k})`, offset: 0.34 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ], { duration: 220 + 40 * k, easing: 'cubic-bezier(.2,.9,.3,1)' });
}

/** Roll a number up rather than snapping it. */
export function countUp(el, from, to, ms, fmt = (v) => String(Math.round(v))) {
  if (!el) return Promise.resolve();
  if (from === to) { el.textContent = fmt(to); return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise((done) => {
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
}

export function formatPL(n) { return '$' + bignum(n); }
export { money };
