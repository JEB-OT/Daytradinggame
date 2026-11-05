// ---------------------------------------------------------------------------
// Settings that change how the game runs rather than how it plays.
//
//   quality     high | medium | low   what the screen is allowed to cost
//   speed       1 | 2 | 4 | 8          how fast trades, deals and payouts play out
//   animations  full | reduced | off   full: everything moves; reduced: the
//                                      ambient motion stops (the old "Ambient
//                                      Motion: off"); off: no motion at all, and
//                                      trades resolve at once
//   fps         true | false           a frame-rate counter in the corner
//   concise     true | false           LESS TEXT: for players who know the game —
//                                      the explanations go, what things DO stays
//
// Saved on this device. Pure: no DOM here, so the tests can hold it to account.
// ---------------------------------------------------------------------------

export const QUALITIES = ['high', 'medium', 'low'];
export const SPEEDS = [1, 2, 4, 8];
export const ANIMATIONS = ['full', 'reduced', 'off'];

export const SETTINGS_KEY = 'margincall.settings';
/** The one setting there used to be, before this module. */
const LEGACY_MOTION_KEY = 'margincall.motion';

export const DEFAULT_SETTINGS = { quality: 'high', speed: 1, animations: 'full', fps: false, concise: false };

/** Anything unknown or malformed falls back to the default for that field. */
export function cleanSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS };
  if (QUALITIES.includes(raw.quality)) s.quality = raw.quality;
  if (SPEEDS.includes(Number(raw.speed))) s.speed = Number(raw.speed);
  if (ANIMATIONS.includes(raw.animations)) s.animations = raw.animations;
  s.fps = raw.fps === true;
  s.concise = raw.concise === true;
  return s;
}

export function loadSettings(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null'); } catch { raw = null; }
  if (raw && typeof raw === 'object') return cleanSettings(raw);
  // First run of this version: carry the old motion switch across, so a player
  // who had turned the ambient motion off does not find it back on.
  const s = { ...DEFAULT_SETTINGS };
  try { if (storage?.getItem(LEGACY_MOTION_KEY) === '0') s.animations = 'reduced'; } catch {}
  return s;
}

export function saveSettings(s, storage = globalThis.localStorage) {
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(cleanSettings(s))); } catch {}
}

/** The next value in a cycle — the settings rows and the speed button step through them. */
export function cycle(list, current) {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

/**
 * How fast the game's own timing runs. With animations off, everything that
 * waits on a timer is effectively instant; otherwise it is the chosen speed.
 */
export function tempoOf(s) {
  return s.animations === 'off' ? { speed: 64, instant: true } : { speed: s.speed, instant: false };
}

/** Per quality, how many particles a burst throws (fraction of the full count). */
export const PARTICLES = { high: 1, medium: 0.6, low: 0.3 };
