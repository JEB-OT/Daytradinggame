# Changelog

Every version the game has shipped, newest first. The number here is the number on your title
screen — if yours is lower, you are running an old copy, so see
[Updating](README.md#updating-to-the-latest-version).

Each released version has a matching git tag, so any version on this page can be downloaded or
checked out on its own: see [Getting a specific version](README.md#getting-a-specific-version).

## v1.10.2 — Inked

*2026-10-10*

- **A stray file no longer stops an update.** Typing `npm update` — npm's own command, not the
  game's — writes a `package-lock.json` into the folder. The updater counted that as
  `You have uncommitted changes, so nothing was pulled` and stopped, and neither fix it offered
  (`git stash`, `git checkout .`) removes a new file, so a player was sent round the same loop
  forever. The up-front check is gone: git itself refuses to update over anything local the update
  would overwrite and leaves the folder as it was, which is all the protection local work needs.
  Untracked files are ignored, and edits to files the update does not touch are carried along
- **When something really is in the way, it says what** — the files, and
  `git stash --include-untracked` followed by `npm run update`, which sets aside edits and new
  files alike (`git stash pop` brings them back)
- **npm no longer drops the file at all.** An `.npmrc` turns lockfiles off for this dependency-free
  game, and `.gitignore` ignores any that already exist
- Copies older than this still have the old check, so a stuck copy needs that stash once:
  `git stash --include-untracked`, then `npm run update`

## v1.10.1 — Inked

*2026-10-10*

- **`npm start` updates the game itself.** Every launch — `npm start` or either double-click
  launcher — fetches, fast-forwards, moves you onto the branch carrying the newest build if that is
  a different one, and then starts that build. Nothing to remember and nothing to type. It never
  gets in the way of playing: with no internet, local changes of your own or a diverged branch it
  says so in one line and starts the copy you have. `MC_NO_UPDATE_CHECK=1 npm start` skips it
- **`npm update` was never the update command.** Without the `run`, npm runs its own dependency
  updater; this game has no dependencies, so it printed `up to date, audited 1 package` and changed
  nothing, whatever version you were on. The README now says so at the top and in the
  troubleshooting table, and `npm start` makes the question moot
- **The GitHub page leads with the newest version** — what it is, what changed, a link to its
  release notes, and a screenshot of the game as it looks now. The test suite fails if that line,
  or the first row of the version table, names anything but the version being shipped, so a
  release can no longer leave the front page a version behind

## v1.10.0 — Inked

*2026-10-10*

- **The whole interface is hand-inked to match the cards.** v1.9 drew the card art in a wobbling
  pen line, but it sat inside flat neon panels that belonged to a different game. Every surface —
  panels, sheets, buttons, the Volume and Leverage chips, tooltips, toasts, tabs, wells, tape rows,
  shop tiles and deadline cards — is now outlined in the same ink, run through the same kind of
  turbulence so the line wobbles, with flat paint, a hard-edged band of light along the top and pen
  hatching along the bottom. Each surface keeps its coloured rim inside the ink, so rarity, bull or
  bear, boss and the rest still read at a glance
- **Candles are playing cards.** Each one is cream card stock with a ledger-paper window, the
  candlestick inked in and filled flat with light down one side. An enhancement re-stocks the card in
  its own colour, the way a steel or gold card does, and the back of a face-down card is a red
  lattice
- **Hand lettering.** Numbers, labels, headings and buttons are set in Bangers, a comic-book capital;
  descriptions and rules in Patrick Hand. Both ship with the game under the SIL Open Font License
  (`src/fonts/`), so nothing is fetched from the web
- **The chart is chalked onto a slate** — a wavering grid, the area under the price hatched rather
  than airbrushed, and every candle a flat body in an ink line. The waver is seeded per candle, so a
  candle keeps its shape as the tape scrolls instead of shimmering
- The background is shaded in at the corners with a pen, and the scanlines are now paper grain
- Fixed: a multiplier built from other multipliers flew across the screen in full — `x2.5600000000000005
  Lev` — instead of `x2.56 Lev`
- The left column fits a 760px-tall screen with Today's Tape still showing; it used to spill off
  the bottom
- Same cost to draw: frame times on the desk and during a trade match v1.9.1

## v1.9.1 — Drawn by Hand

*2026-10-10*

- **The card art is hand-inked.** v1.9.0 replaced the emoji with illustrations, but they were
  shaded with smooth airbrushed gradients and read as clip-art. Every shape is now flat colour with a
  hard-edged cel highlight and cross-hatched shadow, outlined in ink, and each picture runs through a
  turbulence filter so its lines wobble the way a pen's do — stylish and hand-made, still vector
  rather than pixelated
- Frames keep polished cel-banded metal with no hatching, so rims and gold stay crisp and the
  drawing carries the texture
- Same cost to draw: the 140-broker compendium renders in about the time it did before

## v1.9.0 — Drawn by Hand

*2026-10-08*

- **Every card is illustrated.** All ~290 cards showed a bare emoji — a font glyph the size and
  style of a chat message. Each now has its own vector illustration from a library of 195 hand-drawn
  glyphs, every shape shaded and ink-outlined, set in a frame that says what kind of card it is: a
  struck medallion for a broker (rimmed by rarity, Legendary in a gold sunburst), a tarot card for a
  Chart, a sealed scroll for a Contract, a speech bubble for a Rumor, a shield for a licence, a
  spiked crest for a boss, a foil wrapper for a pack
- **Brokers wear a pip** for what they add to a trade — × multiplies, red + adds Leverage, blue +
  adds Volume, $ pays cash, ↻ reprints, ⚙ changes a rule. It is read off each broker's own hooks
  rather than written per card, so it cannot disagree with what the broker does, and it makes desk
  order readable at a glance: the +s go left of the ×s
- **Contracts draw their formation** — a Staircase Contract shows five rising candlesticks, a
  Pillars Contract three and two
- **No formation reads the order you click candles in.** Three White Soldiers and Three Black Crows
  wanted their bodies placed rising (or falling) and unbroken, so 1-2-3-4-5 printed a march and
  2-1-4-3-5 — the same five cards — printed nothing. A march is now three or more candles of one
  colour on different bodies, however they were placed, and a candle of the other colour among them
  no longer breaks it. Order still decides which candle prints first, which is where it belongs

## v1.8.1 — Compound Interest

*2026-08-22*

- **`npm run update` finds the newest build again.** It carried a hand-written list of branches,
  ordered "best first", and stopped searching the moment it reached the branch you were standing
  on. The list had gone stale — the oldest branch sat at the top and the branch carrying v1.6
  through v1.8 was never added — so anyone on that first entry was told **"Already on the newest
  version. v1.5.0"** while three versions behind. The list is gone. The updater now reads the
  version stamp off every branch on the remote and takes the highest, with the remote's own default
  branch breaking a tie; nothing about the answer is maintained by hand any more
- **It moves you, rather than telling you how to move yourself.** It used to print
  `git checkout …` / `git pull` and leave you to run them, which is not updating, it is homework.
  The tree is already known to be clean by that point — a dirty one stops the script — and the save
  lives in the browser, so it just does it and says what it did
- Versions compare as numbers rather than as text, so `v1.10.0` will beat `v1.9.0` when it exists
- The README's recovery instructions pointed at the **stale** branch, which is one way to end up
  stranded on it. They now name the default branch, and show how to find it without trusting a name
  written in a README

## v1.8.0 — Compound Interest

*2026-08-22*

- **Past act 1 the quota compounds the way a desk does.** A build does not get stronger by a fixed
  factor a week — every multiplicative broker multiplies everything already on the desk, and every
  extra print applies all of them again. Against that, a fixed-rate quota is a countdown, not
  difficulty: it only decides how many weeks pass before someone is scoring e50 against a quota of
  e8, which is what players were doing by week 15. The per-week multiplier now accelerates, and the
  acceleration accelerates. Week 15 asks **9.83e44** where it used to ask 2.84e8; week 18 asks
  e124. Weeks 9 and 10 sit near where they were, and act 1 is untouched
- **Today's Tape has a job.** It listed the trades you had booked, which you had just watched
  happen. Above that list it now carries what you still owe and what one more trade has to be worth
  — `$5.90e44 to go · $2.95e44 × 2 trades`, or `QUOTA CLEARED`, or `$5.90e44 short · no trades
  left`. Rows show the conviction each trade earned. No new rule, no new decision: every number in
  it was already on screen
- **Golden Parachute** (🪂) — a rumor with nothing on the other side of it. Signs a random
  **Legendary** broker for no cash, no burnt candle and no fired colleague. It needs a free desk
  slot and refuses rather than half-working if it has not got one. Drawn **3 times in a thousand**,
  set as a share so adding rumors later cannot drift it
- Money past a trillion prints as `$9.83e44` rather than fifty comma-separated digits, which the
  new curve reaches often enough to matter

## v1.7.0 — The Long Game

*2026-08-22*

- **Every act past the first is far steeper than the one before it.** The per-act step went from
  ×0.55 to ×1.35 a week, and act 2 from ×2.40 to ×3.00, so week 24 now asks roughly 130× what the
  old curve did and week 32 thousands of times more. Endless mode gets *harder*, not just longer.
  Act 1 is untouched — the eight weeks the game is balanced around play exactly as they did
- **A boss you have met never comes round again inside the first eight weeks.** A boss used to be
  remembered only if you *cleared* it, so a week you had not reached yet drew from all 29 every
  time and about two runs in three saw the same boss twice before week 8. From week 9 the rule
  lifts completely: any boss, any order, as often as the roll says
- **The REROLL button keeps its width.** The price climbs a dollar a reroll and can read
  "FREE ×3", and the button used to resize under the cursor and shove BOOK, FORMATIONS and NEXT
  DEADLINE up to 27px along the row — worst when spamming reroll, which is when it happens most.
  The cost now sits in a fixed slot and nothing moves
- **Rumors come out of Rumor Packs only.** They are the swingiest thing on the Floor and buying one
  off the shelf skipped the pack that is meant to be how you get them. **Insider Line** (📻, Rare)
  is the one way to reopen the shelf, and makes Rumor Packs turn up more often while it is on your
  desk
- *Clearing House* and *Prime Broker* now stock the packs their cards name. Both promised
  "Packs appear far more often" while actually moving the **shelf** roll, so neither did what it
  said

## v1.6.0 — Every Copy

*2026-08-22*

- The book shows **every copy of a candle on its own card**, in body order, plainest first. Two
  body-7 Techs are rarely the same card once one is Foiled and another is stamped, and collapsing
  them into one square with a `×3` badge hid the one thing the badge was pointing at. A row
  tightens its fan as it gets longer, and only scrolls when it has run out of room to tighten
- An edition a **rumor** puts on a broker is **sealed**: nothing replaces it for the rest of the
  run, and selling the broker is the only way to be rid of it. A second rumor used to be able to
  overwrite the first one's gift with no say in it. Sealed brokers carry a 🔒 and drop out of the
  pool the next rumor picks from
- Eight more brokers that multiply **on every print** rather than once per trade, so they compound
  with everything that makes a candle print again — Stokehold (Ember), Lamplighter (Beacon),
  Ill Omen (Cursed), Wishing Well (Wishbone), Wax Seal (stamps), Colophon (editions), Still Point
  (Dojis) and Long Shadow (body 13)
- **The Fool** is now rare and **Stone Grip** uncommon. The clown keeps ×2 of a RED trade's P/L
  where the stone only stops the penalty, so the better card carries the higher rarity
- **Shapeshifter** and **Hairline** are rare

> Shipped in the same pull request as v1.7.0, so it has no tag of its own — `v1.7.0` is the first
> tag that contains it.

## v1.5.0 — The Fine Print

*2026-08-21*

- The rumors that were free money now print what they cost you, in red, on the card
- Cards name what they do — "Foiled (+50 Volume)", not "laminated"
- The book opens from anywhere, packs included, and doubles as the way to aim a Chart at a candle
- Every dollar in or out floats off the cash you are looking at
- `npm start` prints the version and branch it is running, every time — so an old copy is visible
  before you play it

## v1.4.0 — Payday

*2026-08-21*

- The tape prints live when you call it — the candle opens flat, wanders inside its own range,
  then settles on its close
- Beat the quota and the money comes out of the Volume and Leverage chips: a handful for a
  squeaker, a screenful for a blowout

## v1.3.3 — The Print Shop

*2026-08-21*

- The sort you pick sticks — rearranging a placement no longer leaves the board unsorted for the
  rest of the deadline
- Reordering your placement moves only the candles you placed; the rest hold station

## v1.3.2 — The Print Shop

*2026-08-21*

- `npm start` now tells you when a newer version of the game exists, instead of leaving you to
  find out

## v1.3.1 — The Print Shop

*2026-08-21*

- Hovering cards no longer jitters — a hover can only grow a card now, never slide it out from
  under the cursor
- A card you have placed answers hover again instead of ignoring it
- Click the DECK to see what is still left to draw; click SWEPT for the whole book

> Shipped inside the same merge as v1.3.2, so it has no tag of its own — `v1.3.2` is the first
> tag that contains it.

## v1.3.0 — The Print Shop

*2026-08-21*

- The deck and the swept pile sit either side of your board — candles fly out of one and onto
  the other
- The book is a deck view: fanned rows per sector, a per-body tally, and a REMAINING tab for
  what is left to draw
- 12 print-shop brokers built on making a candle print more than once
- One of each broker, Floor-wide — Hall of Mirrors is the only way round it
- Your desk and Charts stay usable while a pack is open
- Moving a candle moves it in the print order
- Quotas get steeper every eight weeks instead of flattening out
- Adds the version stamp, `npm run update`, and the update docs

## v1.2.0 — The Desk

*2026-08-20*

- Sweeping animates, duplicate brokers barred, Reshuffle escalates, the desk can be dragged

> Predates the version stamp in `src/engine/version.js`, so nothing in the repo proves which
> commit it was. It has no tag for that reason.
