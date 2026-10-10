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
 *
 * Before it serves anything it brings the folder up to the newest version of
 * the game (see selfUpdate below). MC_NO_UPDATE_CHECK=1 skips that.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { UPDATED } from './scripts/version-check.mjs';

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
  '.ttf':  'font/ttf',
  '.txt':  'text/plain; charset=utf-8',
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
 * Bring the folder up to the newest version before serving it.
 *
 * This used to print "a newer version is available — run npm run update" and
 * leave it to the player, and players kept typing `npm update` instead: npm's
 * own dependency updater, which runs none of this and answers "up to date"
 * whatever state the folder is in. So starting the game now updates it. The
 * updater's auto mode never gets in the way of playing — no clone, no network,
 * files in the way or a diverged branch each print a line and the game starts
 * as it is.
 *
 * @returns {boolean} whether the folder now holds a different build.
 */
function selfUpdate() {
  if (process.env.MC_NO_UPDATE_CHECK === '1' || process.env.MC_UPDATED === '1') return false;
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/update.mjs'), '--auto'],
    { cwd: ROOT, stdio: 'inherit', timeout: 60000 });
  return r.status === UPDATED;
}

/**
 * This process loaded the old server.js, so the new one runs in its place. It
 * shares this terminal, and Ctrl+C reaches it the same way.
 */
function relaunch() {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, MC_UPDATED: '1' } });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
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

if (selfUpdate()) relaunch();
else listen(START_PORT, MAX_TRIES);
