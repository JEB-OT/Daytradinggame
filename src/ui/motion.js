// ---------------------------------------------------------------------------
// Motion: the small movements that make the desk feel like a desk.
//
// fx.js has the scoring spectacle — chips, bursts, cash. This is everything
// around it that a player only notices when it is missing: a card that leans
// toward the pointer and catches the light, a button that gives under the
// finger, screens that deal their cards in instead of blinking on, a bought
// broker that actually travels to the desk, a sold one that spins away.
//
// Every effect here is decoration over state that has already changed, so
// skipping one never changes the game. All of them stand down when motion is
// switched off (body.no-motion) or the system asks for reduced motion.
//
// Web Animations are used throughout, on the independent `translate`,
// `rotate` and `scale` properties wherever an element may also have a CSS
// animation or a hover transform — those compose instead of fighting.
// ---------------------------------------------------------------------------

import { sfx } from './fx.js';

const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
/** True when motion should stand down. */
export const calm = () => document.body.classList.contains('no-motion') || !!reduceQuery?.matches;
/** LOW graphics: the cards stop leaning, so nothing redraws under a moving pointer. */
const lowQuality = () => document.documentElement.dataset.quality === 'low';

const layer = () => {
  let l = document.getElementById('motion-layer');
  if (!l) {
    l = document.createElement('div');
    l.id = 'motion-layer';
    l.setAttribute('aria-hidden', 'true');
    document.body.appendChild(l);
  }
  return l;
};

const anim = (el, frames, opts) => {
  try { return el.animate(frames, opts); } catch { return null; }
};

// ---------------------------------------------------------------- tilt + glint
/** What leans, and how far (degrees at the very edge of the card). */
const TILT = [
  ['.candle', 13], ['.broker', 15], ['.consumable', 15], ['.pack-opt', 12],
  ['.shop-slot', 7], ['.dl-choice', 6], ['.home-card', 4], ['.pile', 10],
];
const TILT_SEL = TILT.map(([s]) => s).join(',');
let tilted = null;

function untilt() {
  if (!tilted) return;
  tilted.style.removeProperty('--rx');
  tilted.style.removeProperty('--ry');
  tilted.style.removeProperty('--gx');
  tilted = null;
}

/**
 * Cards lean toward the pointer and a hard cel glint slides across them. The
 * lean is two custom properties the hover rules in styles.css fold into their
 * transform, so without this module every card simply does not lean.
 */
export function initTilt() {
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest?.(TILT_SEL);
    if (el !== tilted) {
      untilt();
      if (el && !el.closest('.bk-cell, .fly-ghost')) sfx.hover();
    }
    if (!el || calm() || lowQuality() || el.closest('.bk-cell, .fly-ghost')) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const px = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
    const py = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
    const max = TILT.find(([s]) => el.matches(s))?.[1] ?? 8;
    el.style.setProperty('--rx', (-py * max * 2).toFixed(2) + 'deg');
    el.style.setProperty('--ry', (px * max * 2).toFixed(2) + 'deg');
    el.style.setProperty('--gx', ((px + 0.5) * 140 - 20).toFixed(1) + '%');
    tilted = el;
  }, { passive: true });
  document.addEventListener('pointerleave', untilt);
  addEventListener('blur', untilt);
}

// ---------------------------------------------------------------- press
const PRESS_SEL = '.btn, .act, .mini, .bk-tab, .comp-tab, .home-card, .set-row, .pile, .home-version';

/**
 * Buttons give under the finger: a quick squash on the way down and a spring
 * back on release, plus a ring of ink where it was pressed. Tiny, but it is
 * the difference between pressing a button and clicking on a picture of one.
 */
