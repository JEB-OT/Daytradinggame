/**
 * "Is there a newer version of the game than the one in this folder?"
 *
 * Shared by `npm run update` and by `npm start`, which prints a one-line notice
 * when the answer is yes. Both need the same answer, and the answer is not the
 * obvious one: `git pull` only ever updates the branch you are standing on, so
 * it reports `Already up to date` while a finished build sits on another branch.
 * Anything that only asks git "am I behind my upstream?" inherits that blind
 * spot, which is exactly how a player ends up staring at an old game being told
 * everything is fine.
 *
 * Nothing here throws. A missing git, a detached HEAD, no network — every one of
 * them just means "no news", because none of them is a reason to stop the game
 * from starting.
 */
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');


export function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts,
  }).trim();
}

/** Ask git a question. Any failure is an answer of `null`, never a throw. */
export function tryGit(args, opts = {}) {
  try { return git(args, opts); } catch { return null; }
}

/** The version stamped into this working copy. */
export function localVersion() {
  try {
    const src = readFileSync(resolve(ROOT, 'src/engine/version.js'), 'utf8');
    const v = src.match(/VERSION\s*=\s*'([^']+)'/)?.[1];
    const n = src.match(/VERSION_NAME\s*=\s*'([^']+)'/)?.[1];
    return v ? `${v}${n ? ' — ' + n : ''}` : 'unknown';
  } catch { return 'unknown (this copy predates version stamping)'; }
}

/** The version on a ref, read straight out of git rather than the working tree. */
export function versionAt(ref) {
  const src = tryGit(['show', `${ref}:src/engine/version.js`]);
  return src?.match(/VERSION\s*=\s*'([^']+)'/)?.[1] ?? null;
}

export function isRepo() { return !!tryGit(['rev-parse', '--git-dir']); }
export function currentBranch() { return tryGit(['rev-parse', '--abbrev-ref', 'HEAD']); }

/**
 * A single-branch clone only tracks the branch it was made from, so it never
 * learns the others exist. Widening the refspec is a no-op on a normal clone
 * and the difference between working and not on a narrow one.
 */
export function widenRefspec() { tryGit(['remote', 'set-branches', 'origin', '*']); }

/** Fetch without ever hanging the caller. Returns whether it worked. */
export function fetchQuiet(timeout = 8000) {
  widenRefspec();
  return tryGit(['fetch', '--all', '--prune', '--quiet'], { timeout }) !== null;
}

/** 'v1.10.0' beats 'v1.9.0'. Compared number by number, never as text. */
export function compareVersions(a, b) {
  const parts = (v) => String(v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

/** The branch a fresh clone lands on, or `null` if this clone cannot tell. */
export function defaultBranch() {
  let ref = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (!ref) {
    // A clone made before the remote had a default branch has no origin/HEAD.
    // Ask once, with a timeout, and carry on regardless if there is no network.
    tryGit(['remote', 'set-head', 'origin', '-a'], { timeout: 8000 });
    ref = tryGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  }
  return ref ? ref.replace(/^origin\//, '') : null;
}

/**
 * Which branch on the remote is actually carrying the newest build.
 *
 * This used to be a hand-written list, ordered "best first", and it rotted
 * exactly the way hand-written lists do: the newest work landed on a branch
 * nobody had added, the oldest branch sat at the top of the list, and the
 * search stopped the moment it reached the branch you were standing on — so a
 * player on the first entry was told they were up to date while three versions
 * behind. Nothing here is maintained by hand any more. Every branch on the
 * remote is asked what version it carries and the highest one wins; the
 * remote's own default branch breaks a tie, because that is what a fresh clone
 * gets.
 */
export function newestRelease() {
  const refs = (tryGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']) || '')
    .split('\n').map((r) => r.trim())
    .filter((r) => r && !r.endsWith('/HEAD'));
  const head = defaultBranch();
  const rows = [];
  for (const ref of refs) {
    const version = versionAt(ref);
    if (version) rows.push({ ref, name: ref.replace(/^origin\//, ''), version });
  }
  rows.sort((a, b) => compareVersions(b.version, a.version)
    || (b.name === head ? 1 : 0) - (a.name === head ? 1 : 0));
  return rows[0] || null;
}

/**
 * Where the newest build is, relative to this working copy.
 *
 * @returns {{behind:number, suggestion:{branch:string, ahead:number, version:string|null}|null}}
 *          `behind` counts commits on your own upstream you have not pulled;
 *          `suggestion` names a branch holding commits you do not have at all.
 */
export function newsFor(branch = currentBranch()) {
  const out = { behind: 0, suggestion: null };
  if (!branch) return out;

  if (tryGit(['rev-parse', '--abbrev-ref', '@{upstream}'])) {
    out.behind = Number(tryGit(['rev-list', '--count', 'HEAD..@{upstream}']) || 0);
  }
  const best = newestRelease();
  if (!best || best.name === branch) return out;

  const ahead = Number(tryGit(['rev-list', '--count', `HEAD..${best.ref}`]) || 0);
  if (!ahead) return out;

  // Only ever point forwards. A branch holding commits you lack but an older
  // version stamp is a side road, not an update.
  const here = versionAt('HEAD');
  if (here && compareVersions(best.version, here) < 0) return out;

  out.suggestion = { branch: best.name, ahead, version: best.version };
  return out;
}

/**
 * The `npm start` path: fetch and answer off the main thread, and hand back
 * nothing at all unless there is genuinely something to say. Never rejects.
 */
export function checkInBackground() {
  return new Promise((done) => {
    if (!isRepo()) return done(null);
    widenRefspec();
    execFile('git', ['fetch', '--all', '--prune', '--quiet'],
      { cwd: ROOT, timeout: 8000 }, () => {
        // Even a failed fetch is worth answering from: refs already on disk can
        // show the player is behind something they fetched earlier.
        try {
          const news = newsFor();
          done(news.behind > 0 || news.suggestion ? news : null);
        } catch { done(null); }
      });
  });
}
