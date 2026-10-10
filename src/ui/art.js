// ---------------------------------------------------------------------------
// ART — every card's picture, drawn as vector illustration.
//
// The cards used to show a bare emoji: a single font glyph, the same size and
// style as a chat message, which made a broker worth $9 look like a text
// reaction. Everything here is drawn instead. An item's picture is three
// layers:
//
//   frame   what KIND of thing it is — a broker is a struck medallion, a Chart
//           a tarot card, a Contract a sealed scroll, a Rumor a speech
//           bubble, a licence a shield, a boss a spiked crest, a pack a foil
//           wrapper. Brokers rim in their rarity's metal.
//   glyph   what it IS — a hand-drawn illustration from the library below,
//           tinted with the item's own hue.
//   pip     for brokers, what it DOES: × for a multiplier, + for Leverage or
//           Volume, $ for cash, ↻ for an extra print, ⚙ for a rule change.
//           Read off the broker's own definition, so it cannot drift from it.
//
// The finish is hand-inked rather than airbrushed: every shape is flat colour,
// a hard-edged cel highlight, cross-hatched shadow on its lower side, and an
// ink outline, and the whole picture then runs through a turbulence filter so
// the lines wobble the way a pen's do. Metal — rims, gold — keeps polished cel
// bands and no hatching, so frames stay clean and the texture lives in the
// picture. The gradients, hatching and filter live once in the document
// (ensureArtDefs) rather than in every picture, so a screen of 140 brokers is
// not 140 copies of the same defs.
// ---------------------------------------------------------------------------
import { BROKERS } from '../game/brokers.js';
import { CHARTS, CONTRACTS, RUMORS } from '../game/consumables.js';
import { LICENSES } from '../game/licenses.js';
import { BOSSES } from '../game/bosses.js';

const INK = '#0a0e1a';

// --- shared defs -------------------------------------------------------------
const DEFS = `
<linearGradient id="mcShade" x1=".15" y1="0" x2=".85" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".5"/>
  <stop offset=".42" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".58" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity=".45"/>
</linearGradient>
<linearGradient id="mcMetal" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
  <stop offset=".22" stop-color="#fff" stop-opacity=".05"/>
  <stop offset=".48" stop-color="#fff" stop-opacity=".35"/>
  <stop offset=".7" stop-color="#000" stop-opacity=".12"/>
  <stop offset="1" stop-color="#000" stop-opacity=".5"/>
</linearGradient>
<linearGradient id="mcCel" x1=".1" y1="0" x2=".9" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".46"/>
  <stop offset=".27" stop-color="#fff" stop-opacity=".46"/>
  <stop offset=".29" stop-color="#fff" stop-opacity="0"/>
  <stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<linearGradient id="mcCelMetal" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fff" stop-opacity=".62"/>
  <stop offset=".2" stop-color="#fff" stop-opacity=".62"/>
  <stop offset=".22" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".44" stop-color="#fff" stop-opacity="0"/>
  <stop offset=".46" stop-color="#fff" stop-opacity=".3"/>
  <stop offset=".52" stop-color="#fff" stop-opacity=".3"/>
  <stop offset=".54" stop-color="#fff" stop-opacity="0"/>
</linearGradient>
<pattern id="mcInkHatch" width="3.6" height="3.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
  <rect width="3.6" height="3.6" fill="#000" fill-opacity=".14"/>
  <path d="M.9 0V3.6" stroke="#0a0e1a" stroke-width="1.15" stroke-opacity=".62"/>
</pattern>
<linearGradient id="mcShadowRamp" x1=".15" y1="0" x2=".85" y2="1">
  <stop offset=".56" stop-color="#000"/>
  <stop offset=".6" stop-color="#fff"/>
</linearGradient>
<mask id="mcShadowMask" maskContentUnits="objectBoundingBox">
  <rect width="1" height="1" fill="url(#mcShadowRamp)"/>
</mask>
<filter id="mcInk" x="-12%" y="-12%" width="124%" height="124%">
  <feTurbulence type="fractalNoise" baseFrequency="0.042" numOctaves="2" seed="5" result="wobble"/>
  <feDisplacementMap in="SourceGraphic" in2="wobble" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<radialGradient id="mcDisc" cx=".5" cy=".38" r=".62">
  <stop offset="0" stop-color="#fff" stop-opacity=".28"/>
  <stop offset=".6" stop-color="#fff" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity=".55"/>
</radialGradient>
<radialGradient id="mcFlame" cx=".5" cy=".6" r=".55">
  <stop offset="0" stop-color="#fff6c9" stop-opacity=".95"/>
  <stop offset=".55" stop-color="#ffcf5a" stop-opacity=".45"/>
  <stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/>
</radialGradient>
<linearGradient id="mcFoil" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#ff7ad9"/><stop offset=".25" stop-color="#7ad7ff"/>
  <stop offset=".5" stop-color="#b8ff7a"/><stop offset=".75" stop-color="#ffe27a"/>
  <stop offset="1" stop-color="#ff7ad9"/>
</linearGradient>
<pattern id="mcGrid" width="10" height="10" patternUnits="userSpaceOnUse">
  <path d="M10 0H0V10" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="1"/>
</pattern>
<pattern id="mcHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
  <path d="M0 0V7" stroke="#fff" stroke-opacity=".07" stroke-width="2.4"/>
</pattern>
<pattern id="mcDots" width="8" height="8" patternUnits="userSpaceOnUse">
  <circle cx="4" cy="4" r="1.1" fill="#fff" fill-opacity=".1"/>
</pattern>`;

/**
 * Put the shared gradients and patterns into the page, once.
 *
 * Not `display:none`: some engines refuse to paint from a gradient inside a
 * hidden subtree. A zero-size absolutely-positioned SVG is invisible and still
 * counts as rendered.
 */
export function ensureArtDefs() {
  if (typeof document === 'undefined' || document.getElementById('mc-art-defs')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="mc-art-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
    style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none"><defs>${DEFS}</defs></svg>`;
  document.body.appendChild(holder.firstElementChild);
}

// --- colour ------------------------------------------------------------------
/** A palette derived from one hue: the item's own colour at five depths. */
export function pal(h, s = 72) {
  return {
    h,
    light: `hsl(${h},${Math.min(100, s + 12)}%,76%)`,
    base: `hsl(${h},${s}%,56%)`,
    dark: `hsl(${h},${s - 6}%,36%)`,
    deep: `hsl(${h},${s - 18}%,16%)`,
    glow: `hsl(${h},95%,66%)`,
  };
}
const GOLD = { light: '#fff3b0', base: '#ffcf45', dark: '#c3841a', deep: '#5e3c07' };
const SILVER = { light: '#ffffff', base: '#d9e3f0', dark: '#8695ac', deep: '#334055' };
const BONE = '#f2e8d2';
const PAPER = '#efe2c2';
const RED = '#ff5468';
const GREEN = '#45e08d';
const CYAN = '#40d9ff';

// --- drawing primitives -------------------------------------------------------
/**
 * One solid, shaded, outlined shape. `tag` is an SVG element name and `g` its
 * geometry attributes. The shade pass is skipped for small details, where a
 * gradient only muddies the colour.
 */
function solid(tag, g, fill, o = {}) {
  const op = o.op != null ? ` opacity="${o.op}"` : '';
  let out = `<${tag} ${g} fill="${fill}"${op}/>`;
  if (!o.flat) {
    // Metal takes polished cel bands and no hatching: rims and gold stay clean
    // and bright, so the hand-inked texture lives in the picture, not the frame.
    out += `<${tag} ${g} fill="url(#${o.metal ? 'mcCelMetal' : 'mcCel'})"${op}/>`;
    if (!o.metal) out += `<${tag} ${g} fill="url(#mcInkHatch)" mask="url(#mcShadowMask)"${op}/>`;
  }
  if (!o.noStroke) {
    out += `<${tag} ${g} fill="none" stroke="${o.stroke || INK}" stroke-width="${(o.sw ?? 3) * 1.12}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  return out;
}
const P = (d, fill, o) => solid('path', `d="${d}"`, fill, o);
const C = (cx, cy, r, fill, o) => solid('circle', `cx="${cx}" cy="${cy}" r="${r}"`, fill, o);
const E = (cx, cy, rx, ry, fill, o) => solid('ellipse', `cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, fill, o);
const R = (x, y, w, h, rx, fill, o) => solid('rect', `x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"`, fill, o);
/** A stroked line or open path. */
const L = (d, color = INK, w = 3, op) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op != null ? ` opacity="${op}"` : ''}/>`;
/** Flat fill, no outline — highlights, shadows, inner detail. */
const F = (d, fill, op) => `<path d="${d}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const FC = (cx, cy, r, fill, op) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
const FE = (cx, cy, rx, ry, fill, op) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${op != null ? ` opacity="${op}"` : ''}/>`;
/** A white specular glint. */
const glint = (cx, cy, rx, ry, op = 0.6, rot = -30) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
/** Four-point sparkle. */
const sparkle = (x, y, s, fill = '#fff', op = 0.9) =>
  F(`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`, fill, op);
/** Mirror a path's x coordinates about x=50 — for symmetric creatures. */
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${100 - Number(x)} ${y}`);
/** A small candlestick, the game's own unit of meaning. */
function stick(x, yTop, h, bull, w = 10) {
  const col = bull ? GREEN : RED;
  return L(`M${x} ${yTop - 6} V${yTop + h + 6}`, INK, 2.4)
    + R(x - w / 2, yTop, w, h, 1.5, col, { sw: 2.4 });
}

// --- the glyph library ----------------------------------------------------------
// Each glyph draws into a 100×100 box, centred near (50, 50) and kept inside
// roughly 14..86 so every frame can scale it down without clipping. `p` is the
// item's palette (see pal); fixed materials — gold, bone, paper — stay fixed.
const G = {};

G.candle = (p) =>
  FC(50, 25, 22, 'url(#mcFlame)')
  + E(50, 81, 25, 7, GOLD.base, { metal: true })
  + P('M37 45 Q37 40 42 40 H58 Q63 40 63 45 V81 H37 Z', p.base)
  + F('M44 40 V51 Q44 56 47.5 56 Q51 56 51 51 V40 Z', p.light)
  + L('M37 45 Q37 40 42 40 H58 Q63 40 63 45')
  + F('M40.5 48 H44.5 V77 H40.5 Z', '#fff', 0.28)
  + L('M50 40 V32', INK, 2.6)
  + P('M50 11 C58 20 61 27 57.5 33.5 C55 37 45 37 42.5 33.5 C39 27 42 19 50 11 Z', '#ffad3b', { sw: 2.6 })
  + F('M50 20 C54 26 55 30.5 52.5 33 C51 34.5 49 34.5 47.5 33 C45 30.5 46 25 50 20 Z', '#fff4c4');

G.coin = (p) =>
  FE(50, 84, 24, 5, '#000', 0.35)
  + C(50, 50, 31, GOLD.base, { metal: true })
  + `<circle cx="50" cy="50" r="24" fill="none" stroke="${GOLD.dark}" stroke-width="3"/>`
  + `<circle cx="50" cy="50" r="27.5" fill="none" stroke="${GOLD.light}" stroke-width="1.4" stroke-dasharray="2 3.2" opacity=".85"/>`
  + L('M50 33 V40 M50 60 V67', GOLD.deep, 3)
  + R(44, 40, 12, 20, 2, p.base, { sw: 2.6, stroke: GOLD.deep })
  + glint(38, 36, 7, 3.2);

G.coins = (p) => {
  let s = FE(50, 86, 27, 5, '#000', 0.35);
  for (let i = 0; i < 4; i++) {
    const y = 74 - i * 9;
    s += P(`M27 ${y} V${y + 7} A23 7 0 0 0 73 ${y + 7} V${y} Z`, GOLD.dark, { flat: true, sw: 2.6 })
      + E(50, y, 23, 7, GOLD.base, { metal: true, sw: 2.6 });
  }
  return s + C(66, 34, 15, GOLD.base, { metal: true, sw: 2.6 })
    + `<circle cx="66" cy="34" r="10.5" fill="none" stroke="${GOLD.dark}" stroke-width="2.4"/>`
    + R(62.5, 28, 7, 12, 1.5, p.base, { sw: 2, stroke: GOLD.deep })
    + glint(60, 28, 4, 2);
};

G.bull = (p) => {
  const horn = 'M33 38 C20 35 12 25 15 13 C21 24 29 28 38 30 Z';
  const ear = 'M31 43 C22 41 16 45 18 51 C25 52 30 50 35 47 Z';
  return P(horn, BONE) + P(mirror(horn), BONE)
    + P(ear, p.dark) + P(mirror(ear), p.dark)
    + P('M34 32 C40 26 60 26 66 32 C71 44 69 60 63 72 C59 80 41 80 37 72 C31 60 29 44 34 32 Z', p.base)
    + F('M41 31 C46 28 54 28 59 31 C56 38 44 38 41 31 Z', p.light, 0.8)
    + E(50, 69, 15, 11, p.light, { sw: 2.6 })
    + FE(44.5, 70, 2.6, 3.4, INK) + FE(55.5, 70, 2.6, 3.4, INK)
    + FC(42, 48, 4, INK) + FC(58, 48, 4, INK) + FC(43.2, 46.8, 1.3, '#fff') + FC(59.2, 46.8, 1.3, '#fff')
    + `<circle cx="50" cy="81" r="6" fill="none" stroke="${GOLD.base}" stroke-width="3.2"/>`
    + `<circle cx="50" cy="81" r="6" fill="none" stroke="${INK}" stroke-width="1" opacity=".6"/>`;
};

G.bear = (p) => {
  const ear = 'M30 26 C22 20 14 26 17 34 C19 39 25 40 30 37 Z';
  return P(ear, p.dark) + P(mirror(ear), p.dark)
    + F('M24 29 C22 27 20 30 21 33 C23 35 26 33 26 31 Z', p.light, 0.7)
    + F(mirror('M24 29 C22 27 20 30 21 33 C23 35 26 33 26 31 Z'), p.light, 0.7)
    + P('M50 22 C70 22 80 36 80 52 C80 70 66 82 50 82 C34 82 20 70 20 52 C20 36 30 22 50 22 Z', p.base)
    + E(50, 64, 16, 12, p.light, { sw: 2.6 })
    + P('M44 58 C44 54 56 54 56 58 C56 62 52 64 50 64 C48 64 44 62 44 58 Z', INK, { flat: true, sw: 1.5 })
    + L('M50 64 V68 M44 70 Q50 74 56 70', INK, 2.4)
    + FC(39, 46, 4, INK) + FC(61, 46, 4, INK) + FC(40.2, 44.8, 1.3, '#fff') + FC(62.2, 44.8, 1.3, '#fff')
    + glint(38, 33, 7, 3);
};

G.crown = (p) =>
  FE(50, 84, 28, 5, '#000', 0.35)
  + P('M18 36 L32 52 L50 24 L68 52 L82 36 L76 74 H24 Z', GOLD.base, { metal: true })
  + R(22, 70, 56, 12, 3, GOLD.dark, { metal: true })
  + C(50, 76, 4.5, p.base, { sw: 2.2 }) + C(34, 76, 3.5, RED, { sw: 2.2 }) + C(66, 76, 3.5, RED, { sw: 2.2 })
  + C(18, 34, 4.5, GOLD.light, { sw: 2.4 }) + C(82, 34, 4.5, GOLD.light, { sw: 2.4 }) + C(50, 21, 5, p.base, { sw: 2.4 })
  + P('M44 52 L50 42 L56 52 L50 62 Z', p.base, { sw: 2.2 })
  + glint(36, 50, 4, 9, 0.45, 20);

G.skull = (p) =>
  P('M50 16 C71 16 82 30 82 47 C82 58 76 64 70 67 V78 Q70 84 64 84 H36 Q30 84 30 78 V67 C24 64 18 58 18 47 C18 30 29 16 50 16 Z', BONE)
  + P('M27 46 C27 39 34 36 40 38 C45 40 46 47 43 52 C40 57 31 57 28 53 C27 51 27 48 27 46 Z', INK, { flat: true, sw: 1 })
  + P(mirror('M27 46 C27 39 34 36 40 38 C45 40 46 47 43 52 C40 57 31 57 28 53 C27 51 27 48 27 46 Z'), INK, { flat: true, sw: 1 })
  + FC(36, 46, 3.2, p.glow) + FC(64, 46, 3.2, p.glow)
  + P('M50 56 L45 65 H55 Z', INK, { flat: true, sw: 1 })
  + L('M38 72 V82 M44 73 V83 M50 73 V83 M56 73 V83 M62 72 V82', INK, 2.2)
  + glint(36, 27, 9, 4, 0.55);

G.flame = (p) =>
  FC(50, 58, 30, 'url(#mcFlame)')
  + P('M50 10 C62 24 76 34 74 56 C72 74 60 86 50 86 C40 86 28 74 26 56 C25 44 32 38 36 30 C38 40 42 44 46 44 C42 32 44 20 50 10 Z', '#ff7a2e')
  + P('M50 34 C58 44 66 52 64 64 C62 76 56 82 50 82 C44 82 38 76 36 66 C35 58 40 54 43 50 C44 56 47 58 50 58 C48 50 47 42 50 34 Z', '#ffc23d', { sw: 2.4 })
  + F('M50 56 C55 62 58 67 57 72 C56 77 53 79 50 79 C47 79 44 77 43 72 C42 67 45 62 50 56 Z', '#fff4c4');

G.moon = (p) =>
  P('M60 14 C40 16 26 32 26 52 C26 72 42 88 62 86 C48 80 40 66 40 50 C40 34 48 22 60 14 Z', SILVER.base)
  + FC(34, 48, 3, SILVER.dark, 0.7) + FC(38, 66, 4, SILVER.dark, 0.6) + FC(44, 30, 2.4, SILVER.dark, 0.6)
  + sparkle(70, 34, 7, p.light) + sparkle(76, 58, 4.5, p.light) + sparkle(62, 72, 3.2, '#fff');

G.quill = (p) =>
  P('M78 12 C60 18 44 34 36 56 L34 64 L42 60 C56 52 72 36 78 12 Z', '#f6f0e4')
  + L('M78 12 C64 30 50 46 36 62', '#b9ae97', 2.2)
  + F('M70 22 L60 26 M66 30 L56 34 M60 38 L50 42', p.base, 1)
  + L('M71 22 L61 27 M66 30 L55 35 M60 38 L49 44', p.dark, 2)
  + P('M36 60 L28 74 L32 76 L40 64 Z', GOLD.base, { metal: true, sw: 2.4 })
  + L('M28 74 L24 82', INK, 2.6)
  + P('M20 86 C20 80 26 80 26 86 C26 90 20 90 20 86 Z', p.dark, { sw: 2 });

G.eye = (p) =>
  P('M12 50 C26 28 74 28 88 50 C74 72 26 72 12 50 Z', BONE)
  + C(50, 50, 16, p.base)
  + `<circle cx="50" cy="50" r="11" fill="none" stroke="${p.dark}" stroke-width="2"/>`
  + FC(50, 50, 7, INK) + FC(45, 45, 3.4, '#fff') + FC(55, 55, 1.6, '#fff', 0.7)
  + L('M12 50 C26 28 74 28 88 50', INK, 3.6)
  + L('M30 32 L26 22 M42 28 L40 17 M58 28 L60 17 M70 32 L74 22', INK, 2.6);

G.dice = (p) =>
  FE(52, 86, 30, 5, '#000', 0.35)
  + P('M18 46 L44 36 L66 46 L40 58 Z', '#fff') + P('M18 46 L40 58 V84 L18 72 Z', '#d8dfec') + P('M40 58 L66 46 V72 L40 84 Z', '#b9c3d6')
  + FE(42, 47, 3, 2, p.dark) + FE(29, 60, 2.4, 3, p.dark) + FE(33, 70, 2.4, 3, p.dark)
  + FE(53, 62, 2.4, 3, p.dark) + FE(59, 70, 2.4, 3, p.dark) + FE(47, 74, 2.4, 3, p.dark)
  + P('M52 22 L72 14 L88 22 L68 31 Z', p.light) + P('M52 22 L68 31 V50 L52 42 Z', p.base) + P('M68 31 L88 22 V41 L68 50 Z', p.dark)
  + FE(70, 22, 2.6, 1.6, INK) + FE(60, 36, 2, 2.4, INK) + FE(78, 36, 2, 2.4, INK);

G.gem = (p) =>
  FE(50, 86, 26, 4, '#000', 0.35)
  + P('M26 36 L38 20 H62 L74 36 L50 82 Z', p.base, { metal: true })
  + F('M26 36 H74 L62 20 H38 Z', p.light, 0.75)
  + L('M26 36 H74 M38 20 L44 36 L50 82 L56 36 L62 20 M44 36 L50 20 L56 36', INK, 2)
  + F('M44 36 L50 82 L32 40 Z', '#fff', 0.22)
  + sparkle(66, 26, 6) + sparkle(33, 56, 3.5, '#fff', 0.7);

G.bell = (p) =>
  FE(50, 86, 26, 4, '#000', 0.35)
  + P('M50 16 C66 16 70 30 70 46 C70 60 76 68 82 72 V76 H18 V72 C24 68 30 60 30 46 C30 30 34 16 50 16 Z', GOLD.base, { metal: true })
  + R(16, 74, 68, 7, 3, GOLD.dark, { metal: true, sw: 2.6 })
  + C(50, 84, 6, p.base, { sw: 2.6 })
  + C(50, 13, 4.5, GOLD.dark, { sw: 2.4 })
  + glint(39, 36, 4, 12, 0.5, 8)
  + L('M74 26 Q80 30 80 38 M80 18 Q90 26 89 40', p.light, 2.6, 0.9);

// --- frames -------------------------------------------------------------------
/** A glyph placed inside a frame: scaled about its centre and nudged. */
const place = (glyph, s, cx = 50, cy = 50) =>
  `<g transform="translate(${cx} ${cy}) scale(${s}) translate(-50 -50)">${glyph}</g>`;

/** Rim metals, one per rarity. */
const RIM = {
  common:    { light: '#dbeaff', base: '#7ea6d8', dark: '#344f78' },
  uncommon:  { light: '#cbf9df', base: '#45c688', dark: '#196a44' },
  rare:      { light: '#ffd6fb', base: '#de5fd6', dark: '#6b1c67' },
  legendary: GOLD,
};

/** Points on a circle — studs, rays, spikes. */
const around = (n, r, cx = 50, cy = 50, phase = -90) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((phase + (360 / n) * i) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, a];
  });
const f1 = (n) => Math.round(n * 10) / 10;

