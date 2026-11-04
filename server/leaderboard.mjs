// ---------------------------------------------------------------------------
// The leaderboards — pure logic, no HTTP and no storage, so it can be tested
// on its own and the server around it stays thin.
//
// The rule that shapes everything here: ONE ENTRY PER PLAYER PER BOARD. A
// player's entry is their best; beating it replaces it, and anything lower is
// ignored. So nobody can fill a board with their own runs.
//
// Players have no accounts. Each browser makes a random secret token the first
// time it plays online; the server only ever stores a hash of it, so the data
// file never holds anything that would let someone post as somebody else.
// The token can be copied to another device to carry the same trader across.
//
// The document this works on is plain JSON (see emptyDoc), so any storage
// that can hold a string can hold it — see store.mjs.
// ---------------------------------------------------------------------------
import { createHash, randomBytes } from 'node:crypto';

/** The boards. `kind` says how the client formats the value. */
export const BOARDS = {
  campaign: {
    title: 'THE CAMPAIGN',
    blurb: 'The biggest single trade booked in weeks 1–8',
    kind: 'money',
  },
  endless: {
    title: 'ENDLESS',
    blurb: 'The biggest single trade booked from week 9 on, in endless mode',
    kind: 'money',
  },
  overkill: {
    title: 'OVERKILL',
    blurb: 'The most a quota was ever buried by — profit ÷ quota, in one deadline',
    kind: 'times',
  },
};
export const BOARD_KEYS = Object.keys(BOARDS);

/** Entries kept per board. Past this the lowest fall off. */
export const MAX_ENTRIES = 1000;
/** The largest value accepted — the game's numbers grow fast, but not past this. */
export const MAX_VALUE = 1e300;
export const SCHEMA = 1;

export const emptyDoc = () => ({
  schema: SCHEMA,
  players: {},   // pid -> { name, created, seen }
  names: {},     // lower-cased name -> pid, so a name belongs to one trader
  boards: Object.fromEntries(BOARD_KEYS.map((k) => [k, {}])),   // board -> pid -> entry
  banned: {},    // pid -> true
});

/** A player's id is the hash of their secret token. */
export const playerId = (token) => createHash('sha256').update(String(token)).digest('hex').slice(0, 32);

/** A fresh secret, for clients that cannot make their own. */
export const newToken = () => randomBytes(24).toString('hex');

/** Tokens are long random strings; anything else is refused before it is hashed. */
export const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{24,128}$/.test(t);

/**
 * A trader name as it will be shown, or null if it cannot be used. Letters
 * (any alphabet), digits, spaces and . _ ' - ; 2 to 18 characters, at least one
 * letter or digit, spaces collapsed.
 */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 18) return null;
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) return null;
  if (!/[\p{L}\p{N}]/u.test(name)) return null;
  if (RESERVED.has(name.toLowerCase())) return null;
  return name;
}
const RESERVED = new Set(['admin', 'administrator', 'moderator', 'mod', 'margin call', 'margincall', 'system', 'you']);

/** Bring a stored document up to date and make it safe to work on. */
export function normalizeDoc(doc) {
  const d = doc && typeof doc === 'object' ? doc : emptyDoc();
  d.schema = SCHEMA;
  d.players ||= {};
  d.names ||= {};
  d.banned ||= {};
  d.boards ||= {};
  // A board added in a later version starts empty; a board retired keeps its data.
  for (const k of BOARD_KEYS) d.boards[k] ||= {};
  return d;
}

export class Leaderboards {
  constructor(doc) {
    this.doc = normalizeDoc(doc);
    this.version = 0;          // bumped on every change; the store saves when it moves
  }

  touch() { this.version++; }

  player(pid) { return this.doc.players[pid] || null; }

  /**
   * Claim or change a trader name. A name can only belong to one trader, in
   * any mix of upper and lower case.
   * @returns {{ok: true, name: string, created: boolean} | {ok: false, error: string, status: number}}
   */
  register(pid, rawName, now = Date.now()) {
    const name = cleanName(rawName);
    if (!name) return { ok: false, status: 400, error: 'Names are 2–18 letters, numbers, spaces or . _ \' -' };
    const key = name.toLowerCase();
    const holder = this.doc.names[key];
    if (holder && holder !== pid) return { ok: false, status: 409, error: 'That name is taken' };
    const existing = this.doc.players[pid];
    if (existing) {
      if (existing.name === name) { existing.seen = now; return { ok: true, name, created: false }; }
      delete this.doc.names[existing.name.toLowerCase()];
      existing.name = name;
      existing.seen = now;
      this.doc.names[key] = pid;
      this.touch();
      return { ok: true, name, created: false };
    }
    this.doc.players[pid] = { name, created: now, seen: now };
    this.doc.names[key] = pid;
    this.touch();
    return { ok: true, name, created: true };
  }

