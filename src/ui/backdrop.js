// ---------------------------------------------------------------------------
// The backdrop: marbled endpaper, slowly on the move.
//
// Behind the whole game is a sheet of marbled paper — flat bands of navy ink
// with a pen line wherever one band meets the next — that drifts like ink on
// water. It is drawn by a small fragment shader into one canvas at a fraction of
// the screen's resolution, capped at 30 frames a second, and stops entirely
// while the tab is hidden or motion is switched off (then it is one still
// frame, so the paper is still there).
//
// It answers the game, never loudly: a winning trade stirs it and warms it
// green, a losing one cools it red, a boss deadline tints it the boss's way.
// Those are `mood()` calls from main.js; each decays back to calm on its own.
//
// It must never cost the game its frame rate. Without a real GPU (software
// WebGL, as in a browser with hardware acceleration off) it is drawn once and
// held still; with one, a governor watches the page's own frame rate and
// steps the paper down — fewer pixels, then fewer frames, then still — the
// moment the page starts to struggle.
//
// If WebGL is not there the canvas never appears and the stylesheet's own
// background shows instead — nothing else depends on this.
// ---------------------------------------------------------------------------

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uSeed;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y + uSeed;
  float t = uTime;
  // domain warp twice over: ink pulled by the water, pulled again
  vec2 q = vec2(fbm(uv * 1.3 + vec2(0.0, t * 0.9)), fbm(uv * 1.3 + vec2(5.2, -t * 0.7)));
  vec2 r = vec2(fbm(uv * 1.3 + 3.2 * q + vec2(1.7, 9.2) + t * 0.5), fbm(uv * 1.3 + 3.2 * q + vec2(8.3, 2.8) - t * 0.4));
  float v = smoothstep(0.18, 0.82, fbm(uv * 1.2 + 2.8 * r));

  // flat bands, like a print run of four inks
  const float BANDS = 6.0;
  float b = floor(v * BANDS);
  float f = fract(v * BANDS);
  vec3 lo = vec3(0.047, 0.082, 0.165), hi = vec3(0.150, 0.235, 0.420);
  vec3 col = mix(lo, hi, b / (BANDS - 1.0));
  // a sliver of light on one edge of each band: the cel highlight, in paper
  col += vec3(0.05, 0.07, 0.11) * (1.0 - smoothstep(0.0, 0.10, f)) * step(0.5, mod(b, 2.0));

  // a pen line where two bands meet, its weight wandering like a nib's
  float dv = fwidth(v * BANDS);
  float w = dv * (1.0 + 1.3 * noise(uv * 34.0 + t));
  float edge = min(f, 1.0 - f);
  float line = 1.0 - smoothstep(0.0, w * 1.35, edge);
  // where the bands crowd closer than a few pixels the pen would fill them in
  // and the bands would alias, so both melt into the plain average there
  float crowd = smoothstep(0.16, 0.42, dv);
  line *= 1.0 - crowd;
  col = mix(col, mix(lo, hi, v), crowd);
  col = mix(col, vec3(0.020, 0.031, 0.067), line * 0.82);

  // the mood of the room
  col = mix(col, col * 0.55 + uTint * 0.45 * (0.35 + b / BANDS), uTintAmt);

  // corners fall away into the desk
  vec2 c = gl_FragCoord.xy / uRes - 0.5;
  col *= 1.0 - dot(c, c) * 1.15;
  gl_FragColor = vec4(col, 1.0);
}`;

let gl = null, canvas = null, prog = null, uni = {};
let raf = 0, last = 0, clock = 0, running = false;
// held still by the player (motion off) or by the hardware (no GPU, or the
// governor ran out of steps); either one stops the animation
let userStill = false, forcedStill = false;
// Graphics quality: HIGH animates, MEDIUM holds one still frame, LOW hides it.
let quality = 'high';
const still = () => userStill || forcedStill || quality !== 'high';
// mood: the tint drifts toward a target, and a stir speeds the water up for a moment
const mood = { tint: [0, 0, 0], target: [0, 0, 0], amt: 0, targetAmt: 0, stir: 0, base: null };
// Render below the screen's resolution — it is soft shapes and one line
// weight — but never so far below that the pen line turns to steps. Each
// governor step trades a little of that for frames.
const TIERS = [{ scale: 0.62, fps: 30 }, { scale: 0.48, fps: 24 }, { scale: 0.4, fps: 15 }];
let tier = 0;
const SCALE = () => Math.min(1, TIERS[tier].scale * Math.min(2, devicePixelRatio || 1));
const FPS = () => TIERS[tier].fps;
// the governor's tally: how many of the page's recent frames came late
const gov = { frames: 0, late: 0, prev: 0, from: 0 };
const SPEED = 0.018;   // how fast the water drifts when nothing is happening

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
  return s;
}

function resize() {
  if (!canvas) return;
  const k = SCALE();
  const w = Math.max(1, Math.round(innerWidth * k)), h = Math.max(1, Math.round(innerHeight * k));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  if (!running) draw();
}

function draw() {
  gl.uniform2f(uni.uRes, canvas.width, canvas.height);
  gl.uniform1f(uni.uTime, clock);
  gl.uniform3f(uni.uTint, ...mood.tint);
  gl.uniform1f(uni.uTintAmt, mood.amt);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/**
 * Watch the page's frame rate, not just ours: a gap between animation frames
 * of over 50 ms means the page as a whole is under 20 fps. If most of the last
 * couple of seconds were like that, step the paper down a tier, and past the
 * last tier hold it still. Hidden tabs and the first frame back are ignored.
 */
function govern(now) {
  const gap = gov.prev ? now - gov.prev : 0;
  gov.prev = now;
  if (!gap || gap > 400 || now < gov.from) return;
  gov.frames++;
  if (gap > 50) gov.late++;
  // judged over wall-clock time, so a page at 8 fps is caught as quickly as one at 25
  if (now - gov.from < 1500 || gov.frames < 6) return;
  const struggling = gov.late / gov.frames > 0.4;
  gov.frames = 0; gov.late = 0; gov.from = now;
  if (!struggling) return;
  if (tier < TIERS.length - 1) { tier++; resize(); }
  else { forcedStill = true; stop(); draw(); }
}

function frame(now) {
  raf = requestAnimationFrame(frame);
  govern(now);
  const dt = Math.min(0.1, (now - last) / 1000);
  if (dt < 1 / FPS() - 0.002) return;
  last = now;
  // ease the mood toward where it is heading; a stir decays over ~2s
  const k = 1 - Math.exp(-dt * 1.6);
  for (let i = 0; i < 3; i++) mood.tint[i] += (mood.target[i] - mood.tint[i]) * k;
  mood.amt += (mood.targetAmt - mood.amt) * k;
  mood.stir *= Math.exp(-dt * 1.4);
  clock += dt * SPEED * (1 + mood.stir * 6);
  draw();
}

function start() {
  if (running || still() || !gl || document.hidden) return;
  running = true;
  last = performance.now();
  // the first seconds after starting (page load, a tab coming back) are
  // always rough and say nothing about the paper
  gov.prev = 0; gov.frames = 0; gov.late = 0; gov.from = last + 2500;
  raf = requestAnimationFrame(frame);
}
function stop() {
  running = false;
  cancelAnimationFrame(raf);
}

/** Put the paper behind the game. Safe to call more than once; does nothing without WebGL. */
export function initBackdrop(seed = Math.random() * 100) {
  if (canvas) return true;
  try {
    canvas = document.createElement('canvas');
    canvas.id = 'backdrop';
    canvas.setAttribute('aria-hidden', 'true');
    const opts = { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false };
    // Ask for a context that refuses to run without a real GPU; if that is
    // all there is, take the software one but only ever draw it once.
    gl = canvas.getContext('webgl', { ...opts, failIfMajorPerformanceCaveat: true });
    if (!gl) { gl = canvas.getContext('webgl', opts); forcedStill = true; }
    if (!gl || !gl.getExtension('OES_standard_derivatives')) throw new Error('no webgl');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) forcedStill = true;
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // one triangle that covers the screen
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uTime', 'uTint', 'uTintAmt', 'uSeed']) uni[n] = gl.getUniformLocation(prog, n);
    gl.uniform1f(uni.uSeed, seed % 100);
    clock = (seed * 7.31) % 40;
  } catch {
    canvas = null; gl = null;
    return false;
  }
  document.body.prepend(canvas);
  document.body.classList.add('has-backdrop');
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
  canvas.addEventListener('webglcontextrestored', () => { canvas.remove(); canvas = null; gl = null; initBackdrop(seed); });
  resize();
  start();
  return true;
}

/** Graphics quality decides whether the paper moves, holds still, or is not there. */
export function setBackdropQuality(q) {
  quality = q;
  if (!canvas) return;
  canvas.style.display = q === 'low' ? 'none' : '';
  if (still()) { stop(); if (gl && q !== 'low') { resize(); draw(); } } else start();
}

/** Motion off: hold the paper still on its current frame. */
export function setBackdropStill(on) {
  userStill = !!on;
  if (still()) { stop(); if (gl) draw(); } else start();
}

const MOODS = {
  calm: { tint: [0, 0, 0], amt: 0 },
  win: { tint: [0.15, 0.85, 0.5], amt: 0.32 },
  bigwin: { tint: [1.0, 0.82, 0.25], amt: 0.42 },
  loss: { tint: [1.0, 0.25, 0.32], amt: 0.34 },
  boss: { tint: [0.75, 0.22, 0.42], amt: 0.26 },
  floor: { tint: [0.55, 0.42, 1.0], amt: 0.18 },
};

/**
 * Set the room's mood. `stir` (0–1) churns the water for a moment; the tint
 * stays until another mood replaces it, unless `fade` is given (seconds), after
 * which it settles back to whatever the base mood is.
 */
export function backdropMood(name, { stir = 0, fade = 0 } = {}) {
  const m = MOODS[name] || MOODS.calm;
  mood.target = [...m.tint];
  mood.targetAmt = m.amt;
  mood.stir = Math.max(mood.stir, stir);
  if (!fade) mood.base = name;
  else {
    clearTimeout(mood.timer);
    mood.timer = setTimeout(() => {
      const b = MOODS[mood.base] || MOODS.calm;
      mood.target = [...b.tint];
      mood.targetAmt = b.amt;
    }, fade * 1000);
  }
  // Held still by the player, the paper still takes the mood, in one redraw.
  // Held still by the hardware, it does not: on software WebGL a single redraw
  // of the whole screen is long enough to hitch the trade animation.
  if (!running && gl && !forcedStill) { mood.tint = [...mood.target]; mood.amt = mood.targetAmt; draw(); }
}

/** Churn the water for a moment without changing the room's mood. */
export function backdropStir(amount = 0.3) {
  mood.stir = Math.max(mood.stir, amount);
}