/** A star or sunburst outline from alternating radii. */
function starPath(points, rOut, rIn, cx = 50, cy = 50, phase = -90) {
  const out = around(points, rOut, cx, cy, phase);
  const inn = around(points, rIn, cx, cy, phase + 180 / points);
  return 'M' + out.map(([x, y], i) => `${f1(x)} ${f1(y)} L${f1(inn[i][0])} ${f1(inn[i][1])}`).join(' L') + ' Z';
}

const PIP = {
  mult:      { fill: '#ff4f6d', sym: '×', size: 17 },
  leverage:  { fill: '#ff6b4f', sym: '+', size: 17 },
  volume:    { fill: '#2fb4ff', sym: '+', size: 17 },
  money:     { fill: '#ffc93c', sym: '$', size: 14, ink: '#3b2604' },
  retrigger: { fill: '#a27bff', sym: '↻', size: 15 },
  rule:      { fill: '#8a9ab4', sym: '⚙', size: 13 },
};
function pip(kind) {
  const k = PIP[kind];
  if (!k) return '';
  return C(81, 81, 11, k.fill, { sw: 2.4 })
    + `<text x="81" y="81" dy=".36em" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif"
        font-weight="900" font-size="${k.size * 0.88}" fill="${k.ink || '#fff'}" stroke="${k.ink ? 'none' : INK}" stroke-width=".8"
        paint-order="stroke">${k.sym}</text>`;
}

/** Broker: a struck medallion, rimmed in its rarity's metal. */
function medallion(glyph, p, rarity, effect) {
  const rim = RIM[rarity] || RIM.common;
  let s = FE(50, 95, 30, 3.6, '#000', 0.45);
  if (rarity === 'legendary') {
    // a sunburst that clears the rim, so the gold reads as more than a colour
    s += P(starPath(16, 54, 43), GOLD.light, { metal: true, sw: 2.2 })
      + P(starPath(16, 49, 43, 50, 50, -90 + 180 / 16), GOLD.dark, { metal: true, sw: 1.8 });
  }
  s += C(50, 50, 45, rim.base, { metal: true });
  s += `<circle cx="50" cy="50" r="41.2" fill="none" stroke="${rim.light}" stroke-width="1.6" opacity=".75"/>`;
  if (rarity === 'uncommon') {
    for (const [x, y] of around(8, 41.8, 50, 50, -67.5)) s += C(f1(x), f1(y), 2.6, rim.light, { sw: 1.6 });
  } else if (rarity === 'rare') {
    for (const [x, y, a] of around(12, 42, 50, 50, -75)) {
      const tx = f1(x + Math.cos(a) * 2.8), ty = f1(y + Math.sin(a) * 2.8);
      s += `<path d="M${f1(x - Math.sin(a) * 2.6)} ${f1(y + Math.cos(a) * 2.6)} L${tx} ${ty} L${f1(x + Math.sin(a) * 2.6)} ${f1(y - Math.cos(a) * 2.6)} Z" fill="${rim.light}" stroke="${INK}" stroke-width="1.4"/>`;
    }
  } else if (rarity === 'legendary') {
    for (const [x, y] of around(4, 42.4, 50, 50, -45)) s += C(f1(x), f1(y), 4, RED, { sw: 2 }) + FC(f1(x - 1.2), f1(y - 1.2), 1.3, '#fff', 0.8);
  } else {
    for (const [x, y] of around(4, 42, 50, 50, -45)) s += C(f1(x), f1(y), 2.2, rim.light, { sw: 1.4 });
  }
  s += C(50, 50, 37, p.deep, { flat: true, sw: 2.6 })
    + `<circle cx="50" cy="50" r="37" fill="url(#${rarity === 'common' ? 'mcDots' : 'mcHatch'})"/>`
    + `<circle cx="50" cy="50" r="37" fill="url(#mcDisc)"/>`
    + `<circle cx="50" cy="50" r="30" fill="${p.glow}" opacity=".16"/>`;
  s += place(glyph, 0.8, 50, 51);
  s += L('M18 34 A37 37 0 0 1 40 14', '#fff', 2.4, 0.35);
  return s + pip(effect);
}

/** Chart: a tarot card with a chart-grid ground. */
function tarot(glyph, p) {
  return FE(50, 96, 30, 3, '#000', 0.45)
    + R(14, 5, 72, 89, 9, '#2a8fb8', { metal: true })
    + R(19.5, 10.5, 61, 78, 5.5, p.deep, { flat: true, sw: 2.2 })
    + `<rect x="19.5" y="10.5" width="61" height="78" rx="5.5" fill="url(#mcGrid)"/>`
    + `<rect x="19.5" y="10.5" width="61" height="78" rx="5.5" fill="url(#mcDisc)"/>`
    + L('M22 72 L32 64 L40 68 L52 54 L60 58 L78 40', CYAN, 2, 0.25)
    + sparkle(25, 16, 3.6, '#bff3ff') + sparkle(75, 16, 3.6, '#bff3ff')
    + sparkle(25, 83, 3.6, '#bff3ff') + sparkle(75, 83, 3.6, '#bff3ff')
    + place(glyph, 0.62, 50, 48);
}

/** Contract: a sealed parchment carrying the formation it levels. */
function scroll(inner, p) {
  return FE(50, 95, 30, 3, '#000', 0.45)
    + R(20, 14, 60, 72, 2, PAPER)
    + `<rect x="20" y="14" width="60" height="72" fill="url(#mcHatch)" opacity=".5"/>`
    + R(14, 8, 72, 10, 5, '#c9b07a', { metal: true, sw: 2.6 })
    + R(14, 82, 72, 10, 5, '#c9b07a', { metal: true, sw: 2.6 })
    + L('M30 25 H70', '#9c8a62', 2, 0.8)
    + inner
    + F('M74 88 L71 98 L76 94 L79 99 L81 89 Z', '#c8283e')
    + C(77, 84, 9, '#c8283e', { sw: 2.4 })
    + P(starPath(5, 5.6, 2.4, 77, 84), '#ff8a9a', { flat: true, sw: 1.2 });
}

/** Rumor: a speech bubble trailing smoke. */
function bubble(glyph, p) {
  return FE(50, 96, 30, 3, '#000', 0.45)
    + L('M12 30 Q6 22 12 14 M88 40 Q96 32 90 24', '#d87cff', 2.4, 0.5)
    + P('M50 8 C74 8 90 22 90 44 C90 66 74 78 52 78 C46 78 42 78 38 77 L22 92 L26 74 C16 68 10 58 10 44 C10 22 26 8 50 8 Z', '#7a2b8f', { metal: true })
    + P('M50 15 C70 15 83 27 83 44 C83 62 70 71 52 71 C40 71 32 70 26 66 C19 61 17 54 17 44 C17 27 30 15 50 15 Z', p.deep, { flat: true, sw: 2 })
    + `<path d="M50 15 C70 15 83 27 83 44 C83 62 70 71 52 71 C40 71 32 70 26 66 C19 61 17 54 17 44 C17 27 30 15 50 15 Z" fill="url(#mcDisc)"/>`
    + place(glyph, 0.6, 50, 43);
}

/** Licence: a heater shield with its tier in studs. */
function shield(glyph, p, tier = 1) {
  const d = 'M16 12 H84 V46 C84 70 68 84 50 93 C32 84 16 70 16 46 Z';
  const di = 'M23 19 H77 V46 C77 65 64 77 50 85 C36 77 23 65 23 46 Z';
  let s = FE(50, 97, 28, 3, '#000', 0.4) + P(d, GOLD.base, { metal: true })
    + P(di, p.deep, { flat: true, sw: 2 })
    + `<path d="${di}" fill="url(#mcHatch)"/><path d="${di}" fill="url(#mcDisc)"/>`
    + place(glyph, 0.58, 50, 50);
  for (let i = 0; i < tier; i++) s += C(44 + i * 12 - (tier - 1) * 0, 12, 4.2, GOLD.light, { sw: 2 });
  return s;
}

/** Boss: a spiked crest, bled red. */
function crest(glyph, p) {
  return FE(50, 96, 30, 3, '#000', 0.5)
    + P(starPath(14, 49, 39), '#8f1426', { metal: true })
    + C(50, 50, 38, '#2a0710', { flat: true, sw: 2.6 })
    + `<circle cx="50" cy="50" r="38" fill="url(#mcHatch)"/><circle cx="50" cy="50" r="38" fill="url(#mcDisc)"/>`
    + `<circle cx="50" cy="50" r="31" fill="${RED}" opacity=".16"/>`
    + place(glyph, 0.7, 50, 51);
}

/** Pack: a crimped foil wrapper with a window. */
function foilPack(glyph, p, size = 1) {
  let s = FE(50, 97, 30, 3, '#000', 0.45)
    + P(`M20 10 H80 V90 H20 Z`, p.dark, { metal: true })
    + `<path d="M20 10 H80 V90 H20 Z" fill="url(#mcFoil)" opacity=".28"/>`
    + L('M20 30 L46 10 M20 52 L64 10 M20 74 L80 22 M34 90 L80 50 M58 90 L80 72', '#fff', 3, 0.14)
    + R(16, 6, 68, 9, 2, p.base, { metal: true, sw: 2.4 })
    + R(16, 85, 68, 9, 2, p.base, { metal: true, sw: 2.4 })
    + L('M18 6 V15 M24 6 V15 M30 6 V15 M36 6 V15 M42 6 V15 M48 6 V15 M54 6 V15 M60 6 V15 M66 6 V15 M72 6 V15 M78 6 V15', INK, 1.2, 0.35)
    + L('M18 85 V94 M24 85 V94 M30 85 V94 M36 85 V94 M42 85 V94 M48 85 V94 M54 85 V94 M60 85 V94 M66 85 V94 M72 85 V94 M78 85 V94', INK, 1.2, 0.35)
    + C(50, 47, 28, p.deep, { flat: true, sw: 2.6 })
    + `<circle cx="50" cy="47" r="28" fill="url(#mcDisc)"/>`
    + place(glyph, 0.54, 50, 47);
  for (let i = 0; i < size; i++) s += sparkle(50 + (i - (size - 1) / 2) * 11, 80, 4.6, GOLD.light, 1);
  return s;
}

/** Bonus: a prize rosette. */
function rosette(glyph, p) {
  let s = FE(50, 97, 26, 3, '#000', 0.4)
    + P('M36 66 L26 96 L36 90 L42 98 L50 70 Z', p.dark, { sw: 2.4 })
    + P(mirror('M36 66 L26 96 L36 90 L42 98 L50 70 Z'), p.dark, { sw: 2.4 });
  s += P(starPath(18, 44, 36, 50, 44), p.base, { metal: true });
  return s + C(50, 44, 31, GOLD.base, { metal: true })
    + C(50, 44, 25, p.deep, { flat: true, sw: 2.4 }) + `<circle cx="50" cy="44" r="25" fill="url(#mcDisc)"/>`
    + place(glyph, 0.5, 50, 44);
}


// --- what each broker does, read off its own definition ----------------------
const HOOKS = ['candleScored', 'candleHeld', 'independent', 'direction', 'tradeEnd', 'discarded',
  'deadlineStart', 'deadlineEnd', 'payout', 'shop'];

/**
 * The pip a broker wears: what kind of thing it adds to a trade.
 *
 * Read from the hooks themselves rather than written down per broker, so the
 * pip cannot disagree with what the broker actually does. A broker that does
 * several things wears its strongest: an extra print beats a multiplier beats
 * cash beats flat Leverage beats flat Volume, and a broker with no scoring hook
 * at all changes a rule.
 */
