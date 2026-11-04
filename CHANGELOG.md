# Changelog

Every version the game has shipped, newest first. The number here is the number on your title
screen — if yours is lower, you are running an old copy, so see
[Updating](README.md#updating-to-the-latest-version).

Each released version has a matching git tag, so any version on this page can be downloaded or
checked out on its own: see [Getting a specific version](README.md#getting-a-specific-version).

## v1.14.0 — Going Live

*2026-11-04*

The game can now be put on the internet, with leaderboards that every player can see. The setup
takes about 15 minutes and costs nothing. It is all in
[docs/hosting-on-render.md](docs/hosting-on-render.md).

### Two versions, one game

- **The local version** is the one `npm start` runs, unchanged. It has no leaderboards.
- **The hosted version** is `server/hosted.mjs`. It serves the very same files and adds a small
  leaderboard API. The game checks for it when it starts, and switches its leaderboards on only
  where that API answers.
- **Both always carry the same game:**
  - `npm start` updates the local version before opening it.
  - Render redeploys the hosted one by itself whenever a new version is merged.
- **The leaderboards survive every update.** They are kept in an Upstash Redis database (free),
  outside the machine Render rebuilds, or on a Render disk.
- **Players with the game open hear about an update.** A banner says a newer version is live and
  offers a reload. Their run is saved, mid-deadline included.

### The leaderboards

- **THE CAMPAIGN**: the biggest single trade booked in weeks 1–8.
- **ENDLESS**: the biggest single trade booked from week 9 on.
- **OVERKILL**: the most a quota was ever buried by, as profit ÷ quota in one deadline. A ×37.2
  means you booked 37 times what you needed.
- **One place per trader on each board.** Beating your own best moves your entry up to the new
  score and replaces the old one; it never adds a second. Nobody can fill a board.
- **No sign-up.** Each browser becomes a trader with a random name like *Bullish Otter 42*.
  - Rename yourself in **LEADERBOARDS**. Names are unique, in any mix of upper and lower case.
  - A **trader code** carries you to another device.
  - The server only ever stores a hash of the code.
- **Bests go in the moment they happen.** Closing the tab never loses one, and if the connection
  drops the best waits in the browser and is sent later. A new best gets a toast with the place
  it took: *New best on THE CAMPAIGN — #3 of 41*.
- **LEADERBOARDS** is on the title screen and in the in-game menu, on the hosted version only.

### Running it

- **`render.yaml`** is a Render Blueprint. Point Render at the repository and paste in two values
  from Upstash. The guide walks through every click.
- **Admin token.** Render makes one up. It lets you remove an entry, ban a trader, export a backup
  and restore it (`/api/admin/*`).
- **Built-in protection.**
  - Rate limits per address.
  - Names checked: letters in any alphabet, numbers, a few marks.
  - Only the game's own files are served; never the server's code, its data, or `.git`.
  - Nothing is ever saved before the stored boards have loaded, so a database that is briefly
    unreachable cannot be overwritten with an empty board.
- **`npm run hosted`** runs the hosted version on your own computer at `localhost:10000`, keeping
  its boards in `data/` (ignored by git).
- **No dependencies, still.** The server is Node's standard library, and Upstash is spoken over
  `fetch`.
- **11 new tests:**
  - the one-entry rule, names, bans, pruning and schema upgrades;
  - the file store, and the Upstash protocol against a fake server;
  - a failed load never overwriting saved data;
  - the whole API end to end, including a restart that keeps the boards;
  - what the server refuses to serve;
  - the rate limit.

## v1.13.0 — Fast Lane

*2026-11-04*

The game can now be made to run faster, in both senses: fewer frames' worth of work on a weak
machine, and less waiting on a fast one. Everything is in **Settings → Performance** and is saved
on your device.

- **Graphics: HIGH, MEDIUM or LOW.**
  - **HIGH** is everything.
  - **MEDIUM** holds the marbled backdrop still and drops the three effects that cost the
    compositor the most: the paper grain over the screen, the drifting glow behind it, and the blur
    behind every open screen.
  - **LOW** also drops the ink wobble on every outline (each one runs through an SVG turbulence
    filter, the biggest single cost on a weak GPU) and the backdrop altogether. Ambient loops such
    as breathing brokers and glowing legendaries play once and stop, and cards no longer lean
    toward the pointer. Bursts throw fewer particles. Signals that mean something (a placement on
    fire, a trade count at zero) keep pulsing.
  - Measured on a machine without a GPU, the desk ran at 30 fps on HIGH and 60 fps on MEDIUM and
    LOW.
- **Game speed: 1×, 2×, 4× or 8×.** It speeds up everything that plays out over time: the waits in
  a trade's resolution, the chart printing its candle, values flying to the chips, numbers counting
  up, the deal, the sweep and the payout. Ambient motion keeps its own pace, because 8× is for the
  game and not for making the desk twitch. A trade that takes 4.7 s at 1× takes 0.7 s at 8×. The
  new speed button in the top bar steps through the speeds in one click, and lights up gold when
  the game is running fast
- **Animations: FULL, REDUCED or OFF.**
  - **REDUCED** is the old *Ambient Motion: off*, and a player who had that switched off keeps it.
  - **OFF** stops everything moving and resolves every trade at once (0.2 s).
- **Show FPS** puts a frame-rate counter in the corner, with the slowest frame of each half-second
  beside it, so the effect of a setting can be seen rather than guessed
- **The chart only redraws when something on it changes.** It used to repaint every frame even
  when nothing on it was moving. Its print animation now runs on real time rather than counting
  frames, so on a slow machine a candle prints in the time it should, instead of taking twice as
  long
- **For anyone hacking on the game:** `MC_SETTINGS='{"speed":8}' node tools/monkey.mjs` plays the
  interface monkey with chosen settings, since timing bugs hide at 1× and show at 8×

## v1.12.0 — Showtime

*2026-11-04*

The game gets a new coat of ink and learns to move. Every change to the look won a head-to-head
round in the new Art Lab against what was there before. The whole record, with the pictures, is in
[docs/art-ab.md](docs/art-ab.md).

### The look

- **Heavier ink.** The card art's pen line is a third heavier, with less wobble and a stronger cel
  band, so a broker still reads at desk size. Chosen over thin ink, a rim light, halftone and flat
  shadow
- **Punchier colour.** Every palette is a little more saturated and a touch lighter. Chosen over
  the palette as drawn and a muted, print-like version
- **Bigger pictures.** The art fills the card: 60 px on the desk (was 46), 100 px on the Floor
  (was 70)
- **A marbled backdrop.** Behind the desk is a sheet of marbled endpaper, flat bands of navy ink
  with a pen line wherever two meet, drifting like ink on water. It answers the game without ever
  getting loud: a winning trade stirs it and warms it green, a losing one cools it red, a boss
  tints it, the Floor turns it violet. It is a small shader capped at 30 fps that stops when the
  tab is hidden or motion is off, and it never costs the game its frame rate. Without a real GPU
  (hardware acceleration off) it is drawn once and held still. With one, it watches the page's
  frame rate and steps itself down (fewer pixels, then fewer frames, then still) the moment the
  page starts to struggle
- **Inked chart candles.** The candles on the chart now stand on the same hard ink lip as every
  card and panel, with pen-inked wicks and hatching across the foot of tall bodies

### The motion

- **Cards lean toward the pointer** and a hard cel glint slides across them: candles, brokers,
  Charts, pack cards, the Floor's stock, deadline cards, the piles. Each card also makes a tiny
  paper tick as the pointer reaches it
- **Buttons give when pressed**, squashing and springing back with a ring of ink where you pressed
- **Placing a candle** makes it jump and land with a squash; taking it out makes it dip. The fifth
  candle rings
- **Screens deal their cards in** one after another instead of appearing all at once. A screen
  redrawn in place (a buy, a sell, a reroll) stays put and keeps its scroll position, and a closed
  screen fades and drops away
- **Bought cards fly to your desk** along an arc and land with a ring. Pack picks do the same, and
  a picked candle flies to the book
- **Sold cards spin away**, shedding a ring of gold
- **Rerolling the Floor** turns its stock over, card by card
- **Using a Chart** makes it lift, turn over and dive into the candles it acts on
- **Sorting, arranging and reordering glide.** Cards slide to their new places instead of jumping
  there, on the board and on the desk
- **Dealt candles flip over** as they fly out of the deck
- **Brokers ring when they fire**: cyan for Volume, red for Leverage, magenta for a multiplier,
  gold for cash
- **The projected P/L catches fire** when the placement on the board would clear the quota, with a
  struck-match sound. A streak of three greens burns the same way
- **Every number bumps when it changes**: week, deadline, desk, trades, sweeps, greens, streak,
  book, deck and profit. The quota bar fills with a little overshoot
- **The payout counts up**: each line lands with a coin, then the total rolls up to what you are
  owed
- **Verdicts are stamped on.** LIQUIDATED and CASHED OUT slam onto the sheet with a thud, the desk
  behind a lost run drains of colour, and a won run rains hand-cut confetti. A boss deadline's
  name is stamped onto the deadline card, and a new week's number onto the week screen
- **The wordmark is lettered in** on the title screen, one letter at a time, and then bobs in a
  wave
- **Tooltips spring open** from the side they point at
- Everything above stands down when motion is switched off in Settings or by the system's reduced
  motion setting

### Fixes

- **Pack cards answer the pointer.** They were enlarged with an inline transform, which outranked
  the hover rule, so they never grew or leaned on hover
- **Nothing falls off a short window.** At about 700 px tall the left column ran 23 px past the
  bottom edge and cut BOOK / TO DEAL in half. Below 760 px it now steps down one more size

## v1.11.1 — Quick Hands

*2026-11-04*

A bug-hunting patch. The engine was played by a fuzzer for over 20,000 runs and 8 million actions
(normal play, random brokers and editions, and runs forced as deep as week 34), and the interface
by a monkey that clicks, types, paints, drags, resizes and reloads the real game at random. Every
crash, freeze and wrong number it turned up is fixed here.

- **Reloading mid-deadline no longer re-deals it.** A save now holds the deadline in progress —
  board, draw pile, placement, trades and sweeps left, profit, streaks, the tape and the chart — so
  a reload comes back to exactly where you were. It used to drop you at the deadline list with a
  fresh board and every trade back, which was both lost progress and a free re-roll
- **Reloading after a payout comes back to the Floor.** A save made between the payout and the
  Floor used to skip the Floor entirely. The Floor is seeded, so it comes back with the same stock
- **No more frozen boards.** Two ways to be stranded with trades still in hand — a book thin enough
  that the board runs empty, and a boss whose rule forbids every trade the board can make once your
  sweeps are gone — used to leave nothing clickable. The run now ends, and the game-over screen
  says why
- **Mimic can copy any broker.** Copying a broker that keeps a running count (Guttering Flame and
  the other stacking brokers) read a count Mimic does not have and turned the whole trade into
  `NaN`. The copy now reads the original's count without ticking it a second time, and the tape
  credits Mimic by name
- **A big board fans in.** More candles than the table is wide (a +board broker, a fat Chart) used
  to push the right side of the desk past the edge of the window, taking the swept pile and
  **GO SHORT** with it. The cards now overlap like a hand of cards, only as much as they must, and
  the one under the pointer comes up on top
- **No more stuck tooltips.** Hover a candle and play the trade without moving the mouse, and its
  tooltip used to stay on screen through the payout and the whole Floor — the card had left the
  page under a still pointer, so nothing ever told the tooltip to go. It now goes with its card,
  and whenever a new screen opens
- **A deadline can no longer be cleared twice.** A trade key pressed during the "quota met" beat
  played another trade on a deadline that was already won, and the second payout crashed the game
- **Cards made right after a reload could share an id** with a card already in your book, so
  selecting, moving or destroying one could act on the other. Ids now carry on from the save
- **The Floor's board is gone once the deadline is.** Board-only Rumors used on the Floor could act
  on the last deadline's leftover board
- **Fixed a crash** from pressing Sweep's key on the title screen after closing the changelog with
  `Esc`; `Esc` with nothing open now always comes back to the title
- **For anyone hacking on the game:** `npm run fuzz` plays hundreds of seeded runs against the
  engine's invariants (cash, ids, the board, saves that reload to the same game), and
  `tools/monkey.mjs` drives the real game in a browser at random

## v1.11.0 — Quick Hands

*2026-10-10*

- **Paint a selection.** Hold the mouse button on a candle and slide across the board: every candle
  you pass over is placed, in the order you crossed them. Crossing one twice never flips it back,
  and painting past five stops at five with a single warning. Only placed candles pick up to be
  dragged now — pressing on an unplaced one starts a stroke instead, so the two gestures no longer
  share one movement
- **Hover select — `E`.** Press it over a candle to place that candle, or hold it and sweep the
  mouse across several. Start it on a candle that is already placed and the sweep takes candles out
  instead
- **Deselect all — `X`.** Empties your placement in one keypress
- **Both keys are rebindable** in **Settings → Controls**: click the action, press the key you want,
  `Esc` cancels. A key that already does something (`L`, `S`, `Space`, the numbers…) is refused
  with the reason, so a rebind can never cost you a trade; the binding is saved on this device and
  the help screen shows your own keys. Settings is now in the in-game menu as well as on the title
  screen

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