export function initPress() {
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || calm()) return;
    const el = e.target.closest?.(PRESS_SEL);
    if (!el || el.disabled) return;
    anim(el, [
      { scale: '1' }, { scale: '0.93 0.9', offset: 0.35 }, { scale: '1.04 1.06', offset: 0.7 }, { scale: '1' },
    ], { duration: 300, easing: 'cubic-bezier(.3,.7,.4,1)' });
    if (el.matches('.btn, .act')) inkRing(e.clientX, e.clientY, el.matches('.act.long, .btn.primary') ? '#45e08d'
      : el.matches('.act.short') ? '#ff5468' : '#9fb4e0', 34);
  }, { passive: true });
}

/** An ink ring that opens out from a point — a press, a trigger, a landing. */
export function inkRing(x, y, color = '#fff', size = 60, width = 4) {
  if (calm()) return;
  const r = document.createElement('div');
  r.className = 'ink-ring';
  r.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--rc:${color};--rw:${width}px`;
  layer().appendChild(r);
  const a = anim(r, [
    { transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 },
  ], { duration: 460, easing: 'cubic-bezier(.15,.8,.3,1)' });
  const done = () => r.remove();
  if (a) a.onfinish = done; else done();
}

/** A ring around an element, from its centre. */
export function ringAround(el, color, scale = 1.6) {
  if (!el || calm()) return;
  const b = el.getBoundingClientRect();
  if (!b.width) return;
  inkRing(b.left + b.width / 2, b.top + b.height / 2, color, Math.max(b.width, b.height) * scale, 5);
}

// ---------------------------------------------------------------- pops
/** Selected: the card jumps a little and lands with a squash. */
export function pop(el, k = 1) {
  if (!el || calm()) return;
  anim(el, [
    { scale: '1' }, { scale: `${1 + 0.1 * k} ${1 + 0.16 * k}`, offset: 0.3 },
    { scale: `${1 + 0.05 * k} ${1 - 0.06 * k}`, offset: 0.62 }, { scale: '1' },
  ], { duration: 320, easing: 'cubic-bezier(.3,.8,.35,1)' });
}

/** Let go: a smaller, softer dip. */
export function dip(el) {
  if (!el || calm()) return;
  anim(el, [{ scale: '1' }, { scale: '0.95 0.97', offset: 0.4 }, { scale: '1' }], { duration: 220, easing: 'ease-out' });
}

/** A number changed: it bumps, so the eye goes to it. */
export function bump(el, k = 1) {
  if (!el || calm()) return;
  anim(el, [
    { scale: '1', rotate: '0deg' },
    { scale: String(1 + 0.22 * k), rotate: `${(Math.random() < 0.5 ? -1 : 1) * 4 * k}deg`, offset: 0.3 },
    { scale: '1', rotate: '0deg' },
  ], { duration: 360, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
}

/** Something refused: a short shake of the head. */
export function nope(el) {
  if (!el || calm()) return;
  anim(el, [
    { translate: '0 0' }, { translate: '-6px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '0 0' },
  ], { duration: 260, easing: 'ease-out' });
}

// ---------------------------------------------------------------- screens
const DEAL_SEL = '.dl-choice, .shop-slot, .pack-opt, .home-card, .home-play, .stat-box, .payout-line, .payout-total,'
  + ' .tut-step, .go-reason, .bonus-art, .pick-card, .floor-earn, .floor-bar';

/**
 * A screen deals its cards in rather than appearing all at once: each rises
 * into place a beat after the one before it, with a little spin.
 */
export function dealIn(root, { from = 'below', stagger = 55, delay = 70 } = {}) {
  if (!root || calm()) return 0;
  const els = [...root.querySelectorAll(DEAL_SEL)].slice(0, 28);
  els.forEach((el, i) => {
    const cardLike = el.matches('.dl-choice, .shop-slot, .pack-opt, .pick-card');
    const spin = cardLike ? (i % 2 ? 5 : -5) : 0;
    const dy = from === 'above' ? -40 : cardLike ? 70 : 18;
    // a card that is drawn larger with an inline `scale` keeps that size
    const base = parseFloat(el.style.scale) || 1;
    anim(el, [
      { translate: `0 ${dy}px`, rotate: `${spin}deg`, scale: String(base * (cardLike ? 0.82 : 0.96)), opacity: 0 },
      { translate: '0 -6px', rotate: `${-spin * 0.2}deg`, scale: String(base * 1.02), opacity: 1, offset: 0.7 },
      { translate: '0 0', rotate: '0deg', scale: String(base), opacity: 1 },
    ], { duration: cardLike ? 460 : 340, delay: delay + i * stagger, easing: 'cubic-bezier(.2,.85,.3,1)', fill: 'backwards' });
  });
  return delay + els.length * stagger;
}

/**
 * Flip cards over in sequence — a reroll turns the Floor's stock face-down and
 * up again instead of swapping it under you.
 */
export function flipIn(els, stagger = 70) {
  if (calm()) return;
  [...els].forEach((el, i) => anim(el, [
    { transform: 'perspective(700px) rotateY(88deg)', filter: 'brightness(1.8)' },
    { transform: 'perspective(700px) rotateY(-8deg)', filter: 'brightness(1.1)', offset: 0.7 },
    { transform: 'perspective(700px) rotateY(0deg)', filter: 'brightness(1)' },
  ], { duration: 380, delay: i * stagger, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' }));
}

/**
 * The overlay that just closed fades and drops away, as a picture of itself:
 * the real one is already gone, so nothing about the game waits on this.
 */
export function ghostOut(ov) {
  if (!ov || calm()) return;
  const g = ov.cloneNode(true);
  g.classList.add('overlay-ghost');
  g.removeAttribute('id');
  g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  layer().appendChild(g);
  const sheet = g.querySelector('.sheet');
  anim(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  if (sheet) anim(sheet, [{ translate: '0 0', scale: '1' }, { translate: '0 24px', scale: '.96' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
  setTimeout(() => g.remove(), 240);
}

// ---------------------------------------------------------------- glides
/**
 * Where every keyed child of a row stands now — take it before a redraw, hand
 * it to `glide` after, and the cards slide to their new places instead of
 * snapping there. Keyed by data-uid, so a card that moved is followed.
 */
export function positions(row) {
  const m = new Map();
  if (!row || calm()) return m;
  for (const el of row.children) if (el.dataset.uid) m.set(el.dataset.uid, el.getBoundingClientRect());
  return m;
}

export function glide(row, before, ms = 280) {
  if (!row || !before?.size || calm()) return;
  for (const el of row.children) {
    const r0 = before.get(el.dataset.uid);
    if (!r0) continue;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
    // `add` stacks on top of whatever the card's own idle animation is doing
    // with `translate`, rather than freezing it for the length of the glide.
    anim(el, [{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }],
      { duration: ms, easing: 'cubic-bezier(.2,.9,.3,1.1)', composite: 'add' });
  }
}

// ---------------------------------------------------------------- flights
/** A picture of an element, pinned where it stands, to animate after the real one is gone. */
export function snapshot(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const g = el.cloneNode(true);
  g.classList.add('fly-ghost');
  g.removeAttribute('id');
  g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  g.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;`;
  return { g, r };
}

