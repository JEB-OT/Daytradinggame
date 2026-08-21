# MARGIN CALL

**A 2D roguelike day-trading deckbuilder made of candlesticks.** Place candles on the tape to
print a formation, call it long or short, and book enough P/L to clear the day's quota.
Miss it and you're liquidated.

Inspired by the "one more run" loop of *Balatro*, *Raccoin* and *Cloverpit* — a small pile of
starting pieces, a shop full of things that break the rules, and a deadline that keeps moving.

No build step and no dependencies — just Node and a browser.

## Quick start

**You need [Node.js](https://nodejs.org) — nothing else.** No build step, no `npm install`,
no dependencies to download.

```bash
git clone https://github.com/JEB-OT/Daytradinggame.git
cd Daytradinggame
npm start
```

That is the whole thing. `npm start` prints a link and opens your browser at
**http://localhost:8080**. Leave that terminal window open while you play; press `Ctrl+C` in it
to stop.

> **Already cloned it?** Run `npm run update` first — see
> [Updating to the latest version](#updating-to-the-latest-version) below. Plain `git pull` is
> often not enough here, and it fails silently rather than telling you.

### Prefer not to use a terminal?

Double-click the launcher in the game folder — it starts the server and opens the browser for you:

| Your machine | Double-click |
|---|---|
| macOS / Linux | **`start.command`** |
| Windows | **`start.bat`** |

### Once it opens

You land on the **home hub**. If it is your first time, hit **TUTORIAL** — seven pages covering
how to read a candle, what Volume and Leverage actually do, and how the call works. Otherwise type
a seed (or leave it blank) and press **START RUN**.

In game: `?` for the rules, `Esc` for the menu, and hover **anything** to see exactly what it does.

---

## If it doesn't start

| What you see | What it means | What to do |
|---|---|---|
| `node: command not found`<br>or `npm: command not found` | Node isn't installed | Install it from [nodejs.org](https://nodejs.org), close and reopen your terminal, try again |
| `python3: command not found` | You are on an old version of this repo | `git pull` — `npm start` no longer uses Python |
| `Error: Cannot find module ... server.js` | You are not in the game folder | `cd` into the folder that contains `index.html`, then `npm start` |
| `port 8080 is busy, trying 8081…` | Something else is using the port | Nothing — it moves to the next free port on its own. Use the link it prints |
| A screen that **looks** like the game but nothing responds | You opened `index.html` by double-clicking it | Browsers block a page loaded from disk from importing its own code. The game says so on screen. Use `npm start` instead |
| The page is blank, or an old version keeps showing | Stale browser cache | Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS) |
| `git pull` says `Already up to date` but the game has not changed | You are on a branch that does not have the new work | See [Updating](#if-the-game-has-not-changed-or-npm-run-update-does-not-exist) |
| `npm error Missing script: "update"` | The update script is part of the update — you are still on the old branch | See [Updating](#if-the-game-has-not-changed-or-npm-run-update-does-not-exist) |
| `pathspec ... did not match any file(s) known to git` | Single-branch clone; git cannot see the branch yet | `git remote set-branches origin "*"` then `git fetch origin`, then retry the checkout |
| A feature from the changelog is missing | You are running an older copy | Check the version in the title screen's bottom corner against [the table above](#checking-which-version-you-actually-have), then `npm run update` |
| Anything else | — | The game prints the real error on screen now. Send that text and it can be diagnosed |

### Want a different port?

```bash
npm start -- 3000        # or:  PORT=3000 npm start
```

### Other commands

```bash
npm run update           # pull the latest version of the game
npm test                 # 152 assertions, no dependencies
npm run sim              # a bot plays 200 runs and prints the difficulty curve
```

---

## Updating to the latest version

**In the game folder:**

```bash
npm run update
```

Then `npm start`, and **hard-refresh** the page: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R`
(macOS). It fetches, fast-forwards, refuses to run if you have uncommitted changes so it can never
eat your work, and tells you which version you ended up on. Your save lives in the browser, not the
repo, so none of this touches your run.

> **Use `npm run update`, not `git pull`.** `git pull` only updates the branch you are standing on.
> When a build lands on another branch it says `Already up to date` and changes nothing, which is
> indistinguishable from everything being fine. `npm run update` asks the question you actually
> meant. From **v1.3.2** `npm start` also checks on its own and prints a notice if you are behind:
>
> ```
>   ┌──────────────────────────────────────────────┐
>   │  A NEWER VERSION OF THE GAME IS AVAILABLE    │
>   └──────────────────────────────────────────────┘
>      v1.3.1 is on claude/day-trading-candle-mechanics-mordep,
>      which has 2 commits this copy does not.
>
>      Stop the server (Ctrl+C) and run:  npm run update
> ```
>
> It runs after the server is already up and never blocks it — no git, no network or no news are
> all equally silent. `MC_NO_UPDATE_CHECK=1 npm start` turns it off.

### If the game has not changed, or `npm run update` does not exist

Both symptoms have the same cause: **you are on a branch that does not have the new work.** New
work lands on a feature branch and only reaches the default branch when its pull request is merged,
and `git pull` only ever updates the branch you are standing on — so it reports `Already up to
date` and changes nothing, which looks identical to the update being broken. `npm run update` is
itself part of an update, so on an old branch it is simply missing:

```
npm error Missing script: "update"
```

**Run these three, once, to get onto the branch with the latest work:**

```bash
git remote set-branches origin "*"
git fetch origin
git checkout claude/day-trading-candle-mechanics-mordep
```

> The first line matters. Clones are often made `--single-branch`, and then `git fetch` never
> learns the other branches exist and the checkout fails with
> `pathspec ... did not match any file(s) known to git`. It is harmless on a normal clone.

After that `npm run update` works, and it will tell you if a branch ever moves ahead of you again:

```
  claude/day-trading-candle-mechanics-mordep has 3 commits you do not have.
  That is where the newest version lives. To switch to it:

    git checkout claude/day-trading-candle-mechanics-mordep
    git pull
```

Once a branch has been merged into the one you are on, the updater stops mentioning it — so after
the pull request lands, plain `npm run update` on the default branch is the whole story.

### Checking which version you actually have

**The title screen prints the version in the bottom corner.** Click it for the full changelog.

| Version | What you should see |
|---|---|
| **v1.4.0** — Payday | Everything below, plus: the tape prints live when you call it, and beating the quota throws cash |
| v1.3.3 — The Print Shop | The board sort sticks through a rearrange and a redraw |
| v1.3.2 — The Print Shop | `npm start` warns you when a newer version exists |
| v1.3.1 — The Print Shop | Hovering cards is smooth, and **clicking the DECK** opens the book on what is left to draw |
| v1.3.0 — The Print Shop | A **DECK** and a **SWEPT** pile either side of your board · the book laid out as fanned rows per sector with a body tally · a **REMAINING** tab · print-shop brokers · your desk visible inside packs |
| v1.2.0 — The Desk | Sweep animation, no duplicate brokers, draggable desk |

If the number on your title screen is older than the newest row here, you are running an old copy.
If it matches but you still cannot see a feature, hard-refresh the page.

---

## The loop

Each **week** has three **deadlines**:

| # | Deadline | Quota | Notes |
|---|----------|-------|-------|
| 1 | Morning Bell | ×1.0 | can be skipped for a bonus |
| 2 | Afternoon Session | ×1.5 | can be skipped for a bonus |
| 3 | **Boss Deadline** | ×2.0 | one of 29 rules that breaks your build |

Weeks come in **acts of eight**, and the quota curve gets steeper at every act boundary — so
weeks 9, 17, 25, 33 and on each start a harder stretch than the one before:

| Act | Weeks | Quota growth |
|---|---|---|
| 1 | 1–8 | a hand-tuned table, ×2.5 easing to ×2.17 a week |
| 2 | 9–16 | ×2.40 a week |
| 3 | 17–24 | ×2.95 a week |
| 4 | 25–32 | ×3.50 a week |
| *n* | … | ×0.55 a week faster than the act before |

Endless mode used to flatten to a constant ×2.4 forever, which meant a desk that could clear week
12 could clear week 40 — it got longer, not harder. Now it keeps outrunning you. The act and its
current rate are printed above the week's deadlines, and the week that starts a new act says so.

A deadline gives you a cash **quota**, a handful of **trades** and some **sweeps**.

1. Place **1–5 candles** from your board. **The order you place them is the order they print** —
   a numbered badge appears on each one.
2. What they print is a **formation**, which sets base **Volume** and **Leverage**.
3. Call the tape: **LONG** or **SHORT**. The tick you called against **prints live** — the candle
   opens flat, wanders inside its own high and low, and settles on its close. About one in four
   goes straight there, so the wander stays a flourish rather than a tic. It is pure theatre: the
   shape it lands on was decided before the animation started.
4. Right call → **GREEN**, full P/L. Wrong call → **RED**, you keep 35%.
5. `Volume × Leverage = P/L`. Reach the quota before you run out of trades, or the run ends.

Clear it and you hit **The Floor** to spend the payout before the next bell — and the screen pays
you in cash on the way out, thrown by the two numbers that earned it: **Volume** and **Leverage**.
**How much depends on how far past the quota you landed:** scrape it and a handful of dollar signs
come up, bury it six times over and the screen fills with notes.

### The deck and the swept pile

Your whole book is shuffled into a **deck** at the bell, and the board is dealt off the top of it.
Both piles sit either side of your board and both are real places, not counters: candles fly out of
the **DECK** on the left when the board refills, and everything you trade or sweep is thrown onto
the **SWEPT** pile on the right, where it stays until the next bell.

**Click the DECK** and the book opens on what is still in it — the deck is where the question
occurs to you, so it is where the answer lives. Clicking **SWEPT** opens the whole book.

That is not decoration &mdash; it is the information the **REMAINING** view of the book is built on.
Once nine of your thirteen Tech candles are on the swept pile, a Tech Cluster is no longer a plan.

---

## Candles

Every candle has three independent axes:

- **Sector** — Tech ▲, Crypto ◆ (Growth) · Energy ⚡, Finance ● (Value)
- **Body** — 1 to 13, worth exactly that much Volume. The body also sets the candle's
  **silhouette**, so size is readable without doing arithmetic:

  | Body | Shape | Looks like |
  |---|---|---|
  | 1 | **Doji** | a thin crossbar between long wicks |
  | 2–4 | **Spinner** | a small body floating between long wicks |
  | 5–7 | **Standard** | even body and wicks |
  | 8–10 | **Heavy** | thick body, short wicks |
  | 11–13 | **Marubozu** | a solid slab, barely any wick |

  Sector shows up as a **texture inside the body** — scanlines for Tech, diagonal hatch for Crypto,
  vertical bars for Energy, dots for Finance — so shape, fill and colour are three independent
  channels you can read at a glance.
- **Polarity** — **BULL** (green) or **BEAR** (red). The book starts split exactly 26 / 26.

Polarity is what makes candles more than re-skinned cards: it feeds **Conviction**.

### Special candles

Twelve of them, and each one looks unmistakably different on the board — its own frame colour,
background and animated aura — so you can read your board at a glance.

| Candle | Ability |
|---|---|
| **Bullion** | +30 Volume when it prints |
| **Bloodstone** | +4 Leverage when it prints |
| **Ember** | +15 Volume, and permanently gains +5 Volume every time it prints |
| **Beacon** | +3 Leverage for every other placed candle sharing its sector |
| **Chameleon** | Counts as every sector at once |
| **Janus** | Counts as BOTH bull and bear — always agrees with your call |
| **Glasswork** | ×2 Leverage. 1 in 4 chance to shatter after the trade |
| **Cursed** | ×3 Leverage, but it costs you $4 every time it prints |
| **Goldleaf** | $3 when held on the board at the close |
| **Wardstone** | ×1.5 Leverage while held on the board |
| **Wishbone** | 1 in 5 for +20 Leverage, 1 in 15 for $20 |
| **Obsidian** | +50 Volume, but no body, sector or polarity |

On top of that a candle can carry an **edition** — Foiled (+50 Volume), Prismatic (+10 Leverage),
Runed (×1.5 Leverage) — and a **seal**: Echo (prints twice), Anchor (stays on the board),
Coin ($3), Rune (leaves a Chart behind when swept).

### Conviction

When your printed candles agree with the direction you just called, you get paid for it:

| Agreement | Multiplier |
|---|---|
| Every candle agrees | **×1.5 Leverage** |
| Most of them agree | **×1.2 Leverage** |
| A split book | ×1.0 |

That's the tension the whole game turns on. The biggest formation on your board is often the
one pointing the wrong way, and the readout under the score shows both calls side by side
(`▲ ×1.50 · ▼ ×1.00`) so the trade-off is always in front of you.

The desk signal only tells the truth **68%** of the time to start. Terminals, data feeds and
burner phones push that up; some brokers stop caring about direction entirely. Eight market
**regimes** (Bull Run, Capitulation, Short Squeeze, Melt-Up, Chop…) change what each direction pays.

---

## Formations

Fourteen of them. Most read the **set** of bodies you placed; two read the **order**.

| Formation | Made of | Volume | Leverage |
|---|---|---:|---:|
| Single Tick | one candle | 5 | ×1 |
| Tweezer | two matching bodies | 10 | ×2 |
| Double Tweezer | two separate matching pairs | 20 | ×2 |
| Triple Tap | three matching bodies | 30 | ×3 |
| **Three White Soldiers** | 3+ bull candles, bodies rising | 30 | ×4 |
| **Three Black Crows** | 3+ bear candles, bodies falling | 30 | ×4 |
| Staircase | five consecutive bodies | 35 | ×4 |
| Sector Cluster | five candles from one sector | 40 | ×4 |
| Pillars | three matching plus two matching | 45 | ×4 |
| Four Winds | four matching bodies | 60 | ×7 |
| Golden Staircase | a Staircase inside one sector | 100 | ×8 |
| Five Alarm | five matching bodies | 120 | ×12 |
| Mega Cluster | Pillars inside one sector | 140 | ×14 |
| Perfect Storm | five matching bodies, one sector | 160 | ×16 |

The last three stay hidden until you first print one.

**Soldiers and Crows must be contiguous in placement order.** The same three candles placed
9-3-6 print nothing; placed 3-6-9 they print Soldiers. `ARRANGE` sorts your placement rising or
falling in one click, so the mechanic is a decision rather than a chore.

---

## Money

Cash is what buys the desk that beats week 5, so the payout matters as much as the quota.
Clearing a deadline pays:

| Source | Pays |
|---|---|
| Clearing the deadline | **$4 / $5 / $7** for the three slots |
| Every trade you did **not** need | **$1** each |
| Interest on what you are holding | **$1 per $5**, up to **$5** — maxed once you have $25 banked |

So there is a real tension between spending on the Floor and banking enough to earn the full
interest. Three licences push that ceiling up:

| Licence | Interest cap | Maxed at |
|---|---|---|
| Retirement Account | $10 | $50 held |
| Trust Fund | $15 | $75 held |
| The Vault Keys | $25 | $125 held |

The Floor prints all of this on a strip at the bottom, so you never have to guess.

## Order of operations

Candles print **left to right**, and so do brokers. `+` does not commute with `×`, so an additive
candle or broker is worth more before a multiplying one. You control both.

**Brokers** — drag them along your desk, in a run, on the Floor, or inside a pack.

**Candles** — three ways:

- **Click order.** The badge on each candle is its slot.
- **Drag.** Pick a candle up and drop it anywhere on the board.
- **`ARRANGE` / `A`** cycles five presets: **Rising ▲**, **Falling ▼** (the shapes the two marches
  want), **Volume 1st**, **Leverage 1st**, and **Reverse**.

**Moving a candle moves it in the print order.** Drag one, `ARRANGE`, or re-sort the board and the
placement is re-derived from where the cards actually sit — so once you have rearranged anything,
the badges read `1 2 3` straight across and **what you see left to right is what prints**. Click
order only decides the starting arrangement.

**Rearranging a placement only moves the candles in it.** The placed candles drop back into the
same slots they already occupied, in the new order, so the candles you did *not* place hold
station. And the sort you picked with `SPACE` is a standing preference, not a one-off: every
redraw comes back in it, so you never have to press it again mid-deadline.

## Building a desk

| Layer | Count | What it does |
|---|---:|---|
| **Brokers** | 131 | Sit on your desk and trigger left to right. The combo engine. **One of each, ever** &mdash; see below. |
| **Charts** | 29 | Reshape the candles in your book — bodies, sectors, polarity, enhancements. |
| **Contracts** | 14 | Permanently level one formation. |
| **Rumors** | 20 | High-risk power spikes with a real cost. |
| **Licences** | 28 | Permanent run upgrades, in 14 two-tier chains. |
| **Bosses** | 29 | One rule each, and it's always the wrong one for your build. |
| **Packs** | 15 | Every tile says exactly what is inside — "Keep 2 of 5 Brokers". The expensive Mega packs let you keep **two**. |
| **Bonuses** | 12 | Paid out for skipping a non-boss deadline. |

**Broker order matters, exactly like candle order.** Both fire left to right, so additive brokers
want to sit before multiplying ones. Drag them around your desk &mdash; on the board, on the Floor,
or inside a pack &mdash; to change the order. Mimic copies whatever is to its right, so where you
drop *it* changes everything.

### One of each

You can never employ the same broker twice, and the Floor never shows you the same broker twice
either. The shelf, an open pack and a skip bonus all roll against **everything already visible
anywhere on the Floor**, not just against their own batch &mdash; otherwise a broker could sit on
the shelf and inside a pack at once, and taking one then buying the other would put two on your
desk.

The single exception is **Hall of Mirrors**. While it is on your desk the whole rule lifts:
brokers you already employ turn up on the Floor again and you may hire duplicates. Sell it and the
rule snaps straight back on &mdash; though whatever duplicates you already hired stay hired.

### Packs keep your desk in reach

Opening a pack leaves your desk and your Charts on screen, with their slot counts. You can sell a
broker, sell a chart or use a chart **while the pack is open**, so a full desk no longer means the
pick you just paid for is unreachable. If a pack is offering something you have no room for, it
says so above the options.

Candles stack four independent layers of their own: sector, **enhancement** (Block Tick,
Leveraged, Rotating, Volatile, Dividend, Hedged, Penny, **Swing**, Sealed), **edition**
(Laminated, Holographic, Algorithmic) and **stamp** (Reissue, Hold, Payout, Filing).

### The print shop

Twelve brokers are built on one verb: making a candle **print more than once**. The top half hands
out extra prints on a band of bodies; the bottom half is paid *per extra print*, so the two halves
are worth far more together than either is alone.

| Broker | Extra prints |
|---|---|
| **Fine Print** | every printed candle with a body of **2, 3, 4 or 5** prints again |
| **Press Run** | every printed candle with a body of **11 or more** prints **twice** more |
| **Hairline** | every printed **Doji** (body 1) prints **three** extra times |
| **Last Word** | the last candle you placed prints again (the mirror of *Encore*) |
| **Kerning** | every printed candle whose body matches another candle you placed prints again |
| **Misprint** | every printed candle carrying an **edition** prints again |

| Broker | Paid per extra print |
|---|---|
| **Run-Off** | +35 Volume for every extra print this trade |
| **Ink Press** | +5 Leverage for every extra print this trade |
| **Print Shop** | $1 for every extra print this trade |
| **Serial Number** | permanently gains +6 Volume for every extra print — it compounds run-long |
| **Overprint** | ×1.6 Leverage if any one candle printed **3 or more** times |
| **Split Run** | ×2 Leverage if you printed a body of **5 or less** *and* a body of **11 or more** |

They stack with the retriggers that were already there — *Understudy*, *Encore*, *The Swarm*,
*Sigil Collector*, *Echo*, Echo Seals — rather than replacing them. Two of them on the same desk is
a build; six is a printing press.

### Some builds that work

- **The march** — *Marching Drum* drops Soldiers to two candles, *Drillmaster* multiplies them and
  *Coattails* pays per candle in the run. Chart your book into rising bulls with *Greenwake*.
- **All-in conviction** — an all-bull book plus *Zealot's Badge* and *The Convert* makes every
  LONG ×1.9, and *Sun Chaser* stacks on top.
- **The two-faced book** — Janus candles count as *both* polarities, so *Janus Ledger*'s
  even-split bonus and full Conviction fire at the same time.
- **Wrong-way desk** — *The Fool* and *Scar Tissue* pay you for calling it wrong, with
  *Salvager* banking cash on every red.
- **Echo stack** — *Echo*, *Sigil Collector* and Echo Seals on a book of three Bullion 13s.
- **The empty desk** — *Void Pact* pays ×0.35 more Leverage for every desk slot you leave *empty*.
- **The press** — *Fine Print* and *Press Run* on a book charted to the two extremes, then
  *Run-Off*, *Ink Press* and *Serial Number* to get paid for every impression. *Split Run* doubles
  it for holding both ends, and *Overprint* doubles it again.
- **Bonfire** — Embers grow +5 Volume every print, so *Overspill* (everything prints) plus
  *Echo* compounds a book of Embers permanently, run after run.

---

## Controls

| Key | Action |
|---|---|
| `1`–`9` | place / remove a candle |
| `L` / `S` | go long / go short |
| `W` | sweep the selection |
| `A` | arrange placement (rising ↔ falling) |
| `Space` | sort the board (body / sector / bull-bear) |
| `Esc` | menu · `M` mute |
| right-click | sell a broker or chart |

---

## The book

`BOOK`, from the top bar or any menu, lays your candles out the way a deck view should read: one
**fanned row per sector**, running body 13 down to 1. Duplicates stack under a `×2` badge, and
anything the view does not hold is drawn as an empty outline — so the shape of your book is one
glance rather than a wall of tiles.

Beside it are two readouts:

- a **BODY** column counting how many of each size you are holding — *four 13s, three 7s* — with a
  `/4` beside anything that is short of the full set
- a **Base Cards** panel totalling the five silhouette bands (Doji, Spinner, Standard, Heavy,
  Marubozu) and the four sectors, which is what a build is actually shaped out of

Two views share that layout:

| View | Shows |
|---|---|
| **FULL BOOK** | every candle you own, wherever it is right now |
| **REMAINING** | only what is **still in the deck** and can still be dealt to you |

`REMAINING` is the one you plan with. The strip along the top splits your book into *in the deck*,
*on the board* and *traded or swept*, the empty squares are the candles already gone, and the BODY
column drops to what is left — so before you spend a sweep chasing a Four Winds of 7s you can see
that three of the four have already been dealt.

---

## Project layout

```
index.html            markup shell
scripts/update.mjs    `npm run update` — fetch, fast-forward, and find the newest branch
scripts/version-check.mjs  "is there a newer build?", shared by the updater and `npm start`
src/styles.css        the whole look
src/main.js           controller: input, placement order, scoring animation, screen flow
src/engine/           seeded RNG, formatting, event bus, the version stamp
src/game/
  candles.js          candles: sector, body, polarity, enhancements, editions, stamps
  formations.js       formation evaluation (set-based + order-based marches) and Conviction
  scoring.js          the Volume × Leverage pipeline, step by step
  brokers.js          131 brokers
  consumables.js      charts, contracts, rumors
  licenses.js         permanent run upgrades
  bosses.js           29 boss rules
  market.js           tape simulation, regimes, the signal
  state.js            run state, deadline flow, the deck/swept piles, the Floor, save/load
src/ui/               canvas chart, particles/audio, candle components, overlays
test/
  run-tests.mjs       141 tests, no dependencies
  sim.mjs             headless bot that plays whole runs, for balance
```

```bash
npm test              # 141 assertions across formations, conviction, scoring, flow and content
node test/sim.mjs 200 # play 200 runs with a bot and print the difficulty curve
```

The simulator is how the numbers were tuned — its bot picks placements by projected P/L and
chooses a direction by expected value, weighing signal accuracy against Conviction. A bot that
never plans a build dies around week 4–5 and clears all eight weeks about 2% of the time, which
leaves the headroom where it should be: in the desk you build, not in the dice.

Runs are seeded — type a seed on the title screen and the whole run is reproducible. Progress
autosaves to `localStorage`; there is one save, and losing wipes it.
