# Changelog

Every version the game has shipped, newest first. The number here is the number on your title
screen — if yours is lower, you are running an old copy, so see
[Updating](README.md#updating-to-the-latest-version).

Each released version has a matching git tag, so any version on this page can be downloaded or
checked out on its own: see [Getting a specific version](README.md#getting-a-specific-version).

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
