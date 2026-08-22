#!/usr/bin/env node
/**
 * MARGIN CALL — publish a version so people can actually get it.
 *
 *   npm run release              tag this commit as the version in version.js
 *   npm run release -- --backfill   tag every past version that never got one
 *   npm run release -- --dry-run    say what it would do, change nothing
 *
 * Bumping VERSION and merging the pull request is only half of shipping. Until
 * a tag points at the commit, GitHub has no v1.5.0 — no entry under Tags, no
 * source download, nothing for `git checkout v1.5.0` to find. The code is up
 * there and the version is still ungettable, which is a confusing way to fail.
 *
 * Pushing the tag is what fixes that, and `.github/workflows/release.yml` turns
 * the pushed tag into a GitHub release with the notes from CHANGELOG.md.
 *
 * Uses nothing but git and Node's standard library, like the rest of the repo.
 */
import { git, tryGit, isRepo, versionAt } from './version-check.mjs';
import { notesFor } from './release-notes.mjs';

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
function line() { console.log(C.dim('─'.repeat(58))); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const backfill = args.includes('--backfill');

console.log('');
console.log(C.bold('  MARGIN CALL — release'));
line();

if (!isRepo()) {
  console.log(C.red('  This folder is not a git clone, so there is nothing to tag.'));
  console.log('');
  process.exit(1);
}

/**
 * Where each version stopped being the current one.
 *
 * Walking first-parent history and reading the stamp at every commit gives the
 * last commit that still said vX — which is the whole of vX as it shipped, not
 * the commit that opened it. Versions that only ever existed inside a feature
 * branch never appear here, and versions older than the stamp itself cannot be
 * derived at all; both are noted in CHANGELOG.md rather than guessed at.
 */
function releasedVersions() {
  const commits = (tryGit(['log', '--first-parent', '--format=%H', 'HEAD']) || '')
    .split('\n').filter(Boolean).reverse();      // oldest first
  const last = new Map();                        // version -> newest commit at it
  for (const sha of commits) {
    const v = versionAt(sha);
    if (v) last.set(v, sha);
  }
  return last;
}

/** Where a tag points in this clone. `null` if there is no such tag. */
function localTag(tag) {
  return tryGit(['rev-list', '-n', '1', tag]);
}

/**
 * The tags GitHub already has, and the commit each one names.
 *
 * "Released" has to mean "on the remote", not "in my clone". A tag that was
 * created here and never pushed is exactly the failure this script exists to
 * fix, so treating it as done would let a second run report success over the
 * same missing release. `null` means we could not ask — offline, no remote —
 * and the caller falls back to the local answer rather than stopping.
 */
function publishedTags() {
  const out = tryGit(['ls-remote', '--tags', 'origin'], { timeout: 15000 });
  if (out === null) return null;
  const map = new Map();
  for (const row of out.split('\n').filter(Boolean)) {
    const [sha, ref] = row.split('\t');
    if (!ref) continue;
    const peeled = ref.endsWith('^{}');
    const name = ref.replace('refs/tags/', '').replace(/\^\{\}$/, '');
    // An annotated tag shows up twice: the tag object, then the commit it
    // wraps as `<tag>^{}`. Only the second says which commit was released.
    if (peeled || !map.has(name)) map.set(name, sha);
  }
  return map;
}

const wanted = [];
if (backfill) {
  for (const [version, sha] of releasedVersions()) wanted.push({ version, sha });
} else {
  const version = versionAt('HEAD');
  if (!version) {
    console.log(C.red('  Could not read VERSION out of src/engine/version.js at HEAD.'));
    console.log('');
    process.exit(1);
  }
  wanted.push({ version, sha: git(['rev-parse', 'HEAD']) });
}

// A dirty tree does not block a tag — a tag names a commit, not your desk — but
// it does mean the thing you are looking at is not the thing being released.
if (git(['status', '--porcelain'])) {
  console.log(C.yellow('  Heads up: you have uncommitted changes.'));
  console.log(C.dim('  They are not in the release — a tag names a commit, not your working tree.'));
  line();
}

const published = publishedTags();
if (published === null) {
  console.log(C.yellow('  Could not reach GitHub to see which tags are already published.'));
  console.log(C.dim('  Going on what this clone knows instead.'));
  line();
}

const toPush = [];
for (const { version, sha } of wanted) {
  const onRemote = published
    ? published.get(version) ?? null
    : localTag(version);              // offline: this clone is the best answer we have

  if (onRemote === sha) {
    console.log(`  ${C.dim('=')} ${version} ${C.dim('already released at ' + sha.slice(0, 7))}`);
    continue;
  }
  if (onRemote) {
    // Moving a tag rewrites what a released version means for everyone who
    // already has it. Never do that on our own initiative.
    console.log(`  ${C.red('!')} ${version} is already released at ${onRemote.slice(0, 7)}, not ${sha.slice(0, 7)}`);
    console.log(C.dim('     Leaving it alone. A released version should not change under people.'));
    continue;
  }
  if (!notesFor(version)) {
    console.log(`  ${C.yellow('?')} ${version} has no CHANGELOG.md section — add one first`);
    continue;
  }

  const here = localTag(version);
  if (here && here !== sha) {
    console.log(`  ${C.red('!')} ${version} exists in this clone at ${here.slice(0, 7)}, but should be ${sha.slice(0, 7)}`);
    console.log(C.dim(`     Leaving it alone. Delete it by hand (git tag -d ${version}) if it is wrong.`));
    continue;
  }

  toPush.push({ version, sha, needsTag: !here });
  console.log(`  ${C.green('+')} ${version} ${C.dim('→ ' + sha.slice(0, 7) + (here ? ' (tagged here, never pushed)' : ''))}`);
}

if (!toPush.length) {
  line();
  console.log(C.green('  Nothing to do.') + C.dim('  Every version is already on GitHub.'));
  console.log('');
  process.exit(0);
}

if (dryRun) {
  line();
  console.log(C.dim('  --dry-run: no tags created, nothing pushed.'));
  console.log('');
  process.exit(0);
}

for (const { version, sha, needsTag } of toPush) {
  if (!needsTag) continue;
  const { heading, body } = notesFor(version);
  git(['tag', '-a', version, sha, '-m', heading, '-m', body]);
}

line();
console.log(C.dim('  pushing…'));

// The push is the whole point, so a flaky network gets a few goes before we
// claim it failed.
let pushed = false;
for (let attempt = 1; attempt <= 4 && !pushed; attempt++) {
  try {
    git(['push', 'origin', ...toPush.map((t) => `refs/tags/${t.version}`)],
      { stdio: ['ignore', 'pipe', 'inherit'] });
    pushed = true;
  } catch {
    if (attempt < 4) {
      console.log(C.dim(`  retrying (${attempt}/3)…`));
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2 ** attempt * 1000);
    }
  }
}

line();
if (!pushed) {
  console.log(C.red('  The tags exist locally but could not be pushed.'));
  console.log(C.dim('  A 403 here means your git credentials may not write tags to this repo.'));
  console.log('  Try again with:  ' + C.cyan(`git push origin ${toPush.map((t) => t.version).join(' ')}`));
  console.log('');
  process.exit(1);
}

console.log(C.green(`  Pushed ${toPush.length} tag${toPush.length === 1 ? '' : 's'}.`));
console.log('');
console.log('  GitHub now has them under ' + C.cyan('Tags') + ', each with a source download,');
console.log('  and the release workflow turns each one into a release with its notes.');
console.log('');
