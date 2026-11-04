// ---------------------------------------------------------------------------
// The art style, as knobs.
//
// Everything about how the game is drawn that is a matter of taste rather than
// meaning lives here: how heavy the ink is, how far it wobbles, how shadows are
// shaded, how the background and card faces are dressed. The card art
// (art.js) reads the SVG knobs; the interface reads `flags` through
// html[data-art~="flag"] rules in styles.css.
//
// Each named style is a candidate that was (or can be) put head to head in the
// Art Lab (tools/artlab.html), which shows the game twice with a different
// style in each frame. The winners of those rounds are what `DEFAULT` holds;
// the rest stay here so a round can be re-run, or re-judged by someone else.
//
// A style is picked with ?artstyle=<name> on the game's own address. Nothing
// else changes it, and without the parameter the game draws DEFAULT.
// ---------------------------------------------------------------------------

export const DEFAULT = {
  // ink
  ink: '#0a0e1a',      // outline colour
  inkWidth: 1.12,      // outline weight multiplier
  wobble: 3.2,         // turbulence displacement on the card art
  wobbleFreq: 0.042,   // how tight the wobble is
  // light and shade
  cel: 0.46,           // opacity of the hard highlight band
  celEnd: 0.27,        // how far down the shape the band reaches
  shade: 'hatch',      // shadow side: hatch | halftone | tone | none
  hatch: 0.62,         // hatching ink opacity
  rim: 0,              // backlight rim on the shadow edge (0 = none)
  // colour
  sat: 0,              // saturation shift for every item palette
  light: 0,            // lightness shift for every item palette
  // ground and print
  shadow: 'soft',      // drop shadow under each picture: soft | offset
  ground: 'texture',   // medallion/frame grounds: texture | rays | halftone
  // interface — read by styles.css
  flags: [],
};

export const STYLES = {
  current: { label: 'the shipping look' },
};

function activeName() {
  try {
    const n = new URLSearchParams(globalThis.location?.search || '').get('artstyle');
    return n && STYLES[n] ? n : 'current';
  } catch { return 'current'; }
}

export const STYLE_NAME = activeName();
export const STYLE = { ...DEFAULT, ...STYLES[STYLE_NAME], flags: [...DEFAULT.flags, ...(STYLES[STYLE_NAME].flags || [])] };

/** Tell the stylesheet which interface flags are on. Call once at boot. */
export function applyStyleFlags(doc = globalThis.document) {
  if (doc?.documentElement) doc.documentElement.dataset.art = STYLE.flags.join(' ');
}
