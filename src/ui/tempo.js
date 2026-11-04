// ---------------------------------------------------------------------------
// Tempo: the game speed setting (1× to 8×), applied to everything that plays
// out over time — the waits in a trade's resolution, the chart printing its
// candle, cards flying, numbers counting up, and the CSS animations that are
// part of the action (a candle scoring, a burst, a card dealt or swept).
//
// Ambient loops — a broker breathing, a legendary's glow — keep their own
// pace at any speed: 8× is for the game, not for making the desk twitch.
//
// With animations off the game is "instant": waits resolve on the next tick
// and one-shot animations run so fast they are only a frame.
// ---------------------------------------------------------------------------

let speed = 1;
let instant = false;

export function setTempo(t) {
  speed = Math.max(1, Number(t.speed) || 1);
  instant = !!t.instant;
}

export const gameSpeed = () => speed;
export const isInstant = () => instant;

/** A duration in the game's time, in real milliseconds. */
export const dur = (ms) => (instant ? 0 : ms / speed);

/** Wait for a stretch of game time. */
export const wait = (ms) => new Promise((r) => setTimeout(r, dur(ms)));

/** Run a Web Animation at the game's speed. Returns the animation. */
export function paced(anim) {
  if (anim) anim.playbackRate = instant ? 64 : speed;
  return anim;
}

/**
 * CSS animations do not know about the setting, so they are caught as they
 * start: anything that runs a fixed number of times is part of the action and
 * is sped up; anything that loops forever is ambient and keeps its pace.
 */
export function installTempo(doc = globalThis.document) {
  if (!doc) return;
  doc.addEventListener('animationstart', (e) => {
    if (speed === 1 && !instant) return;
    const el = e.target;
    if (!el?.getAnimations) return;
    for (const a of el.getAnimations()) {
      if (a.animationName !== e.animationName) continue;
      const iterations = a.effect?.getTiming?.().iterations;
      if (iterations === Infinity) continue;
      a.playbackRate = instant ? 64 : speed;
    }
  }, true);
}