export function brokerEffect(key) {
  const d = BROKERS[key];
  if (!d) return null;
  if (d.retriggerScored || d.retriggerHeld) return 'retrigger';
  const src = HOOKS.map((h) => (typeof d[h] === 'function' ? String(d[h]) : '')).join(' ');
  if (/\bx(Leverage|Volume)\(/.test(src) || d.redMult) return 'mult';
  if (/\bearn\(|\.cash\b/.test(src) || typeof d.payout === 'function') return 'money';
  if (/\baddLeverage\(/.test(src)) return 'leverage';
  if (/\baddVolume\(/.test(src)) return 'volume';
  return 'rule';
}

// --- the picture ---------------------------------------------------------------
const cache = new Map();

/**
 * The full SVG for one item. `kind` is broker | chart | contract | rumor |
 * license | boss | pack | bonus | slot, and `key` the item's key. Strings are
 * cached: the same broker drawn on the desk, in the shop and in the
 * compendium is built once.
 */
export function artSvg(kind, key) {
  const id = `${kind}:${key}`;
  if (cache.has(id)) return cache.get(id);
  ensureArtDefs();
  const spec = ART[kind]?.[key] || [kind === 'boss' ? 'skull' : 'coin', 210];
  const [glyphName, hue, sat] = spec;
  const p = pal(hue, sat);
  const glyph = (G[glyphName] || G.coin)(p);
  let body;
  switch (kind) {
    case 'broker':   body = medallion(glyph, p, BROKERS[key]?.rarity || 'common', brokerEffect(key)); break;
    case 'chart':    body = tarot(glyph, p); break;
    case 'contract': body = scroll(formationDiagram(CONTRACTS[key]?.formation), p); break;
    case 'rumor':    body = bubble(glyph, p); break;
    case 'license':  body = shield(glyph, p, LICENSES[key]?.tier || 1); break;
    case 'boss':     body = crest(glyph, p); break;
    case 'pack':     body = foilPack(glyph, p, spec[3] || 1); break;
    case 'bonus':    body = rosette(glyph, p); break;
    default:         body = medallion(glyph, p, spec[3] || 'common', null);
  }
  const svg = `<svg class="art art-${kind}" viewBox="0 0 100 100" overflow="visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g filter="url(#mcInk)">${body}</g></svg>`;
  cache.set(id, svg);
  return svg;
}

/** The picture for whatever kind of consumable a key belongs to. */
export function consumableArt(key) {
  if (CHARTS[key]) return artSvg('chart', key);
  if (CONTRACTS[key]) return artSvg('contract', key);
  if (RUMORS[key]) return artSvg('rumor', key);
  return artSvg('chart', key);
}

/** Every key that has art, by kind — what the test suite checks coverage against. */
export function artKeys(kind) { return kind === 'contract' ? Object.keys(CONTRACTS) : Object.keys(ART[kind] || {}); }
export function hasGlyph(name) { return typeof G[name] === 'function'; }

// --- contracts draw the formation they level ------------------------------------
// [body, bull] per candle; `one` marks the formations that need a single sector
// and `gold` the Golden Staircase, both shown as a band under the candles.
const DIAGRAMS = {
  tick:          { c: [[9, true]] },
  tweezer:       { c: [[7, true], [7, false]] },
  doubleTweezer: { c: [[4, true], [4, false], [9, true], [9, false]] },
  triple:        { c: [[7, true], [7, false], [7, true]] },
  soldiers:      { c: [[3, true], [6, true], [9, true]] },
  crows:         { c: [[9, false], [6, false], [3, false]] },
  staircase:     { c: [[3, true], [4, false], [5, true], [6, false], [7, true]] },
  cluster:       { c: [[2, true], [9, false], [5, true], [12, false], [7, true]], one: true },
  pillars:       { c: [[8, true], [8, false], [8, true], [3, false], [3, true]] },
  fourWinds:     { c: [[6, true], [6, false], [6, true], [6, false]] },
  goldenStair:   { c: [[3, true], [4, true], [5, true], [6, true], [7, true]], one: true, gold: true },
  fiveAlarm:     { c: [[8, true], [8, false], [8, true], [8, false], [8, true]] },
  megaCluster:   { c: [[8, true], [8, false], [8, true], [3, false], [3, true]], one: true },
  perfectStorm:  { c: [[8, true], [8, true], [8, true], [8, true], [8, true]], one: true, gold: true },
};

function formationDiagram(key) {
  const d = DIAGRAMS[key] || DIAGRAMS.tick;
  const n = d.c.length;
  const gap = n > 3 ? 10 : 13;
  const x0 = 48 - ((n - 1) * gap) / 2;
  let s = '';
  if (d.one) s += R(x0 - 7, 71, (n - 1) * gap + 14, 4.5, 2, d.gold ? GOLD.base : CYAN, { sw: 2, metal: d.gold });
  d.c.forEach(([body, bull], i) => {
    const h = 4 + body * 1.85;
    s += stick(f1(x0 + i * gap), f1(67 - h), f1(h), bull, n > 3 ? 7 : 9);
  });
  return s;
}

// --- who wears what ------------------------------------------------------------
// [glyph, hue, saturation?, extra]. Hue sets the item's own colour; for brokers
// the frame's metal comes from rarity, so two brokers can share a glyph and
// still read as different cards.
const ART = {
  broker: {
    sticky: ['quill', 210], tickertape: ['pennant', 195], deskFan: ['clover', 130], hoodie: ['mask', 300],
    energyDrink: ['bolt', 55], charting101: ['spiral', 275], sectorMap: ['card', 340], fullPort: ['fox', 25],
    roundLot: ['fullmoon', 220], scalper: ['lantern', 45], pairsTrade: ['hearts', 345], openOutcry: ['megaphone', 15],
    techBro: ['chip', 192], oilBaron: ['flame', 25], bankTeller: ['coin', 140], degenTrader: ['imp', 295],
    bullPen: ['bull', 140], bearCave: ['bear', 355], evenSplit: ['twins', 200], oddLot: ['dice', 265],
    wideLoad: ['elephant', 210], wideSeeker: ['crown', 280], dojiMonk: ['candle', 260], pennyJar: ['purse', 30],
    growthFund: ['sprout', 125], valueFund: ['anvil', 210], convictionDesk: ['medal', 0], trueBeliever: ['halo', 50],
    hedgeBook: ['janus', 40], reversalDesk: ['mirror', 190], drillSergeant: ['trumpet', 45], crowKeeper: ['crow', 260],
    cadence: ['drum', 0], momentumRider: ['boot', 30], stepLadder: ['ladder', 35], momentum: ['flame', 350],
    contrarian: ['jester', 300], diamondHands: ['gem', 195], hedgeFund: ['web', 270], bullhorn: ['megaphone', 140],
    burnerPhone: ['phone', 175], bloomberg: ['book', 215], stopLoss: ['hamsa', 195], pyramid: ['pyramid', 45],
    volSurface: ['bandage', 20], blackSwan: ['swan', 250], theTape: ['blood', 355], firstMover: ['knight', 215],
    deadlineDread: ['coffin', 280], quantumDesk: ['flask', 165], blueSuit: ['bowtie', 220], caffeinated: ['clapper', 0],
    hftRack: ['bee', 48], stampCollector: ['seal', 345], frontRunner: ['speaker', 190], flashBoy: ['juggle', 300],
    laminator: ['brush', 45], algoDesk: ['lizard', 270], volDesk: ['bomb', 20], swingDesk: ['swap', 30],
    emberDesk: ['urn', 20], beaconDesk: ['lantern', 185], cursedDesk: ['skull', 280], wishDesk: ['well', 200],
    stampPress: ['seal', 5], colophon: ['book', 25], stillPoint: ['yinyang', 210], longShadow: ['ruler', 45],
    ladder: ['chest', 35], bagholder: ['moneybag', 40], divTrap: ['note', 140], synthetic: ['helix', 290],
    theWhale: ['whale', 205], darkPool: ['moon', 240], rotationDesk: ['violin', 25], monoDesk: ['moai', 215],
    muddyWaters: ['vulture', 20], perma: ['sun', 45], theOracle: ['orb', 275], arbBot: ['nazar', 210],
    hallOfMirrors: ['tent', 345], quantIntern: ['gradcap', 230], chartist: ['compass', 35], siliconValley: ['blossom', 320],
    oilFutures: ['barrel', 25], stampede: ['bull', 22], permafrost: ['snowflake', 195], newsWire: ['newspaper', 210],
    patternRecog: ['brain', 330], shredder: ['bin', 210], compounder: ['abacus', 35],
    rogueTrader: ['devil', 0], singularity: ['galaxy', 270], theWolf: ['wolf', 220], thePonzi: ['ouroboros', 140],
    closingBell: ['bell', 45], unlimitedMargin: ['pact', 0],
    riskDesk: ['lifering', 5], bigBoard: ['frame', 35], overtime: ['moon', 230], boardSeat: ['chair', 30],
    savingsBond: ['piggy', 340], ramenBudget: ['bowl', 30], creditLine: ['creditcard', 215], hoarder: ['acorn', 30],
    taxLoss: ['receipt', 140], marketMaker: ['servicebell', 45], angelInvestor: ['ring', 45], theMole: ['spy', 215],
    wireTap: ['radio', 25], shellCorp: ['shell', 20], brokerFriend: ['handshake', 35], archivist: ['cabinet', 30],
    paperShuffler: ['paper', 45], insiderMemo: ['envelope', 355], contractLawyer: ['quill', 260], tapeReader: ['eye', 275],
    fourFingers: ['hand', 30], shortcut: ['stone', 205], splitter: ['wave', 200], luckyStreak: ['horseshoe', 140],
    goldRush: ['pickaxe', 45], burnout: ['stub', 15], sunkCost: ['anchor', 210], indexFund: ['crowd', 220],
    auditRisk: ['book', 355], perpetualMotion: ['gears', 195], darkAlpha: ['void', 270], finePrint: ['magnifier', 195],
    pressRun: ['press', 30], hairline: ['quill', 195], lastWord: ['speech', 35], kerning: ['type', 30],
    misprint: ['prism', 290], runOff: ['press', 195], inkPress: ['inkpot', 250], printShop: ['factory', 25],
    overprint: ['layers', 300], splitRun: ['scissors', 210], serialNumber: ['numbers', 35],
  },
  chart: {
    analyst: ['temple', 45], quant: ['dagger', 200], gambler: ['slots', 330], landlord: ['house', 30],
    custodian: ['shield', 210], wildcard: ['card', 300], lottery: ['well', 200], vault: ['tomb', 230],
    forge: ['anvil', 20], lighthouse: ['lighthouse', 200], hex: ['skull', 280], pivot: ['door', 30],
    techWave: ['bolt', 192], oilShock: ['flame', 25], bankRun: ['bank', 140], altSeason: ['moonrise', 240],
    pump: ['waxing', 230], dump: ['waning', 250], theFlip: ['swap', 195], greenDay: ['upcandle', 140],
    redDay: ['downcandle', 355], buyback: ['pyre', 20], split: ['flask', 300], merger: ['stitch', 195],
    filing: ['seal', 275], insiderLeak: ['speech', 200], bonusRound: ['gift', 345], fireSale: ['coins', 30],
    roadshow: ['sparkles', 45], ipo: ['sunrise', 30], ladderPrint: ['mountain', 140], crowPrint: ['crow', 355],
  },
  rumor: {
    nakedShort: ['dagger', 355], blockTrade: ['anchor', 210], kickback: ['moneybag', 140], paperTrail: ['rune', 275],
    gilding: ['sparkles', 205], nakedCall: ['prism', 300], quantModel: ['rune', 220], offBookDeal: ['devil', 280],
    goldenChute: ['parachute', 45], hostileTakeover: ['swords', 0], restructure: ['crack', 30], squeezePlay: ['dove', 195],
    capitulation: ['blood', 355], insiderWhisper: ['brain', 300], shellGame: ['shell', 30], blackout: ['eclipse', 250],
    dilution: ['droplet', 195], chapter11: ['altar', 0], frontOffice: ['tower', 215], totalRecall: ['swap', 275],
    theSqueeze: ['halo', 45],
  },
  license: {
    discountTerminal: ['tag', 330], liquidation: ['tag', 0], extraBandwidth: ['antenna', 195], darkFiber: ['satellite', 250],
    prepaidReroll: ['swap', 140], houseAccount: ['house', 30], overdraft: ['creditcard', 210], overdraftII: ['creditcard', 45],
    extraShift: ['clock', 195], doubleShift: ['clock', 275], ergoDesk: ['chair', 30], tradingPit: ['arena', 20],
    researchBudget: ['book', 215], researchWing: ['school', 230], dataFeed: ['signal', 195], directFeed: ['plug', 55],
    retirement: ['pie', 35], trustFund: ['tophat', 280], vaultKeys: ['key', 45], clearingHouse: ['bank', 210],
    primeBroker: ['medal', 45], complianceWaiver: ['clipboard', 140], regCapture: ['mask', 280], seedRound: ['acorn', 30],
    seriesA: ['rocket', 0], floorConviction: ['compass', 195], convictionGuru: ['candle', 45], darkTerminal: ['monitor', 210],
    blackTerminal: ['joystick', 280],
  },
  boss: {
    auditor: ['magnifier', 0], regulator: ['scales', 0], embargo: ['barrier', 30], rugPull: ['trap', 20],
    greenScreen: ['bull', 140], redScreen: ['bear', 355], noConviction: ['fog', 220], shuffleDesk: ['dice', 0],
    flashCrash: ['bomb', 20], marginCall: ['phone', 0], circuitBreaker: ['cage', 210], shortLadder: ['ladder', 0],
    bullTrap: ['boomerang', 30], washSale: ['swap', 0], repeatBan: ['nosign', 0], darkPoolBan: ['waning', 250],
    quietPeriod: ['hush', 0], fatFinger: ['hand', 0], whaleWall: ['whale', 205], insiderProbe: ['siren', 0],
    taxSeason: ['receipt', 0], slippage: ['droplet', 45], delisting: ['bin', 0], clawback: ['hook', 210],
    volatilityHalt: ['pause', 0], theCeiling: ['bricks', 15], wideControl: ['blindfold', 0], hardClose: ['alarm', 0],
    theSpread: ['spread', 0],
  },
  pack: {
    chartS: ['barchart', 195, 72, 1], chartJ: ['barchart', 195, 72, 2], chartM: ['barchart', 195, 72, 3],
    ctS: ['scrollicon', 210, 60, 1], ctJ: ['scrollicon', 210, 60, 2], ctM: ['scrollicon', 210, 60, 3],
    rumorS: ['speech', 295, 70, 1], rumorJ: ['speech', 295, 70, 2], rumorM: ['speech', 295, 70, 3],
    candleS: ['candle', 25, 75, 1], candleJ: ['candle', 25, 75, 2], candleM: ['candle', 25, 75, 3],
    brokerS: ['briefcase', 140, 60, 1], brokerJ: ['briefcase', 140, 60, 2], brokerM: ['briefcase', 140, 60, 3],
  },
  bonus: {
    freeBroker: ['briefcase', 140], uncommonBroker: ['target', 140], rareBroker: ['star', 300], charts: ['book', 195],
    contract: ['scrollicon', 210], rumor: ['speech', 295], cash: ['moneybag', 45], coupon: ['ticket', 330],
    rerolls: ['swap', 195], investment: ['upcandle', 140], candles: ['candle', 25], edition: ['sparkles', 45],
  },
  slot: {
    0: ['bell', 45, 72, 'uncommon'], 1: ['clock', 195, 72, 'common'], 2: ['skull', 0, 72, 'rare'],
    between: ['tower', 215, 60, 'common'],
  },
};

// --- more primitives ----------------------------------------------------------
/** A thick outlined stroke — necks, tails, rings, ropes. */
const tube = (d, color, w = 8) => L(d, INK, w + 5) + L(d, color, w);
const ring = (cx, cy, r, color, w = 7) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="${w + 5}"/>`
  + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
const SKIN = '#f1c7a0';
/** A dark tone that still carries the item's hue — crows, ravens, swans. */
const shadowHue = (p, l = 22) => `hsl(${p.h},30%,${l + 8}%)`;

// --- batch: creatures and figures -------------------------------------------------
G.fox = (p) => {
  const ear = 'M25 16 L41 36 L21 43 Z';
  return P(ear, p.base) + P(mirror(ear), p.base)
    + F('M27 23 L36 35 L25 39 Z', p.deep, 0.7) + F(mirror('M27 23 L36 35 L25 39 Z'), p.deep, 0.7)
    + P('M20 40 C30 30 70 30 80 40 C77 57 63 74 50 83 C37 74 23 57 20 40 Z', p.base)
    + P('M27 52 C36 55 45 62 50 80 C55 62 64 55 73 52 C68 67 59 77 50 83 C41 77 32 67 27 52 Z', '#fff7ea', { sw: 2.2 })
    + F('M32 45 Q39 40 45 47 Q38 50 32 45 Z', INK) + F(mirror('M32 45 Q39 40 45 47 Q38 50 32 45 Z'), INK)
    + FC(40, 45, 1.2, '#fff') + FC(61, 45, 1.2, '#fff')
    + E(50, 79, 4.5, 3.4, INK, { flat: true, sw: 1 })
    + glint(36, 35, 6, 2.4, 0.5);
};

G.imp = (p) => {
  const ear = 'M30 46 L9 30 L22 54 Z';
  const horn = 'M38 27 L33 11 L45 23 Z';
  return P(ear, p.dark) + P(mirror(ear), p.dark) + P(horn, BONE, { sw: 2.4 }) + P(mirror(horn), BONE, { sw: 2.4 })
    + P('M50 22 C68 22 76 36 76 52 C76 70 64 82 50 82 C36 82 24 70 24 52 C24 36 32 22 50 22 Z', p.base)
    + E(40, 48, 6.5, 5, '#ffe066', { sw: 2.2 }) + E(60, 48, 6.5, 5, '#ffe066', { sw: 2.2 })
    + L('M40 44.5 V51.5 M60 44.5 V51.5', INK, 2.6)
    + L('M33 39 L45 43 M67 39 L55 43', INK, 2.8)
    + F('M33 61 Q50 77 67 61 Q50 70 33 61 Z', INK)
    + F('M39 63.5 L41.5 68.5 L44 65 Z M56 65 L58.5 68.5 L61 63.5 Z', '#fff')
    + glint(38, 32, 7, 2.6, 0.45);
};

G.elephant = (p) => {
  const ear = 'M31 30 C12 24 6 46 12 60 C17 69 29 66 35 58 Z';
  const tusk = 'M39 61 C37 69 32 74 27 74 C31 67 33 62 35 58 Z';
  return P(ear, p.dark) + P(mirror(ear), p.dark)
    + F('M29 35 C17 33 13 47 17 57 C21 61 27 59 31 55 Z', p.light, 0.45) + F(mirror('M29 35 C17 33 13 47 17 57 C21 61 27 59 31 55 Z'), p.light, 0.45)
    + P('M50 20 C65 20 73 31 73 44 C73 55 66 61 60 63 H40 C34 61 27 55 27 44 C27 31 35 20 50 20 Z', p.base)
    + P(tusk, BONE, { sw: 2.4 }) + P(mirror(tusk), BONE, { sw: 2.4 })
    + P('M42 56 C42 70 45 81 53 85 C59 87 63 82 59 79 C53 77 53 68 57 56 Z', p.base)
    + L('M45 66 H52 M46 72 H53 M48 78 H55', p.dark, 1.8)
    + FC(40, 42, 3.3, INK) + FC(60, 42, 3.3, INK) + FC(41, 41, 1.1, '#fff') + FC(61, 41, 1.1, '#fff')
    + glint(42, 28, 8, 3, 0.45);
};

G.crow = (p) => {
  const dk = shadowHue(p, 20), mid = shadowHue(p, 32);
  return FC(52, 54, 34, p.glow, 0.22) + L('M43 77 L40 88 M55 77 L56 88', GOLD.dark, 3)
    + P('M20 62 C20 45 35 34 50 34 C62 34 70 42 72 52 L87 51 L74 59 C72 67 63 75 50 77 L30 81 L16 88 L21 75 Z', dk)
    + P('M28 55 C38 45 55 47 62 57 C54 66 40 68 28 63 Z', mid, { sw: 2.4 })
    + L('M34 58 L44 56 M38 62 L50 60 M44 65 L56 62', dk, 2)
    + C(64, 37, 12.5, dk)
    + P('M74 34 L91 38 L74 43 Z', '#c8b57d', { sw: 2.4 })
    + FC(66, 34, 3.4, p.glow) + FC(66.9, 33.2, 1.1, '#fff')
    + glint(58, 30, 5, 2, 0.35);
};

G.swan = (p) => {
  const dk = shadowHue(p, 18), mid = shadowHue(p, 30);
  return FC(50, 54, 34, p.glow, 0.22) + L('M12 86 Q20 82 28 86 T44 86 T60 86 T76 86 T90 86', p.light, 2.4, 0.8)
    + P('M18 66 C18 56 32 52 46 55 C56 57 64 62 82 56 C84 70 72 80 54 80 H32 C24 80 18 74 18 66 Z', dk)
    + P('M30 62 C40 54 54 56 64 64 C56 72 40 72 30 66 Z', mid, { sw: 2.2 })
    + tube('M60 60 C50 46 56 30 66 24 C71 21 75 25 72 30', dk, 7)
    + C(70, 25, 6.5, dk, { sw: 2.6 })
    + P('M75 23 L88 28 L75 31 Z', RED, { sw: 2.2 })
    + FC(70, 23.5, 1.7, '#fff');
};

G.bee = () =>
  solid('ellipse', 'cx="38" cy="31" rx="14" ry="8" transform="rotate(-32 38 31)"', '#e9f7ff', { op: 0.92, sw: 2.4 })
  + solid('ellipse', 'cx="62" cy="31" rx="14" ry="8" transform="rotate(32 62 31)"', '#e9f7ff', { op: 0.92, sw: 2.4 })
  + P('M46 80 L50 91 L54 80 Z', INK, { flat: true, sw: 1 })
  + E(50, 59, 20, 24, '#ffcf3d')
  + F('M31.5 52 Q50 45 68.5 52 L69.8 59 Q50 52 30.2 59 Z', INK)
  + F('M32 66 Q50 59 68 66 L65 73 Q50 67 35 73 Z', INK)
  + `<ellipse cx="50" cy="59" rx="20" ry="24" fill="none" stroke="${INK}" stroke-width="3"/>`
  + C(50, 33, 10.5, '#2c2a33')
  + L('M46 25 Q42 15 35 14 M54 25 Q58 15 65 14', INK, 2.4) + FC(35, 14, 2.8, INK) + FC(65, 14, 2.8, INK)
  + FC(46, 32, 2.4, '#fff') + FC(54, 32, 2.4, '#fff')
  + glint(42, 48, 5, 2.2, 0.5);

G.lizard = (p) =>
  tube('M32 66 C14 67 13 45 28 45 C39 45 39 58 30 58', p.dark, 7)
  + L('M42 70 L37 82 M60 71 L65 82', INK, 8) + L('M42 70 L37 82 M60 71 L65 82', p.dark, 4.5)
  + P('M30 66 C34 52 50 44 64 46 C76 48 85 56 85 62 C85 68 77 70 69 68 C61 73 46 74 30 66 Z', p.base)
  + P('M40 51 L44 44 L48 50 L52 43 L56 49 L60 43 L64 49 L59 50 Z', p.dark, { sw: 2.2 })
  + F('M38 62 C48 60 58 62 66 60', 'none') + L('M40 62 Q46 58 52 62 T64 61', p.light, 2.4, 0.9)
  + C(72, 56, 6.5, p.light, { sw: 2.4 }) + FC(73.4, 56, 3.2, INK) + FC(74.4, 55, 1, '#fff')
  + L('M78 64 Q82 66 85 63', INK, 2);

G.whale = (p) =>
  L('M54 32 C52 24 47 20 41 18 M54 32 C56 24 61 20 67 18 M54 32 V16', CYAN, 3)
  + FC(41, 16, 2.4, CYAN) + FC(67, 16, 2.4, CYAN) + FC(54, 13, 2.4, CYAN)
  + P('M17 58 C10 50 6 42 8 33 C14 39 18 45 22 51 Z', p.dark, { sw: 2.4 })
  + P('M17 58 C9 54 3 50 3 43 C9 45 15 49 21 54 Z', p.base, { sw: 2.4 })
  + P('M15 57 C15 42 34 36 54 38 C70 40 83 48 85 58 C87 72 71 80 51 80 C37 80 25 76 19 70 Z', p.base)
  + F('M23 66 C35 74 57 76 79 66 C75 76 63 80 51 80 C37 80 27 74 23 66 Z', p.light)
  + L('M38 72 V78 M46 73 V80 M54 73 V80 M62 72 V79', p.dark, 1.6, 0.7)
  + FC(67, 54, 3.3, INK) + FC(68, 53, 1.1, '#fff')
  + L('M71 64 Q78 64 83 60', INK, 2.2)
  + glint(40, 46, 10, 3, 0.4, -12);

G.vulture = (p) => {
  const dk = shadowHue(p, 24), mid = shadowHue(p, 36);
  const wing = 'M48 42 C30 30 13 40 11 66 C21 59 29 61 36 67 Z';
  return FC(50, 54, 34, p.glow, 0.22) + P(wing, dk) + P(mirror(wing), dk)
    + L('M20 50 L30 56 M16 58 L28 62 M80 50 L70 56 M84 58 L72 62', mid, 2)
    + P('M36 46 C41 41 59 41 64 46 C68 62 62 80 50 85 C38 80 32 62 36 46 Z', mid)
    + P('M33 46 C40 37 60 37 67 46 C60 52 40 52 33 46 Z', BONE, { sw: 2.4 })
    + P('M46 42 C44 31 46 22 51 20 C57 20 59 26 57 32 C56 36 55 38 55 43 Z', '#eaa699', { sw: 2.4 })
    + P('M56 25 L66 30 L58 33 Z', '#d6bd84', { sw: 2.2 })
    + FC(53, 25.5, 2.1, INK)
    + L('M44 85 L42 92 M56 85 L58 92', GOLD.dark, 2.6);
};

G.wolf = (p) => {
  const ear = 'M27 13 L42 33 L23 40 Z';
  const eye = 'M33 44 Q39 41 44 47 Q37 49 33 44 Z';
  return P(ear, p.dark) + P(mirror(ear), p.dark)
    + F('M29 20 L37 31 L27 36 Z', p.light, 0.5) + F(mirror('M29 20 L37 31 L27 36 Z'), p.light, 0.5)
    + P('M50 25 C65 25 77 34 81 46 C77 52 71 54 66 56 C64 67 58 78 50 85 C42 78 36 67 34 56 C29 54 23 52 19 46 C23 34 35 25 50 25 Z', p.base)
    + F('M19 46 C25 50 31 52 35 58 L33 49 Z', p.light, 0.8) + F(mirror('M19 46 C25 50 31 52 35 58 L33 49 Z'), p.light, 0.8)
    + P('M39 55 C41 66 45 76 50 81 C55 76 59 66 61 55 C56 51 44 51 39 55 Z', SILVER.base, { sw: 2.4 })
    + F('M44.5 71 Q50 68 55.5 71 Q50 78 44.5 71 Z', INK)
    + F(eye, '#ffe066') + F(mirror(eye), '#ffe066') + L('M39 43 V48 M61 43 V48', INK, 2.2)
    + L('M31 40 L45 44 M69 40 L55 44', INK, 2.8);
};

G.ouroboros = (p) =>
  ring(50, 52, 27, p.base, 9)
  + `<circle cx="50" cy="52" r="27" fill="none" stroke="${p.dark}" stroke-width="9" stroke-dasharray="3 5" opacity=".55"/>`
  + `<circle cx="50" cy="52" r="27" fill="none" stroke="${p.light}" stroke-width="2" opacity=".6" stroke-dasharray="40 130" stroke-dashoffset="-180"/>`
  + P('M60 16 C70 11 83 17 84 28 C85 37 77 43 68 41 L59 33 Z', p.base, { sw: 2.8 })
  + P('M56 26 L68 30 L58 35 Z', p.dark, { sw: 2.2 })
  + F('M66 39 L68 44 L70 39 Z', '#fff')
  + FC(73, 24, 3, '#ffe066') + L('M73 22 V26', INK, 1.4)
  + glint(68, 18, 4, 1.8, 0.45);

G.devil = (p) => {
  const horn = 'M31 31 C24 23 22 12 26 5 C30 14 36 20 41 27 Z';
  const eye = 'M34 47 Q40 44 45 49 Q39 51 34 47 Z';
  return P(horn, '#3a1520') + P(mirror(horn), '#3a1520')
    + F('M28 10 C29 17 33 22 38 26', 'none') + L('M28 12 C30 18 34 22 38 26', '#7a3040', 1.8)
    + P('M50 22 C68 22 76 36 76 50 C76 66 64 80 50 84 C36 80 24 66 24 50 C24 36 32 22 50 22 Z', p.base)
    + P('M44 79 L50 93 L56 79 Z', '#3a1520', { sw: 2.4 })
    + F(eye, '#ffe066') + F(mirror(eye), '#ffe066') + FC(40, 47.5, 1.8, INK) + FC(60, 47.5, 1.8, INK)
    + L('M31 40 L46 45 M69 40 L54 45', INK, 3)
    + F('M33 60 Q50 76 67 60 Q62 71 50 73 Q38 71 33 60 Z', INK)
    + F('M40 63.5 L42.5 67.5 L45 65 Z M55 65 L57.5 67.5 L60 63.5 Z', '#fff')
    + glint(38, 32, 7, 2.6, 0.5);
};

G.jester = (p) => {
  const lobe = 'M30 47 C22 34 14 26 7 26 C11 35 18 45 27 51 Z';
  return P(lobe, p.base) + P(mirror(lobe), p.base)
    + P('M37 43 C39 29 45 17 50 9 C55 17 61 29 63 43 Z', GOLD.base, { metal: true })
    + C(7, 26, 4.5, GOLD.base, { sw: 2.2 }) + C(93, 26, 4.5, GOLD.base, { sw: 2.2 }) + C(50, 9, 4.5, p.base, { sw: 2.2 })
    + R(27, 42, 46, 9, 4.5, p.dark, { sw: 2.6 })
    + P('M32 50 C32 70 40 83 50 83 C60 83 68 70 68 50 Z', BONE)
    + F('M37 57 L41 51.5 L45 57 L41 62.5 Z', p.base) + F('M55 57 L59 51.5 L63 57 L59 62.5 Z', p.base)
    + FC(41, 57, 2.2, INK) + FC(59, 57, 2.2, INK)
    + FC(36, 67, 3.6, RED, 0.6) + FC(64, 67, 3.6, RED, 0.6)
    + L('M41 69 Q50 77 59 69', INK, 2.8);
};

G.twins = (p) => {
  const bust = (x, shirt) =>
    P(`M${x - 17} 86 C${x - 17} 67 ${x + 17} 67 ${x + 17} 86 Z`, shirt)
    + C(x, 49, 13, SKIN)
    + P(`M${x - 13} 47 C${x - 14} 34 ${x + 14} 34 ${x + 13} 47 C${x + 6} 42 ${x - 6} 42 ${x - 13} 47 Z`, p.dark, { sw: 2.4 })
    + FC(x - 4.5, 51, 1.9, INK) + FC(x + 4.5, 51, 1.9, INK)
    + L(`M${x - 4} 57 Q${x} 60 ${x + 4} 57`, INK, 2);
  return bust(33, p.base) + bust(67, p.light)
    + sparkle(50, 22, 6, GOLD.light);
};

G.janus = () =>
  P('M50 16 C33 16 20 29 20 48 C20 67 33 81 50 86 Z', GOLD.base, { metal: true })
  + P('M50 16 C67 16 80 29 80 48 C80 67 67 81 50 86 Z', SILVER.base, { metal: true })
  + F('M29 45 Q35 40 42 45 Q35 49 29 45 Z', INK) + F('M58 45 Q65 40 71 45 Q65 49 58 45 Z', INK)
  + L('M30 63 Q37 70 45 63', INK, 2.8) + L('M56 67 Q63 60 71 67', INK, 2.8)
  + L('M30 38 L41 40 M59 42 L70 37', INK, 2.4)
  + L('M50 16 V86', INK, 3);

G.mask = (p) =>
  L('M21 35 C13 37 11 45 15 51 M79 35 C87 37 89 45 85 51', p.dark, 3.2)
  + P('M21 30 C33 21 67 21 79 30 C81 50 75 70 50 83 C25 70 19 50 21 30 Z', p.base)
  + F('M29 42 Q37 33 46 42 Q37 48 29 42 Z', INK) + F('M54 42 Q63 33 71 42 Q63 48 54 42 Z', INK)
  + F('M35 59 Q50 74 65 59 Q50 66 35 59 Z', INK)
  + L('M27 30 Q37 26 44 32 M56 32 Q63 26 73 30', p.light, 2.4)
  + glint(33, 28, 7, 2.4, 0.5, -10);

G.piggy = () =>
  C(54, 21, 8, GOLD.base, { metal: true, sw: 2.4 }) + R(51.5, 17, 5, 8, 1, GOLD.dark, { flat: true, sw: 1.4 })
  + L('M82 54 C91 50 88 42 83 46', '#ff8fae', 3.2)
  + R(31, 70, 9, 14, 3, '#ff8fae', { sw: 2.4 }) + R(60, 70, 9, 14, 3, '#ff8fae', { sw: 2.4 })
  + E(52, 56, 31, 22, '#ffb6c9')
  + P('M29 37 L33 23 L43 35 Z', '#ff8fae', { sw: 2.4 })
  + E(22, 58, 7, 9, '#ff8fae', { sw: 2.4 }) + FE(20.5, 55, 1.4, 2.2, INK) + FE(23.5, 61, 1.4, 2.2, INK)
  + FC(33, 48, 3, INK) + FC(34, 47, 1, '#fff')
  + R(46, 34, 16, 4.5, 2.2, INK, { flat: true, sw: 1 })
  + glint(50, 44, 12, 4, 0.45, -8);

G.acorn = (p) =>
  P('M58 18 C66 10 80 12 85 19 C77 25 65 25 58 18 Z', p.base, { sw: 2.4 })
  + L('M60 18 C68 17 76 17 83 19', p.dark, 1.6)
  + P('M30 46 C30 66 40 82 50 85 C60 82 70 66 70 46 Z', '#cf8e4c')
  + P('M23 46 C23 32 35 25 50 25 C65 25 77 32 77 46 Z', '#7c4c27')
  + L('M30 33 L38 45 M40 28 L48 45 M52 27 L60 45 M64 30 L70 42', '#5d3719', 2, 0.8)
  + tube('M50 25 C50 20 54 16 58 14', '#5a3518', 3)
  + glint(39, 56, 4, 9, 0.45, 12);

G.knight = (p) =>
  R(27, 74, 46, 10, 3, p.dark, { metal: true })
  + P('M31 74 L35 65 H65 L69 74 Z', p.base, { metal: true })
  + P('M37 65 C35 53 39 46 43 40 C37 40 29 44 25 40 C25 31 33 23 41 21 L45 12 L51 19 C62 21 71 32 71 46 C71 56 67 62 65 65 Z', p.base, { metal: true })
  + tube('M51 21 C60 25 66 34 66 46 C66 54 64 60 62 65', p.dark, 3)
  + FC(45, 31, 2.8, INK) + FC(45.8, 30.2, 0.9, '#fff') + FC(29.5, 37.5, 1.6, INK);

G.moai = (p) => {
  const stone = `hsl(${p.h},12%,56%)`, dark = `hsl(${p.h},14%,38%)`;
  return R(24, 40, 7, 24, 3.5, dark, { sw: 2.4 }) + R(69, 40, 7, 24, 3.5, dark, { sw: 2.4 })
    + P('M33 18 H67 C69 30 69 40 67 50 C71 54 71 62 67 66 V86 H33 V66 C29 62 29 54 33 50 C31 40 31 30 33 18 Z', stone)
    + R(35, 11, 30, 9, 3, '#b0503e', { sw: 2.4 })
    + R(30, 33, 40, 7, 2, dark, { sw: 2.4 })
    + F('M35 41 H46 V47 H35 Z', INK, 0.55) + F('M54 41 H65 V47 H54 Z', INK, 0.55)
    + P('M46 40 L54 40 L57 59 C57 64 43 64 43 59 Z', `hsl(${p.h},12%,64%)`, { sw: 2.4 })
    + L('M40 71 H60', INK, 3.2)
    + L('M36 76 V84 M64 76 V84', dark, 2);
};

G.spy = (p) =>
  P('M23 86 C25 71 38 69 50 75 C62 69 75 71 77 86 Z', '#8a7652')
  + P('M42 72 L50 86 L58 72', '#6c5b3d', { sw: 2.4 })
  + P('M34 42 C34 63 42 73 50 73 C58 73 66 63 66 42 Z', SKIN)
  + E(50, 40, 33, 7.5, '#2c3550')
  + P('M30 40 C30 23 38 17 50 17 C62 17 70 23 70 40 Z', '#2c3550')
  + R(30, 31, 40, 6, 2, p.base, { sw: 2.2 })
  + R(34, 46, 13.5, 8.5, 3.5, INK, { flat: true, sw: 1 }) + R(52.5, 46, 13.5, 8.5, 3.5, INK, { flat: true, sw: 1 })
  + L('M47.5 49 H52.5', INK, 2.4)
  + glint(39, 48, 3, 1.4, 0.8) + glint(58, 48, 3, 1.4, 0.8)
  + L('M44 64 Q50 61 56 64', INK, 2.2);

G.crowd = (p) => {
  const bust = (x, y, s, shirt) =>
    P(`M${x - 15 * s} ${y + 34 * s} C${x - 15 * s} ${y + 16 * s} ${x + 15 * s} ${y + 16 * s} ${x + 15 * s} ${y + 34 * s} Z`, shirt, { sw: 2.4 })
    + C(x, y, 10 * s, SKIN, { sw: 2.4 })
    + P(`M${x - 10 * s} ${y - 1} C${x - 10 * s} ${y - 13 * s} ${x + 10 * s} ${y - 13 * s} ${x + 10 * s} ${y - 1} C${x + 4 * s} ${y - 5 * s} ${x - 4 * s} ${y - 5 * s} ${x - 10 * s} ${y - 1} Z`, p.deep, { sw: 2 });
  return bust(28, 42, 0.85, p.dark) + bust(72, 42, 0.85, p.dark) + bust(50, 52, 1, p.base);
};

G.hand = (p) =>
  R(32, 23, 8.5, 36, 4.25, SKIN, { sw: 2.6 }) + R(41.5, 16, 8.5, 42, 4.25, SKIN, { sw: 2.6 })
  + R(51, 19, 8.5, 40, 4.25, SKIN, { sw: 2.6 }) + R(60.5, 27, 8.5, 32, 4.25, SKIN, { sw: 2.6 })
  + solid('rect', 'x="63" y="46" width="9.5" height="25" rx="4.75" transform="rotate(42 67 58)"', SKIN, { sw: 2.6 })
  + R(32, 45, 37, 33, 11, SKIN, { sw: 2.6 })
  + L('M40 60 Q50 64 60 58', '#c9946c', 2)
  + R(35, 76, 31, 10, 3, p.base, { sw: 2.6 });

G.hamsa = (p) => {
  const thumb = 'M31 52 C23 47 21 38 25 33 C30 37 33 44 35 47 Z';
  return R(36, 20, 8.5, 32, 4.25, p.base, { sw: 2.6 }) + R(45.75, 15, 8.5, 36, 4.25, p.base, { sw: 2.6 })
    + R(55.5, 20, 8.5, 32, 4.25, p.base, { sw: 2.6 })
    + P(thumb, p.base, { sw: 2.6 }) + P(mirror(thumb), p.base, { sw: 2.6 })
    + P('M28 46 H72 C72 70 62 84 50 87 C38 84 28 70 28 46 Z', p.base)
    + E(50, 64, 11, 6.5, BONE, { sw: 2.4 }) + FC(50, 64, 4.4, p.dark) + FC(50, 64, 2.2, INK) + FC(48.5, 62.5, 1, '#fff')
    + L('M34 52 H66', GOLD.base, 2) + FC(38, 77, 1.8, GOLD.base) + FC(50, 81, 1.8, GOLD.base) + FC(62, 77, 1.8, GOLD.base);
};

G.handshake = (p) =>
  P('M7 57 L30 44 L37 57 L14 71 Z', p.base) + P('M93 57 L70 44 L63 57 L86 71 Z', p.dark)
  + R(27, 41, 6, 17, 2, '#fff', { sw: 2.2 }) + R(67, 41, 6, 17, 2, '#fff', { sw: 2.2 })
  + P('M31 47 C39 41 51 41 59 45 L71 51 C73 57 67 61 61 59 L57 65 C53 71 45 71 39 65 L33 57 Z', SKIN)
  + L('M44 53 L53 59 M48 49 L57 55 M53 46.5 L61 52', '#c9946c', 2.2);

G.brain = (p) =>
  P('M50 22 C40 16 26 20 24 32 C16 34 14 46 20 52 C16 60 22 70 32 70 C36 78 48 80 52 74 C58 80 72 78 74 70 C84 70 88 58 82 52 C88 44 84 32 74 30 C72 20 60 16 50 22 Z', p.light)
  + L('M50 24 V72 M36 30 C40 36 34 42 40 46 M30 52 C38 50 40 58 46 56 M64 30 C60 36 66 42 60 46 M70 52 C62 50 60 58 54 56 M36 64 C40 60 46 62 46 66 M64 64 C60 60 54 62 54 66', p.dark, 2.4)
  + sparkle(80, 22, 5, '#fff') + sparkle(20, 24, 3.4, '#fff', 0.8)
  + glint(36, 28, 7, 2.6, 0.5);

G.dove = (p) =>
  P('M44 54 C38 37 41 22 53 14 C55 29 59 41 59 52 Z', '#eef3ff')
  + L('M47 44 L53 30 M51 47 L56 34', '#b9c6dc', 1.8)
  + P('M29 61 C39 49 55 47 66 51 L80 43 L74 55 C74 65 62 73 48 73 L29 81 L35 68 Z', '#fff')
  + C(70, 46, 7, '#fff', { sw: 2.6 })
  + P('M76 44 L85 46 L76 49 Z', GOLD.base, { sw: 2 })
  + FC(71, 44.5, 1.6, INK)
  + tube('M84 47 C88 52 86 58 82 60', '#5c8a3a', 1.4) + FE(85, 55, 3.2, 1.8, '#7bc142')
  + FC(50, 30, 16, p.glow, 0.18);

G.blindfold = (p) =>
  P('M50 18 C66 18 74 30 74 46 C74 64 64 80 50 80 C36 80 26 64 26 46 C26 30 34 18 50 18 Z', SKIN)
  + P('M26 42 C24 24 38 13 50 13 C62 13 76 24 74 42 C68 30 58 26 50 26 C42 26 32 30 26 42 Z', p.deep, { sw: 2.6 })
  + P('M21 41 H79 V54 H21 Z', p.base)
  + P('M78 45 L91 39 L88 52 Z M78 50 L90 58 L84 62 Z', p.base, { sw: 2.2 })
  + L('M21 47 H79', p.dark, 1.6)
  + L('M42 68 Q50 63 58 68', INK, 2.6);

G.hush = (p) =>
  P('M50 18 C66 18 74 30 74 46 C74 64 64 80 50 80 C36 80 26 64 26 46 C26 30 34 18 50 18 Z', SKIN)
  + P('M26 42 C24 24 38 13 50 13 C62 13 76 24 74 42 C68 30 58 26 50 26 C42 26 32 30 26 42 Z', p.deep, { sw: 2.6 })
  + L('M35 47 Q40 51 45 47 M55 47 Q60 51 65 47', INK, 2.6)
  + L('M41 67 H59', INK, 2.6)
  + R(45.5, 52, 9, 34, 4.5, SKIN, { sw: 2.6 })
  + L('M47 58 H53', '#c9946c', 1.6);

G.halo = (p) => {
  const wing = 'M50 60 C38 42 21 40 10 48 C17 52 21 58 21 64 C30 62 40 62 50 66 Z';
  return FC(50, 56, 22, p.glow, 0.18)
    + P(wing, '#fff') + P(mirror(wing), '#fff')
    + L('M18 52 C26 52 32 55 36 59 M23 58 C30 58 36 61 40 63', '#b9c6dc', 1.8)
    + L(mirror('M18 52 C26 52 32 55 36 59 M23 58 C30 58 36 61 40 63'), '#b9c6dc', 1.8)
    + C(50, 60, 9, p.light, { sw: 2.4 })
    + `<ellipse cx="50" cy="28" rx="20" ry="7" fill="none" stroke="${INK}" stroke-width="10"/>`
    + `<ellipse cx="50" cy="28" rx="20" ry="7" fill="none" stroke="${GOLD.base}" stroke-width="5"/>`
    + `<ellipse cx="50" cy="27" rx="18" ry="5.6" fill="none" stroke="${GOLD.light}" stroke-width="1.6"/>`;
};

// --- batch: objects, part one -------------------------------------------------------
/** A heart centred at (cx, cy), `s` = scale. */
const heartPath = (cx, cy, s) =>
  `M${cx} ${f1(cy + 18 * s)} C${f1(cx - 4 * s)} ${f1(cy + 12 * s)} ${f1(cx - 20 * s)} ${f1(cy + 4 * s)} ${f1(cx - 20 * s)} ${f1(cy - 6 * s)} `
  + `C${f1(cx - 20 * s)} ${f1(cy - 16 * s)} ${f1(cx - 6 * s)} ${f1(cy - 20 * s)} ${cx} ${f1(cy - 10 * s)} `
  + `C${f1(cx + 6 * s)} ${f1(cy - 20 * s)} ${f1(cx + 20 * s)} ${f1(cy - 16 * s)} ${f1(cx + 20 * s)} ${f1(cy - 6 * s)} `
  + `C${f1(cx + 20 * s)} ${f1(cy + 4 * s)} ${f1(cx + 4 * s)} ${f1(cy + 12 * s)} ${cx} ${f1(cy + 18 * s)} Z`;
/** An Archimedean spiral as a polyline. */
function spiralPath(cx, cy, turns, r0, r1) {
  const pts = [];
  const n = Math.round(turns * 40);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = t * turns * Math.PI * 2, r = r0 + (r1 - r0) * t;
    pts.push(`${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)}`);
  }
  return 'M' + pts.join(' L');
}
/** A toothed gear outline. */
function gearPath(cx, cy, teeth, rOut, rIn) {
  const pts = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2, w = (Math.PI * 2) / teeth;
    for (const [da, r] of [[0, rIn], [w * 0.18, rOut], [w * 0.5, rOut], [w * 0.68, rIn]]) {
      pts.push(`${f1(cx + Math.cos(a0 + da) * r)} ${f1(cy + Math.sin(a0 + da) * r)}`);
    }
  }
  return 'M' + pts.join(' L') + ' Z';
}
const rot = (a, cx, cy, inner) => `<g transform="rotate(${a} ${cx} ${cy})">${inner}</g>`;
const T = (x, y, txt, size, fill, o = {}) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dy=".35em" font-family="${o.serif ? 'Georgia,serif' : 'system-ui,-apple-system,Segoe UI,sans-serif'}" font-weight="900" font-size="${size}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1.2}" paint-order="stroke"` : ''}>${txt}</text>`;

G.pennant = (p) =>
  tube('M27 14 V88', '#8a6a44', 3) + C(27, 12, 3.8, GOLD.base, { sw: 2.2 })
  + P('M29 18 C45 13 58 26 83 19 C76 30 78 38 85 46 C62 53 47 40 29 46 Z', p.base)
  + F('M29 29 C45 25 58 36 81 31 L83 38 C60 43 46 33 29 38 Z', '#fff', 0.55)
  + glint(40, 22, 6, 2, 0.5, -8);

G.clover = (p) => {
  const leaf = 'M50 50 C38 42 30 32 34 24 C38 17 47 19 50 26 C53 19 62 17 66 24 C70 32 62 42 50 50 Z';
  let s = tube('M51 54 C56 68 54 79 47 88', '#3e8a3a', 3);
  for (const a of [-45, 45, 135, 225]) {
    s += solid('path', `d="${leaf}" transform="rotate(${a} 50 50)"`, p.base, { sw: 2.6 })
      + `<path d="M50 48 L50 30" transform="rotate(${a} 50 50)" stroke="${p.dark}" stroke-width="1.6" fill="none"/>`;
  }
  return s + C(50, 50, 4, p.light, { sw: 2 }) + sparkle(78, 22, 5, '#fff');
};

G.bolt = (p) =>
  FC(50, 50, 32, p.glow, 0.22)
  + P('M58 9 L27 54 H46 L37 91 L75 42 H55 L67 9 Z', p.light)
  + F('M58 9 L35 46 H48 L56 22 Z', '#fff', 0.55)
  + sparkle(24, 26, 4.5, '#fff') + sparkle(80, 70, 4, '#fff', 0.8);

G.spiral = (p) =>
  C(50, 50, 33, p.base)
  + L(spiralPath(50, 50, 3.2, 1, 29), '#fff', 4.4)
  + L(spiralPath(50, 50, 3.2, 1, 29), p.deep, 1.2, 0.5)
  + glint(36, 32, 7, 2.6, 0.45);

G.card = (p) =>
  rot(-16, 44, 50, R(26, 22, 38, 54, 5, p.dark) + `<rect x="30" y="26" width="30" height="46" rx="3" fill="url(#mcHatch)"/>`
    + L('M30 26 L60 72 M60 26 L30 72', p.base, 1.6, 0.5))
  + rot(10, 56, 50, R(37, 22, 38, 54, 5, '#fffaf0')
    + F('M56 34 L64 49 L56 64 L48 49 Z', p.base) + F('M56 37 L60.5 49 L56 53 L51.5 49 Z', '#fff', 0.5)
    + T(43.5, 30, 'A', 8, p.dark) + T(68.5, 68, 'A', 8, p.dark));

G.fullmoon = (p) =>
  FC(50, 50, 38, p.glow, 0.16)
  + C(50, 50, 30, '#f3efe0')
  + FC(40, 42, 6, '#d6cdb2') + FC(58, 60, 8, '#d6cdb2') + FC(62, 38, 3.6, '#d6cdb2') + FC(40, 64, 3, '#d6cdb2')
  + glint(38, 34, 8, 3.2, 0.6)
  + sparkle(84, 20, 4, '#fff') + sparkle(16, 76, 3, '#fff', 0.7);

G.lantern = (p) =>
  FC(50, 52, 30, p.glow, 0.25)
  + tube('M40 22 C40 11 60 11 60 22', GOLD.dark, 3)
  + R(37, 30, 26, 38, 4, p.light, { op: 0.85 })
  + FC(50, 52, 15, 'url(#mcFlame)')
  + P('M50 39 C55 46 56 52 53 56 C51 58 49 58 47 56 C44 52 45 46 50 39 Z', '#ffcf45', { sw: 2 })
  + L('M37 30 V68 M63 30 V68 M50 30 V39 M50 60 V68', GOLD.dark, 2.6)
  + P('M33 22 H67 L62 31 H38 Z', GOLD.base, { metal: true })
  + P('M33 68 H67 L69 77 H31 Z', GOLD.base, { metal: true });

G.hearts = (p) =>
  P(heartPath(38, 47, 1.05), p.base) + glint(29, 37, 5, 2.4, 0.55)
  + P(heartPath(65, 60, 0.8), p.light) + glint(58, 52, 3.6, 1.8, 0.55)
  + sparkle(74, 26, 5, '#fff') + sparkle(22, 78, 3.4, '#fff', 0.8);

G.megaphone = (p) =>
  L('M80 36 Q89 50 80 64 M87 27 Q99 50 87 73', p.light, 3)
  + P('M38 60 L43 77 H52 L47 58 Z', p.dark, { sw: 2.6 })
  + R(18, 40, 14, 20, 3, p.dark, { sw: 2.6 })
  + P('M30 40 L70 21 V79 L30 60 Z', p.base, { metal: true })
  + E(70, 50, 7, 29, p.light, { sw: 2.6 }) + FE(71, 50, 3.6, 22, p.deep, 0.7)
  + L('M36 46 L66 32', '#fff', 2, 0.5);

G.chip = (p) => {
  let pins = '';
  for (let i = 0; i < 4; i++) {
    const v = 34 + i * 10.6;
    pins += `M${f1(v)} 16 V28 M${f1(v)} 72 V84 M16 ${f1(v)} H28 M72 ${f1(v)} H84 `;
  }
  return L(pins, INK, 5.6) + L(pins, SILVER.base, 2.8)
    + R(26, 26, 48, 48, 5, '#2b3346')
    + R(36, 36, 28, 28, 3, p.base, { metal: true })
    + L('M42 44 H58 M42 50 H58 M42 56 H58', p.deep, 1.6, 0.7)
    + FC(31, 31, 2, SILVER.base) + glint(42, 40, 5, 2, 0.6);
};

G.purse = (p) =>
  C(73, 74, 8, GOLD.base, { metal: true, sw: 2.4 })
  + P('M22 47 C22 80 34 86 50 86 C66 86 78 80 78 47 Z', p.base)
  + L('M28 54 C30 74 40 80 50 80 C60 80 70 74 72 54', p.light, 1.6, 0.7)
  + P('M24 48 C24 37 36 32 50 32 C64 32 76 37 76 48 Z', GOLD.base, { metal: true })
  + C(44, 28, 4.4, GOLD.light, { sw: 2.2 }) + C(56, 28, 4.4, GOLD.light, { sw: 2.2 })
  + glint(34, 60, 4, 10, 0.4, 18);

G.sprout = (p) =>
  P('M20 77 C28 66 72 66 80 77 C72 86 28 86 20 77 Z', '#7a4b27')
  + FC(32, 76, 2, '#5a3518') + FC(60, 79, 2.4, '#5a3518')
  + tube('M50 74 C50 60 48 50 50 38', '#3e8a3a', 3)
  + P('M50 50 C40 35 26 35 19 42 C27 52 42 55 50 50 Z', p.base)
  + P('M50 42 C58 25 74 23 83 30 C77 42 60 47 50 42 Z', p.light)
  + L('M48 49 C40 44 32 42 24 43 M52 41 C60 35 68 31 77 30', p.dark, 1.6)
  + FC(50, 34, 4, p.glow, 0.6);

G.anvil = (p) => {
  const iron = `hsl(${p.h},14%,46%)`;
  return P('M18 40 H70 C79 40 85 44 87 51 C81 51 75 53 71 57 H63 V66 H71 V77 H29 V66 H37 V57 H33 C25 55 20 49 18 40 Z', iron, { metal: true })
    + rot(42, 62, 26, R(52, 20, 24, 12, 2, SILVER.base, { metal: true }))
    + tube('M60 30 L80 10', '#8a6a44', 3)
    + sparkle(30, 30, 4.5, '#ffcf45') + sparkle(22, 22, 3, '#ff8a3d') + sparkle(40, 22, 2.6, '#ffcf45');
};

G.medal = (p) =>
  P('M33 10 H46 L55 40 H42 Z', p.base, { sw: 2.6 }) + P('M67 10 H54 L45 40 H58 Z', p.dark, { sw: 2.6 })
  + C(50, 61, 23, GOLD.base, { metal: true })
  + `<circle cx="50" cy="61" r="17" fill="none" stroke="${GOLD.dark}" stroke-width="2.6"/>`
  + P(starPath(5, 13, 5.6, 50, 61), GOLD.light, { sw: 2.2 })
  + glint(41, 52, 4.4, 2, 0.6);

G.mirror = (p) =>
  R(45.5, 62, 9, 24, 3, GOLD.dark, { metal: true }) + C(50, 88, 4.4, GOLD.base, { sw: 2.2 })
  + E(50, 39, 23, 27, GOLD.base, { metal: true })
  + E(50, 39, 16.5, 20.5, p.light, { flat: true, sw: 2.2 })
  + F('M38 34 L52 22 L56 25 L41 39 Z M42 48 L60 32 L62 36 L44 52 Z', '#fff', 0.55)
  + FC(50, 13, 3, RED) + FC(27, 39, 2.4, RED) + FC(73, 39, 2.4, RED);

G.trumpet = (p) =>
  P('M29 48 H56 V67 L42.5 61 L29 67 Z', p.base, { sw: 2.6 })
  + tube('M27 46 C27 58 53 58 53 46', GOLD.base, 4)
  + R(18, 37, 45, 9, 3, GOLD.base, { metal: true })
  + R(33, 27, 5, 11, 1.5, GOLD.dark, { sw: 2 }) + R(41, 27, 5, 11, 1.5, GOLD.dark, { sw: 2 }) + R(49, 27, 5, 11, 1.5, GOLD.dark, { sw: 2 })
  + R(11, 36, 9, 11, 2, GOLD.dark, { sw: 2.4 })
  + P('M61 35 L85 21 V63 L61 48 Z', GOLD.base, { metal: true })
  + E(85, 42, 5, 21, GOLD.light, { sw: 2.4 });

G.drum = (p) =>
  tube('M28 30 L56 8', '#c9a46a', 3) + C(56, 8, 3.4, '#f2e8d2', { sw: 2 })
  + tube('M72 30 L44 8', '#c9a46a', 3) + C(44, 8, 3.4, '#f2e8d2', { sw: 2 })
  + P('M21 40 V70 C21 81 79 81 79 70 V40 Z', p.base)
  + L('M21 44 L35 74 L50 44 L64 74 L79 44', GOLD.light, 2.4)
  + E(50, 40, 29, 10, BONE)
  + `<ellipse cx="50" cy="40" rx="29" ry="10" fill="none" stroke="${p.dark}" stroke-width="3.4"/>`
  + `<path d="M21 70 C21 81 79 81 79 70" fill="none" stroke="${p.dark}" stroke-width="3.4"/>`
  + glint(38, 37, 8, 2.2, 0.55, -4);

G.boot = (p) =>
  P('M35 13 H59 V53 C67 55 81 59 85 67 V78 H31 Z', '#4a3628')
  + R(29, 76, 58, 9, 2.5, '#2b201a')
  + R(33, 11, 28, 9, 2.5, p.base, { sw: 2.6 })
  + L('M41 28 H53 M41 36 H53 M41 44 H53', p.light, 2.4)
  + L('M60 55 C68 58 77 61 81 66', '#7a5a46', 2, 0.8)
  + glint(42, 50, 3, 8, 0.35);

G.ladder = () => {
  let s = tube('M33 10 L28 89', '#a8743e', 4) + tube('M67 10 L72 89', '#a8743e', 4);
  for (let i = 0; i < 6; i++) {
    const y = 18 + i * 13, w = 0.065 * (y - 10);
    s += tube(`M${f1(32.5 - w + 1)} ${y} H${f1(67.5 + w - 1)}`, '#d29a5c', 3);
  }
  return s;
};

G.web = (p) => {
  let s = '';
  const c = [50, 44];
  const spokes = around(8, 38, c[0], c[1], -90);
  s += L(spokes.map(([x, y]) => `M${c[0]} ${c[1]} L${f1(x)} ${f1(y)}`).join(' '), '#dfe7f2', 1.6, 0.85);
  for (const r of [10, 20, 30]) {
    const pts = around(8, r, c[0], c[1], -90);
    s += L('M' + pts.map(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      const mx = (x + nx) / 2 + (c[0] - (x + nx) / 2) * 0.12, my = (y + ny) / 2 + (c[1] - (y + ny) / 2) * 0.12;
      return `${f1(x)} ${f1(y)} Q${f1(mx)} ${f1(my)} ${f1(nx)} ${f1(ny)}`;
    }).join(' M') + '', '#dfe7f2', 1.6, 0.85);
  }
  s += L('M64 44 V60', '#dfe7f2', 1.4)
    + L('M56 62 L48 56 M56 66 L46 66 M56 70 L48 76 M72 62 L80 56 M72 66 L82 66 M72 70 L80 76', INK, 2.4)
    + E(64, 67, 8, 9, p.deep) + C(64, 58, 4.6, p.deep, { sw: 2.2 })
    + F('M61.5 64 L66.5 64 L64 67 L66.5 70 L61.5 70 L64 67 Z', RED);
  return s;
};

G.phone = (p) =>
  P('M26 54 C26 46 74 46 74 54 L80 82 H20 Z', p.base)
  + C(50, 66, 13, BONE, { sw: 2.4 })
  + around(8, 9, 50, 66, -60).map(([x, y]) => FC(f1(x), f1(y), 1.9, p.dark)).join('')
  + FC(50, 66, 3, p.dark)
  + P('M17 40 C17 29 26 27 32 29 L36 37 H64 L68 29 C74 27 83 29 83 40 C83 46 75 48 69 44 L64 42 H36 L31 44 C25 48 17 46 17 40 Z', p.dark)
  + glint(28, 34, 4, 1.8, 0.5);

// --- batch: objects, part two ---------------------------------------------------------
G.book = (p) =>
  P('M26 27 H81 V83 H26 Z', PAPER)
  + L('M76 31 V80 M79 33 V80', '#c9b07a', 1.2)
  + P('M18 22 H73 V78 H18 Z', p.base)
  + R(18, 22, 9, 56, 2, p.dark, { sw: 2.6 })
  + L('M22 30 H23 M22 70 H23', GOLD.light, 2.4)
  + P('M48 36 L58 50 L48 64 L38 50 Z', GOLD.base, { metal: true, sw: 2.4 })
  + P('M60 78 V91 L64 87 L68 91 V78 Z', RED, { sw: 2.2 })
  + glint(34, 30, 8, 2, 0.4, -4);

G.pyramid = (p) =>
  FC(50, 18, 12, p.glow, 0.5)
  + P('M50 16 L84 76 L54 84 Z', '#c48d45')
  + P('M50 16 L54 84 L16 75 Z', '#f0c67a')
  + L('M36 44 L52 47 M28 58 L53 62 M22 70 L54 74 M58 40 L68 38 M64 52 L76 50 M70 64 L81 61', '#9c6b2e', 1.6, 0.8)
  + P('M50 16 L57 29 L45 31 Z', GOLD.light, { metal: true, sw: 2 })
  + sparkle(50, 12, 6, '#fff');

G.bandage = (p) =>
  solid('rect', 'x="17" y="40" width="66" height="20" rx="10" transform="rotate(-35 50 50)"', '#f4d6b8')
  + solid('rect', 'x="17" y="40" width="66" height="20" rx="10" transform="rotate(35 50 50)"', '#f7dec4')
  + solid('rect', 'x="41" y="41" width="18" height="18" rx="3" transform="rotate(35 50 50)"', '#fff4e6', { sw: 2.2 })
  + around(4, 5, 50, 50, 10).map(([x, y]) => FC(f1(x), f1(y), 1.2, '#d7b28e')).join('')
  + FC(56, 44, 4, p.base, 0.55);

G.blood = (p) => {
  const red = `hsl(${p.h},82%,46%)`;
  return P('M50 11 C58 30 73 44 73 61 C73 75 63 85 50 85 C37 85 27 75 27 61 C27 44 42 30 50 11 Z', red)
    + glint(40, 56, 4.4, 10, 0.55, 10)
    + P('M78 24 C80 29 83 32 83 35 C83 38 81 40 78 40 C75 40 73 38 73 35 C73 32 76 29 78 24 Z', red, { sw: 2.2 })
    + FC(22, 34, 3, red);
};

G.coffin = (p) =>
  P('M38 11 H62 L75 30 L64 89 H36 L25 30 Z', '#6a4632')
  + P('M41 16 H59 L69 31 L60 83 H40 L31 31 Z', '#8a5d42', { flat: true, sw: 2 })
  + L('M50 33 V64 M41 43 H59', INK, 7.4) + L('M50 33 V64 M41 43 H59', p.light, 4)
  + glint(40, 24, 3, 6, 0.4, 30);

G.flask = (p) =>
  R(39, 9, 22, 8, 2, '#a8743e', { sw: 2.4 })
  + FC(60, 9, 3, '#fff', 0.6) + FC(66, 4, 2, '#fff', 0.5)
  + P('M42 34 V40 C30 46 23 56 23 66 C23 80 35 89 50 89 C65 89 77 80 77 66 C77 56 70 46 58 40 V34 Z', '#e4f4ff', { op: 0.9 })
  + F('M26 65 C34 60 44 66 50 64 C58 61 66 60 74 64 C75 78 64 86 50 86 C36 86 25 78 26 65 Z', p.base)
  + FC(42, 74, 3, '#fff', 0.7) + FC(56, 70, 2, '#fff', 0.7) + FC(50, 79, 1.6, '#fff', 0.7)
  + L('M42 34 V40 C30 46 23 56 23 66 C23 80 35 89 50 89 C65 89 77 80 77 66 C77 56 70 46 58 40 V34', INK, 3)
  + R(41, 16, 18, 19, 2, '#e4f4ff', { op: 0.9 })
  + glint(35, 56, 3, 9, 0.6, 20);

G.bowtie = (p) => {
  const wing = 'M50 47 L22 32 C17 40 17 53 22 61 Z';
  return P('M22 72 L50 58 L78 72 L72 88 H28 Z', '#fff', { sw: 2.4 })
    + L('M50 58 V88', '#b9c6dc', 1.6)
    + P(wing, p.base) + P(mirror(wing), p.base)
    + L('M24 39 L40 45 M24 54 L40 50', p.dark, 1.6, 0.8) + L(mirror('M24 39 L40 45 M24 54 L40 50'), p.dark, 1.6, 0.8)
    + R(43, 40, 14, 14, 3.5, p.dark)
    + glint(30, 40, 4, 1.8, 0.5);
};

G.clapper = (p) => {
  const stripes = (y) => [0, 1, 2, 3, 4].map((i) => F(`M${22 + i * 12} ${y} L${30 + i * 12} ${y} L${26 + i * 12} ${y + 10} L${18 + i * 12} ${y + 10} Z`, '#fff')).join('');
  return R(20, 41, 60, 44, 3, '#2c3243')
    + L('M26 60 H62 M26 68 H54 M26 76 H58', '#8a95ad', 2.2)
    + R(20, 41, 60, 10, 2, INK, { flat: true }) + stripes(41)
    + rot(-18, 22, 40, R(20, 28, 60, 11, 2, INK, { flat: true }) + stripes(28.5))
    + C(22, 40, 3.4, SILVER.base, { sw: 2 })
    + FC(70, 72, 5, p.base);
};

G.seal = (p) => {
  const wobble = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2, r = i % 2 ? 27.5 : 30.5;
    return `${f1(50 + Math.cos(a) * r)} ${f1(46 + Math.sin(a) * r)}`;
  });
  return P('M36 62 L28 90 L38 84 L44 92 L50 66 Z', p.dark, { sw: 2.4 })
    + P('M64 62 L72 90 L62 84 L56 92 L50 66 Z', p.dark, { sw: 2.4 })
    + P('M' + wobble.join(' L') + ' Z', p.base)
    + `<circle cx="50" cy="46" r="19" fill="none" stroke="${p.dark}" stroke-width="3"/>`
    + P(starPath(5, 11, 4.4, 50, 46), p.light, { sw: 2 })
    + glint(38, 32, 5, 2.4, 0.5);
};

G.speaker = (p) =>
  L('M70 36 Q78 50 70 64 M78 27 Q90 50 78 73 M86 18 Q102 50 86 82', p.light, 3)
  + R(20, 37, 18, 26, 3, p.dark)
  + P('M38 37 L60 19 V81 L38 63 Z', p.base, { metal: true })
  + glint(46, 34, 2.4, 8, 0.45, 40);

G.juggle = (p) =>
  L('M24 70 Q50 4 76 70', '#fff', 2, 0.35)
  + `<path d="M24 70 Q50 4 76 70" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 5" opacity=".5"/>`
  + C(27, 57, 9, RED) + glint(24, 54, 3, 1.6, 0.7)
  + C(50, 25, 9, p.base) + glint(47, 22, 3, 1.6, 0.7)
  + C(73, 57, 9, GOLD.base) + glint(70, 54, 3, 1.6, 0.7)
  + E(27, 80, 11, 6, '#fff', { sw: 2.4 }) + E(73, 80, 11, 6, '#fff', { sw: 2.4 });

G.brush = (p) =>
  P('M14 79 C30 63 46 71 58 58 C61 64 57 73 48 77 C38 83 25 83 14 79 Z', GOLD.base, { metal: true })
  + sparkle(24, 72, 3.4, '#fff')
  + rot(40, 64, 32, R(58, 6, 12, 40, 6, p.base) + R(58, 42, 12, 10, 1.5, SILVER.base, { metal: true }))
  + P('M50 52 L58 60 C56 66 52 68 47 66 C46 61 47 56 50 52 Z', GOLD.dark, { sw: 2.4 });

G.bomb = (p) =>
  FC(80, 15, 10, 'url(#mcFlame)')
  + tube('M62 27 C66 18 72 15 79 16', '#a8743e', 2.4)
  + rot(32, 58, 32, R(51, 26, 14, 11, 2, '#4a5266'))
  + C(45, 58, 27, '#2c3243')
  + glint(34, 46, 8, 4, 0.5)
  + P(starPath(8, 9, 3.6, 80, 15), '#ffd84a', { sw: 1.8 })
  + FC(45, 58, 27, p.glow, 0.08);

G.swap = (p) =>
  tube('M26 46 C26 29 40 22 56 22 H63', p.base, 7) + P('M60 11 L79 22 L60 33 Z', p.base, { sw: 2.6 })
  + tube('M74 54 C74 71 60 78 44 78 H37', p.light, 7) + P('M40 67 L21 78 L40 89 Z', p.light, { sw: 2.6 });

G.urn = (p) =>
  FC(50, 22, 10, 'url(#mcFlame)')
  + tube('M35 41 C23 41 21 53 30 57', p.dark, 3) + tube('M65 41 C77 41 79 53 70 57', p.dark, 3)
  + P('M36 34 C23 42 21 62 30 74 C34 81 42 85 50 85 C58 85 66 81 70 74 C79 62 77 42 64 34 Z', p.base, { metal: true })
  + R(40, 23, 20, 12, 3, p.dark, { sw: 2.6 })
  + R(33, 18, 34, 7, 3, p.base, { metal: true, sw: 2.6 })
  + L('M26 57 H74', GOLD.base, 3.4) + L('M30 65 L36 61 L42 65 L48 61 L54 65 L60 61 L66 65 L70 62', GOLD.light, 1.8)
  + sparkle(42, 12, 3, '#ffcf45') + sparkle(58, 9, 2.4, '#ff8a3d');

G.well = (p) =>
  P('M16 34 L50 13 L84 34 Z', '#a8432f') + L('M24 30 L50 15 L76 30', '#d06a50', 1.6)
  + R(25, 32, 6, 30, 1, '#8a6a44', { sw: 2.4 }) + R(69, 32, 6, 30, 1, '#8a6a44', { sw: 2.4 })
  + L('M50 34 V48', '#c9a46a', 2) + R(44.5, 47, 11, 8, 1.5, '#8a6a44', { sw: 2.2 })
  + R(19, 58, 62, 27, 4, '#7d8798')
  + L('M19 67 H81 M19 76 H81 M34 58 V67 M56 58 V67 M27 67 V76 M46 67 V76 M66 67 V76 M38 76 V85 M60 76 V85', '#596273', 1.6)
  + E(50, 58, 31, 6, p.dark, { sw: 2.6 }) + FE(50, 57, 24, 3.4, p.light, 0.6)
  + sparkle(66, 50, 4, GOLD.light) + sparkle(36, 52, 3, GOLD.light);

G.yinyang = (p) =>
  FC(50, 50, 36, p.glow, 0.14)
  + C(50, 50, 32, '#fff')
  + F('M50 18 A32 32 0 0 1 50 82 A16 16 0 0 1 50 50 A16 16 0 0 0 50 18 Z', p.base)
  + FC(50, 34, 5, p.base) + FC(50, 66, 5, '#fff')
  + `<circle cx="50" cy="50" r="32" fill="none" stroke="${INK}" stroke-width="3"/>`
  + glint(36, 32, 6, 2.6, 0.4);

G.ruler = (p) =>
  F('M30 86 L85 31 L91 37 L36 92 Z', '#000', 0.32)
  + rot(-40, 50, 48, R(14, 40, 72, 17, 2, GOLD.base, { metal: true })
    + L(Array.from({ length: 13 }, (_, i) => `M${20 + i * 5} 40 V${i % 2 ? 46 : 50}`).join(' '), GOLD.deep, 1.6)
    + FC(80, 48.5, 2.2, p.base));

G.chest = (p) =>
  FC(50, 46, 26, GOLD.light, 0.2)
  + R(20, 48, 60, 35, 4, '#8a5636')
  + P('M20 48 V40 C20 27 80 27 80 40 V48 Z', '#a8683f')
  + L('M20 60 H80 M20 72 H80', '#6a3f22', 1.6, 0.7)
  + R(25, 30, 7, 53, 1, GOLD.base, { metal: true, sw: 2.2 }) + R(68, 30, 7, 53, 1, GOLD.base, { metal: true, sw: 2.2 })
  + R(43, 43, 14, 15, 2, GOLD.base, { metal: true, sw: 2.4 })
  + F('M50 47 C52 47 53 49 52 51 L53 55 H47 L48 51 C47 49 48 47 50 47 Z', INK)
  + FC(38, 40, 2.4, p.light) + sparkle(62, 36, 3.4, '#fff');

G.moneybag = (p) =>
  P('M36 35 C20 47 18 71 26 81 C32 89 68 89 74 81 C82 71 80 47 64 35 Z', '#c9a46a')
  + P('M38 31 L31 17 L44 24 L50 13 L56 24 L69 17 L62 31 Z', '#c9a46a', { sw: 2.6 })
  + R(37, 29, 26, 7, 3.5, p.dark, { sw: 2.6 })
  + T(50, 62, '$', 30, p.dark, { stroke: '#f0dcae', sw: 1.4 })
  + glint(34, 52, 4, 10, 0.35, 14);

G.note = (p) =>
  rot(-11, 49, 46, R(15, 28, 68, 36, 3, p.dark) + `<rect x="15" y="28" width="68" height="36" rx="3" fill="url(#mcHatch)"/>`)
  + rot(7, 51, 56, R(17, 38, 68, 36, 3, p.light)
    + `<rect x="21" y="42" width="60" height="28" rx="2" fill="none" stroke="${p.dark}" stroke-width="1.6"/>`
    + C(51, 56, 9, p.base, { sw: 2 }) + T(51, 56, '$', 11, '#fff')
    + T(28, 48, '5', 7, p.dark) + T(74, 64, '5', 7, p.dark));

G.helix = (p) => {
  const a = [], b = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, y = 12 + t * 76, x = Math.sin(t * Math.PI * 3) * 18;
    a.push(`${f1(50 + x)} ${f1(y)}`); b.push(`${f1(50 - x)} ${f1(y)}`);
  }
  let rungs = '';
  for (let i = 1; i < 12; i++) {
    const t = i / 12, y = 12 + t * 76, x = Math.sin(t * Math.PI * 3) * 18;
    if (Math.abs(x) > 3) rungs += `M${f1(50 - x)} ${f1(y)} H${f1(50 + x)} `;
  }
  return L(rungs, p.light, 2.4, 0.9)
    + tube('M' + a.join(' L'), p.base, 4.4) + tube('M' + b.join(' L'), GOLD.base, 4.4);
};

G.violin = () =>
  tube('M20 84 L80 18', '#d6c08a', 2) + L('M22 82 L78 20', '#fff', 1, 0.6)
  + rot(28, 50, 50, P('M50 30 C40 30 36 38 39 46 C34 49 32 56 35 63 C37 72 44 76 50 76 C56 76 63 72 65 63 C68 56 66 49 61 46 C64 38 60 30 50 30 Z', '#b4652e')
    + F('M44 50 C42 52 42 56 44 58 M56 50 C58 52 58 56 56 58', 'none')
    + L('M44 49 C41 52 41 56 44 59 M56 49 C59 52 59 56 56 59', INK, 1.8)
    + R(47.5, 10, 5, 34, 1.5, '#2b201a', { sw: 2 })
    + C(50, 9, 3.6, '#5a3518', { sw: 2 })
    + L('M48.6 14 V70 M51.4 14 V70', '#f2e8d2', 0.8)
    + R(44, 64, 12, 3, 1, '#2b201a', { flat: true, sw: 1.4 })
    + glint(43, 38, 3, 6, 0.45));

G.sun = (p) =>
  FC(50, 50, 40, p.glow, 0.2)
  + P(starPath(12, 41, 27), p.base, { metal: true })
  + C(50, 50, 22, '#ffe27a')
  + FC(50, 50, 16, '#fff6c9', 0.6)
  + glint(42, 41, 6, 3, 0.6);

G.orb = (p) =>
  R(25, 77, 50, 9, 3, GOLD.base, { metal: true, sw: 2.6 })
  + P('M31 77 L37 67 H63 L69 77 Z', GOLD.dark, { metal: true, sw: 2.6 })
  + C(50, 43, 28, p.base)
  + FC(50, 46, 19, p.glow, 0.45)
  + L('M34 50 C40 40 52 52 60 42 C64 37 66 42 64 48', '#fff', 2.4, 0.6)
  + sparkle(58, 34, 4, '#fff') + sparkle(40, 56, 2.6, '#fff', 0.8)
  + glint(39, 30, 8, 4, 0.55);

G.nazar = (p) =>
  tube('M50 18 C44 6 56 6 50 18', GOLD.base, 2.4)
  + C(50, 51, 32, p.dark)
  + C(50, 51, 23, '#fff', { flat: true, sw: 2.6 })
  + C(50, 51, 15, p.light, { flat: true, sw: 2.6 })
  + C(50, 51, 7.5, INK, { flat: true, sw: 1 })
  + glint(40, 38, 7, 3, 0.55) + FC(47, 48, 2, '#fff', 0.8);

G.tent = (p) => {
  let s = P('M16 82 L22 45 L50 22 L78 45 L84 82 Z', '#fff');
  for (let i = 0; i < 3; i++) s += F(`M${22 + i * 20} 45 L${32 + i * 20} 45 L${30 + i * 22} 82 L${18 + i * 22} 82 Z`, p.base);
  return s + L('M16 82 L22 45 L50 22 L78 45 L84 82 Z', INK, 3)
    + P('M22 45 L50 22 L78 45 C66 51 34 51 22 45 Z', p.base)
    + tube('M50 22 V8', '#8a6a44', 1.6) + P('M50 8 L63 12 L50 16 Z', GOLD.base, { sw: 2 })
    + F('M42 82 L50 58 L58 82 Z', INK, 0.75)
    + L('M22 45 Q26 51 31 46 Q36 52 40 47 Q45 52 50 47 Q55 52 60 47 Q64 52 69 46 Q74 51 78 45', GOLD.light, 2);
};

G.gradcap = (p) =>
  P('M30 46 V62 C30 71 70 71 70 62 V46 L50 54 Z', '#363f56')
  + P('M13 40 L50 25 L87 40 L50 55 Z', '#2b3346')
  + L('M20 40 L50 28 L80 40', '#4a5470', 1.6)
  + tube('M50 40 L74 48 V66', p.base, 1.8) + R(69.5, 63, 9, 12, 2, p.base, { sw: 2.2 })
  + C(50, 40, 3.2, GOLD.base, { sw: 1.8 });

G.compass = (p) =>
  C(50, 50, 33, GOLD.base, { metal: true })
  + C(50, 50, 27, BONE, { flat: true, sw: 2.4 })
  + L('M50 25 V29 M50 71 V75 M25 50 H29 M71 50 H75', '#9c8a62', 2)
  + P(starPath(4, 24, 6, 50, 50, -45), p.dark, { sw: 2 })
  + P(starPath(4, 27, 6.5, 50, 50, -90), p.base, { sw: 2.2 })
  + F('M50 23 L56 50 H44 Z', RED, 0.9) + L('M50 23 L56 50 L44 50 Z', INK, 2)
  + C(50, 50, 3.6, GOLD.light, { sw: 1.8 });

G.blossom = (p) => {
  let s = P('M50 66 C46 76 40 84 32 88', 'none') + tube('M50 64 C48 76 42 84 34 88', '#3e8a3a', 2.6)
    + P('M40 80 C30 74 22 78 20 84 C28 88 36 86 40 80 Z', '#5aa54a', { sw: 2.2 });
  for (const [x, y, a] of around(5, 15, 50, 44, -90)) {
    s += solid('ellipse', `cx="${f1(x)}" cy="${f1(y)}" rx="13" ry="10" transform="rotate(${f1((a * 180) / Math.PI)} ${f1(x)} ${f1(y)})"`, p.light, { sw: 2.4 });
  }
  return s + C(50, 44, 8, GOLD.base, { sw: 2.2 })
    + around(6, 4, 50, 44).map(([x, y]) => FC(f1(x), f1(y), 1.2, GOLD.deep)).join('');
};

G.barrel = (p) =>
  P('M27 22 C25 40 25 60 27 78 C35 85 65 85 73 78 C75 60 75 40 73 22 C65 16 35 16 27 22 Z', p.dark)
  + L('M27 38 Q50 44 73 38 M27 62 Q50 68 73 62', '#2b3346', 4)
  + E(50, 22, 23, 6.5, p.base, { sw: 2.6 }) + FE(57, 21, 4, 1.6, INK, 0.7)
  + P('M50 44 C54 50 57 54 57 57 C57 61 54 63 50 63 C46 63 43 61 43 57 C43 54 46 50 50 44 Z', '#1b1f2a', { sw: 2 })
  + glint(34, 40, 3, 12, 0.35);

G.snowflake = (p) => {
  let arm = 'M50 50 V16 M50 26 L42 19 M50 26 L58 19 M50 36 L43 30 M50 36 L57 30';
  let s = FC(50, 50, 34, p.glow, 0.16);
  for (let i = 0; i < 6; i++) s += `<g transform="rotate(${i * 60} 50 50)">${L(arm, INK, 7)}</g>`;
  for (let i = 0; i < 6; i++) s += `<g transform="rotate(${i * 60} 50 50)">${L(arm, p.light, 3.4)}</g>`;
  return s + P(starPath(6, 8, 6, 50, 50), '#fff', { sw: 2 });
};

// --- batch: objects, part three -------------------------------------------------------
G.newspaper = (p) =>
  P('M23 18 H84 V80 C84 84 82 86 78 86 H27 C25 86 23 84 23 80 Z', '#d9d4c8')
  + P('M16 24 H77 V82 C77 85 75 87 72 87 H20 C18 87 16 85 16 82 Z', '#f4f1ea')
  + R(22, 30, 49, 8, 1, INK, { flat: true, sw: 1 })
  + R(22, 43, 23, 19, 1, p.light, { sw: 2 })
  + L('M24 58 L30 52 L35 55 L43 46', p.dark, 2)
  + L('M49 45 H71 M49 50 H71 M49 55 H71 M49 60 H66 M22 67 H71 M22 72 H71 M22 77 H60', '#8b8f9a', 1.8);

G.bin = (p) =>
  FC(36, 14, 4, '#9aa6b8', 0.5) + FC(46, 8, 5, '#9aa6b8', 0.45) + FC(58, 12, 3.6, '#9aa6b8', 0.4)
  + P('M26 30 H74 L68 87 H32 Z', SILVER.base, { metal: true })
  + L('M38 38 L40 80 M50 38 V80 M62 38 L60 80', SILVER.dark, 2.4)
  + R(21, 22, 58, 9, 3, SILVER.dark, { metal: true })
  + R(43, 16, 14, 7, 2, SILVER.dark, { sw: 2.4 })
  + FC(50, 30, 6, p.base, 0.4);

G.abacus = (p) => {
  let s = R(17, 19, 66, 64, 4, '#8a5636') + R(23, 25, 54, 52, 2, '#2b201a', { flat: true, sw: 2 });
  const rows = [33, 44, 55, 66];
  s += L(rows.map((y) => `M23 ${y} H77`).join(' '), '#c9a46a', 1.8);
  rows.forEach((y, r) => {
    const beads = [3, 5, 2, 4][r];
    for (let i = 0; i < beads; i++) s += E(30 + i * 7 + (r % 2) * 18, y, 3.6, 4.4, i % 2 ? p.light : p.base, { sw: 1.8 });
  });
  return s;
};

G.galaxy = (p) =>
  FC(50, 50, 36, p.glow, 0.14)
  + L(spiralPath(50, 50, 1.4, 2, 34), p.light, 5, 0.85)
  + `<g transform="rotate(180 50 50)">${L(spiralPath(50, 50, 1.4, 2, 34), p.base, 5, 0.85)}</g>`
  + L(spiralPath(50, 50, 1.4, 2, 34), '#fff', 1.4, 0.6)
  + FC(50, 50, 9, '#fff6c9') + FC(50, 50, 14, p.glow, 0.4)
  + sparkle(20, 22, 3.4) + sparkle(80, 78, 3) + sparkle(78, 24, 2.4) + sparkle(24, 76, 2.4);

G.pact = (p) =>
  R(24, 20, 46, 64, 2, PAPER)
  + R(20, 14, 54, 9, 4.5, '#c9b07a', { metal: true, sw: 2.4 }) + R(20, 80, 54, 9, 4.5, '#c9b07a', { metal: true, sw: 2.4 })
  + L('M30 30 H64 M30 36 H64 M30 42 H58 M30 48 H62', '#9c8a62', 1.8)
  + L('M30 66 C36 58 40 72 46 62 C50 56 54 68 60 62', RED, 2.6)
  + P('M64 52 C66 56 68 58 68 60 C68 62 66 64 64 64 C62 64 60 62 60 60 C60 58 62 56 64 52 Z', RED, { sw: 1.8 })
  + P('M86 16 C76 20 66 32 62 46 L61 52 L66 48 C74 40 82 30 86 16 Z', '#f6f0e4', { sw: 2.4 });

G.lifering = () =>
  `<circle cx="50" cy="50" r="25" fill="none" stroke="${INK}" stroke-width="21"/>`
  + `<circle cx="50" cy="50" r="25" fill="none" stroke="#fff" stroke-width="16"/>`
  + `<circle cx="50" cy="50" r="25" fill="none" stroke="${RED}" stroke-width="16" stroke-dasharray="19.63 19.63" stroke-dashoffset="9.8"/>`
  + `<circle cx="50" cy="50" r="25" fill="none" stroke="#000" stroke-width="16" opacity=".12" stroke-dasharray="40 200" stroke-dashoffset="-60"/>`
  + `<circle cx="50" cy="50" r="33" fill="none" stroke="#e8d3a0" stroke-width="2.2" stroke-dasharray="7 9"/>`
  + `<circle cx="50" cy="50" r="17" fill="none" stroke="#e8d3a0" stroke-width="2.2" stroke-dasharray="5 7"/>`
  + glint(34, 32, 6, 2.6, 0.55);

G.frame = (p) =>
  R(14, 21, 72, 58, 4, GOLD.base, { metal: true })
  + R(22, 29, 56, 42, 2, p.deep, { flat: true, sw: 2.4 })
  + F('M22 71 L38 52 L48 62 L60 44 L78 64 V71 Z', p.base) + FC(66, 38, 5, GOLD.light, 0.9)
  + L('M22 29 H78 V71 H22 Z', INK, 2.4)
  + C(14, 21, 4, GOLD.light, { sw: 2 }) + C(86, 21, 4, GOLD.light, { sw: 2 }) + C(14, 79, 4, GOLD.light, { sw: 2 }) + C(86, 79, 4, GOLD.light, { sw: 2 });

G.chair = (p) =>
  L('M50 72 L28 84 M50 72 L72 84 M50 72 L40 88 M50 72 L60 88', INK, 6) + L('M50 72 L28 84 M50 72 L72 84 M50 72 L40 88 M50 72 L60 88', SILVER.dark, 3)
  + C(28, 85, 3, INK, { flat: true, sw: 1 }) + C(72, 85, 3, INK, { flat: true, sw: 1 }) + C(40, 89, 3, INK, { flat: true, sw: 1 }) + C(60, 89, 3, INK, { flat: true, sw: 1 })
  + R(46, 60, 8, 14, 1, SILVER.dark, { sw: 2.4 })
  + R(31, 15, 38, 38, 9, p.base) + L('M38 24 V44 M50 22 V46 M62 24 V44', p.dark, 1.6, 0.7)
  + R(25, 52, 50, 10, 4, p.dark)
  + R(20, 44, 8, 4, 2, SILVER.base, { sw: 2 }) + R(72, 44, 8, 4, 2, SILVER.base, { sw: 2 });

G.bowl = (p) =>
  L('M38 22 C34 16 40 12 36 6 M50 22 C46 16 52 12 48 6 M62 22 C58 16 64 12 60 6', '#dfe7f2', 2.2, 0.6)
  + tube('M60 40 L84 12', '#a8743e', 2) + tube('M66 42 L90 18', '#a8743e', 2)
  + P('M15 47 H85 C85 70 70 85 50 85 C30 85 15 70 15 47 Z', p.base)
  + L('M22 60 H78', p.light, 2.4) + L('M26 66 L32 61 L38 66 L44 61 L50 66 L56 61 L62 66 L68 61 L74 66', p.dark, 1.8)
  + E(50, 47, 35, 8, '#f2c27a', { sw: 2.6 })
  + L('M26 47 C30 43 34 51 38 47 C42 43 46 51 50 47 C54 43 58 51 62 47', '#ffe39a', 2.2)
  + C(38, 46, 6, '#fff', { sw: 2 }) + FC(38, 46, 3, '#ffb23e');

G.creditcard = (p) =>
  rot(-12, 54, 44, R(24, 26, 60, 38, 5, p.dark))
  + R(15, 38, 62, 40, 5, p.base, { metal: true })
  + R(15, 46, 62, 7, 0, INK, { flat: true, sw: 0.1, noStroke: true })
  + R(22, 57, 13, 10, 2, GOLD.base, { metal: true, sw: 2 })
  + L('M24 62 H33 M28.5 57 V67', GOLD.dark, 1.2)
  + L('M42 64 H48 M51 64 H57 M60 64 H66', '#fff', 2.4, 0.85)
  + L('M15 38 H77', INK, 0.1)
  + glint(28, 42, 6, 1.6, 0.45, 0);

G.receipt = (p) =>
  P('M27 11 H73 V82 L67 88 L61 82 L55 88 L49 82 L43 88 L37 82 L31 88 L27 82 Z', '#fbf8f0')
  + L('M33 21 H67 M33 28 H58 M33 35 H63 M33 42 H55 M33 49 H61', '#8b8f9a', 1.8)
  + L('M33 60 H67', INK, 1.4) + R(33, 64, 34, 8, 1, p.base, { sw: 1.8 })
  + C(72, 76, 9, GOLD.base, { metal: true, sw: 2.2 });

G.servicebell = (p) =>
  L('M28 24 L22 18 M72 24 L78 18 M50 18 V10', p.light, 2.4)
  + R(16, 67, 68, 11, 3, '#5a3a2a')
  + P('M23 67 C23 44 35 32 50 32 C65 32 77 44 77 67 Z', GOLD.base, { metal: true })
  + R(46, 25, 8, 8, 1.5, SILVER.dark, { sw: 2 }) + E(50, 24, 7, 3, SILVER.base, { sw: 2 })
  + glint(37, 46, 4, 9, 0.5, 20);

G.ring = (p) =>
  ring(50, 64, 20, GOLD.base, 6.4)
  + `<circle cx="50" cy="64" r="20" fill="none" stroke="${GOLD.light}" stroke-width="2" stroke-dasharray="20 120" stroke-dashoffset="-70"/>`
  + P('M41 43 L50 50 L59 43 Z', GOLD.base, { sw: 2.2 })
  + P('M36 33 L43 24 H57 L64 33 L50 48 Z', p.light)
  + L('M36 33 H64 M43 24 L47 33 L50 48 L53 33 L57 24', INK, 1.6)
  + sparkle(66, 22, 5) + sparkle(30, 28, 3, '#fff', 0.8);

G.radio = (p) =>
  tube('M66 34 L80 12', SILVER.dark, 1.8) + C(80, 11, 3, SILVER.base, { sw: 1.8 })
  + R(17, 33, 66, 48, 6, '#8a5636')
  + C(37, 57, 14, '#3a2a20', { sw: 2.4 })
  + `<circle cx="37" cy="57" r="10" fill="none" stroke="#6a4632" stroke-width="1.6"/><circle cx="37" cy="57" r="5" fill="none" stroke="#6a4632" stroke-width="1.6"/>`
  + R(55, 42, 22, 11, 2, BONE, { sw: 2 })
  + L('M58 47 H74', '#9c8a62', 1.2) + L('M64 43 V52', RED, 1.6)
  + C(60, 68, 4.4, GOLD.base, { sw: 2 }) + C(72, 68, 4.4, p.base, { sw: 2 })
  + glint(26, 38, 6, 1.6, 0.4, 0);

G.shell = (p) => {
  let ribs = '';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.08 + (0.84 * i) / 6);
    ribs += `M50 82 L${f1(50 + Math.cos(a) * 36)} ${f1(52 + Math.sin(a) * 36)} `;
  }
  return P('M50 84 L17 49 C17 27 33 16 50 16 C67 16 83 27 83 49 Z', p.light)
    + L(ribs, p.dark, 1.8, 0.8)
    + P('M39 84 H61 L57 76 H43 Z', p.base, { sw: 2.4 })
    + glint(38, 30, 7, 2.6, 0.5, -20);
};

