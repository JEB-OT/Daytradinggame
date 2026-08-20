import { bignum, money } from '../engine/util.js';

const root = () => document.getElementById('app');

export function shake(big = false) {
  const el = root();
  el.classList.remove('shake', 'shake-big');
  void el.offsetWidth;
  el.classList.add(big ? 'shake-big' : 'shake');
  setTimeout(() => el.classList.remove('shake', 'shake-big'), big ? 1300 : 400);
}

export function toast(msg, kind = '') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2500);
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

// ---------------------------------------------------------------------------
// Tiny WebAudio blip kit — no assets, all synthesised.
// ---------------------------------------------------------------------------
let ac = null;
let muted = false;
export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }
function actx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
  if (ac?.state === 'suspended') ac.resume();
  return ac;
}

export function blip(freq = 440, dur = 0.07, type = 'square', gain = 0.05) {
  if (muted) return;
  const a = actx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

export const sfx = {
  select:  () => blip(660, 0.04, 'square', 0.035),
  deselect:() => blip(420, 0.04, 'square', 0.03),
  chipTick:(i) => blip(420 + Math.min(24, i) * 42, 0.045, 'square', 0.03),
  play:    () => { blip(320, 0.08, 'sawtooth', 0.05); setTimeout(() => blip(480, 0.1, 'sawtooth', 0.04), 60); },
  green:   () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.11, 'triangle', 0.05), i * 65)); },
  red:     () => { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.13, 'sawtooth', 0.05), i * 80)); },
  cash:    () => { [880, 1174].forEach((f, i) => setTimeout(() => blip(f, 0.07, 'triangle', 0.04), i * 55)); },
  clear:   () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.055), i * 90)); },
  fail:    () => { [220, 180, 140, 100].forEach((f, i) => setTimeout(() => blip(f, 0.28, 'sawtooth', 0.06), i * 150)); },
  buy:     () => { blip(740, 0.06, 'square', 0.04); setTimeout(() => blip(1100, 0.08, 'square', 0.035), 55); },
  err:     () => blip(140, 0.12, 'sawtooth', 0.05),
  open:    () => { [392, 523, 659].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'triangle', 0.045), i * 70)); },
};

export function formatPL(n) { return '$' + bignum(n); }
export { money };
