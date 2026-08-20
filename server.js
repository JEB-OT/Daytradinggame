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
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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
  try { spawn(cmd, args, { stdio: 'ignore', detached: true }).unref(); } catch { /* no browser, no problem */ }
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
  console.log('  Leave this window open while you play.');
  console.log('  Press Ctrl+C here to stop the server.');
  console.log('');
  if (process.env.NO_OPEN !== '1') openBrowser(url);
});

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