G.cabinet = (p) =>
  R(25, 12, 50, 76, 3, SILVER.base, { metal: true })
  + [16, 40, 64].map((y) => R(29, y, 42, 20, 2, SILVER.dark, { metal: true, sw: 2.2 })
    + R(40, y + 4, 20, 6, 1, PAPER, { sw: 1.6 }) + R(43, y + 12, 14, 4, 2, p.base, { sw: 1.6 })).join('');

G.paper = (p) =>
  rot(-12, 46, 50, R(22, 22, 44, 56, 2, '#e8e2d2'))
  + P('M32 18 H66 L76 28 V82 H32 Z', '#fffdf6')
  + P('M66 18 V28 H76 Z', '#d9d2bf', { sw: 2 })
  + L('M38 34 H62 M38 41 H68 M38 48 H66 M38 55 H60', '#8b8f9a', 1.8)
  + L('M38 66 C44 60 48 72 54 64 C58 60 62 68 68 64', p.base, 2.4);

G.envelope = (p) =>
  R(15, 30, 70, 47, 3, '#f4ead2')
  + L('M15 77 L42 54 M85 77 L58 54', '#c9b07a', 2)
  + P('M15 30 L50 57 L85 30 Z', '#e8dcbf', { sw: 2.6 })
  + C(50, 57, 8.5, p.base, { sw: 2.4 }) + P(starPath(5, 5, 2, 50, 57), p.light, { flat: true, sw: 1 });

