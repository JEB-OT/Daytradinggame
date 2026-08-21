#!/usr/bin/env node
/**
 * MARGIN CALL — dependency-free static server.
 *
 * The game is plain HTML + ES modules, which browsers refuse to load over
 * file://. This serves the folder over http so they load, using nothing but
 * Node's standard library. If you can run `npm`, you can run this.
 *
 *   node server.js            → http://localhost:8080
 *   node server.js 3000       → a port you pick
 *   PORT=3000 node server.js  → same thing
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const START_PORT = Number(process.argv[2] || process.env.PORT || 8080);
const MAX_TRIES = 12;

// .js MUST be a JavaScript type or the browser refuses the module import.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const target = normalize(join(ROOT, clean === '/' ? '/index.html' : clean));
  // Never serve anything outside the game folder.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  const file = safePath(req.url || '/');
  if (!file) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const info = await stat(file);
    const target = info.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      // Always hand back the current build — no stale copies after a git pull.
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<pre style="font:14px monospace;padding:24px">404 — not found\n\n' +
            'Are you running this from the game folder?\n' +
            'It should contain index.html.</pre>');
  }
});

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32' ? 'cmd'
            : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    // A machine with no browser opener (a bare container, a server box) makes
    // spawn emit 'error' asynchronously, which would otherwise take the whole
    // server down with it. The game itself is still perfectly serveable.
    child.on('error', () => {});
    child.unref();
  } catch { /* no browser, no problem */ }
}

// Announce once, reading the port we actually got. Passing a callback to
// listen() would leave a stale one attached after every retry, and they all
// fire on success — printing the ports that failed.
server.on('listening', () => {
  const { port } = server.address();
  const url = `http://localhost:${port}`;
  console.log('');
  console.log('  ╭──────────────────────────────────────────────╮');
  console.log('  │  MARGIN CALL is running                      │');
  console.log('  ╰──────────────────────────────────────────────╯');
  console.log('');
  console.log(`     ${url}`);
  console.log('');
  // Print the version every single time, not just when an update is found.
  // "Am I running the build I think I am?" has to be answerable without the
  // update check working — offline, odd clone, stale refs, all of it. If this
  // line and the title screen disagree, the browser is serving a cached copy;
  // if they agree and both look old, the folder is behind. Two very different
  // problems that used to look identical.
  console.log(`  version  ${localBuild()}`);
  console.log('');
  console.log('  Leave this window open while you play.');
  console.log('  Press Ctrl+C here to stop the server.');
  console.log('');
  console.log('  The title screen shows this same version in its bottom corner.');
  console.log('  If it shows an older one, hard-refresh the page:');
  console.log('     Ctrl+Shift+R  (Windows/Linux)   ·   Cmd+Shift+R  (macOS)');
  console.log('');
  if (process.env.NO_OPEN !== '1') openBrowser(url);
  if (process.env.MC_NO_UPDATE_CHECK !== '1') announceUpdate();
});

/**
 * The version in this folder, and the branch it came from — read straight off
 * disk so it works with no git, no network and no remote at all.
 */
function localBuild() {
  let version = 'unknown (this copy predates version stamping)';
  try {
    const src = readFileSync(resolve(ROOT, 'src/engine/version.js'), 'utf8');
    const v = src.match(/VERSION\s*=\s*'([^']+)'/)?.[1];
    const n = src.match(/VERSION_NAME\s*=\s*'([^']+)'/)?.[1];
    if (v) version = `${v}${n ? ' — ' + n : ''}`;
  } catch { /* an unreadable version file is still a running game */ }
  let branch = null;
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* not a clone, or no git — the version alone still answers it */ }
  return branch ? `${version}   (branch: ${branch})` : version;
}

/**
 * Tell the player when they are about to play an old copy.
 *
 * `git pull` answers "am I behind my own branch?", which is not the same
 * question as "is there a newer version of this game?" — when a build lands on
 * another branch, pull reports `Already up to date` and the game quietly stays
 * as it was. That is impossible to distinguish from everything being fine, so
 * the game says so itself at the one moment the player is guaranteed to look.
 *
 * Runs after the server is already listening and never blocks it: no git, no
 * network, no news — all identical, and all silent. MC_NO_UPDATE_CHECK=1 opts
 * out entirely.
 */
async function announceUpdate() {
  let news = null;
  try {
    const vc = await import('./scripts/version-check.mjs');
    news = await vc.checkInBackground();
    if (!news) return;
    const target = news.suggestion;
    console.log('  ┌──────────────────────────────────────────────┐');
    console.log('  │  A NEWER VERSION OF THE GAME IS AVAILABLE    │');
    console.log('  └──────────────────────────────────────────────┘');
    if (target) {
      console.log(`     ${target.version ? target.version + ' is' : 'It is'} on ${target.branch},`);
      console.log(`     which has ${target.ahead} commit${target.ahead === 1 ? '' : 's'} this copy does not.`);
    } else {
      console.log(`     Your branch is ${news.behind} commit${news.behind === 1 ? '' : 's'} behind.`);
    }
    console.log('');
    console.log('     Stop the server (Ctrl+C) and run:  npm run update');
    console.log('');
  } catch { /* a version check is never worth interrupting a game for */ }
}

function listen(port, triesLeft) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.log(`  port ${port} is busy, trying ${port + 1}…`);
      listen(port + 1, triesLeft - 1);
    } else {
      console.error('\n  Could not start the server:', err.message, '\n');
      process.exit(1);
    }
  });
  server.listen(port);
}

listen(START_PORT, MAX_TRIES);
