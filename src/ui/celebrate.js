// ---------------------------------------------------------------------------
// The bell: what happens the moment a deadline's quota is met.
//
// It is the biggest beat in a run, so it takes the middle of the table rather
// than a corner of it:
//
//   1. a hit-stop — the desk flashes and holds for a breath
//   2. the verdict slams into the centre, over a sunburst of hard gold rays,
//      with a shockwave of ink
//   3. a fountain of inked bills and coins erupts from under it, straight up
//      and out to both sides, and falls back across the whole screen
//   4. what you booked counts up under the title
//   5. bury the quota deep enough and it rains money from the top as well
//
// Everything scales with the overkill (profit ÷ quota): scraping past the
// quota is a good moment; burying it ten times over is a spectacle. The money
// is drawn, not emoji — flat colour in the same pen as the cards.
//
// Respects the game speed (tempo.js), the graphics quality (fewer pieces on
// MEDIUM and LOW) and the animation setting: REDUCED shows the verdict and
// nothing flies, OFF skips straight to the payout.
// ---------------------------------------------------------------------------
import { bignum } from '../engine/util.js';
import { PARTICLES } from '../engine/settings.js';
import { sfx, shake } from './fx.js';
import { paced, dur, isInstant } from './tempo.js';
import { calm, inkRing } from './motion.js';

const afford = (n) => Math.max(1, Math.round(n * (PARTICLES[document.documentElement.dataset.quality] ?? 1)));
const rand = (a, b) => a + Math.random() * (b - a);

/** How hard to celebrate, from how far past the quota the deadline finished. */
export function tierOf(over) {
  if (over >= 10) return { title: 'TOTAL OVERKILL', level: 3 };
  if (over >= 3) return { title: 'OVERKILL', level: 2 };
  if (over >= 1.5) return { title: 'QUOTA SMASHED', level: 1 };
  return { title: 'QUOTA MET', level: 0 };
}

const fmtTimes = (x) => (x >= 100 ? bignum(x) : x.toFixed(1));

function layer() {
  let l = document.getElementById('celebrate');
  if (!l) {
    l = document.createElement('div');
    l.id = 'celebrate';
    l.setAttribute('aria-hidden', 'true');
    document.body.appendChild(l);
  }
  return l;
}

/** One piece of money: a bill or a coin, drawn in flat colour and pen. */
function piece(L, x, y) {
  const el = document.createElement('i');
  const coin = Math.random() < 0.42;
  el.className = coin ? 'cb-coin' : 'cb-bill';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  L.appendChild(el);
  return { el, coin, s: rand(0.8, 1.35).toFixed(2) };
}

/**
 * Throw a piece along a real arc: up, out, and down under gravity, tumbling.
 * Bills flutter (they turn over in 3D); coins spin flat.
 */
function arc({ el, coin, s }, vx, vy, { g = 1500, life = 1.6, delay = 0 } = {}) {
  const frames = [];
  const spin = rand(-720, 720);
  const flip = rand(360, 1080) * (Math.random() < 0.5 ? -1 : 1);
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = (life * i) / N;
    const x = vx * t;
    const y = vy * t + 0.5 * g * t * t;
    const k = i / N;
    frames.push({
      transform: `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s})`
        + (coin ? ` rotate(${(spin * k).toFixed(1)}deg)` : ` rotate(${(spin * 0.4 * k).toFixed(1)}deg) rotateX(${(flip * k).toFixed(1)}deg)`),
      opacity: i === 0 ? 0 : k > 0.82 ? Math.max(0, 1 - (k - 0.82) / 0.18) : 1,
    });
  }
  const a = paced(el.animate(frames, { duration: life * 1000, delay, easing: 'linear', fill: 'backwards' }));
  if (a) a.onfinish = () => el.remove(); else el.remove();
}

/**
 * Play the bell. Resolves when the payout should come up; the money keeps
 * falling over it for a moment after.
 *
 * @param {object} o
 * @param {number} o.profit  what was booked this deadline
 * @param {number} o.quota   what was needed
 * @param {string} [o.tag]   the line over the title — the deadline, or the boss beaten
 * @param {Element} [o.stage] what to centre on (the table)
 */
