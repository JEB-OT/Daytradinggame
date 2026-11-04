// ---------------------------------------------------------------------------
// Where the leaderboards live between restarts — and, the part that matters,
// between deploys. Every update you push makes Render build a fresh machine,
// and anything written to that machine's own disk is gone with it. So the
// data has to live somewhere the deploy does not touch:
//
//   UPSTASH   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
//             A free Upstash Redis database, reached over HTTPS with fetch —
//             no dependency. Survives every deploy. The recommended setup.
//   FILE      DATA_DIR is set — point it at a Render persistent disk
//             (e.g. /var/data). Survives every deploy. Needs a paid instance.
//   LOCAL     Neither. A file in ./data: fine on your own computer, but on
//             Render it is wiped by every deploy. The server says so loudly.
//
// A store loads and saves the leaderboard document (leaderboard.mjs). It never
// saves before a load has succeeded, so a database that is briefly unreachable
// at start-up can never be overwritten with an empty board.
// ---------------------------------------------------------------------------
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BOARD_KEYS, emptyDoc } from './leaderboard.mjs';

/** Pick a store from the environment. */
export function openStore(env = process.env, opts = {}) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return upstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN, {
      prefix: env.LEADERBOARD_PREFIX || 'margincall', fetchImpl: opts.fetchImpl,
    });
  }
  if (env.DATA_DIR) return fileStore(env.DATA_DIR, { persistent: true });
  return fileStore(opts.localDir || join(process.cwd(), 'data'), { persistent: false });
}

// ------------------------------------------------------------------- file
export function fileStore(dir, { persistent = true } = {}) {
  const file = join(dir, 'leaderboards.json');
  return {
    kind: persistent ? 'file' : 'local',
    persistent,
    where: file,
    async load() {
      try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) {
        if (e.code === 'ENOENT') return null;          // first run: nothing yet
        throw e;                                        // anything else must not look like "empty"
      }
    },
    async save(doc) {
      await mkdir(dir, { recursive: true });
      // write beside it, then swap: a crash mid-write never leaves half a file
      const tmp = file + '.tmp';
      await writeFile(tmp, JSON.stringify(doc));
      await rename(tmp, file);
    },
  };
}

// ------------------------------------------------------------------- upstash
/**
 * The document is split across keys — the players, and one key per board — so
 * a new score rewrites one board, not everything, and no single value grows
 * past what a free database takes in one request.
 */
export function upstashStore(url, token, { prefix = 'margincall', fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  const base = url.replace(/\/+$/, '');
  const keys = { players: `${prefix}:players`, board: (b) => `${prefix}:board:${b}` };
  const lastSaved = new Map();     // key -> the JSON last written, to send only what changed

  async function pipeline(commands) {
    const res = await doFetch(base + '/pipeline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (!res.ok) throw new Error(`Upstash answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const out = await res.json();
    for (const r of out) if (r && r.error) throw new Error('Upstash: ' + r.error);
    return out.map((r) => r?.result ?? null);
  }

  const parts = (doc) => {
    const m = new Map();
    m.set(keys.players, JSON.stringify({ schema: doc.schema, players: doc.players, names: doc.names, banned: doc.banned }));
    for (const b of Object.keys(doc.boards)) m.set(keys.board(b), JSON.stringify(doc.boards[b]));
    return m;
  };

  return {
    kind: 'upstash',
    persistent: true,
    where: base.replace(/^https?:\/\//, ''),
    async load() {
      const boardKeys = BOARD_KEYS.map(keys.board);
      const [players, ...boards] = await pipeline([['GET', keys.players], ...boardKeys.map((k) => ['GET', k])]);
      if (players == null && boards.every((b) => b == null)) return null;
      const doc = emptyDoc();
      if (players) Object.assign(doc, JSON.parse(players));
      BOARD_KEYS.forEach((b, i) => { if (boards[i]) doc.boards[b] = JSON.parse(boards[i]); });
      // what is stored now is what was last saved
      for (const [k, v] of parts(doc)) lastSaved.set(k, v);
      return doc;
    },
    async save(doc) {
      const changed = [...parts(doc)].filter(([k, v]) => lastSaved.get(k) !== v);
      if (!changed.length) return;
      await pipeline(changed.map(([k, v]) => ['SET', k, v]));
      for (const [k, v] of changed) lastSaved.set(k, v);
    },
  };
}

// ------------------------------------------------------------------- saver
/**
 * Writes the document back after changes, a beat later and coalesced, so a
 * burst of scores is one write. A failed write is retried until it lands, and
 * `flush()` writes whatever is pending before the server shuts down.
 */
export class Saver {
  constructor(store, boards, { delay = 300, retry = 5000, log = console } = {}) {
    Object.assign(this, { store, boards, delay, retry, log });
    this.saved = boards.version;
    this.timer = null;
    this.running = null;
    this.ready = false;      // set once a load has succeeded
  }

  schedule() {
    if (!this.ready || this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.delay);
  }

  async flush() {
    if (!this.ready) return;
    if (this.running) { await this.running; if (this.boards.version === this.saved) return; }
    if (this.boards.version === this.saved) return;
    const v = this.boards.version;
    this.running = this.store.save(this.boards.doc)
      .then(() => { this.saved = Math.max(this.saved, v); })
      .catch((e) => {
        this.log.error?.(`[leaderboard] save failed, retrying in ${this.retry / 1000}s:`, e.message);
        setTimeout(() => this.schedule(), this.retry);
      })
      .finally(() => { this.running = null; });
    await this.running;
    if (this.boards.version !== this.saved) this.schedule();
  }
}
