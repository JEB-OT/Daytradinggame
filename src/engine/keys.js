/**
 * The keys a player can rebind (Settings → Controls), and the rules for which
 * key may do what.
 *
 * Only actions whose key is a matter of taste are here. The fixed keys stay
 * fixed, and nothing may be bound over one of them: a deselect key that also
 * went long would cost a trade.
 *
 * Keys are compared as `KeyboardEvent.key`, lower-cased — the same thing the
 * game's own key handler reads — so a binding means what the player pressed,
 * on whatever keyboard layout they pressed it.
 */

export const BINDABLE = {
  deselectAll: {
    label: 'Deselect all',
    default: 'x',
    blurb: 'take every candle out of your placement',
  },
  hoverSelect: {
    label: 'Hover select',
    default: 'e',
    blurb: 'press over a candle to place it, or hold it and sweep the mouse across several',
  },
};

/** Keys that already do something, and what — none of them can be rebound onto. */
export const FIXED = {
  escape: 'the menu',
  m: 'mute',
  b: 'the book',
  '?': 'help',
  l: 'go long',
  s: 'go short',
  w: 'sweep',
  a: 'arrange',
  ' ': 'sort the board',
  ...Object.fromEntries([...'1234567890'].map((d) => [d, 'place a candle by number'])),
};

/** Keys that are no use on their own, or that the browser needs for itself. */
const UNUSABLE = new Set(['shift', 'control', 'alt', 'altgraph', 'meta', 'os', 'capslock', 'numlock',
  'scrolllock', 'tab', 'enter', 'dead', 'unidentified', 'process', 'contextmenu']);

const STORE = 'margincall.keys';

export function defaultKeys() {
  return Object.fromEntries(Object.entries(BINDABLE).map(([action, b]) => [action, b.default]));
}

/** How a key is written on screen: `X`, `Space`, `Backspace`. */
export function keyLabel(key) {
  if (key === ' ') return 'Space';
  if (!key) return '—';
  return key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
}

/**
 * Why `key` cannot be bound to `action` given the other bindings, or `null` if
 * it can. The reason is written to be shown to the player as it stands.
 */
export function bindProblem(keys, action, key) {
  if (!key || UNUSABLE.has(key) || /^f\d+$/.test(key)) return 'Pick a letter, number or symbol key';
  if (FIXED[key]) return `${keyLabel(key)} already does ${FIXED[key]}`;
  for (const [other, k] of Object.entries(keys)) {
    if (other !== action && k === key) return `${keyLabel(key)} is already ${BINDABLE[other].label}`;
  }
  return null;
}

/**
 * The player's bindings, falling back to the defaults for anything missing,
 * unreadable or clashing. Never throws: a private window, a blocked store or a
 * hand-edited value all just mean "the defaults".
 */
export function loadKeys(storage = globalThis.localStorage) {
  const keys = defaultKeys();
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(STORE) || 'null'); } catch { /* unreadable — defaults */ }
  if (!saved || typeof saved !== 'object') return keys;
  for (const action of Object.keys(BINDABLE)) {
    const key = typeof saved[action] === 'string' ? saved[action].toLowerCase() : null;
    if (key && !bindProblem({}, action, key)) keys[action] = key;
  }
  // The settings screen never saves two actions on one key, so a clash means
  // the store was edited by hand — and the defaults are the only safe answer.
  const used = Object.values(keys);
  return new Set(used).size === used.length ? keys : defaultKeys();
}

export function saveKeys(keys, storage = globalThis.localStorage) {
  try { storage?.setItem(STORE, JSON.stringify(keys)); } catch { /* not saved — still bound this session */ }
}