/**
 * Fly a snapshot along an arc to where `target` now stands — the shop card you
 * bought travelling down to your desk. The target is hidden until it lands.
 */
export function flyTo(snap, target, { onLand, keep = false } = {}) {
  if (!snap) return;
  if (!target || calm()) { onLand?.(); return; }
  const t = target.getBoundingClientRect();
  if (!t.width) { onLand?.(); return; }
  layer().appendChild(snap.g);
  if (!keep) target.style.visibility = 'hidden';
  const dx = t.left + t.width / 2 - (snap.r.left + snap.r.width / 2);
  const dy = t.top + t.height / 2 - (snap.r.top + snap.r.height / 2);
  const s = Math.min(t.width / snap.r.width, t.height / snap.r.height);
  const lift = -Math.min(160, 60 + Math.abs(dx) * 0.2);
  const a = anim(snap.g, [
    { transform: 'translate(0,0) rotate(0deg) scale(1)' },
    { transform: `translate(${dx * 0.1}px,${lift * 0.6}px) rotate(-6deg) scale(1.08)`, offset: 0.22 },
    { transform: `translate(${dx * 0.7}px,${dy * 0.45 + lift}px) rotate(8deg) scale(${(1 + s) / 2})`, offset: 0.66 },
    { transform: `translate(${dx}px,${dy}px) rotate(0deg) scale(${s})` },
  ], { duration: 620, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'forwards' });
  const land = () => {
    snap.g.remove();
    if (!keep) target.style.visibility = '';
    pop(target, 1.2);
    ringAround(target, '#ffd24a', 1.4);
    onLand?.();
  };
  if (a) a.onfinish = land; else land();
}

