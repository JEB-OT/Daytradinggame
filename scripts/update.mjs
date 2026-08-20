#!/usr/bin/env node
/**
 * MARGIN CALL — pull the latest version of the game.
 *
 *   npm run update
 *
 * Plain `git pull` is not enough on its own, because the newest work usually
 * lands on a feature branch first and only reaches the default branch when its
 * pull request is merged. Someone sitting on the default branch can pull all
 * day and never see it — the game just keeps looking the same, which is
 * indistinguishable from "the update didn't work".
 *
 * So this does the whole job: fetch, fast-forward, and if a release branch is
 * ahead of wherever you are, say exactly what to run to get on it. It never
 * throws away local work — a dirty tree stops it with an explanation instead.
 *
 * Uses nothing but git and Node's standard library, like the rest of the repo.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Branches that may carry a newer build than the default branch, best first.
 * When a feature branch is merged its entry can come out — the script skips
 * any branch that is already contained in the one you are on.
 */
const RELEASE_BRANCHES = [
  'claude/day-trading-candle-mechanics-mordep',
  'claude/roguelike-day-trading-game-vy5qsg',
];

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}
/** Run git and hand back null instead of throwing — for questions, not actions. */
function tryGit(args) {
  try { return git(args); } catch { return null; }
}

function localVersion() {
  try {
    const src = readFileSync(resolve(ROOT, 'src/engine/version.js'), 'utf8');
    const v = src.match(/VERSION\s*=\s*'([^']+)'/)?.[1];
    const n = src.match(/VERSION_NAME\s*=\s*'([^']+)'/)?.[1];
    return v ? `${v}${n ? ' — ' + n : ''}` : 'unknown';
  } catch { return 'unknown (this copy predates version stamping)'; }
}

function line() { console.log(C.dim('─'.repeat(58))); }

// ---------------------------------------------------------------------------
console.log('');
console.log(C.bold('  MARGIN CALL — update'));
line();

if (!tryGit(['rev-parse', '--git-dir'])) {
  console.log(C.red('  This folder is not a git clone.'));
  console.log('  You probably downloaded a ZIP. To get updates, clone it instead:');
  console.log(C.cyan('    git clone https://github.com/JEB-OT/Daytradinggame.git'));
  console.log('');
  process.exit(1);
}

const before = localVersion();
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
console.log(`  branch   ${C.cyan(branch)}`);
console.log(`  version  ${C.cyan(before)}`);

// A dirty tree is the one thing that can lose work, so stop rather than guess.
const dirty = git(['status', '--porcelain']);
if (dirty) {
  line();
  console.log(C.yellow('  You have uncommitted changes, so nothing was pulled.'));
  console.log('  Keep them:   ' + C.cyan('git stash') + C.dim('   (then re-run npm run update, and `git stash pop`)'));
  console.log('  Bin them:    ' + C.cyan('git checkout .'));
  console.log('');
  process.exit(1);
}

console.log(C.dim('  fetching…'));
try {
  // A shallow/single-branch clone only tracks the branch it was made from, so a
  // plain fetch never even learns the other branches exist and `git checkout`
  // fails with "pathspec did not match". Widen the refspec first — a no-op on a
  // normal clone, and the difference between working and not on a narrow one.
  tryGit(['remote', 'set-branches', 'origin', '*']);
  git(['fetch', '--all', '--prune'], { stdio: ['ignore', 'pipe', 'inherit'] });
} catch {
  line();
  console.log(C.red('  Could not reach GitHub. Check your internet connection and try again.'));
  console.log('');
  process.exit(1);
}

// --- fast-forward the branch you are on -----------------------------------
let moved = false;
let blocked = false;   // a fast-forward we could not do — never claim success after one
if (tryGit(['rev-parse', '--abbrev-ref', '@{upstream}'])) {
  const behind = Number(tryGit(['rev-list', '--count', 'HEAD..@{upstream}']) || 0);
  if (behind > 0) {
    try {
      git(['merge', '--ff-only', '@{upstream}']);
      console.log(C.green(`  pulled ${behind} new commit${behind === 1 ? '' : 's'} onto ${branch}`));
      moved = true;
    } catch {
      blocked = true;
      console.log(C.yellow(`  ${branch} has diverged from its remote — resolve it by hand:`));
      console.log(C.cyan(`    git pull --rebase origin ${branch}`));
    }
  } else {
    console.log(C.dim(`  ${branch} is already up to date with its remote`));
  }
} else {
  console.log(C.dim(`  ${branch} does not track a remote branch`));
}

// --- is a release branch ahead of where you are? ---------------------------
let suggestion = null;
for (const rb of RELEASE_BRANCHES) {
  const ref = `origin/${rb}`;
  if (!tryGit(['rev-parse', '--verify', ref])) continue;
  if (rb === branch) break;                       // already on it
  const ahead = Number(tryGit(['rev-list', '--count', `HEAD..${ref}`]) || 0);
  if (ahead > 0) { suggestion = { branch: rb, ahead }; break; }
}

line();
const after = localVersion();
if (blocked) {
  console.log(C.yellow('  Not updated.') + '  Run the command above, then try again.');
} else if (suggestion) {
  console.log(C.yellow(`  ${suggestion.branch} has ${suggestion.ahead} commit${suggestion.ahead === 1 ? '' : 's'} you do not have.`));
  console.log('  That is where the newest version lives. To switch to it:');
  console.log('');
  console.log(C.cyan(`    git checkout ${suggestion.branch}`));
  console.log(C.cyan(`    git pull`));
  console.log('');
  console.log(C.dim('  (Your save is in the browser, not the repo, so switching keeps it.)'));
} else if (moved) {
  console.log(C.green('  Up to date.') + `  Now on ${C.cyan(after)}`);
  console.log('');
  console.log('  Start the game with ' + C.cyan('npm start') + ', then hard-refresh the page:');
  console.log(C.dim('    Ctrl+Shift+R  (Windows/Linux)   ·   Cmd+Shift+R  (macOS)'));
} else {
  console.log(C.green('  Already on the newest version.') + `  ${C.cyan(after)}`);
  console.log(C.dim('  The title screen shows this same number — if it disagrees, hard-refresh the page.'));
}
console.log('');
