// ---------------------------------------------------------------------------
// Online: the game's half of the leaderboards.
//
// The same game runs in two places: on your own computer (`npm start`), and
// hosted (server/hosted.mjs, e.g. on Render). Only the hosted server answers
// /api/health, so that is how the game knows where it is — on your computer
// nothing below does anything and no leaderboard button appears.
//
// Online, each browser is a TRADER: a random secret token (kept on this
// device, never shown on a board) and a name, given at random at first and
// changeable at any time. Bests are posted the moment they happen — a trade
// bigger than any before, a deadline buried deeper than ever — so closing the
// tab never loses one. If the server cannot be reached the best waits here
// and is sent later.
// ---------------------------------------------------------------------------
import { VERSION } from '../engine/version.js';

const TRADER_KEY = 'margincall.trader';
const BEST_KEY = 'margincall.lb.best';
const PENDING_KEY = 'margincall.lb.pending';

export const online = { ready: false, health: null };

const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

async function call(path, body, { timeout = 6000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(path, body === undefined ? { signal: ctl.signal } : {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, ok: res.ok && data?.ok !== false, data: data || {} };
  } finally { clearTimeout(t); }
}

// ------------------------------------------------------------------ names
const ADJ = ['Bullish', 'Bearish', 'Lucky', 'Greedy', 'Plucky', 'Shady', 'Jolly', 'Sly', 'Brave', 'Rowdy', 'Sleepy',
  'Swift', 'Wild', 'Frosty', 'Golden', 'Rusty', 'Sunny', 'Stormy', 'Cosmic', 'Spicy', 'Velvet', 'Neon', 'Sneaky', 'Crafty'];
const ANIMAL = ['Otter', 'Badger', 'Falcon', 'Mole', 'Lynx', 'Heron', 'Moose', 'Gecko', 'Raven', 'Yak', 'Koala', 'Bison',
  'Ferret', 'Walrus', 'Panda', 'Wolf', 'Hare', 'Crow', 'Squid', 'Newt', 'Goose', 'Toad', 'Puma', 'Owl'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const randomName = () => `${pick(ADJ)} ${pick(ANIMAL)} ${10 + Math.floor(Math.random() * 90)}`;

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** This browser's trader, made on first use. */
export function trader() {
  let t = read(TRADER_KEY, null);
  if (!t || typeof t.token !== 'string' || t.token.length < 24) {
    t = { token: newToken(), name: randomName(), registered: false };
    write(TRADER_KEY, t);
  }
  return t;
}
const saveTrader = (t) => write(TRADER_KEY, t);

/** Make sure the server knows this trader, taking a fresh random name if this one is taken. */
async function ensureRegistered() {
  const t = trader();
  if (t.registered) return t;
  for (let i = 0; i < 6; i++) {
    const r = await call('/api/player', { token: t.token, name: t.name });
    if (r.ok) { t.name = r.data.name; t.registered = true; saveTrader(t); return t; }
    if (r.status === 409 || r.status === 400) { t.name = randomName(); continue; }
    throw new Error(r.data.error || 'The leaderboards did not answer');
  }
  throw new Error('Could not find a free name');
}

// ------------------------------------------------------------------ start-up
/** Is there a leaderboard server here? Quick, and quiet if not. */
export async function detectOnline() {
  if (location.protocol === 'file:') return false;
  try {
    const r = await call('/api/health', undefined, { timeout: 2500 });
    // the local server answers too, with hosted: false and no boards
    if (r.status !== 200 || r.data.game !== 'margin-call' || !r.data.boards) return false;
    online.ready = true;
    online.health = r.data;
    flushPending();
    setInterval(flushPending, 60e3);
    return true;
  } catch { return false; }
}

/**
 * Tell the player when a newer version has been deployed while they play.
 * Checks every few minutes; calls back once.
 */
export function watchVersion(onNewer, every = 5 * 60e3) {
  if (!online.ready) return;
  const id = setInterval(async () => {
    try {
      const r = await call('/api/health', undefined, { timeout: 5000 });
      if (r.status === 200 && r.data.version && r.data.version !== VERSION) { clearInterval(id); onNewer(r.data.version, r.data.versionName); }
    } catch {}
  }, every);
}

// ------------------------------------------------------------------ bests
/** The best already posted from this browser, per board — for this trader only. */
function bests() {
  const b = read(BEST_KEY, null);
  const t = trader();
  return b && b.token === t.token ? b.values || {} : {};
}
function setBest(board, value) {
  const t = trader();
  write(BEST_KEY, { token: t.token, values: { ...bests(), [board]: value } });
}

/**
 * A result happened. If it beats this trader's best on that board, post it.
 * @returns the server's answer ({improved, rank, total}) when it went in, else null.
 */
export async function record(board, value, meta = {}) {
  if (!online.ready || !Number.isFinite(value) || value <= 0) return null;
  if (value <= (bests()[board] || 0)) return null;
  setBest(board, value);
  return submit({ board, value, week: meta.week, seed: meta.seed != null ? String(meta.seed) : undefined });
}

async function submit(entry) {
  try {
    const t = await ensureRegistered();
    let r = await call('/api/score', { token: t.token, version: VERSION, ...entry });
    if (r.status === 401) {          // the server forgot us (a wiped store): introduce ourselves again
      t.registered = false; saveTrader(t);
      await ensureRegistered();
      r = await call('/api/score', { token: t.token, version: VERSION, ...entry });
    }
    if (r.status === 429 || r.status >= 500) throw new Error('later');
    return r.ok ? r.data : null;
  } catch {
    queue(entry);
    return null;
  }
}

function queue(entry) {
  const list = read(PENDING_KEY, []).filter((e) => e.board !== entry.board || e.value > entry.value);
  if (!list.some((e) => e.board === entry.board && e.value >= entry.value)) list.push(entry);
  write(PENDING_KEY, list.slice(-20));
}

let flushing = false;
async function flushPending() {
  if (flushing || !online.ready) return;
  const list = read(PENDING_KEY, []);
  if (!list.length) return;
  flushing = true;
  write(PENDING_KEY, []);
  try { for (const e of list) await submit(e); } finally { flushing = false; }
}

// ------------------------------------------------------------------ the boards
export async function fetchBoards(limit = 50) {
  const t = trader();
  const r = await call(`/api/leaderboards?limit=${limit}`, { token: t.token });
  if (!r.ok) throw new Error(r.data.error || 'The leaderboards did not answer');
  if (r.data.you?.name && r.data.you.name !== t.name) { t.name = r.data.you.name; t.registered = true; saveTrader(t); }
  return r.data;
}

/** Change the name shown on every board. */
export async function rename(name) {
  const t = trader();
  const r = await call('/api/player', { token: t.token, name });
  if (!r.ok) throw new Error(r.data.error || 'That name did not work');
  t.name = r.data.name; t.registered = true; saveTrader(t);
  return t.name;
}

/** The secret that carries this trader to another device. */
export const traderCode = () => trader().token;

/** Become the trader a code belongs to (from another device). */
export async function useCode(code) {
  const token = String(code || '').trim();
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(token)) throw new Error('That is not a trader code');
  const r = await call('/api/me', { token });
  if (!r.ok) throw new Error(r.data.error || 'No trader with that code');
  saveTrader({ token, name: r.data.name, registered: true });
  // their bests come with them, so this device only posts what beats them
  const values = {};
  for (const [b, e] of Object.entries(r.data.boards || {})) if (e) values[b] = e.value;
  write(BEST_KEY, { token, values });
  write(PENDING_KEY, []);
  return r.data.name;
}