G.stone = (p) =>
  `<ellipse cx="52" cy="72" rx="30" ry="7" fill="none" stroke="${p.light}" stroke-width="2" opacity=".6"/>`
  + `<ellipse cx="52" cy="72" rx="18" ry="4" fill="none" stroke="${p.light}" stroke-width="2" opacity=".8"/>`
  + `<path d="M16 50 Q30 30 46 44" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 5" opacity=".6"/>`
  + solid('ellipse', 'cx="56" cy="46" rx="22" ry="12" transform="rotate(-14 56 46)"', '#9aa6b8')
  + FC(48, 44, 2, '#6f7b8e') + FC(60, 50, 2.6, '#6f7b8e') + FC(66, 42, 1.6, '#6f7b8e')
  + glint(48, 40, 7, 2.4, 0.5, -14);

G.wave = (p) =>
  P('M12 74 C22 42 46 24 70 30 C84 34 90 50 82 58 C76 48 64 46 58 54 C68 54 72 64 64 68 C52 74 30 76 12 74 Z', p.base)
  + F('M58 54 C64 46 76 48 82 58 C74 54 66 54 58 54 Z', '#fff', 0.85)
  + L('M22 66 C34 46 50 36 66 38', p.light, 2.4, 0.8)
  + FC(84, 28, 3, p.light) + FC(78, 20, 2.2, p.light) + FC(88, 40, 1.8, p.light)
  + L('M10 84 Q20 80 30 84 T50 84 T70 84 T90 84', p.light, 2.4, 0.7);

