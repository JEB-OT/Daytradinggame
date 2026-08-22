# Changelog

Every version the game has shipped, newest first. The number here is the number on your title
screen — if yours is lower, you are running an old copy, so see
[Updating](README.md#updating-to-the-latest-version).

Each released version has a matching git tag, so any version on this page can be downloaded or
checked out on its own: see [Getting a specific version](README.md#getting-a-specific-version).

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
