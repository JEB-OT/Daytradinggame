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

/**
 * Branches that may carry a newer build than the default branch, best first.
 * A branch already merged into the one you are on contains no commits you lack,
 * so it drops out of the answer on its own and needs no maintenance here.
 */
export const RELEASE_BRANCHES = [
  'claude/day-trading-candle-mechanics-mordep',
  'claude/roguelike-day-trading-game-vy5qsg',
];

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
  for (const rb of RELEASE_BRANCHES) {
    const ref = `origin/${rb}`;
    if (!tryGit(['rev-parse', '--verify', ref])) continue;
    if (rb === branch) break;                 // already standing on it
    const ahead = Number(tryGit(['rev-list', '--count', `HEAD..${ref}`]) || 0);
    if (ahead > 0) { out.suggestion = { branch: rb, ahead, version: versionAt(ref) }; break; }
  }
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