G.horseshoe = (p) =>
  tube('M29 24 V54 C29 75 71 75 71 54 V24', GOLD.base, 11)
  + L('M29 24 V54 C29 75 71 75 71 54 V24', GOLD.light, 2.4, 0.7)
  + FC(29, 34, 1.8, GOLD.deep) + FC(29, 46, 1.8, GOLD.deep) + FC(33, 60, 1.8, GOLD.deep)
  + FC(71, 34, 1.8, GOLD.deep) + FC(71, 46, 1.8, GOLD.deep) + FC(67, 60, 1.8, GOLD.deep)
  + sparkle(50, 30, 6, p.light) + sparkle(16, 72, 3.4, '#fff') + sparkle(84, 72, 3.4, '#fff');

G.pickaxe = () =>
  rot(40, 50, 50, R(46, 22, 8, 66, 3, '#a8743e'))
  + P('M15 36 C33 17 67 17 85 36 C67 29 33 29 15 36 Z', SILVER.base, { metal: true })
  + R(43, 26, 14, 10, 2, SILVER.dark, { sw: 2.2 })
  + P('M64 72 L72 66 L80 70 L82 78 L74 84 L66 80 Z', GOLD.base, { metal: true, sw: 2.2 })
  + sparkle(84, 64, 3.6, '#fff');

G.stub = (p) =>
  L('M50 22 C46 16 52 12 48 6', '#9aa6b8', 2, 0.5)
  + E(50, 80, 27, 6.5, p.light, { sw: 2.6 })
  + P('M37 58 Q37 55 40 55 H60 Q63 55 63 58 V80 H37 Z', p.base)
  + F('M42 55 V64 Q42 68 45 68 Q48 68 48 64 V55 Z', p.light) + F('M56 55 V61 Q56 64 58 64 Q60 64 60 61 V55 Z', p.light)
  + L('M37 58 Q37 55 40 55 H60 Q63 55 63 58', INK, 3)
  + L('M50 55 V48', INK, 2.4)
  + P('M50 34 C54 39 55 43 53 46 C52 48 48 48 47 46 C45 43 46 39 50 34 Z', '#ff8a3d', { sw: 2 })
  + FC(50, 44, 2, '#fff4c4');

G.anchor = (p) =>
  ring(50, 17, 6, SILVER.base, 4)
  + tube('M24 60 C26 76 40 84 50 84 C60 84 74 76 76 60', SILVER.base, 6)
  + P('M18 62 L24 52 L30 62 Z', SILVER.base, { sw: 2.4 }) + P('M70 62 L76 52 L82 62 Z', SILVER.base, { sw: 2.4 })
  + R(46, 23, 8, 58, 2, SILVER.base, { metal: true })
  + R(32, 31, 36, 7, 3, SILVER.base, { metal: true })
  + tube('M46 46 C58 50 58 58 46 62', p.base, 2.4);

G.gears = (p) =>
  P(gearPath(40, 44, 10, 24, 18), SILVER.base, { metal: true })
  + C(40, 44, 7, p.deep, { flat: true, sw: 2.4 })
  + P(gearPath(68, 68, 8, 16, 11.5), p.base, { metal: true })
  + C(68, 68, 4.6, p.deep, { flat: true, sw: 2.2 })
  + glint(32, 36, 5, 2, 0.5);

G.void = (p) =>
  FC(50, 50, 38, p.glow, 0.18)
  + `<ellipse cx="50" cy="50" rx="38" ry="12" fill="none" stroke="${p.base}" stroke-width="7" opacity=".85" transform="rotate(-20 50 50)"/>`
  + `<ellipse cx="50" cy="50" rx="38" ry="12" fill="none" stroke="#fff" stroke-width="1.6" opacity=".6" transform="rotate(-20 50 50)"/>`
  + C(50, 50, 15, '#000', { flat: true, sw: 2.6 })
  + `<circle cx="50" cy="50" r="18" fill="none" stroke="${p.light}" stroke-width="2" opacity=".7"/>`
  + `<path d="M14 62 A38 12 -20 0 0 86 38" fill="none" stroke="${p.light}" stroke-width="4" opacity=".9" transform="rotate(0)"/>`
  + sparkle(22, 24, 3) + sparkle(80, 78, 2.6);

G.magnifier = (p) =>
  tube('M58 58 L80 80', '#5a3a2a', 9)
  + C(42, 42, 22, p.light, { op: 0.45, flat: true, noStroke: true })
  + ring(42, 42, 22, SILVER.base, 6)
  + glint(34, 33, 7, 3, 0.7)
  + L('M30 48 L38 40 L44 46 L54 34', p.dark, 2.4, 0.8);

