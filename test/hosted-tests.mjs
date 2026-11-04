// Tests for the hosted version: the leaderboard rules, the stores, and the
// server end to end. Run as part of `npm test` (run-tests.mjs awaits these).
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Leaderboards, BOARD_KEYS, MAX_ENTRIES, cleanName, playerId, emptyDoc } from '../server/leaderboard.mjs';
import { fileStore, upstashStore, Saver } from '../server/store.mjs';
import { startHosted } from '../server/hosted.mjs';

const quiet = { log() {}, warn() {}, error() {} };
const tok = (n) => ('trader-token-' + n).padEnd(32, 'x');

export function hostedTests({ eq, ok }) {
  const tests = [];
  const ta = (name, fn) => tests.push([name, fn]);

  ta('leaderboard: one entry per trader per board — a better score replaces it, a worse one is ignored', () => {
    const lb = new Leaderboards(null);
    const a = playerId(tok(1)), b = playerId(tok(2));
    ok(lb.register(a, 'Alice').ok); ok(lb.register(b, 'Bob').ok);
    eq(lb.submit(a, 'campaign', 500).improved, true);
    eq(lb.submit(a, 'campaign', 300).improved, false, 'a lower score must not count');
    eq(lb.submit(a, 'campaign', 900).improved, true);
    lb.submit(b, 'campaign', 700);
    const top = lb.top('campaign');
    eq(top.entries.length, 2, 'Alice must hold exactly one place');
    eq(top.entries[0].name, 'Alice'); eq(top.entries[0].value, 900);
    eq(top.entries[1].name, 'Bob');
    eq(lb.submit(a, 'endless', 5).improved, true, 'the boards are separate');
    eq(lb.top('endless').entries.length, 1);
  });

  ta('leaderboard: names are unique in any case, and a trader can rename', () => {
    const lb = new Leaderboards(null);
    const a = playerId(tok(1)), b = playerId(tok(2));
    ok(lb.register(a, 'Bullish Otter 42').ok);
    eq(lb.register(b, 'bullish otter 42').status, 409, 'a name differing only in case is taken');
    ok(lb.register(a, 'Sly Fox').ok, 'renaming');
    ok(lb.register(b, 'Bullish Otter 42').ok, 'the old name is free again');
    lb.submit(a, 'overkill', 12.5);
    eq(lb.top('overkill').entries[0].name, 'Sly Fox', 'the board shows the new name');
  });

  ta('leaderboard: bad names, boards and values are refused', () => {
    for (const bad of ['', 'a', 'x'.repeat(19), '<script>', 'admin', '   ', '---', 'a\u0000b']) eq(cleanName(bad), null, `"${bad}" should be refused`);
    eq(cleanName('  Jöse   Çağrı  '), 'Jöse Çağrı', 'other alphabets are fine, spaces collapse');
    const lb = new Leaderboards(null);
    const a = playerId(tok(1));
    eq(lb.submit(a, 'campaign', 10).status, 401, 'no name, no entry');
    lb.register(a, 'Alice');
    for (const v of [0, -5, NaN, Infinity, 'lots', 1e301]) eq(lb.submit(a, 'campaign', v).ok, false, `${v} is not a score`);
    eq(lb.submit(a, 'nope', 10).status, 400);
  });

  ta('leaderboard: a board keeps its best MAX_ENTRIES; earlier wins a tie', () => {
    const lb = new Leaderboards(null);
    for (let i = 0; i < MAX_ENTRIES + 5; i++) { const p = playerId(tok('p' + i)); lb.register(p, 'Trader ' + i); lb.submit(p, 'campaign', 1000 + i, {}, i); }
    eq(lb.sorted('campaign').length, MAX_ENTRIES);
    eq(lb.top('campaign').entries[0].value, 1000 + MAX_ENTRIES + 4, 'the best is kept');
    eq(lb.sorted('campaign').at(-1)[1].value, 1005, 'the five lowest fell off');
    const x = playerId(tok('tie1')), y = playerId(tok('tie2'));
    lb.register(x, 'First'); lb.register(y, 'Second');
    lb.submit(x, 'endless', 77, {}, 1); lb.submit(y, 'endless', 77, {}, 2);
    eq(lb.top('endless').entries[0].name, 'First');
  });

  ta('leaderboard: a ban takes a trader off every board and keeps them off', () => {
    const lb = new Leaderboards(null);
    const a = playerId(tok(1));
    lb.register(a, 'Cheater'); lb.submit(a, 'campaign', 1e9); lb.submit(a, 'overkill', 999);
    ok(lb.ban('cheater').ok);
    for (const b of BOARD_KEYS) eq(lb.top(b).entries.length, 0);
    lb.submit(a, 'campaign', 2e9);
    eq(lb.top('campaign').entries.length, 0, 'a banned trader posts into nothing');
  });

  ta('leaderboard: an old document gains new boards without losing the old ones', () => {
    const old = emptyDoc(); delete old.boards.overkill; old.boards.retired = { someone: { value: 1 } };
    const lb = new Leaderboards(old);
    ok(lb.doc.boards.overkill && lb.doc.boards.retired, 'a new board appears, a retired one is kept');
  });

  ta('store: the file store round-trips, and a missing file is "nothing yet", not an error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-lb-'));
    try {
      const st = fileStore(dir);
      eq(await st.load(), null);
      const lb = new Leaderboards(null);
      lb.register(playerId(tok(1)), 'Alice'); lb.submit(playerId(tok(1)), 'campaign', 42);
      await st.save(lb.doc);
      const back = new Leaderboards(await st.load());
      eq(back.top('campaign').entries[0].value, 42);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  ta('store: Upstash is spoken correctly — split keys, and only what changed is sent', async () => {
    const kv = new Map(); const sent = [];
    const fakeFetch = async (url, init) => {
      eq(init.headers.Authorization, 'Bearer tkn');
      ok(url.endsWith('/pipeline'));
      const cmds = JSON.parse(init.body); sent.push(cmds);
      const out = cmds.map(([op, k, v]) => (op === 'GET' ? { result: kv.has(k) ? kv.get(k) : null } : (kv.set(k, v), { result: 'OK' })));
      return { ok: true, status: 200, json: async () => out, text: async () => '' };
    };
    const st = upstashStore('https://x.upstash.io/', 'tkn', { fetchImpl: fakeFetch });
    eq(await st.load(), null, 'an empty database is nothing yet');
    const lb = new Leaderboards(null);
    lb.register(playerId(tok(1)), 'Alice'); lb.submit(playerId(tok(1)), 'campaign', 42);
    await st.save(lb.doc);
    ok(kv.has('margincall:players') && kv.has('margincall:board:campaign'));
    sent.length = 0;
    lb.submit(playerId(tok(1)), 'overkill', 3);
    await st.save(lb.doc);
    const keysSent = sent[0].map((c) => c[1]);
    ok(keysSent.includes('margincall:board:overkill'), 'the changed board is written');
    ok(!keysSent.includes('margincall:board:campaign') && !keysSent.includes('margincall:board:endless'), 'untouched boards are not re-sent');
    const again = upstashStore('https://x.upstash.io', 'tkn', { fetchImpl: fakeFetch });
    const back = new Leaderboards(await again.load());
    eq(back.top('overkill').entries[0].value, 3);
    eq(back.top('campaign').entries[0].name, 'Alice');
  });

  ta('store: a failed load never lets an empty board overwrite the saved one', async () => {
    let saves = 0;
    const flaky = { kind: 'test', persistent: true, where: 'x', load: async () => { throw new Error('down'); }, save: async () => { saves++; } };
    const lb = new Leaderboards(null);
    const saver = new Saver(flaky, lb, { delay: 1, log: quiet });
    lb.register(playerId(tok(1)), 'Alice');
    saver.schedule(); await saver.flush();
    eq(saves, 0, 'nothing is written until a load has succeeded');
  });

  ta('server: the whole round trip, and the boards survive a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-host-'));
    const env = { DATA_DIR: dir };
    let app = await startHosted({ port: 0, host: '127.0.0.1', env, store: fileStore(dir), adminToken: 'sekrit', log: quiet });
    try {
      await app.loading;
      const base = `http://127.0.0.1:${app.port}`;
      const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
      const h = await (await fetch(base + '/api/health')).json();
      eq(h.game, 'margin-call'); ok(h.version); eq(h.storage.persistent, true);
      const A = tok('a'), B = tok('b');
      eq((await post('/api/player', { token: A, name: 'Alice' })).status, 200);
      eq((await post('/api/player', { token: B, name: 'ALICE' })).status, 409);
      eq((await post('/api/player', { token: B, name: 'Bob' })).status, 200);
      eq((await post('/api/score', { token: A, board: 'campaign', value: 1000, week: 3 })).body.rank, 1);
      eq((await post('/api/score', { token: B, board: 'campaign', value: 5000, week: 5 })).body.rank, 1);
      eq((await post('/api/score', { token: A, board: 'campaign', value: 200, week: 6 })).body.improved, false);
      const boards = (await post('/api/leaderboards', { token: A })).body;
      eq(boards.boards.campaign.entries.length, 2);
      eq(boards.boards.campaign.you.rank, 2, 'Alice sees her own place');
      eq(boards.you.name, 'Alice');
      eq((await post('/api/me', { token: B })).body.boards.campaign.value, 5000, 'a trader code finds its trader');
      // moderation
      eq((await post('/api/admin/remove', { name: 'bob' })).status, 403, 'not without the admin token');
      eq((await post('/api/admin/remove', { name: 'bob' }, { Authorization: 'Bearer sekrit' })).body.removed, 1);
      // the game is served, and nothing else is
      eq((await fetch(base + '/')).status, 200);
      eq((await fetch(base + '/src/main.js')).status, 200);
      for (const p of ['/server/hosted.mjs', '/package.json', '/.git/config', '/data/leaderboards.json', '/src/..%2f..%2fserver%2fhosted.mjs', '/test/run-tests.mjs']) {
        eq((await fetch(base + p)).status, 404, p + ' must not be served');
      }
      await app.close();
      // a "deploy": a new server on the same storage
      app = await startHosted({ port: 0, host: '127.0.0.1', env, store: fileStore(dir), log: quiet });
      await app.loading;
      const after = await (await fetch(`http://127.0.0.1:${app.port}/api/leaderboards`)).json();
      eq(after.boards.campaign.entries.length, 1, 'Alice is still there after the restart (Bob was removed)');
      eq(after.boards.campaign.entries[0].name, 'Alice');
    } finally {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  ta('server: a flood of writes from one address is slowed down', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mc-rate-'));
    const app = await startHosted({ port: 0, host: '127.0.0.1', env: {}, store: fileStore(dir), log: quiet });
    try {
      await app.loading;
      let limited = false;
      for (let i = 0; i < 60 && !limited; i++) {
        const r = await fetch(`http://127.0.0.1:${app.port}/api/score`, { method: 'POST', body: JSON.stringify({ token: tok('z'), board: 'campaign', value: i + 1 }) });
        if (r.status === 429) limited = true;
      }
      ok(limited, 'sixty writes a minute from one address should hit the limit');
    } finally { await app.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  return tests;
}

