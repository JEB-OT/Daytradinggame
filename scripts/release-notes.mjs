/**
 * The CHANGELOG entry for one version, as plain markdown.
 *
 *   node scripts/release-notes.mjs v1.5.0
 *
 * Used by `npm run release` and by the release workflow, so the notes on a
 * GitHub release are the same words as CHANGELOG.md rather than a second copy
 * that drifts. Sections are delimited by `## v<version> — <name>` headings.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './version-check.mjs';

/** The heading line for `version`, plus everything under it. `null` if absent. */
export function notesFor(version, changelog = readChangelog()) {
  const want = version.startsWith('v') ? version : `v${version}`;
  const lines = changelog.split('\n');

  // A heading counts as this version's only if the token after `## ` matches
  // exactly — otherwise `v1.3` would claim the `v1.3.3` section.
  const isHeadingFor = (l, v) => {
    const m = l.match(/^##\s+(\S+)/);
    return m ? m[1] === v : false;
  };

  const start = lines.findIndex((l) => isHeadingFor(l, want));
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }
  return { heading: lines[start].replace(/^##\s+/, ''), body: lines.slice(start + 1, end).join('\n').trim() };
}

export function readChangelog() {
  return readFileSync(resolve(ROOT, 'CHANGELOG.md'), 'utf8');
}

/** Every version that has a section, newest first. */
export function versionsInChangelog(changelog = readChangelog()) {
  return [...changelog.matchAll(/^##\s+(v\S+)/gm)].map((m) => m[1]);
}

// --- run directly ----------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('release-notes.mjs')) {
  const args = process.argv.slice(2);
  const wantTitle = args.includes('--title');       // the heading, for a release title
  const version = args.find((a) => !a.startsWith('--'));
  if (!version) {
    console.error('usage: node scripts/release-notes.mjs [--title] v1.5.0');
    process.exit(2);
  }
  const found = notesFor(version);
  if (!found) {
    console.error(`No CHANGELOG.md section for ${version}.`);
    console.error(`Known: ${versionsInChangelog().join(', ')}`);
    process.exit(1);
  }
  console.log(wantTitle ? found.heading : found.body);
}
