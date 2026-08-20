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

> Already cloned it? Run `git pull` first, then `npm start`.
> If the branch matters: `git checkout claude/roguelike-day-trading-game-vy5qsg`.

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
| Anything else | — | The game prints the real error on screen now. Send that text and it can be diagnosed |

### Want a different port?

```bash
npm start -- 3000        # or:  PORT=3000 npm start
```

### Other commands

```bash
npm test                 # 118 assertions, no dependencies
npm run sim              # a bot plays 200 runs and prints the difficulty curve
```

---

## The loop

Each **week** has three **deadlines**:

| # | Deadline | Quota | Notes |
|---|----------|-------|-------|
| 1 | Morning Bell | ×1.0 | can be skipped for a bonus |
| 2 | Afternoon Session | ×1.5 | can be skipped for a bonus |
| 3 | **Boss Deadline** | ×2.0 | one of 29 rules that breaks your build |

A deadline gives you a cash **quota**, a handful of **trades** and some **sweeps**.

1. Place **1–5 candles** from your board. **The order you place them is the order they print** —
   a numbered badge appears on each one.
2. What they print is a **formation**, which sets base **Volume** and **Leverage**.
3. Call the tape: **LONG** or **SHORT**.
4. Right call → **GREEN**, full P/L. Wrong call → **RED**, you keep 35%.
5. `Volume × Leverage = P/L`. Reach the quota before you run out of trades, or the run ends.

Clear it and you hit **The Floor** to spend the payout before the next bell.

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

## Placement order

Candles print **left to right**, and `+` does not commute with `×` — an additive candle is worth
more before a multiplying one. You control the order three ways:

- **Click order.** The badge on each candle is its slot.
- **Drag.** Pick a candle up and drop it on another, on the board or inside your placement.
- **`ARRANGE` / `A`** cycles five presets: **Rising ▲**, **Falling ▼** (the shapes the two marches
  want), **Volume 1st**, **Leverage 1st**, and **Reverse**.

## Building a desk

| Layer | Count | What it does |
|---|---:|---|
| **Brokers** | 118 | Sit on your desk and trigger left to right. The combo engine. |
| **Charts** | 29 | Reshape the candles in your book — bodies, sectors, polarity, enhancements. |
| **Contracts** | 14 | Permanently level one formation. |
| **Rumors** | 20 | High-risk power spikes with a real cost. |
| **Licences** | 28 | Permanent run upgrades, in 14 two-tier chains. |
| **Bosses** | 29 | One rule each, and it's always the wrong one for your build. |
| **Packs** | 15 | Every tile says exactly what is inside — "Keep 2 of 5 Brokers". The expensive Mega packs let you keep **two**. |
| **Bonuses** | 12 | Paid out for skipping a non-boss deadline. |

**Broker order matters.** Additive brokers want to sit before multiplicative ones. Drag to
reorder. Arb Bot copies whatever is to its right, so where you drop it changes everything.

Candles stack four independent layers of their own: sector, **enhancement** (Block Tick,
Leveraged, Rotating, Volatile, Dividend, Hedged, Penny, **Swing**, Sealed), **edition**
(Laminated, Holographic, Algorithmic) and **stamp** (Reissue, Hold, Payout, Filing).

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

## Project layout

```
index.html            markup shell
src/styles.css        the whole look
src/main.js           controller: input, placement order, scoring animation, screen flow
src/engine/           seeded RNG, formatting, event bus
src/game/
  candles.js          candles: sector, body, polarity, enhancements, editions, stamps
  formations.js       formation evaluation (set-based + order-based marches) and Conviction
  scoring.js          the Volume × Leverage pipeline, step by step
  brokers.js          118 brokers
  consumables.js      charts, contracts, rumors
  licenses.js         permanent run upgrades
  bosses.js           29 boss rules
  market.js           tape simulation, regimes, the signal
  state.js            run state, deadline flow, the Floor, save/load
src/ui/               canvas chart, particles/audio, candle components, overlays
test/
  run-tests.mjs       102 tests, no dependencies
  sim.mjs             headless bot that plays whole runs, for balance
```

```bash
npm test              # 102 assertions across formations, conviction, scoring, flow and content
node test/sim.mjs 200 # play 200 runs with a bot and print the difficulty curve
```

The simulator is how the numbers were tuned — its bot picks placements by projected P/L and
chooses a direction by expected value, weighing signal accuracy against Conviction. A bot that
never plans a build dies around week 4–5 and clears all eight weeks about 2% of the time, which
leaves the headroom where it should be: in the desk you build, not in the dice.

Runs are seeded — type a seed on the title screen and the whole run is reproducible. Progress
autosaves to `localStorage`; there is one save, and losing wipes it.