G.press = (p) =>
  R(17, 74, 66, 11, 2, '#5a3a2a')
  + R(23, 20, 9, 56, 2, '#7a5236') + R(68, 20, 9, 56, 2, '#7a5236')
  + R(19, 15, 62, 10, 2, '#7a5236')
  + R(45.5, 25, 9, 24, 1, SILVER.base, { metal: true }) + L('M46 30 H54 M46 35 H54 M46 40 H54 M46 45 H54', SILVER.dark, 1.2)
  + tube('M30 30 H70', SILVER.dark, 3) + C(29, 30, 3.6, RED, { sw: 2 }) + C(71, 30, 3.6, RED, { sw: 2 })
  + R(33, 49, 34, 8, 2, SILVER.dark, { metal: true })
  + R(32, 62, 36, 11, 1, '#fff')
  + R(37, 64.5, 5, 6, 1, p.base, { flat: true, sw: 1 }) + R(45, 64.5, 5, 6, 1, RED, { flat: true, sw: 1 }) + R(53, 64.5, 5, 6, 1, p.base, { flat: true, sw: 1 }) + R(61, 64.5, 3, 6, 1, RED, { flat: true, sw: 1 });

G.speech = (p) =>
  P('M50 17 C72 17 86 29 86 46 C86 62 72 72 52 72 L33 87 L36 70 C22 66 14 56 14 46 C14 29 28 17 50 17 Z', '#fff')
  + FC(35, 45, 5, p.base) + FC(50, 45, 5, p.base) + FC(65, 45, 5, p.base)
  + glint(30, 28, 8, 2.6, 0.6, -14);

G.type = (p) => {
  const block = (x, y, ch, c) =>
    P(`M${x} ${y + 6} L${x + 6} ${y} H${x + 26} V${y + 22} L${x + 20} ${y + 28} H${x} Z`, '#a8743e', { sw: 2.4 })
    + R(x, y + 6, 20, 22, 1, '#c98f52', { sw: 2.4 })
    + T(x + 10, y + 17, ch, 16, c, { serif: true });
  return block(16, 52, 'K', p.base) + block(42, 40, 'e', p.dark) + block(60, 58, 'r', p.base);
};

G.prism = (p) =>
  L('M8 54 L40 47', '#fff', 3.4)
  + ['#ff5468', '#ff9f43', '#ffd84a', '#45e08d', '#40d9ff', '#a27bff'].map((c, i) => L(`M60 50 L92 ${36 + i * 6}`, c, 3.4)).join('')
  + P('M50 17 L81 76 H19 Z', '#e4f4ff', { op: 0.85 })
  + F('M50 17 L58 76 H19 Z', '#fff', 0.35)
  + L('M50 17 L81 76 H19 Z', INK, 3)
  + FC(50, 54, 12, p.glow, 0.25);

G.inkpot = (p) =>
  P('M64 4 C56 10 50 22 48 34 L50 36 C56 26 62 14 64 4 Z', '#f6f0e4', { sw: 2.2 })
  + P('M30 45 C25 53 25 71 31 81 C37 87 63 87 69 81 C75 71 75 53 70 45 Z', '#2b3346')
  + F('M30 58 C40 55 60 61 71 57 C73 68 72 76 69 81 C63 87 37 87 31 81 C28 76 27 66 30 58 Z', p.deep)
  + R(39, 34, 22, 12, 3, '#3a4258', { sw: 2.6 })
  + R(37, 60, 26, 13, 2, PAPER, { sw: 2 }) + L('M41 65 H59 M41 69 H54', '#9c8a62', 1.4)
  + F('M58 45 C60 51 61 54 59 56 C57 57 55 55 56 52 Z', p.base)
  + glint(34, 52, 2.6, 8, 0.4);

G.factory = (p) =>
  FC(70, 14, 5, '#9aa6b8', 0.6) + FC(78, 8, 6.5, '#9aa6b8', 0.5) + FC(60, 12, 4, '#9aa6b8', 0.4)
  + R(64, 16, 11, 44, 1, '#8a5636', { sw: 2.6 })
  + L('M64 26 H75 M64 34 H75', '#6a3f22', 1.6)
  + P('M15 86 V50 L31 60 V50 L47 60 V50 L63 60 V40 H83 V86 Z', p.dark)
  + [22, 38, 54].map((x) => R(x, 66, 9, 9, 1, GOLD.light, { sw: 1.8 })).join('')
  + R(67, 50, 10, 10, 1, GOLD.light, { sw: 1.8 }) + R(67, 66, 10, 20, 1, '#3a2a20', { sw: 1.8 });

G.layers = (p) =>
  rot(-14, 50, 50, R(20, 24, 56, 42, 3, p.dark))
  + rot(-4, 50, 50, R(22, 28, 56, 42, 3, p.base))
  + rot(6, 50, 50, R(24, 32, 56, 42, 3, '#fffdf6')
    + R(36, 42, 10, 22, 1.5, '#40d9ff', { flat: true, noStroke: true, op: 0.8 })
    + R(39, 45, 10, 22, 1.5, '#ff5cf0', { flat: true, noStroke: true, op: 0.7 })
    + L('M41.5 36 V70', INK, 1.6)
    + L('M56 46 H72 M56 52 H70 M56 58 H72', '#8b8f9a', 1.6));

G.scissors = (p) =>
  `<path d="M12 50 H34" stroke="#fff" stroke-width="2" stroke-dasharray="3 4" opacity=".6"/>`
  + P('M40 50 L86 26 L88 32 L48 52 Z', SILVER.base, { metal: true })
  + P('M40 50 L86 74 L88 68 L48 48 Z', SILVER.light, { metal: true })
  + ring(28, 36, 9, p.base, 5) + ring(28, 64, 9, p.base, 5)
  + tube('M35 41 L44 48 M35 59 L44 52', p.base, 3)
  + C(46, 50, 3.6, GOLD.base, { sw: 2 });

G.numbers = (p) =>
  R(18, 62, 64, 22, 3, '#fffdf6')
  + T(50, 73.5, '0042', 15, p.base, { serif: true })
  + R(43, 10, 14, 16, 7, '#8a5636')
  + R(46, 24, 8, 10, 1, '#6a3f22', { sw: 2.4 })
  + R(25, 33, 50, 16, 3, p.dark, { metal: true })
  + L('M30 49 V54 M38 49 V54 M46 49 V54 M54 49 V54 M62 49 V54 M70 49 V54', INK, 2);

// --- batch: charts and rumors --------------------------------------------------------
G.dagger = (p) =>
  P('M50 7 L57 21 V57 H43 V21 Z', SILVER.base, { metal: true })
  + L('M50 14 V55', SILVER.dark, 1.6)
  + R(29, 57, 42, 7, 3, GOLD.base, { metal: true })
  + C(50, 60.5, 3.6, p.base, { sw: 1.8 })
  + R(45, 64, 10, 17, 2, '#5a3a2a') + L('M45 68 H55 M45 72 H55 M45 76 H55', '#8a5d42', 1.4)
  + C(50, 85, 5.4, p.base, { sw: 2.4 })
  + glint(47, 30, 1.6, 9, 0.6, 0);

G.slots = (p) =>
  tube('M74 47 H82 V23', SILVER.dark, 3) + C(82, 20, 5.4, RED, { sw: 2.4 })
  + P('M18 34 C18 22 74 22 74 34 Z', p.dark, { sw: 2.6 })
  + R(18, 32, 56, 54, 5, p.base, { metal: true })
  + R(23, 40, 46, 24, 3, '#fff', { sw: 2.4 })
  + L('M38.3 40 V64 M53.6 40 V64', '#c9d2e0', 1.6)
  + T(30.7, 52, '7', 15, RED, { serif: true }) + T(46, 52, '7', 15, RED, { serif: true }) + T(61.3, 52, '7', 15, RED, { serif: true })
  + R(27, 71, 38, 8, 2, INK, { flat: true, sw: 1 }) + FC(40, 75, 2.4, GOLD.base) + FC(50, 75, 2.4, GOLD.base);

G.house = (p) =>
  R(63, 21, 9, 18, 1, '#8a5636', { sw: 2.4 })
  + R(22, 44, 56, 41, 2, '#f0e2c2')
  + P('M13 47 L50 17 L87 47 Z', p.base)
  + R(43.5, 61, 13, 24, 2, '#8a5636', { sw: 2.4 }) + FC(53, 73, 1.6, GOLD.base)
  + R(27, 53, 12, 11, 1, GOLD.light, { sw: 2.2 }) + R(61, 53, 12, 11, 1, GOLD.light, { sw: 2.2 })
  + L('M33 53 V64 M27 58.5 H39 M67 53 V64 M61 58.5 H73', '#c49a3a', 1.4);

G.shield = (p) =>
  P('M21 17 H79 V46 C79 68 65 80 50 89 C35 80 21 68 21 46 Z', p.base, { metal: true })
  + F('M21 17 H50 V89 C35 80 21 68 21 46 Z', p.dark, 0.45)
  + L('M50 17 V89 M21 46 H79', GOLD.base, 4)
  + C(50, 46, 9, GOLD.base, { metal: true, sw: 2.4 })
  + glint(32, 26, 6, 2.4, 0.5, -10);

G.tomb = (p) =>
  E(50, 84, 32, 6, '#3e5a3a', { sw: 2.4 })
  + P('M28 84 V41 C28 24 72 24 72 41 V84 Z', '#8e98a8')
  + `<path d="M31 41 C31 28 69 28 69 41" fill="none" stroke="#b5bdcb" stroke-width="2"/>`
  + T(50, 48, 'R.I.P', 9.5, '#4a5266', { serif: true })
  + L('M58 56 L62 64 L57 70', '#5f6879', 1.6)
  + L('M24 84 L26 77 L28 84 M70 84 L73 76 L75 84', '#5aa54a', 2.2)
  + FC(50, 22, 7, p.glow, 0.45);

G.lighthouse = (p) =>
  F('M50 26 L92 12 L92 36 Z', p.glow, 0.35) + F('M50 26 L8 12 L8 36 Z', p.glow, 0.35)
  + E(50, 86, 26, 5, '#596273', { sw: 2.4 })
  + P('M38 85 L42 34 H58 L62 85 Z', '#fff')
  + F('M41.2 44 H58.8 L59.6 54 H40.4 Z M39.6 64 H60.4 L61.2 74 H38.8 Z', RED)
  + L('M38 85 L42 34 H58 L62 85', INK, 3)
  + R(40, 22, 20, 13, 2, GOLD.light, { sw: 2.4 }) + FC(50, 28, 5, '#fff', 0.8)
  + P('M37 22 L50 11 L63 22 Z', RED, { sw: 2.4 })
  + R(44, 74, 12, 11, 4, '#3a4258', { sw: 2 });

G.door = (p) =>
  F('M32 86 L68 86 L86 97 L14 97 Z', '#fff6c9', 0.35)
  + R(27, 13, 46, 74, 2, '#7a5236')
  + R(32, 18, 36, 68, 0, '#fff6c9', { flat: true, sw: 2 })
  + FC(50, 50, 18, p.glow, 0.35)
  + P('M32 18 L52 25 V80 L32 86 Z', '#a8683f', { sw: 2.6 })
  + L('M36 28 L48 32 V48 L36 45 Z M36 54 L48 56 V72 L36 74 Z', '#8a5636', 1.6)
  + C(47, 54, 2.4, GOLD.base, { sw: 1.4 });

G.bank = (p) =>
  R(12, 84, 76, 6, 1, '#cfc7b4', { sw: 2.4 }) + R(16, 78, 68, 6, 1, '#e8e2d2', { sw: 2.4 })
  + [22, 37, 54, 69].map((x) => R(x, 41, 9, 37, 1, '#f4efe2', { sw: 2.4 }) + L(`M${x + 3} 44 V75 M${x + 6} 44 V75`, '#cfc7b4', 1.2)).join('')
  + R(18, 35, 64, 7, 1, '#e8e2d2', { sw: 2.4 })
  + P('M14 36 L50 14 L86 36 Z', '#f4efe2')
  + C(50, 27, 6, GOLD.base, { metal: true, sw: 2 }) + T(50, 27.5, '$', 7, GOLD.deep)
  + FC(50, 60, 10, p.glow, 0.25);

G.moonrise = (p) =>
  L('M12 66 H88', p.light, 3)
  + F('M12 66 H88 V80 H12 Z', p.deep, 0.6)
  + P('M26 66 A24 24 0 0 1 74 66 Z', '#f3efe0')
  + FC(42, 54, 3.4, '#d6cdb2') + FC(58, 58, 4, '#d6cdb2')
  + L('M20 74 H36 M44 74 H58 M64 74 H80', p.light, 2, 0.6) + L('M30 80 H46 M54 80 H70', p.light, 2, 0.4)
  + sparkle(22, 28, 4) + sparkle(78, 22, 3.4) + sparkle(64, 34, 2.4, '#fff', 0.7);

G.waxing = (p) =>
  FC(50, 50, 36, p.glow, 0.14)
  + C(50, 50, 30, '#3a4258')
  + F('M50 20 A30 30 0 0 1 50 80 A16 30 0 0 1 50 20 Z', '#f3efe0')
  + FC(60, 40, 3.6, '#d6cdb2') + FC(66, 62, 4, '#d6cdb2')
  + `<circle cx="50" cy="50" r="30" fill="none" stroke="${INK}" stroke-width="3"/>`
  + sparkle(84, 20, 3.4);

G.waning = (p) =>
  FC(50, 50, 36, p.glow, 0.14)
  + C(50, 50, 30, '#3a4258')
  + F('M50 20 A30 30 0 0 0 50 80 A16 30 0 0 0 50 20 Z', '#f3efe0')
  + FC(40, 40, 3.6, '#d6cdb2') + FC(34, 62, 4, '#d6cdb2')
  + `<circle cx="50" cy="50" r="30" fill="none" stroke="${INK}" stroke-width="3"/>`
  + sparkle(16, 20, 3.4);

G.upcandle = (p) =>
  FC(44, 52, 30, GREEN, 0.14)
  + L('M42 12 V88', INK, 3)
  + R(30, 30, 24, 44, 3, GREEN)
  + glint(36, 40, 2, 9, 0.6, 0)
  + tube('M72 76 V30', p.light, 5) + P('M63 34 L72 16 L81 34 Z', p.light, { sw: 2.6 });

G.downcandle = (p) =>
  FC(44, 48, 30, RED, 0.14)
  + L('M42 12 V88', INK, 3)
  + R(30, 26, 24, 44, 3, RED)
  + glint(36, 36, 2, 9, 0.6, 0)
  + tube('M72 24 V70', p.light, 5) + P('M63 66 L72 84 L81 66 Z', p.light, { sw: 2.6 });

G.pyre = (p) =>
  FC(50, 52, 30, 'url(#mcFlame)')
  + P('M50 14 C60 26 72 36 70 54 C68 66 60 72 50 72 C40 72 32 66 30 54 C29 44 36 38 40 30 C42 40 45 44 48 44 C45 34 46 24 50 14 Z', '#ff7a2e')
  + P('M50 36 C56 44 62 50 60 60 C58 68 54 70 50 70 C46 70 42 68 40 60 C39 54 43 50 46 46 C47 52 48 54 50 54 C49 48 48 42 50 36 Z', '#ffc23d', { sw: 2.2 })
  + rot(-18, 50, 76, R(20, 71, 60, 9, 4.5, '#7a4b27'))
  + rot(18, 50, 76, R(20, 71, 60, 9, 4.5, '#8a5636'))
  + FC(26, 72, 2.4, '#c98f52') + FC(74, 72, 2.4, '#c98f52');

G.stitch = (p) =>
  rot(-8, 36, 50, R(18, 26, 30, 48, 4, p.base))
  + rot(8, 64, 50, R(52, 26, 30, 48, 4, p.light))
  + L('M44 30 L56 36 M56 30 L44 36 M44 42 L56 48 M56 42 L44 48 M44 54 L56 60 M56 54 L44 60 M44 66 L56 72 M56 66 L44 72', INK, 4.4)
  + L('M44 30 L56 36 M56 30 L44 36 M44 42 L56 48 M56 42 L44 48 M44 54 L56 60 M56 54 L44 60 M44 66 L56 72 M56 66 L44 72', '#f2e8d2', 2);

G.gift = (p) =>
  R(20, 46, 60, 38, 3, p.base)
  + R(16, 36, 68, 12, 3, p.light)
  + R(45, 36, 10, 48, 1, GOLD.base, { metal: true, sw: 2.4 })
  + P('M50 36 C40 22 26 24 30 32 C33 38 44 37 50 36 Z', GOLD.base, { metal: true, sw: 2.4 })
  + P('M50 36 C60 22 74 24 70 32 C67 38 56 37 50 36 Z', GOLD.base, { metal: true, sw: 2.4 })
  + C(50, 36, 4.4, GOLD.dark, { sw: 2 })
  + sparkle(80, 20, 4.4) + sparkle(18, 24, 3);

G.sparkles = (p) =>
  FC(46, 52, 32, p.glow, 0.18)
  + P(starPath(4, 26, 7, 44, 54), p.light, { sw: 2.6 })
  + P(starPath(4, 14, 4, 72, 26), '#fff', { sw: 2.2 })
  + P(starPath(4, 10, 3, 76, 74), GOLD.light, { sw: 2 })
  + FC(44, 54, 4, '#fff', 0.9);

G.sunrise = (p) =>
  FC(50, 64, 34, p.glow, 0.2)
  + around(9, 36, 50, 64, -180).filter(([, y]) => y < 62).map(([x, y]) => L(`M${f1(50 + (x - 50) * 0.75)} ${f1(64 + (y - 64) * 0.75)} L${f1(x)} ${f1(y)}`, GOLD.light, 3.4)).join('')
  + P('M26 64 A24 24 0 0 1 74 64 Z', '#ffd84a')
  + L('M10 64 H90', p.light, 3)
  + L('M20 72 H40 M48 72 H66 M72 72 H84 M30 80 H52 M58 80 H74', p.light, 2.2, 0.7);

G.mountain = (p) =>
  P('M8 84 L36 34 L50 54 L64 26 L92 84 Z', p.dark)
  + F('M36 34 L44 48 L40 46 L34 52 L30 44 Z M64 26 L72 42 L66 40 L60 46 L58 36 Z', '#fff', 0.9)
  + L('M8 84 L36 34 L50 54 L64 26 L92 84', INK, 3)
  + tube('M64 26 V10', '#8a6a44', 1.6) + P('M64 10 L76 14 L64 18 Z', p.light, { sw: 2 })
  + L('M18 76 L30 68 L38 72 L50 62', GREEN, 2.6, 0.9);

G.temple = (p) =>
  R(14, 84, 72, 5, 1, '#cfc7b4', { sw: 2.2 })
  + [20, 33, 46, 59, 72].map((x) => R(x, 44, 8, 40, 1, '#f4efe2', { sw: 2.2 })).join('')
  + R(16, 39, 68, 6, 1, '#e8e2d2', { sw: 2.2 })
  + P('M24 39 C24 18 76 18 76 39 Z', '#e8e2d2')
  + C(50, 30, 8, GOLD.base, { metal: true, sw: 2.2 }) + R(48, 25, 4, 10, 1, GOLD.dark, { flat: true, sw: 1 })
  + FC(50, 62, 12, p.glow, 0.25);

G.rune = (p) =>
  FC(50, 50, 30, p.glow, 0.18)
  + P('M26 18 L70 14 L78 50 L72 86 L30 84 L22 50 Z', '#7d8798')
  + F('M30 22 L66 19 L72 48 L66 80 L34 79 L28 50 Z', '#959fb0', 0.6)
  + L('M44 28 V72 M44 36 L58 46 M44 50 L58 60 M58 46 V36', INK, 5.4)
  + L('M44 28 V72 M44 36 L58 46 M44 50 L58 60 M58 46 V36', p.glow, 3)
  + FC(44, 28, 3, '#fff', 0.8);

G.parachute = (p) =>
  P('M14 44 C14 22 32 12 50 12 C68 12 86 22 86 44 C80 40 74 40 68 44 C62 40 56 40 50 44 C44 40 38 40 32 44 C26 40 20 40 14 44 Z', GOLD.base, { metal: true })
  + F('M32 44 C34 26 42 14 50 12 C44 22 40 32 38 42 Z M62 42 C60 32 56 22 50 12 C58 14 66 26 68 44 Z', p.base, 0.8)
  + L('M14 44 C14 22 32 12 50 12 C68 12 86 22 86 44', INK, 3)
  + L('M14 44 L44 72 M32 44 L46 72 M50 44 V72 M68 44 L54 72 M86 44 L56 72', '#dfe7f2', 1.4)
  + R(40, 70, 20, 16, 3, '#8a5636', { sw: 2.4 }) + R(46, 66, 8, 5, 2, '#6a3f22', { sw: 1.8 })
  + T(50, 78.5, '$', 9, GOLD.light);

G.swords = (p) => {
  const sword = (a) => rot(a, 50, 50,
    P('M47 10 L50 4 L53 10 V60 H47 Z', SILVER.base, { metal: true })
    + R(38, 60, 24, 5, 2, GOLD.base, { metal: true, sw: 2.2 })
    + R(46.5, 65, 7, 15, 2, '#5a3a2a', { sw: 2.2 }) + C(50, 83, 4, p.base, { sw: 2 }));
  return sword(-40) + sword(40) + sparkle(50, 30, 5, '#fff');
};

G.crack = (p) =>
  R(16, 30, 68, 50, 4, '#8e98a8')
  + L('M16 46 H84 M16 62 H84 M38 30 V46 M62 46 V62 M30 62 V80 M70 62 V80', '#6f7b8e', 1.6)
  + F('M48 30 L44 44 L52 50 L42 62 L50 70 L46 80 L56 80 L58 70 L52 62 L62 50 L54 44 L58 30 Z', p.deep)
  + L('M48 30 L44 44 L52 50 L42 62 L50 70 L46 80 M58 30 L54 44 L62 50 L52 62 L58 70 L56 80', INK, 2)
  + FC(50, 54, 10, p.glow, 0.35)
  + P('M66 18 L72 12 L76 20 L70 24 Z', '#8e98a8', { sw: 2 }) + P('M26 20 L30 14 L34 22 Z', '#8e98a8', { sw: 2 });

G.eclipse = (p) =>
  FC(50, 50, 38, p.glow, 0.22)
  + `<circle cx="50" cy="50" r="27" fill="none" stroke="#fff6c9" stroke-width="5"/>`
  + `<circle cx="50" cy="50" r="27" fill="none" stroke="${GOLD.light}" stroke-width="2" stroke-dasharray="4 6"/>`
  + C(50, 50, 24, '#0e1220', { flat: true, sw: 2.6 })
  + FC(66, 34, 5, '#fff', 0.9)
  + sparkle(18, 22, 3.4) + sparkle(84, 80, 3);

