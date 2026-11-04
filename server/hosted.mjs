#!/usr/bin/env node
// ---------------------------------------------------------------------------
// MARGIN CALL — the hosted server: the game, plus online leaderboards.
//
// This is what runs on Render (see render.yaml and docs/hosting-on-render.md).
// It is the same game as the one `npm start` serves — the same files from
// the same folder — so every update to the game reaches both. What it adds is
// a small JSON API the game looks for when it starts: when /api/health
// answers, the game shows its LEADERBOARDS and posts players' bests.
//
//   node server/hosted.mjs          → http://localhost:10000 (or $PORT)
//
// Environment:
//   PORT                     set by Render
//   UPSTASH_REDIS_REST_URL   } where the leaderboards are kept (store.mjs);
//   UPSTASH_REDIS_REST_TOKEN } without these, DATA_DIR, or a local ./data file
//   DATA_DIR                 a persistent disk, instead of Upstash
//   ADMIN_TOKEN              unlocks /api/admin/* (remove, ban, export, import)
//
// No dependencies — Node's standard library only, like the rest of the game.
// ---------------------------------------------------------------------------
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { timingSafeEqual, createHash } from 'node:crypto';
import { BOARDS, BOARD_KEYS, Leaderboards, playerId, validToken, normalizeDoc } from './leaderboard.mjs';
import { openStore, Saver } from './store.mjs';
import { VERSION, VERSION_NAME } from '../src/engine/version.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
// Only the game is served — never the server's own code, its data, or .git.
const PUBLIC = [/^\/index\.html$/, /^\/src\//, /^\/docs\//, /^\/tools\/(artlab\.html|scenes\.js)$/];

// ------------------------------------------------------------------ limits
/** Requests a minute (or an hour) per address, by kind. Generous for a player, tight for a script. */
const LIMITS = { read: [240, 60e3], write: [40, 60e3], newPlayer: [8, 3600e3], admin: [30, 60e3] };

class RateLimiter {
  constructor() { this.hits = new Map(); }
  allow(ip, kind, now = Date.now()) {
    const [max, window] = LIMITS[kind];
    const key = kind + ' ' + ip;
    const list = (this.hits.get(key) || []).filter((t) => now - t < window);
    if (list.length >= max) { this.hits.set(key, list); return false; }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  sweep(now = Date.now()) {
    for (const [k, list] of this.hits) if (!list.some((t) => now - t < 3600e3)) this.hits.delete(k);
  }
}

// ------------------------------------------------------------------ helpers
const send = (res, status, body, headers = {}) => {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' || Buffer.isBuffer(body) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
};

function readBody(req, max) {
  return new Promise((done, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) { fail(Object.assign(new Error('Too much'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return done({});
      try { done(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { fail(Object.assign(new Error('Not JSON'), { status: 400 })); }
    });
    req.on('error', fail);
  });
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

function sameSecret(a, b) {
  if (!a || !b) return false;
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// ------------------------------------------------------------------ static files
async function serveStatic(req, res) {
  let path;
  try { path = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]); } catch { return send(res, 400, 'Bad path'); }
  if (path === '/') path = '/index.html';
  const clean = normalize(path).replace(/\\/g, '/');
  if (!PUBLIC.some((re) => re.test(clean))) return send(res, 404, 'Not found');
  const file = join(ROOT, clean);
  if (!file.startsWith(ROOT + sep)) return send(res, 404, 'Not found');
  try {
    const info = await stat(file);
    if (!info.isFile()) return send(res, 404, 'Not found');
    // Revalidated on every load and answered 304 when unchanged, so a deploy
    // shows up on the next refresh and nothing is downloaded twice in between.
    const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, 'Not found');
  }
}

// ------------------------------------------------------------------ the app
/**
 * Start the hosted server. Returns once it is listening; the leaderboards load
 * in the background, and the API answers 503 until they have.
 */
export async function startHosted({
  port = Number(process.env.PORT) || 10000,
  host = process.env.HOST || '0.0.0.0',
  env = process.env,
  store = openStore(env),
  adminToken = env.ADMIN_TOKEN || '',
  log = console,
} = {}) {
  const boards = new Leaderboards(null);
  const saver = new Saver(store, boards, { log });
  const limiter = new RateLimiter();
  let loaded = false, loadError = null;

  async function load() {
    for (let attempt = 1; ; attempt++) {
      try {
        const doc = await store.load();
        boards.doc = normalizeDoc(doc);
        boards.version = 0;
        saver.saved = 0;
        saver.ready = true;
        loaded = true;
        loadError = null;
        log.log?.(`[leaderboard] loaded from ${store.kind} (${store.where}): ${JSON.stringify(boards.stats())}`);
        return;
      } catch (e) {
        loadError = e.message;
        log.error?.(`[leaderboard] load failed (attempt ${attempt}), retrying:`, e.message);
        await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * attempt)));
      }
    }
  }
  const loading = load();
  if (!store.persistent) {
    log.warn?.('[leaderboard] WARNING: no Upstash database and no DATA_DIR disk — scores are kept in ' +
      `${store.where}, which a Render deploy wipes. See docs/hosting-on-render.md.`);
  }

  const changed = () => saver.schedule();
  const tokenOf = (body) => (validToken(body.token) ? body.token : null);

  async function api(req, res, url) {
    const ip = clientIp(req);
    const route = req.method + ' ' + url.pathname;
    const kind = url.pathname.startsWith('/api/admin/') ? 'admin' : req.method === 'GET' ? 'read' : 'write';
    if (!limiter.allow(ip, kind)) return send(res, 429, { ok: false, error: 'Slow down — too many requests' }, { 'Retry-After': '30' });

    if (route === 'GET /api/health') {
      return send(res, 200, {
        ok: true, game: 'margin-call', version: VERSION, versionName: VERSION_NAME,
        leaderboards: loaded, storage: { kind: store.kind, persistent: store.persistent },
        boards: Object.fromEntries(BOARD_KEYS.map((k) => [k, { title: BOARDS[k].title, blurb: BOARDS[k].blurb, kind: BOARDS[k].kind }])),
      });
    }
    if (!loaded) return send(res, 503, { ok: false, error: 'The leaderboards are still loading', detail: loadError }, { 'Retry-After': '5' });

    const body = req.method === 'POST' ? await readBody(req, kind === 'admin' ? 8e6 : 8e3) : {};
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 50));

    switch (route) {
      case 'GET /api/leaderboards':
      case 'POST /api/leaderboards': {
        const token = tokenOf(body);
        const pid = token ? playerId(token) : null;
        const me = pid ? boards.player(pid) : null;
        return send(res, 200, {
          ok: true,
          you: me ? { name: me.name } : null,
          boards: Object.fromEntries(BOARD_KEYS.map((k) => [k, boards.top(k, limit, me ? pid : null)])),
        });
      }
      case 'POST /api/player': {
        const token = tokenOf(body);
        if (!token) return send(res, 400, { ok: false, error: 'Missing trader token' });
        const pid = playerId(token);
        if (!boards.player(pid) && !limiter.allow(ip, 'newPlayer')) {
          return send(res, 429, { ok: false, error: 'Too many new traders from here — try again later' });
        }
        const r = boards.register(pid, body.name);
        if (!r.ok) return send(res, r.status, r);
        changed();
        return send(res, 200, r);
      }
      case 'POST /api/score': {
        const token = tokenOf(body);
        if (!token) return send(res, 400, { ok: false, error: 'Missing trader token' });
        const r = boards.submit(playerId(token), body.board, body.value, body);
        if (!r.ok) return send(res, r.status, r);
        if (r.improved) changed();
        return send(res, 200, { ...r, board: body.board, total: boards.sorted(body.board).length });
      }
      case 'POST /api/me': {
        const token = tokenOf(body);
        const me = token ? boards.player(playerId(token)) : null;
        if (!me) return send(res, 404, { ok: false, error: 'No trader with that code' });
        const pid = playerId(token);
        return send(res, 200, {
          ok: true, name: me.name,
          boards: Object.fromEntries(BOARD_KEYS.map((k) => {
            const e = boards.doc.boards[k][pid];
            return [k, e ? { value: e.value, week: e.week, rank: boards.rankOf(k, pid) } : null];
          })),
        });
      }
    }

    // --------------------------------------------------------- moderation
    if (kind === 'admin') {
      const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || body.adminToken;
      if (!adminToken || !sameSecret(given, adminToken)) return send(res, 403, { ok: false, error: 'Admin token required' });
      if (route === 'POST /api/admin/remove') {
        const r = boards.remove(body.name, BOARDS[body.board] ? body.board : null);
        if (r.ok) changed();
        return send(res, r.ok ? 200 : r.status, r);
      }
      if (route === 'POST /api/admin/ban') {
        const r = boards.ban(body.name, body.on !== false);
        if (r.ok) changed();
        return send(res, r.ok ? 200 : r.status, r);
      }
      if (route === 'GET /api/admin/export') {
        return send(res, 200, boards.doc, { 'Content-Disposition': `attachment; filename="margincall-leaderboards-${new Date().toISOString().slice(0, 10)}.json"` });
      }
      if (route === 'POST /api/admin/import') {
        if (!body.doc || typeof body.doc !== 'object' || !body.doc.players) return send(res, 400, { ok: false, error: 'Send {"doc": <an export>}' });
        boards.doc = normalizeDoc(body.doc);
        boards.touch();
        changed();
        return send(res, 200, { ok: true, ...boards.stats() });
      }
      if (route === 'GET /api/admin/stats') return send(res, 200, { ok: true, ...boards.stats(), storage: { kind: store.kind, where: store.where, persistent: store.persistent } });
    }
    return send(res, 404, { ok: false, error: 'No such endpoint' });
  }

  const server = createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url || '/', 'http://localhost'); } catch { return send(res, 400, 'Bad request'); }
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
      return await serveStatic(req, res);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { ok: false, error: e.status ? e.message : 'Server error' });
      if (!e.status) log.error?.('[server]', e);
    }
  });

  const sweep = setInterval(() => limiter.sweep(), 10 * 60e3);
  sweep.unref?.();

  await new Promise((done) => server.listen(port, host, done));
  const addr = server.address();
  return {
    server, boards, saver, store, loading,
    port: addr.port,
    async close() {
      clearInterval(sweep);
      await saver.flush();
      await new Promise((r) => server.close(() => r()));
    },
  };
}

// Run directly: start, and save what is pending before Render stops the old
// copy during a deploy (it sends SIGTERM and waits).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await startHosted();
  console.log(`MARGIN CALL ${VERSION} — hosted, listening on port ${app.port}; leaderboards in ${app.store.kind} (${app.store.where})`);
  let stopping = false;
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
      if (stopping) return;
      stopping = true;
      console.log(`[server] ${sig}: saving and shutting down`);
      try { await app.close(); } finally { process.exit(0); }
    });
  }
}
