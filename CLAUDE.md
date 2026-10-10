# MARGIN CALL — notes for Claude

A browser roguelike deckbuilder. No build step and no dependencies: `npm start` serves the repo,
`npm test` runs `test/run-tests.mjs`, `npm run sim` plays 200 bot runs for balance.

## Shipping a patch — every time, without being asked

The owner wants every patch on GitHub the moment it is done: merged, released, and visible on
the repository page. A patch is not finished until all of this has happened.

1. **Version it.** Bump `VERSION` (and `VERSION_NAME` if it is a new release name) in
   `src/engine/version.js` and add an entry to its in-game `CHANGELOG`. Add the matching
   `## vX.Y.Z — Name` section to `CHANGELOG.md`, set `"version"` in `package.json`, and add a row
   to the version table in `README.md` (the version table, and any counts the patch changes, are
   what people read on the GitHub page). The test suite fails if `CHANGELOG.md` is missing the
   current version.
2. **Verify.** `npm test` green; `npm run sim` for anything touching balance; drive the real game in
   a browser for anything visual.
3. **One patch, one pull request.** Commit on the working branch, push, and open a pull request
   into the default branch (`claude/roguelike-day-trading-game-vy5qsg`). Never put two versions
   in one pull request: the release tooling tags the default branch's first-parent history, so a
   version that only ever existed inside a merged branch gets no tag of its own (that is what
   happened to v1.3.1 and v1.6.0).
4. **Merge it** with a merge commit, once it is clean and mergeable. The owner has asked for this
   to happen without waiting on them.
5. **Release it.** Run the `Release` workflow (`.github/workflows/release.yml`) on the default
   branch with `backfill: true`. It tags every version that lacks a tag and publishes a GitHub
   Release for each, with notes taken from `CHANGELOG.md`. Pushing a tag from a Claude session
   is refused, so the workflow is the way in. Then confirm the new version is listed — and marked
   Latest — on the Releases page.
6. **Start the next patch fresh.** After the merge, restart the working branch from the default
   branch rather than stacking new work on merged history.

## Art

Card pictures are inline SVG built in `src/ui/art.js`, not emoji: a glyph library, a frame per
kind of card, and a pip on brokers. The look is hand-inked — wobbling ink lines, hard cel
highlights, cross-hatched shadows — and stays vector rather than pixelated. New cards need an
entry in the `ART` table (the tests fail without one), and new glyphs should be drawn with the
same helpers so they pick up the same treatment.