/** Sold: the card spins up and away, shedding a ring of gold. */
export function spinAway(snap) {
  if (!snap || calm()) return;
  layer().appendChild(snap.g);
  const cx = snap.r.left + snap.r.width / 2, cy = snap.r.top + snap.r.height / 2;
  inkRing(cx, cy, '#ffd24a', snap.r.width * 1.8, 5);
  const a = anim(snap.g, [
    { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1, filter: 'brightness(1)' },
    { transform: 'translateY(-26px) rotate(-12deg) scale(1.12)', opacity: 1, filter: 'brightness(1.6)', offset: 0.3 },
    { transform: 'translateY(-70px) rotate(200deg) scale(.2)', opacity: 0, filter: 'brightness(2)' },
  ], { duration: 520, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
  if (a) a.onfinish = () => snap.g.remove(); else snap.g.remove();
}

/**
 * A Chart or Rumor used: the card lifts, turns, and dives into what it acts
 * on, where it goes off in a ring of its own colour.
 */
export function spend(snap, target, color = '#a98bff') {
  if (!snap || calm()) return;
  layer().appendChild(snap.g);
  const t = (target || document.body).getBoundingClientRect();
  const tx = t.left + t.width / 2, ty = t.top + t.height / 2;
  const dx = tx - (snap.r.left + snap.r.width / 2), dy = ty - (snap.r.top + snap.r.height / 2);
  const a = anim(snap.g, [
    { transform: 'translate(0,0) rotateY(0deg) scale(1)', opacity: 1, filter: 'brightness(1)' },
    { transform: 'translate(0,-34px) rotateY(180deg) scale(1.25)', opacity: 1, filter: 'brightness(1.5)', offset: 0.35 },
    { transform: `translate(${dx}px,${dy}px) rotateY(360deg) scale(.3)`, opacity: 0.2, filter: 'brightness(2.2)' },
  ], { duration: 560, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' });
  const boom = () => { snap.g.remove(); inkRing(tx, ty, color, Math.min(260, Math.max(90, t.width * 0.5)), 6); };
  if (a) a.onfinish = boom; else boom();
}

// ---------------------------------------------------------------- big moments
/**
 * A rubber stamp slammed onto the screen — LIQUIDATED, CASHED OUT. Comes in
 * huge and tilted, lands with a jolt, and leaves a ring of ink.
 */
export function stamp(el) {
  if (!el || calm()) return;
  anim(el, [
    { scale: '3.2', rotate: '-14deg', opacity: 0 },
    { scale: '0.92', rotate: '-2deg', opacity: 1, offset: 0.55 },
    { scale: '1.06', rotate: '-3deg', offset: 0.75 },
    { scale: '1', rotate: '-2deg', opacity: 1 },
  ], { duration: 520, delay: 160, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'backwards' });
  // the landing: the whole sheet takes the blow
  setTimeout(() => {
    sfx.stamp();
    const sheet = el.closest('.sheet') || el;
    anim(sheet, [{ translate: '0 0' }, { translate: '0 7px' }, { translate: '0 -2px' }, { translate: '0 0' }],
      { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)' });
  }, 450);
}

/** Paper confetti, cut by hand and inked: a run won, a record broken. */
export function confetti(n = 90, { colors = ['#45e08d', '#ffd24a', '#40d9ff', '#ff5cf0', '#ff5468', '#f6ecd8'] } = {}) {
  if (calm()) return;
  const L = layer();
  const W = innerWidth, H = innerHeight;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetto';
    const w = 7 + Math.random() * 9, h = 4 + Math.random() * 7;
    p.style.cssText = `left:${Math.random() * W}px;top:-20px;width:${w}px;height:${h}px;background:${colors[i % colors.length]}`;
    L.appendChild(p);
    const drift = (Math.random() - 0.5) * 260;
    const spin = (Math.random() - 0.5) * 1440;
    const dur = 1800 + Math.random() * 1600;
    const a = anim(p, [
      { transform: 'translate(0,0) rotate(0deg) rotateX(0deg)' },
      { transform: `translate(${drift * 0.5}px,${H * 0.5}px) rotate(${spin * 0.5}deg) rotateX(540deg)`, offset: 0.5 },
      { transform: `translate(${drift}px,${H + 40}px) rotate(${spin}deg) rotateX(1080deg)` },
    ], { duration: dur, delay: Math.random() * 700, easing: 'cubic-bezier(.25,.4,.5,1)', fill: 'backwards' });
    if (a) a.onfinish = () => p.remove(); else p.remove();
  }
}

/**
 * A sweep of ink across the screen between two places — into a deadline, onto
 * the Floor. Fast enough never to be waited on: the change underneath happens
 * at the moment the band covers the screen.
 */
export function wipe(onCovered, color = '#0a0e1a') {
  if (calm()) { onCovered?.(); return; }
  const w = document.createElement('div');
  w.className = 'ink-wipe';
  w.style.setProperty('--wc', color);
  layer().appendChild(w);
  const a = anim(w, [
    { transform: 'translateX(-130%) skewX(-14deg)' },
    { transform: 'translateX(0%) skewX(-14deg)', offset: 0.45 },
    { transform: 'translateX(0%) skewX(-14deg)', offset: 0.55 },
    { transform: 'translateX(130%) skewX(-14deg)' },
  ], { duration: 560, easing: 'cubic-bezier(.6,0,.4,1)' });
  setTimeout(() => onCovered?.(), 250);
  if (a) a.onfinish = () => w.remove(); else w.remove();
}

// ---------------------------------------------------------------- the FPS counter
let fpsEl = null, fpsRaf = 0;
/**
 * A frame-rate counter in the corner (Settings → Show FPS), so the effect of
 * the graphics quality setting can be seen rather than guessed. Counts real
 * frames over half-second windows and shows the slowest frame too, because a
 * smooth average can hide a stutter.
 */
export function fpsMeter(on) {
  if (!on) {
    cancelAnimationFrame(fpsRaf);
    fpsEl?.remove();
    fpsEl = null;
    return;
  }
  if (fpsEl) return;
  fpsEl = document.createElement('div');
  fpsEl.id = 'fps-meter';
  fpsEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fpsEl);
  let frames = 0, from = performance.now(), last = from, worst = 0;
  const tick = (now) => {
    frames++;
    worst = Math.max(worst, now - last);
    last = now;
    if (now - from >= 500) {
      const fps = Math.round((frames * 1000) / (now - from));
      fpsEl.textContent = `${fps} FPS · ${Math.round(worst)} ms`;
      fpsEl.className = fps >= 50 ? 'good' : fps >= 28 ? 'ok' : 'bad';
      frames = 0; from = now; worst = 0;
    }
    fpsRaf = requestAnimationFrame(tick);
  };
  fpsRaf = requestAnimationFrame(tick);
}
