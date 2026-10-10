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
 * So this does the whole job: fetch, fast-forward, and — if the newest build is
 * on a different branch from the one you are standing on — move you onto it.
 * Printing the two commands and leaving you to run them was not updating, it
 * was homework. It never throws away local work: git refuses to move the folder
 * over anything local the update would overwrite, and the refusal is explained.
 *
 * Uses nothing but git and Node's standard library, like the rest of the repo.
 *
 *   node scripts/update.mjs --auto
 *
 * is what `npm start` runs before it serves the game, so a player never has to
 * remember an update command at all — which matters, because the one people
 * reach for, `npm update`, is npm's own dependency updater: it runs none of
 * this, and answers "up to date" whatever state the folder is in. In auto mode
 * nothing is ever allowed to stop the game starting: no clone, no network, files
 * in the way or a diverged branch each print a line and leave the folder as it
 * is. The exit code says whether the folder moved (UPDATED), so the server
 * knows to restart itself on the new code.
 */
// The logic for "where is the newest build?" lives in version-check.mjs,
// because `npm start` needs exactly the same answer and two copies of a rule
// this fiddly would drift.
import { git, tryGit, isRepo, localVersion, newsFor, widenRefspec, UPDATED } from './version-check.mjs';

const AUTO = process.argv.includes('--auto');

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function line() { console.log(C.dim('─'.repeat(58))); }

/**
 * Say why git would not move the folder, and the one fix that always works.
 *
 * `git stash --include-untracked` sets aside edits and new files alike, and
 * `git stash pop` brings them back. Plain `git stash` and `git checkout .`
 * both leave untracked files where they are, so they never clear an untracked
 * file that is in the way.
 */
function explainRefusal(err, otherwise) {
  const msg = String(err?.stderr || err?.message || '');
  if (!/would be overwritten|untracked working tree files/i.test(msg)) return otherwise();
  const files = [...msg.matchAll(/^\t(.+)$/gm)].map((m) => m[1].trim());
  console.log(C.yellow('  Files in this folder are in the way of the update:'));
  for (const f of files.slice(0, 6)) console.log(C.dim(`    ${f}`));
  if (files.length > 6) console.log(C.dim(`    …and ${files.length - 6} more`));
  console.log('  Set them aside, then update again:');
  console.log(C.cyan('    git stash --include-untracked'));
  console.log(C.cyan('    npm run update'));
  console.log(C.dim('  (`git stash pop` afterwards brings them back, if you want them)'));
}

/** Stop without updating. By hand that is a failure; on the way to a game it is not. */
function giveUp() {
  if (AUTO) console.log(C.dim('  Starting the copy you have.'));
  console.log('');
  process.exit(AUTO ? 0 : 1);
}

// ---------------------------------------------------------------------------
console.log('');
console.log(C.bold(AUTO ? '  MARGIN CALL — checking for a newer version' : '  MARGIN CALL — update'));
line();

if (!isRepo()) {
  console.log(C.red('  This folder is not a git clone.'));
  console.log('  You probably downloaded a ZIP. To get updates, clone it instead:');
  console.log(C.cyan('    git clone https://github.com/JEB-OT/Daytradinggame.git'));
  giveUp();
}

const before = localVersion();
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
console.log(`  branch   ${C.cyan(branch)}`);
console.log(`  version  ${C.cyan(before)}`);

// Nothing is refused up front. Git will not fast-forward or switch branches
// over a local edit or an untracked file that the update would overwrite — it
// stops and leaves the folder exactly as it was — so that refusal, explained by
// explainRefusal() below, is all the protection local work needs.
//
// The up-front check this replaced counted every untracked file as
// "uncommitted changes" and stopped dead. The usual culprit was
// package-lock.json, which npm writes into the folder when someone types
// `npm update` — and neither fix it suggested (`git stash`, `git checkout .`)
// touches an untracked file, so players were sent round the same loop forever.
if (tryGit(['status', '--porcelain', '--untracked-files=no'])) {
  console.log(C.dim('  some of the game\'s files have local edits — they are kept'));
}

console.log(C.dim('  fetching…'));
try {
  widenRefspec();
  // On the way to a game, a dead connection must not hold the window hostage.
  git(['fetch', '--all', '--prune'], { stdio: ['ignore', 'pipe', AUTO ? 'pipe' : 'inherit'], timeout: AUTO ? 15000 : 0 });
} catch {
  line();
  console.log(C.red('  Could not reach GitHub.') + (AUTO ? '' : ' Check your internet connection and try again.'));
  giveUp();
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
    } catch (err) {
      blocked = true;
      explainRefusal(err, () => {
        console.log(C.yellow(`  ${branch} has diverged from its remote — resolve it by hand:`));
        console.log(C.cyan(`    git pull --rebase origin ${branch}`));
      });
    }
  } else {
    console.log(C.dim(`  ${branch} is already up to date with its remote`));
  }
} else {
  console.log(C.dim(`  ${branch} does not track a remote branch`));
}

// --- is another branch carrying a newer build? -----------------------------
// The tree is clean by here — a dirty one exited above — so moving between
// branches cannot lose anything, and the save lives in the browser rather than
// the repo. So do it rather than describe it.
const { suggestion } = newsFor(branch);
let switched = null;
if (suggestion && !blocked) {
  console.log(C.dim(`  ${suggestion.branch} is carrying ${suggestion.version || 'the newest build'} — switching to it…`));
  try {
    git(['checkout', suggestion.branch]);
    // A branch that already existed in this clone may itself be behind.
    if (tryGit(['rev-parse', '--abbrev-ref', '@{upstream}'])) {
      const behind = Number(tryGit(['rev-list', '--count', 'HEAD..@{upstream}']) || 0);
      if (behind > 0) git(['merge', '--ff-only', '@{upstream}']);
    }
    switched = suggestion.branch;
    moved = true;
  } catch (err) {
    blocked = true;
    explainRefusal(err, () => {
      console.log(C.yellow('  Could not switch branches automatically. Do it by hand:'));
      console.log(C.cyan(`    git checkout ${suggestion.branch}`));
      console.log(C.cyan('    git pull'));
    });
  }
}

line();
const after = localVersion();
if (blocked) {
  console.log(C.yellow(moved ? '  Only partly updated.' : '  Not updated.') + '  Run the command above, then try again.');
  if (AUTO) console.log(C.dim('  Starting the copy you have.'));
} else if (moved) {
  console.log(C.green('  Updated.') + `  Now on ${C.cyan(after)}` + C.dim(`  (was ${before})`));
  if (switched) console.log(C.dim(`  Moved you onto ${switched} — your save is in the browser, so nothing was lost.`));
  console.log('');
  if (AUTO) {
    console.log(C.dim('  Starting the new version…'));
  } else {
    console.log('  Start the game with ' + C.cyan('npm start') + ', then hard-refresh the page:');
    console.log(C.dim('    Ctrl+Shift+R  (Windows/Linux)   ·   Cmd+Shift+R  (macOS)'));
  }
} else {
  console.log(C.green('  Already on the newest version.') + `  ${C.cyan(after)}`);
  if (!AUTO) console.log(C.dim('  The title screen shows this same number — if it disagrees, hard-refresh the page.'));
}
console.log('');
if (AUTO) process.exit(moved ? UPDATED : 0);