  /**
   * Post a result. Only a value above the player's own best on that board
   * changes anything: it replaces their entry, so they hold one place.
   */
  submit(pid, board, value, meta = {}, now = Date.now()) {
    if (!BOARDS[board]) return { ok: false, status: 400, error: 'No such board' };
    if (!this.doc.players[pid]) return { ok: false, status: 401, error: 'Unknown trader — pick a name first' };
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0 || v > MAX_VALUE) return { ok: false, status: 400, error: 'That is not a score' };
    const week = Math.max(1, Math.min(100000, Math.floor(Number(meta.week) || 1)));
    this.doc.players[pid].seen = now;
    // A banned trader is told it went in; it just never shows.
    if (this.doc.banned[pid]) return { ok: true, improved: false, best: v, rank: null };
    const rows = this.doc.boards[board];
    const prev = rows[pid];
    if (prev && prev.value >= v) return { ok: true, improved: false, best: prev.value, rank: this.rankOf(board, pid) };
    rows[pid] = {
      value: v,
      week,
      at: now,
      version: typeof meta.version === 'string' ? meta.version.slice(0, 16) : undefined,
      seed: typeof meta.seed === 'string' ? meta.seed.slice(0, 40) : undefined,
    };
    this.prune(board);
    this.touch();
    return { ok: true, improved: true, best: v, previous: prev?.value ?? null, rank: this.rankOf(board, pid) };
  }

  /** Every entry on a board, best first; earlier beats later on a tie. */
  sorted(board) {
    const rows = this.doc.boards[board] || {};
    return Object.entries(rows)
      .filter(([pid]) => !this.doc.banned[pid] && this.doc.players[pid])
      .sort((a, b) => b[1].value - a[1].value || a[1].at - b[1].at);
  }

  rankOf(board, pid) {
    const i = this.sorted(board).findIndex(([p]) => p === pid);
    return i < 0 ? null : i + 1;
  }

  /** The top of a board, as it is shown to everyone. */
  top(board, limit = 50, pid = null) {
    const all = this.sorted(board);
    const entries = all.slice(0, limit).map(([p, e], i) => ({
      rank: i + 1, name: this.doc.players[p].name, value: e.value, week: e.week, at: e.at, you: p === pid || undefined,
    }));
    let you = null;
    if (pid) {
      const i = all.findIndex(([p]) => p === pid);
      if (i >= 0) you = { rank: i + 1, value: all[i][1].value, week: all[i][1].week, at: all[i][1].at };
    }
    return { board, ...BOARDS[board], total: all.length, entries, you };
  }

  /** Keep a board to MAX_ENTRIES, dropping from the bottom. */
  prune(board) {
    const rows = this.doc.boards[board];
    const n = Object.keys(rows).length;
    if (n <= MAX_ENTRIES) return;
    for (const [pid] of this.sorted(board).slice(MAX_ENTRIES)) delete rows[pid];
  }

  // ------------------------------------------------------------- moderation
  pidByName(name) { return this.doc.names[String(name || '').toLowerCase().trim()] || null; }

  /** Take one entry off one board (or every board). */
  remove(name, board = null) {
    const pid = this.pidByName(name);
    if (!pid) return { ok: false, status: 404, error: 'No trader by that name' };
    let removed = 0;
    for (const b of board ? [board] : BOARD_KEYS) {
      if (this.doc.boards[b]?.[pid]) { delete this.doc.boards[b][pid]; removed++; }
    }
    if (removed) this.touch();
    return { ok: true, removed };
  }

  /** Take a trader off every board, and keep anything they post from showing. */
  ban(name, on = true) {
    const pid = this.pidByName(name);
    if (!pid) return { ok: false, status: 404, error: 'No trader by that name' };
    if (on) { this.doc.banned[pid] = true; this.remove(name); } else delete this.doc.banned[pid];
    this.touch();
    return { ok: true };
  }

  stats() {
    return {
      players: Object.keys(this.doc.players).length,
      entries: Object.fromEntries(BOARD_KEYS.map((b) => [b, Object.keys(this.doc.boards[b]).length])),
      banned: Object.keys(this.doc.banned).length,
    };
  }
}