export async function quotaMet({ profit, quota, tag = '', stage = null }) {
  if (isInstant()) return;
  const over = quota > 0 ? profit / quota : 1;
  const tier = tierOf(over);
  // 0 when the quota is scraped, 1 at 12× and beyond
  const power = Math.max(0, Math.min(1, (over - 1) / 11));
  const L = layer();
  L.innerHTML = '';
  L.classList.remove('out');

  const box = (stage || document.body).getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + Math.min(box.height * 0.42, innerHeight * 0.42);
  L.style.setProperty('--cx', cx + 'px');
  L.style.setProperty('--cy', cy + 'px');

  const quiet = calm();
  L.innerHTML = `
    ${quiet ? '' : '<div class="cb-flash"></div><div class="cb-rays"></div>'}
    <div class="cb-band lvl-${tier.level}"></div>
    <div class="cb-banner lvl-${tier.level}">
      ${tag ? `<div class="cb-tag">${tag}</div>` : ''}
      <div class="cb-title">${tier.title}</div>
      <div class="cb-sub"><b class="cb-amt">$${bignum(quota)}</b> BOOKED &nbsp;·&nbsp; <b>×${fmtTimes(over)}</b> THE QUOTA</div>
    </div>`;
  const banner = L.querySelector('.cb-banner');
  const band = L.querySelector('.cb-band');
  const amt = L.querySelector('.cb-amt');

  if (quiet) {
    banner.style.opacity = 1;
    band.style.opacity = 1;
    amt.textContent = '$' + bignum(profit);
    sfx.clear();
    await new Promise((r) => setTimeout(r, dur(1100)));
    L.classList.add('out');
    setTimeout(() => { L.innerHTML = ''; }, dur(300));
    return;
  }

  // 1 — hit-stop: the desk flashes and holds
  document.getElementById('app')?.classList.add('hitstop');
  sfx.stamp();
  await new Promise((r) => setTimeout(r, dur(110)));
  document.getElementById('app')?.classList.remove('hitstop');

  // 2 — the slam
  sfx.clear();
  sfx.register();
  paced(banner.animate([
    { transform: 'translate(-50%,-50%) scale(3.4) rotate(-12deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(.9) rotate(-1deg)', opacity: 1, offset: 0.5 },
    { transform: 'translate(-50%,-50%) scale(1.08) rotate(-3deg)', offset: 0.72 },
    { transform: 'translate(-50%,-50%) scale(1) rotate(-2deg)', opacity: 1 },
  ], { duration: 420, easing: 'cubic-bezier(.5,0,.4,1)', fill: 'both' }));
  // the ribbon the verdict sits on wipes out from the centre
  paced(band.animate([
    { transform: 'translateY(-50%) rotate(-2deg) scaleX(0)', opacity: 1 },
    { transform: 'translateY(-50%) rotate(-2deg) scaleX(1.04)', opacity: 1, offset: 0.7 },
    { transform: 'translateY(-50%) rotate(-2deg) scaleX(1)', opacity: 1 },
  ], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'both' }));
  const rays = L.querySelector('.cb-rays');
  paced(rays.animate([
    { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1) rotate(25deg)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-50%) scale(1.06) rotate(70deg)', opacity: 1, offset: 0.85 },
    { transform: 'translate(-50%,-50%) scale(1.12) rotate(85deg)', opacity: 0 },
  ], { duration: 2000, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'both' }));
  paced(L.querySelector('.cb-flash').animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: 360, easing: 'ease-out', fill: 'both' }));

  await new Promise((r) => setTimeout(r, dur(170)));
  // the landing: shockwave, shake scaled by the overkill
  inkRing(cx, cy, '#ffd24a', 380 + tier.level * 120, 10);
  setTimeout(() => inkRing(cx, cy, '#fff3b0', 240 + tier.level * 80, 6), dur(90));
  shake(tier.level >= 2);

  // 3 — the fountain, bursting out from behind the ribbon, up and out to both sides
  const fy = cy;
  const n = afford(34 + Math.round(power * 90) + tier.level * 14);
  for (let i = 0; i < n; i++) {
    const p = piece(L, cx + rand(-60, 60), fy);
    const side = i % 2 ? 1 : -1;
    const vx = side * rand(80, 300 + power * 420) + rand(-40, 40);
    const vy = -rand(520, 900 + power * 520);
    arc(p, vx, vy, { g: 1500, life: rand(1.3, 2.0), delay: dur(rand(0, 260 + power * 240)) });
  }
  // coins ring out as they go, faster and longer the bigger the win
  const rings = 4 + tier.level * 3;
  for (let i = 0; i < rings; i++) setTimeout(() => sfx.coin(i), dur(60 + i * (110 - tier.level * 18)));

  // 5 — bury it deep enough and it rains from the top as well
  if (tier.level >= 1) {
    const drops = afford(16 + Math.round(power * 70) + tier.level * 10);
    for (let i = 0; i < drops; i++) {
      const p = piece(L, rand(0, innerWidth), -40);
      arc(p, rand(-60, 60), rand(120, 260), { g: 900, life: rand(1.6, 2.4), delay: dur(rand(150, 900)) });
    }
  }

  // 4 — what was booked counts up under the title
  const t0 = performance.now(), span = dur(650);
  await new Promise((done) => {
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / Math.max(1, span));
      const e = 1 - Math.pow(1 - k, 3);
      amt.textContent = '$' + bignum(Math.floor(quota + (profit - quota) * e));
      if (k < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  paced(amt.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.3)' }));

  // hold the verdict, then let it go as the payout comes up; the money keeps falling
  await new Promise((r) => setTimeout(r, dur(520 + tier.level * 120)));
  paced(banner.animate([
    { transform: 'translate(-50%,-50%) scale(1) rotate(-2deg)', opacity: 1 },
    { transform: 'translate(-50%,-60%) scale(.86) rotate(-2deg)', opacity: 0 },
  ], { duration: 260, easing: 'ease-in', fill: 'forwards' }));
  paced(band.animate([
    { transform: 'translateY(-50%) rotate(-2deg) scaleX(1)', opacity: 1 },
    { transform: 'translateY(-50%) rotate(-2deg) scaleX(0)', opacity: 0 },
  ], { duration: 260, easing: 'ease-in', fill: 'forwards' }));
  setTimeout(() => { L.querySelectorAll('.cb-banner, .cb-band, .cb-rays, .cb-flash').forEach((e) => e.remove()); }, dur(280));
}