G.droplet = (p) =>
  P('M44 14 C51 31 64 43 64 58 C64 71 55 80 44 80 C33 80 24 71 24 58 C24 43 37 31 44 14 Z', p.base)
  + glint(36, 54, 3.6, 9, 0.6, 10)
  + P('M72 44 C75 51 80 55 80 61 C80 66 76 69 72 69 C68 69 64 66 64 61 C64 55 69 51 72 44 Z', p.light, { sw: 2.4 })
  + L('M14 88 Q30 84 44 88 T74 88', p.light, 2.2, 0.6);

G.altar = (p) =>
  R(18, 62, 64, 24, 3, '#8e98a8')
  + R(14, 56, 72, 8, 2, '#a8b1c0')
  + L('M24 70 H76 M24 78 H76', '#6f7b8e', 1.4)
  + R(25, 40, 8, 16, 1.5, BONE, { sw: 2 }) + R(67, 40, 8, 16, 1.5, BONE, { sw: 2 })
  + P('M29 28 C32 32 33 35 31 38 C30 39 28 39 27 38 C25 35 26 32 29 28 Z', '#ffad3b', { sw: 1.6 })
  + P('M71 28 C74 32 75 35 73 38 C72 39 70 39 69 38 C67 35 68 32 71 28 Z', '#ffad3b', { sw: 1.6 })
  + P('M38 34 H62 L50 54 Z', p.base, { sw: 2.6 })
  + FC(50, 40, 12, p.glow, 0.3);

G.tower = (p) =>
  R(30, 16, 40, 72, 2, p.dark)
  + R(36, 8, 28, 10, 1, p.base, { sw: 2.4 })
  + tube('M50 8 V2', SILVER.base, 1.4)
  + Array.from({ length: 7 }, (_, r) => [37, 47, 57].map((x) => R(x, 22 + r * 9, 6, 6, 0.8, (r + x) % 3 ? GOLD.light : p.light, { flat: true, sw: 1.2 })).join('')).join('')
  + R(14, 50, 16, 38, 1, p.base, { sw: 2.4 }) + R(70, 40, 16, 48, 1, p.base, { sw: 2.4 })
  + L('M18 58 H26 M18 66 H26 M18 74 H26 M74 50 H82 M74 58 H82 M74 66 H82 M74 74 H82', GOLD.light, 2.4);

// --- batch: licences, bosses, packs, bonuses ----------------------------------------
G.tag = (p) =>
  tube('M30 22 C20 14 12 22 20 30', '#c9a46a', 1.6)
  + P('M26 18 H58 L84 44 L54 74 L28 48 Z', p.base, { metal: true })
  + C(36, 28, 4.4, p.deep, { flat: true, sw: 2.2 })
  + T(58, 46, '%', 22, '#fff', { stroke: INK, sw: 1.6 })
  + glint(40, 22, 6, 1.8, 0.5, 45);

G.antenna = (p) =>
  L('M50 26 C40 26 36 34 36 40 M50 26 C60 26 64 34 64 40', p.light, 2.6, 0.7)
  + L('M30 20 C22 26 22 40 28 46 M70 20 C78 26 78 40 72 46 M22 12 C10 22 10 44 20 54 M78 12 C90 22 90 44 80 54', p.light, 2.8)
  + L('M50 30 L32 88 M50 30 L68 88 M40 56 H60 M36 70 H64 M44 44 L58 64 M56 44 L42 64', INK, 5)
  + L('M50 30 L32 88 M50 30 L68 88 M40 56 H60 M36 70 H64 M44 44 L58 64 M56 44 L42 64', SILVER.base, 2.4)
  + C(50, 28, 5.4, RED, { sw: 2.4 });

G.satellite = (p) =>
  rot(-30, 50, 50,
    R(10, 42, 26, 16, 1.5, p.base, { metal: true, sw: 2.4 }) + R(64, 42, 26, 16, 1.5, p.base, { metal: true, sw: 2.4 })
    + L('M18.6 42 V58 M27.3 42 V58 M72.6 42 V58 M81.3 42 V58 M10 50 H36 M64 50 H90', p.deep, 1.2)
    + L('M36 50 H64', SILVER.dark, 3)
    + R(40, 38, 20, 24, 3, SILVER.base, { metal: true })
    + E(50, 30, 10, 5, SILVER.light, { sw: 2.2 }) + L('M50 30 V38', INK, 2))
  + L('M70 72 Q78 76 80 84 M74 64 Q86 70 88 82', p.light, 2.4, 0.8);

G.clock = (p) =>
  C(50, 50, 33, p.base, { metal: true })
  + C(50, 50, 27, '#fffdf6', { flat: true, sw: 2.4 })
  + around(12, 23, 50, 50).map(([x, y], i) => FC(f1(x), f1(y), i % 3 ? 1.4 : 2.6, INK)).join('')
  + L('M50 50 V31 M50 50 L64 58', INK, 3.4)
  + C(50, 50, 3.4, RED, { sw: 1.6 })
  + glint(36, 34, 6, 2.4, 0.5);

G.arena = (p) => {
  let s = P('M12 80 V44 C12 32 88 32 88 44 V80 Z', '#d9b380');
  for (let i = 0; i < 6; i++) s += P(`M${17 + i * 12} 80 V64 C${17 + i * 12} 58 ${25 + i * 12} 58 ${25 + i * 12} 64 V80 Z`, '#3a2a20', { flat: true, sw: 1.8 });
  for (let i = 0; i < 7; i++) s += P(`M${15 + i * 10.5} 54 V47 C${15 + i * 10.5} 43 ${21 + i * 10.5} 43 ${21 + i * 10.5} 47 V54 Z`, '#3a2a20', { flat: true, sw: 1.6 });
  return s + L('M12 56 H88 M12 44 C12 32 88 32 88 44', '#a8803e', 2)
    + tube('M50 34 V18', '#8a6a44', 1.4) + P('M50 18 L62 22 L50 26 Z', p.base, { sw: 2 });
};

G.school = (p) =>
  R(14, 46, 72, 38, 2, '#c66b4a')
  + P('M10 48 L50 28 L90 48 Z', '#8a3a2a')
  + R(40, 18, 20, 30, 1, '#d98060', { sw: 2.4 }) + P('M37 20 L50 8 L63 20 Z', '#8a3a2a', { sw: 2.4 })
  + C(50, 30, 5, '#fffdf6', { sw: 1.8 }) + L('M50 30 V27 M50 30 H53', INK, 1.4)
  + [20, 32, 60, 72].map((x) => R(x, 54, 8, 10, 1, GOLD.light, { sw: 1.8 })).join('')
  + R(44, 64, 12, 20, 1, '#5a3a2a', { sw: 2.2 })
  + FC(50, 14, 2, p.base);

G.signal = (p) =>
  [0, 1, 2, 3].map((i) => R(20 + i * 16, 70 - i * 15, 11, 16 + i * 15, 2, i < 3 ? p.base : p.light, { metal: true, sw: 2.4 })).join('')
  + L('M66 22 Q74 14 82 22 M62 16 Q74 4 86 16', p.light, 2.6, 0.85);

G.plug = (p) =>
  tube('M50 70 C50 84 30 84 26 90', '#2b3346', 3.4)
  + R(36, 40, 28, 30, 5, p.base, { metal: true })
  + R(40, 22, 6, 20, 1, SILVER.base, { metal: true, sw: 2.2 }) + R(54, 22, 6, 20, 1, SILVER.base, { metal: true, sw: 2.2 })
  + L('M42 52 H58 M42 58 H58', p.dark, 1.6)
  + P('M74 20 L66 34 H74 L68 46 L82 30 H74 L80 20 Z', '#ffd84a', { sw: 2 });

G.pie = (p) =>
  C(46, 54, 28, p.dark, { metal: true })
  + F('M46 54 L46 26 A28 28 0 0 1 72.6 62.6 Z', p.base)
  + L('M46 54 L46 26 M46 54 L72.6 62.6', INK, 2.4)
  + P('M54 46 L54 18 A28 28 0 0 1 80.6 54.6 Z', GOLD.base, { metal: true })
  + glint(36, 40, 5, 2.4, 0.5);

G.tophat = (p) =>
  E(50, 72, 36, 9, '#1f2433')
  + P('M30 72 V28 C30 20 70 20 70 28 V72 Z', '#2b3346')
  + R(30, 58, 40, 9, 0, p.base, { sw: 2.4 })
  + E(50, 28, 20, 5, '#3a4258', { sw: 2.4 })
  + glint(38, 40, 2.4, 10, 0.3, 0)
  + C(76, 84, 6, GOLD.base, { metal: true, sw: 2 }) + C(64, 88, 5, GOLD.base, { metal: true, sw: 2 });

G.key = (p) =>
  ring(32, 38, 15, GOLD.base, 7)
  + C(32, 38, 4, p.base, { sw: 1.8 })
  + R(44, 34, 42, 8, 2, GOLD.base, { metal: true })
  + R(70, 42, 6, 12, 1, GOLD.base, { metal: true, sw: 2.2 }) + R(80, 42, 6, 9, 1, GOLD.base, { metal: true, sw: 2.2 })
  + sparkle(22, 70, 4) + glint(26, 30, 4, 1.6, 0.6);

G.clipboard = (p) =>
  R(22, 18, 56, 70, 4, '#a8743e')
  + R(28, 26, 44, 56, 1, '#fffdf6', { sw: 2.2 })
  + R(38, 12, 24, 12, 3, SILVER.base, { metal: true, sw: 2.4 })
  + [36, 50, 64].map((y) => L(`M33 ${y} L37 ${y + 4} L43 ${y - 3}`, GREEN, 2.6) + L(`M48 ${y + 1} H66`, '#8b8f9a', 2)).join('')
  + C(66, 78, 6, p.base, { sw: 2 });

G.rocket = (p) =>
  P('M44 72 C42 82 46 90 50 94 C54 90 58 82 56 72 Z', '#ffad3b', { sw: 2.2 }) + F('M47 74 C47 82 49 86 50 88 C51 86 53 82 53 74 Z', '#fff4c4')
  + P('M36 56 L26 74 L40 70 Z', p.dark, { sw: 2.4 }) + P('M64 56 L74 74 L60 70 Z', p.dark, { sw: 2.4 })
  + P('M50 8 C62 20 64 40 62 70 H38 C36 40 38 20 50 8 Z', '#f2f6ff')
  + F('M50 8 C56 14 60 22 61 30 H39 C40 22 44 14 50 8 Z', p.base)
  + C(50, 44, 7, p.light, { sw: 2.4 }) + FC(48, 42, 2, '#fff', 0.8)
  + glint(43, 50, 1.6, 10, 0.4, 0);

G.monitor = (p) =>
  R(40, 70, 20, 8, 1, SILVER.dark, { sw: 2.2 }) + R(30, 78, 40, 6, 2, SILVER.base, { sw: 2.2 })
  + R(14, 18, 72, 52, 4, '#2b3346')
  + R(19, 23, 62, 42, 2, p.deep, { flat: true, sw: 2 })
  + `<rect x="19" y="23" width="62" height="42" rx="2" fill="url(#mcGrid)"/>`
  + [[28, 50, 8, false], [37, 44, 10, true], [46, 46, 7, false], [55, 36, 12, true], [64, 30, 12, true]].map(([x, y, h, b]) => stick(x, y, h, b, 5)).join('')
  + glint(26, 28, 6, 1.4, 0.4, 0);

G.joystick = (p) =>
  P('M18 66 C18 58 82 58 82 66 V78 C82 84 18 84 18 78 Z', '#2b3346')
  + E(50, 64, 32, 6, '#3a4258', { sw: 2.4 })
  + R(46.5, 30, 7, 34, 2, SILVER.base, { metal: true })
  + C(50, 26, 11, p.base) + glint(46, 22, 3.6, 1.8, 0.6)
  + C(28, 72, 4, RED, { sw: 1.8 }) + C(72, 72, 4, GREEN, { sw: 1.8 });

G.scales = (p) =>
  R(30, 82, 40, 6, 2, GOLD.dark, { metal: true, sw: 2.4 })
  + R(47, 22, 6, 62, 1, GOLD.base, { metal: true, sw: 2.4 })
  + tube('M16 32 L84 26', GOLD.base, 3)
  + L('M18 32 L10 56 M18 32 L28 56 M82 26 L74 48 M82 26 L90 48', '#dfe7f2', 1.4)
  + P('M8 56 H30 C30 64 8 64 8 56 Z', GOLD.base, { metal: true, sw: 2.2 })
  + P('M72 48 H92 C92 56 72 56 72 48 Z', GOLD.base, { metal: true, sw: 2.2 })
  + C(50, 20, 4.4, p.base, { sw: 2 });

G.barrier = () =>
  R(20, 50, 6, 36, 1, SILVER.dark, { sw: 2.4 }) + R(74, 50, 6, 36, 1, SILVER.dark, { sw: 2.4 })
  + R(10, 36, 80, 16, 2, '#fff')
  + [0, 1, 2, 3, 4].map((i) => F(`M${14 + i * 16} 36 H${22 + i * 16} L${14 + i * 16} 52 H${6 + i * 16} Z`, RED)).join('')
  + `<rect x="10" y="36" width="80" height="16" rx="2" fill="none" stroke="${INK}" stroke-width="3"/>`
  + C(18, 28, 5, '#ffad3b', { sw: 2.2 }) + C(82, 28, 5, '#ffad3b', { sw: 2.2 });

G.trap = (p) =>
  R(14, 56, 72, 28, 3, '#c98f52')
  + L('M20 66 H80 M20 74 H80', '#a8743e', 1.4)
  + tube('M24 58 V40 H76 V58', SILVER.base, 3)
  + L('M50 58 V44', SILVER.dark, 2.4)
  + P('M58 50 L78 58 L58 62 Z', '#ffd84a', { sw: 2.2 }) + FC(66, 56, 1.6, '#e0a83a') + FC(72, 58, 1.2, '#e0a83a')
  + C(36, 58, 4, SILVER.dark, { sw: 1.8 })
  + FC(50, 70, 14, p.glow, 0.15);

G.fog = (p) =>
  P('M28 52 C20 52 16 46 18 40 C20 34 28 32 32 34 C34 24 46 20 54 26 C60 20 72 22 74 32 C82 32 86 40 82 46 C80 51 74 52 70 52 Z', '#c9d2e0')
  + L('M14 62 H66 M30 70 H86 M18 78 H58 M64 78 H80', '#c9d2e0', 3.4, 0.8)
  + F('M28 44 C40 40 60 40 74 44', 'none') + L('M30 44 C40 40 58 40 72 44', '#fff', 2, 0.6)
  + FC(50, 50, 30, p.glow, 0.1);

G.cage = (p) =>
  P('M24 40 C24 18 76 18 76 40 V80 H24 Z', 'none', { flat: true, sw: 0.1 })
  + L('M24 80 V40 C24 18 76 18 76 40 V80', INK, 5) + L('M24 80 V40 C24 18 76 18 76 40 V80', GOLD.base, 2.6)
  + L('M37 80 V26 M50 80 V20 M63 80 V26', INK, 4.4) + L('M37 80 V26 M50 80 V20 M63 80 V26', GOLD.base, 2.2)
  + R(18, 78, 64, 8, 2, GOLD.dark, { metal: true, sw: 2.4 })
  + ring(50, 14, 4, GOLD.base, 2.4)
  + L('M30 56 H70', GOLD.base, 2.4)
  + FC(50, 64, 10, p.glow, 0.35) + P('M50 56 L46 64 H54 Z', RED, { sw: 1.6 });

G.boomerang = (p) =>
  P('M18 30 C30 22 44 26 54 38 C62 48 74 52 84 50 C80 60 68 66 56 62 C42 56 36 44 26 42 C20 41 16 36 18 30 Z', '#c98f52')
  + L('M24 34 C36 32 46 40 54 48 C62 54 72 56 80 54', '#8a5636', 1.6)
  + F('M20 32 L28 30 L26 36 Z M72 54 L80 52 L76 58 Z', p.base)
  + L('M64 26 C76 26 84 32 86 40', p.light, 2.4, 0.8) + P('M84 34 L88 42 L80 42 Z', p.light, { sw: 1.6 });

G.nosign = () =>
  `<circle cx="50" cy="50" r="30" fill="none" stroke="${INK}" stroke-width="14"/>`
  + `<circle cx="50" cy="50" r="30" fill="none" stroke="${RED}" stroke-width="9"/>`
  + L('M29 71 L71 29', INK, 14) + L('M29 71 L71 29', RED, 9)
  + glint(34, 30, 6, 2, 0.5);

G.siren = (p) =>
  FC(50, 46, 34, RED, 0.18)
  + L('M18 30 L28 36 M82 30 L72 36 M50 10 V18 M24 50 H14 M76 50 H86', '#ffd84a', 3)
  + R(22, 70, 56, 12, 3, '#2b3346')
  + P('M30 70 C30 38 70 38 70 70 Z', RED)
  + F('M36 70 C36 46 50 44 50 44 V70 Z', '#fff', 0.35)
  + R(44, 32, 12, 6, 2, SILVER.base, { sw: 2 });

G.hook = (p) =>
  tube('M50 10 V54 C50 72 74 72 74 56', SILVER.base, 4.4)
  + P('M74 56 L80 46 L70 50 Z', SILVER.base, { sw: 2 })
  + ring(50, 10, 4, SILVER.base, 2.6)
  + C(36, 76, 9, GOLD.base, { metal: true, sw: 2.4 }) + T(36, 76.5, '$', 10, GOLD.deep)
  + L('M50 54 C46 66 42 70 40 68', '#dfe7f2', 1.4, 0.6);

G.pause = (p) =>
  C(50, 50, 32, p.base, { metal: true })
  + R(36, 32, 10, 36, 2, '#fff', { sw: 2.4 }) + R(54, 32, 10, 36, 2, '#fff', { sw: 2.4 })
  + glint(36, 32, 6, 2.4, 0.5);

G.bricks = (p) => {
  let s = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      const x = 12 + c * 20 - (r % 2 ? 10 : 0);
      if (x < 2 || x > 74) continue;
      s += R(Math.max(12, x), 18 + r * 13, x < 12 ? 10 : (x > 64 ? 88 - x : 19), 12, 1, r % 2 === c % 2 ? '#b0503e' : '#c66b4a', { sw: 2 });
    }
  }
  return s + L('M12 16 H88', p.light, 2.4, 0.8);
};

G.alarm = (p) =>
  L('M28 82 L22 90 M72 82 L78 90', INK, 4)
  + C(30, 22, 9, GOLD.base, { metal: true, sw: 2.4 }) + C(70, 22, 9, GOLD.base, { metal: true, sw: 2.4 })
  + C(50, 54, 30, p.base, { metal: true })
  + C(50, 54, 24, '#fffdf6', { flat: true, sw: 2.4 })
  + L('M50 54 V36 M50 54 L62 60', INK, 3.2) + C(50, 54, 3, RED, { sw: 1.4 })
  + L('M14 36 L8 32 M86 36 L92 32 M16 48 H8 M84 48 H92', RED, 2.6);

G.spread = (p) =>
  R(44, 18, 12, 64, 2, p.dark, { metal: true })
  + tube('M38 50 H14', RED, 5) + P('M18 40 L6 50 L18 60 Z', RED, { sw: 2.2 })
  + tube('M62 50 H86', GREEN, 5) + P('M82 40 L94 50 L82 60 Z', GREEN, { sw: 2.2 });

G.barchart = (p) =>
  L('M14 84 H86 M18 84 V16', INK, 3)
  + [[24, 60], [38, 46], [52, 52], [66, 30]].map(([x, y], i) => R(x, y, 11, 84 - y, 1.5, i % 2 ? p.light : p.base, { metal: true, sw: 2.4 })).join('')
  + tube('M22 56 L36 42 L50 48 L72 22', GOLD.light, 2.4) + P('M66 18 L78 16 L74 28 Z', GOLD.light, { sw: 1.8 });

G.scrollicon = (p) =>
  R(24, 22, 52, 56, 1, PAPER)
  + L('M32 34 H68 M32 42 H68 M32 50 H60 M32 58 H64', '#9c8a62', 2)
  + R(18, 16, 64, 10, 5, '#c9b07a', { metal: true, sw: 2.6 })
  + R(18, 74, 64, 10, 5, '#c9b07a', { metal: true, sw: 2.6 })
  + C(66, 70, 8, '#c8283e', { sw: 2.2 }) + P(starPath(5, 4.6, 2, 66, 70), '#ff8a9a', { flat: true, sw: 1 })
  + FC(36, 28, 1, p.base);

G.briefcase = (p) =>
  R(38, 20, 24, 12, 4, 'none', { flat: true, sw: 0.1 }) + L('M40 32 V24 C40 20 60 20 60 24 V32', INK, 6) + L('M40 32 V24 C40 20 60 20 60 24 V32', '#6a3f22', 3)
  + R(14, 32, 72, 52, 6, '#8a5636')
  + L('M14 52 H86', '#6a3f22', 2.4)
  + R(44, 46, 12, 12, 2, GOLD.base, { metal: true, sw: 2.2 })
  + R(20, 30, 8, 6, 1, GOLD.dark, { sw: 1.6 }) + R(72, 30, 8, 6, 1, GOLD.dark, { sw: 1.6 })
  + FC(50, 52, 2, p.base)
  + glint(26, 40, 6, 1.8, 0.35, 0);

G.target = (p) =>
  C(46, 54, 30, '#fff')
  + `<circle cx="46" cy="54" r="22" fill="${RED}"/><circle cx="46" cy="54" r="14" fill="#fff"/><circle cx="46" cy="54" r="7" fill="${RED}"/>`
  + `<circle cx="46" cy="54" r="30" fill="none" stroke="${INK}" stroke-width="3"/>`
  + tube('M46 54 L80 20', '#a8743e', 2)
  + P('M80 20 L86 12 L88 22 Z', p.base, { sw: 1.8 }) + P('M80 20 L74 14 L84 14 Z', p.light, { sw: 1.6 });

G.star = (p) =>
  FC(50, 52, 34, p.glow, 0.2)
  + P(starPath(5, 36, 15, 50, 54), GOLD.base, { metal: true })
  + P(starPath(5, 18, 7.6, 50, 54), GOLD.light, { flat: true, sw: 0.1, noStroke: true })
  + sparkle(82, 20, 4.4) + sparkle(18, 22, 3.4)
  + glint(40, 40, 4, 2, 0.6);

G.ticket = (p) =>
  rot(-10, 50, 50,
    P('M14 34 H86 V44 C80 44 80 56 86 56 V66 H14 V56 C20 56 20 44 14 44 Z', p.base, { metal: true })
    + `<path d="M64 34 V66" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/>`
    + T(38, 50, 'FREE', 12, '#fff', { stroke: INK, sw: 1.4 })
    + P(starPath(5, 7, 3, 75, 50), GOLD.light, { sw: 1.6 }));
