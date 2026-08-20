# MARGIN CALL

**A 2D roguelike day-trading deckbuilder.** Build a position out of ticker cards, call the tape
long or short, and book enough P/L to clear the day's quota. Miss it and you're liquidated.

Inspired by the "one more run" loop of *Balatro*, *Raccoin* and *Cloverpit* — a small pile of
starting cards, a shop full of items that break the rules, and a deadline that keeps moving.

No build step, no dependencies. Open it in a browser and play.

```bash
npm start          # serves on http://localhost:8080
# or: python3 -m http.server 8080
```

> ES modules need a real HTTP server — opening `index.html` from the filesystem won't work.

---

## The loop

Each **week** has three **deadlines**:

| # | Deadline | Quota | Notes |
|---|----------|-------|-------|
| 1 | Morning Bell | ×1.0 | can be skipped for a bonus |
| 2 | Afternoon Session | ×1.5 | can be skipped for a bonus |
| 3 | **Boss Deadline** | ×2.0 | one of 25 rules that breaks your build |

A deadline gives you a cash **quota**, a handful of **trades** and some **discards**.

1. Pick **1–5 tickers** from your hand. The pattern they form sets your base
   **Volume** (chips) and **Leverage** (multiplier).
2. Call the tape: **LONG** or **SHORT**.
3. A hidden tick prints. Right call → **GREEN**, you book the full P/L.
   Wrong call → **RED**, you keep 35% of it.
4. `Volume × Leverage = P/L`. Reach the quota before you run out of trades.

Run out of trades below quota and the run is over. Clear it and you hit **The Floor** to spend
the payout before the next bell.

### The signal

The desk shows an arrow for the next tick, but it only tells the truth **68%** of the time to
start. Terminals, data feeds and burner phones push that up; some perks stop caring about
direction entirely; one boss hides the arrow completely.

The **market regime** — Bull Run, Capitulation, Short Squeeze, Melt-Up, Chop and three more —
changes what each direction pays. A correct SHORT during a Melt-Up pays double. A SHORT during
a Squeeze barely pays at all.

---

## Chart patterns

Poker hands, re-skinned as chart patterns. **Contracts** bought on the Floor level them up
permanently.

| Pattern | Made of | Volume | Leverage |
|---|---|---:|---:|
| Flat Line | High Card | 5 | ×1 |
| Double Bottom | Pair | 10 | ×2 |
| Head & Shoulders | Two Pair | 20 | ×2 |
| Triple Top | Three of a Kind | 30 | ×3 |
| Breakout Rally | Straight | 30 | ×4 |
| Sector Rotation | Flush | 35 | ×4 |
| Bull Flag | Full House | 40 | ×4 |
| Quad Witching | Four of a Kind | 60 | ×7 |
| Golden Cross | Straight Flush | 100 | ×8 |
| Insider Tip | Five of a Kind | 120 | ×12 |
| Market Corner | Flush House | 140 | ×14 |
| Total Monopoly | Flush Five | 160 | ×16 |

The last three only exist once you can duplicate ranks — they stay hidden until you make one.

---

## Building a desk

| Layer | Count | What it does |
|---|---:|---|
| **Perks** | 102 | Sit on your desk, trigger left to right. The combo engine. |
| **Charts** | 23 | Tarot-likes. Reshape the tickers in your portfolio. |
| **Contracts** | 12 | Permanently level one chart pattern. |
| **Rumors** | 18 | High-risk power spikes with a real cost. |
| **Licences** | 26 | Permanent run upgrades, in 13 two-tier chains. |
| **Bosses** | 25 | One rule each, and it's always the wrong one for your build. |
| **Packs** | 13 | Pick 1–2 from a spread of tickers, perks or consumables. |
| **Bonuses** | 12 | Paid out for skipping a non-boss deadline. |

**Perk order matters.** Additive perks want to go before multiplicative ones. Drag them to
reorder. Arb Bot copies whatever sits to its right, so where you drop it changes everything.

Tickers themselves stack four independent layers:

- **Sector** — Tech ▲, Crypto ◆ (Growth) · Energy ⚡, Finance ● (Value)
- **Enhancement** — Blue Chip, Leveraged, Diversified, Volatile, Dividend, Hedged, Penny Stock, Restricted
- **Edition** — Laminated, Holographic, Algorithmic
- **Stamp** — Reissue, Hold, Payout, Filing

### Some builds that work

- **Wrong-way desk** — Contrarian and Vol Surface pay you for calling it *wrong*, then Tax-Loss
  Harvest pays cash on top. Every red trade is a green one.
- **Mono-sector** — Mono Desk, a sector perk and Synthetic Position, funnelled through Sector
  Rotation contracts.
- **Retrigger stack** — Front Runner, Stamp Collector and Reissue stamps, on a portfolio of
  three Blue Chip Alphas.
- **Perfect information** — Burner Phone or The Oracle removes the guess entirely, so every
  trade is green and Pyramid Scheme compounds forever.
- **Empty desk** — Dark Alpha pays ×0.35 more leverage for every desk slot you leave *empty*.

---

## Controls

| Key | Action |
|---|---|
| `1`–`9` | select / deselect a ticker |
| `L` / `S` | go long / go short |
| `D` | discard the selection |
| `Space` | sort hand by rank ↔ sector |
| `Esc` | menu / close |
| `M` | mute |
| right-click | sell a perk or chart |

---

## Project layout

```
index.html            markup shell
src/styles.css        the whole look
src/main.js           game controller: input, scoring animation, screen flow
src/engine/           seeded RNG, formatting, event bus
src/game/
  cards.js            tickers, sectors, enhancements, editions, stamps
  patterns.js         chart-pattern evaluation (poker hands + wilds/4-card/gapped)
  scoring.js          the Volume × Leverage pipeline, step by step
  perks.js            102 perks
  consumables.js      charts, contracts, rumors
  licenses.js         permanent run upgrades
  bosses.js           25 boss rules
  market.js           tape simulation, regimes, the signal
  state.js            run state, deadline flow, shop, save/load
src/ui/               canvas chart, particles/audio, card components, overlays
test/
  run-tests.mjs       81 tests, no dependencies
  sim.mjs             headless bot that plays whole runs, for balance
```

```bash
npm test              # 81 assertions across scoring, patterns, flow and content
node test/sim.mjs 200 # play 200 runs with a bot and print the difficulty curve
```

The simulator is how the numbers were tuned. A greedy bot that never plans a build dies
mid-week-3 on average and clears the full eight weeks about 1% of the time, which leaves the
headroom where it should be: in the deck you build, not in the dice.

Runs are seeded — type a seed on the title screen and the whole run is reproducible.
RANDOM is fine too. Progress autosaves to `localStorage`; there is one save, and losing wipes it.
