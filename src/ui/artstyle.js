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
  inkWidth: 1.5,       // outline weight multiplier          (round 1: bold beat 1.12)
  wobble: 2.4,         // turbulence displacement on the card art
  wobbleFreq: 0.042,   // how tight the wobble is
  // light and shade
  cel: 0.52,           // opacity of the hard highlight band
  celEnd: 0.27,        // how far down the shape the band reaches
  shade: 'hatch',      // shadow side: hatch | halftone | tone | none   (round 1: hatch kept)
  hatch: 0.62,         // hatching ink opacity
  rim: 0,              // backlight rim on the shadow edge (0 = none)  (round 1: rim lost)
  // colour
  sat: 12,             // saturation shift for every item palette    (round 3: punchy beat muted and v1.11)
  light: 3,            // lightness shift for every item palette
  // ground and print
  shadow: 'soft',      // drop shadow under each picture: soft | offset
  ground: 'texture',   // medallion/frame grounds: texture | rays | halftone   (round 4: texture kept)
  // interface — read by styles.css (bigart) and main.js (marble)
  flags: ['bigart', 'marble'], // (round 2: both beat the v1.11 interface)
};

/**
 * The candidates. Each is a set of overrides on DEFAULT, so `classic` — the
 * look before the Art Lab — has to put every changed knob back.
 */
export const STYLES = {
  current: { label: 'the shipping look (every round winner)' },
  classic: { label: 'v1.11: thin ink, flat backdrop, small art', inkWidth: 1.12, wobble: 3.2, cel: 0.46, sat: 0, light: 0, flags: [], replaceFlags: true },
  // round 1 — ink and shade (judged against classic)
  bold: { label: 'heavier ink, less wobble', inkWidth: 1.5, wobble: 2.4, cel: 0.52 },
  rim: { label: 'backlit rim on the shadow edge', rim: 0.55 },
  halftone: { label: 'halftone dots for shadow', shade: 'halftone', hatch: 0.5 },
  tone: { label: 'flat two-tone shadow', shade: 'tone' },
  // round 2 — the room
  flat: { label: 'no marbled backdrop', flags: ['bigart'], replaceFlags: true },
  smallart: { label: 'pictures at their v1.11 size', flags: ['marble'], replaceFlags: true },
  // round 3 — colour
  muted: { label: 'desaturated, print-like', sat: -14, light: -2 },
  neutral: { label: 'palettes as drawn, no shift', sat: 0, light: 0 },
  // round 4 — grounds (texture kept: rays would blur Legendary's sunburst)
  rays: { label: 'sunburst grounds', ground: 'rays' },
  dotGround: { label: 'halftone grounds', ground: 'halftone' },
};

function activeName() {
  try {
    const n = new URLSearchParams(globalThis.location?.search || '').get('artstyle');
    return n && STYLES[n] ? n : 'current';
  } catch { return 'current'; }
}

export const STYLE_NAME = activeName();
const pick = STYLES[STYLE_NAME];
export const STYLE = {
  ...DEFAULT, ...pick,
  flags: pick.replaceFlags ? [...(pick.flags || [])] : [...new Set([...DEFAULT.flags, ...(pick.flags || [])])],
};

/** Tell the stylesheet which interface flags are on. Call once at boot. */
export function applyStyleFlags(doc = globalThis.document) {
  if (doc?.documentElement) doc.documentElement.dataset.art = STYLE.flags.join(' ');
}
