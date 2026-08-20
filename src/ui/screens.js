import { showOverlay, closeOverlay, helpScreen, runInfoScreen, bookScreen, formationScreen } from './overlays.js';
import { candleEl, brokerEl, consumableEl } from './components.js';
import { makeCandle, SECTORS, SECTOR_KEYS, ENHANCEMENTS, ENHANCEMENT_KEYS, EDITIONS, STAMPS, BANDS, bandOf } from '../game/candles.js';
import { BROKERS, BROKER_KEYS, RARITY, brokerText, makeBroker } from '../game/brokers.js';
import { ALL_CONSUMABLES, CHARTS, CONTRACTS, RUMORS, consumableText } from '../game/consumables.js';
import { FORMATIONS, FORMATION_KEYS, formationStats } from '../game/formations.js';
import { BOSSES, BOSS_KEYS } from '../game/bosses.js';
import { LICENSES, LICENSE_KEYS } from '../game/licenses.js';
import { sfx } from './fx.js';

const CAREER_KEY = 'margincall.career.v1';
export function career() {
  try { return JSON.parse(localStorage.getItem(CAREER_KEY)) || {}; } catch { return {}; }
}
export function saveCareer(patch) {
  const c = { ...career(), ...patch };
  try { localStorage.setItem(CAREER_KEY, JSON.stringify(c)); } catch {}
  return c;
}

// ---------------------------------------------------------------------------
// HOME — the hub. Everything is reachable without starting a run.
// ---------------------------------------------------------------------------
export function homeScreen(game) {
  const hasSave = game.hasSave();
  const c = career();
  const seenTutorial = c.tutorial;

  const sheet = showOverlay(`
    <div class="home">
      <div class="home-hero">
        <div class="home-tape" id="home-tape" aria-hidden="true"></div>
        <div class="wordmark">MARGIN<em>CALL</em></div>
        <div class="home-tag">HIT THE QUOTA OR GET LIQUIDATED</div>
      </div>

      <div class="home-main">
        <div class="home-play">
          <label class="home-label" for="seed-input">RUN SEED — optional, shareable</label>
          <input id="seed-input" class="home-seed" placeholder="LEAVE BLANK FOR RANDOM" maxlength="16" />
          <button class="btn primary home-big" id="h-new">${hasSave ? 'START A NEW RUN' : 'START RUN'}</button>
          ${hasSave ? '<button class="btn home-big" id="h-continue">CONTINUE RUN</button>' : ''}
          ${seenTutorial ? '' : '<div class="home-nudge">New here? Start with the tutorial &mdash; it takes two minutes.</div>'}
        </div>

        <nav class="home-menu" aria-label="Main menu">
          <button class="home-card ${seenTutorial ? '' : 'flag'}" id="h-tutorial">
            <span class="hc-art">🎓</span>
            <span class="hc-body"><b>TUTORIAL</b><small>Learn Volume, Leverage and the call</small></span>
          </button>
          <button class="home-card" id="h-rules">
            <span class="hc-art">📖</span>
            <span class="hc-body"><b>HOW TO PLAY</b><small>The full rules and controls</small></span>
          </button>
          <button class="home-card" id="h-compendium">
            <span class="hc-art">🗂️</span>
            <span class="hc-body"><b>COMPENDIUM</b><small>Candles, brokers, formations, bosses</small></span>
          </button>
          <button class="home-card" id="h-glossary">
            <span class="hc-art">📔</span>
            <span class="hc-body"><b>GLOSSARY</b><small>Every term the game uses</small></span>
          </button>
          <button class="home-card" id="h-settings">
            <span class="hc-art">🎛️</span>
            <span class="hc-body"><b>SETTINGS</b><small>Sound and motion</small></span>
          </button>
        </nav>
      </div>

      <div class="home-stats">
        <div class="hs"><b>${c.runs || 0}</b><span>RUNS</span></div>
        <div class="hs"><b>${c.bestWeek || 0}</b><span>BEST WEEK</span></div>
        <div class="hs"><b>${c.deadlines || 0}</b><span>DEADLINES CLEARED</span></div>
        <div class="hs"><b>${c.wins || 0}</b><span>CASHED OUT</span></div>
      </div>
      <div class="home-foot">${BROKER_KEYS.length} brokers &middot; ${ENHANCEMENT_KEYS.length} special candles &middot;
        ${FORMATION_KEYS.length} formations &middot; ${BOSS_KEYS.length} bosses</div>
    </div>`, { dismissable: false, width: '900px' });

  // a slow idle tape of candles behind the wordmark
  const tape = sheet.querySelector('#home-tape');
  const rnd = (n) => Math.floor(Math.random() * n);
  for (let i = 0; i < 16; i++) {
    const cd = makeCandle(SECTOR_KEYS[rnd(4)], 1 + rnd(13), Math.random() < 0.5);
    const el = candleEl(cd, { reveal: true });
    el.classList.add('home-candle');
    el.style.setProperty('--i', i);
    tape.appendChild(el);
  }

  const start = () => {
    const seed = sheet.querySelector('#seed-input').value.trim().toUpperCase();
    sfx.open();
    saveCareer({ runs: (c.runs || 0) + 1 });
    game.startRun(seed || null);
  };
  sheet.querySelector('#h-new').onclick = start;
  sheet.querySelector('#seed-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
  sheet.querySelector('#h-continue')?.addEventListener('click', () => { sfx.open(); game.continueRun(); });
  sheet.querySelector('#h-tutorial').onclick = () => { sfx.select(); tutorialScreen(game, 0); };
  sheet.querySelector('#h-rules').onclick = () => { sfx.select(); helpScreen(game, false, () => homeScreen(game)); };
  sheet.querySelector('#h-compendium').onclick = () => { sfx.select(); compendiumScreen(game, () => homeScreen(game)); };
  sheet.querySelector('#h-glossary').onclick = () => { sfx.select(); glossaryScreen(game, () => homeScreen(game)); };
  sheet.querySelector('#h-settings').onclick = () => { sfx.select(); settingsScreen(game, () => homeScreen(game)); };
}

// ---------------------------------------------------------------------------
// TUTORIAL — a short primer built out of the real components.
// ---------------------------------------------------------------------------
const demoCandle = (sector, body, bull, extra) => makeCandle(sector, body, bull, extra || {});

const TUTORIAL = [
  {
    title: 'THE JOB',
    body: `<p>Every <b>deadline</b> hands you a cash <b>quota</b> and a small number of <b>trades</b>.
      Book the quota before the trades run out and you move on. Miss it and the run is over —
      there is no second chance and no continue.</p>
      <p>You do that by placing candles, printing a formation, and calling which way the tape moves.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-quota';
      w.innerHTML = `<div class="tq-row"><span>QUOTA</span><b>$180</b></div>
        <div class="tq-bar"><i style="width:62%"></i></div>
        <div class="tq-row small"><span>BOOKED</span><b>$112</b></div>
        <div class="tq-row small"><span>TRADES LEFT</span><b>2</b></div>`;
      return w;
    },
  },
  {
    title: 'READING A CANDLE',
    body: `<p>Every candle carries three things, and each one is drawn differently so you can read a
      board without doing arithmetic.</p>
      <p><b>Body</b> — the number, 1 to 13. It is worth exactly that much <b>Volume</b>, and it sets the
      candle's <b>shape</b>: a 1 is a thin <b>Doji</b> cross, a 13 is a solid <b>Marubozu</b> slab.</p>
      <p><b>Sector</b> — the glyph, and the texture inside the body. Five of one sector prints a Cluster.</p>
      <p><b>Polarity</b> — green <b>bull</b> or red <b>bear</b>. This decides Conviction, coming up in a moment.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-row';
      [[1, 'TECH', true], [3, 'CRYPTO', false], [6, 'ENERGY', true], [9, 'FINANCE', false], [13, 'TECH', true]]
        .forEach(([b, s, bull]) => {
          const cell = document.createElement('div');
          cell.className = 'tut-cell';
          cell.appendChild(candleEl(demoCandle(s, b, bull), { reveal: true }));
          const cap = document.createElement('span');
          cap.textContent = bandOf(b).name;
          cell.appendChild(cap);
          w.appendChild(cell);
        });
      return w;
    },
  },
  {
    title: 'VOLUME × LEVERAGE',
    body: `<p>Every trade is two numbers multiplied together.</p>
      <p><b class="tut-vol">Volume</b> is how big the position is. The formation gives you a base, then every
      candle adds its body on top.</p>
      <p><b class="tut-lev">Leverage</b> is how hard that gets multiplied. The formation gives a base here too,
      and brokers pile on.</p>
      <p><b>Volume × Leverage = P/L</b>, and that is what pays down the quota.</p>
      <p class="tut-aside">This is the single most important thing to understand: once Volume is large,
      a <b>×2 Leverage</b> is worth far more than a <b>+50 Volume</b>. Early on you buy Volume.
      Later you buy multipliers.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-math';
      w.innerHTML = `
        <div class="tm-line"><span class="tut-vol">120 Volume</span><i>×</i><span class="tut-lev">4 Leverage</span><i>=</i><b>$480</b></div>
        <div class="tm-note">add <span class="tut-vol">+50 Volume</span> &rarr; 170 × 4 = <b>$680</b> &nbsp;<em>(+200)</em></div>
        <div class="tm-note">add <span class="tut-lev">+2 Leverage</span> &rarr; 120 × 6 = <b>$720</b> &nbsp;<em>(+240)</em></div>
        <div class="tm-note strong">at 400 Volume the same +2 Leverage is worth <b>+800</b></div>`;
      return w;
    },
  },
  {
    title: 'FORMATIONS',
    body: `<p>What your placed candles make is a <b>formation</b>, and it sets the starting Volume and
      Leverage. Matching bodies make Tweezers and Pillars. Consecutive bodies make a <b>Staircase</b>.
      One sector across five candles makes a <b>Cluster</b>.</p>
      <p>Two formations read the <b>order you place them in</b>: three rising bulls print
      <b>Three White Soldiers</b>, three falling bears print <b>Three Black Crows</b>. Press
      <span class="k">A</span> to sort your placement instead of clicking them in order.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-row';
      [[3, true], [7, true], [11, true]].forEach(([b, bull], i) => {
        const cell = document.createElement('div');
        cell.className = 'tut-cell';
        const el = candleEl(demoCandle('TECH', b, bull), { reveal: true, order: i + 1 });
        cell.appendChild(el);
        w.appendChild(cell);
      });
      const cap = document.createElement('div');
      cap.className = 'tut-caption';
      cap.innerHTML = 'Rising bull bodies, placed in order &rarr; <b>Three White Soldiers</b>';
      const wrap = document.createElement('div');
      wrap.appendChild(w); wrap.appendChild(cap);
      return wrap;
    },
  },
  {
    title: 'THE CALL, AND CONVICTION',
    body: `<p>Once the candles are down you call the tape: <b class="tut-long">LONG</b> or
      <b class="tut-short">SHORT</b>. Get it right and you book the full P/L — a <b>green</b> trade.
      Get it wrong and you keep 35% — a <b>red</b> trade.</p>
      <p>The desk signal points the way, but it only tells the truth <b>68%</b> of the time to begin with.</p>
      <p><b>Conviction</b> is the bonus for your own candles agreeing with your call. All of them agreeing
      is <b>×1.5 Leverage</b>; most of them is <b>×1.2</b>. The readout under your score shows both calls
      at once, so you always know what each one is worth.</p>
      <p class="tut-aside">That is the real decision in this game: the biggest formation on your board is
      very often the one pointing the wrong way.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-conv';
      w.innerHTML = `
        <div class="tc-side"><span>▲ LONG</span><b style="color:var(--gold)">×1.50</b><small>all three bull</small></div>
        <div class="tc-side dim"><span>▼ SHORT</span><b>×1.00</b><small>none agree</small></div>`;
      return w;
    },
  },
  {
    title: 'BROKERS',
    body: `<p>Between deadlines you visit <b>The Floor</b> and hire <b>brokers</b>. They sit on your desk and
      trigger <b>left to right</b> — so the order you keep them in changes the result. Additive brokers
      want to go before multiplying ones.</p>
      <p>Drag to reorder. Right-click to sell. There are 118 of them, and a run is really the story of which
      five or six you end up with.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-row';
      ['sticky', 'bullPen', 'pyramid', 'theWolf'].forEach((k) => {
        const cell = document.createElement('div');
        cell.className = 'tut-cell';
        cell.appendChild(brokerEl(makeBroker(k, null), { brokers: [], mods: {}, cash: 0 }, { hideSell: true }));
        w.appendChild(cell);
      });
      return w;
    },
  },
  {
    title: 'SPECIAL CANDLES',
    body: `<p>Charts bought on the Floor turn ordinary candles into <b>special</b> ones. Each has an ability and
      its own unmistakable look, so you can spot them on a crowded board.</p>
      <p>An <b>Ember</b> permanently grows every time it prints. A <b>Janus</b> counts as both bull and bear,
      so it always earns Conviction. A <b>Cursed</b> candle is ×3 Leverage that charges you rent.</p>
      <p>Hover anything, anywhere in the game, to read exactly what it does.</p>`,
    art: () => {
      const w = document.createElement('div');
      w.className = 'tut-row';
      [['ember', 7], ['janus', 8], ['cursed', 12], ['beacon', 5]].forEach(([e, b]) => {
        const cell = document.createElement('div');
        cell.className = 'tut-cell';
        cell.appendChild(candleEl(demoCandle('TECH', b, true, { enhancement: e }), { reveal: true }));
        const cap = document.createElement('span');
        cap.textContent = ENHANCEMENTS[e].name;
        cap.style.color = ENHANCEMENTS[e].color;
        cell.appendChild(cap);
        w.appendChild(cell);
      });
      return w;
    },
  },
];

export function tutorialScreen(game, page = 0) {
  const p = TUTORIAL[page];
  const last = page === TUTORIAL.length - 1;
  const sheet = showOverlay(`
    <div class="tut">
      <div class="tut-head">
        <span class="tut-step">STEP ${page + 1} OF ${TUTORIAL.length}</span>
        <h2>${p.title}</h2>
      </div>
      <div class="tut-dots">${TUTORIAL.map((_, i) => `<i class="${i === page ? 'on' : ''}" data-go="${i}"></i>`).join('')}</div>
      <div class="tut-grid">
        <div class="tut-copy">${p.body}</div>
        <div class="tut-art" id="tut-art"></div>
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="t-skip">${last ? 'BACK TO MENU' : 'SKIP'}</button>
        ${page > 0 ? '<button class="btn" id="t-prev">BACK</button>' : ''}
        <button class="btn primary" id="t-next">${last ? 'PLAY' : 'NEXT'}</button>
      </div>
    </div>`, { dismissable: false, width: '920px' });

  sheet.querySelector('#tut-art').appendChild(p.art());
  sheet.querySelectorAll('[data-go]').forEach((d) => d.onclick = () => tutorialScreen(game, +d.dataset.go));
  sheet.querySelector('#t-prev')?.addEventListener('click', () => { sfx.select(); tutorialScreen(game, page - 1); });
  sheet.querySelector('#t-skip').onclick = () => { saveCareer({ tutorial: true }); homeScreen(game); };
  sheet.querySelector('#t-next').onclick = () => {
    sfx.select();
    if (!last) return tutorialScreen(game, page + 1);
    saveCareer({ tutorial: true });
    homeScreen(game);
  };
}

// ---------------------------------------------------------------------------
// COMPENDIUM — browse everything, in or out of a run.
// ---------------------------------------------------------------------------
const TABS = [
  { key: 'candles', name: 'SPECIAL CANDLES' },
  { key: 'brokers', name: 'BROKERS' },
  { key: 'formations', name: 'FORMATIONS' },
  { key: 'charts', name: 'CHARTS & RUMORS' },
  { key: 'bosses', name: 'BOSSES' },
  { key: 'licences', name: 'LICENCES' },
];

export function compendiumScreen(game, back, tab = 'candles', query = '') {
  const sheet = showOverlay(`
    <div class="sheet-head">
      <div><h2>COMPENDIUM</h2><div class="sub" style="margin:0">Everything in the game and what it does</div></div>
      <input class="comp-search" id="comp-q" placeholder="Search&hellip;" value="${query.replace(/"/g, '&quot;')}" />
    </div>
    <div class="comp-tabs">${TABS.map((t) =>
      `<button class="comp-tab ${t.key === tab ? 'on' : ''}" data-tab="${t.key}">${t.name}</button>`).join('')}</div>
    <div class="comp-body" id="comp-body"></div>
    <div class="btn-row"><button class="btn" id="comp-back">BACK</button></div>`,
    { dismissable: false, width: '1000px' });

  const body = sheet.querySelector('#comp-body');
  const q = query.trim().toLowerCase();
  const hit = (...parts) => !q || parts.join(' ').toLowerCase().includes(q);

  if (tab === 'candles') {
    const rows = ENHANCEMENT_KEYS.filter((k) => hit(ENHANCEMENTS[k].name, ENHANCEMENTS[k].desc));
    body.innerHTML = `<div class="comp-note">Special candles keep their sector, body and polarity, and gain an
      ability on top. Each one is drawn differently so you can spot it on the board.</div>
      <div class="comp-cards" id="cand-cards"></div>
      <h3>BODY SHAPES</h3>
      <div class="comp-note">A candle's body also sets its silhouette, so size reads at a glance.</div>
      <div class="comp-cards" id="band-cards"></div>
      <h3>EDITIONS &amp; SEALS</h3>
      <div class="comp-mini">${[...Object.values(EDITIONS), ...Object.values(STAMPS)]
        .filter((e) => hit(e.name, e.desc))
        .map((e) => `<div class="cm"><b>${e.name}</b><span>${e.desc}</span></div>`).join('')}</div>`;
    const cc = body.querySelector('#cand-cards');
    rows.forEach((k) => {
      const e = ENHANCEMENTS[k];
      const card = document.createElement('div');
      card.className = 'comp-card';
      card.appendChild(candleEl(demoCandle('TECH', k === 'obsidian' ? 13 : [7, 6, 7, 5, 11, 8, 4, 12, 10, 3, 2, 13][ENHANCEMENT_KEYS.indexOf(k)] || 7, true, { enhancement: k }), { reveal: true }));
      const t = document.createElement('div');
      t.innerHTML = `<b style="color:${e.color}">${e.name}</b><span>${e.desc}</span>`;
      card.appendChild(t);
      cc.appendChild(card);
    });
    const bc = body.querySelector('#band-cards');
    Object.values(BANDS).forEach((band, i) => {
      const bodyVal = [1, 3, 6, 9, 13][i];
      const card = document.createElement('div');
      card.className = 'comp-card';
      card.appendChild(candleEl(demoCandle(SECTOR_KEYS[i % 4], bodyVal, i % 2 === 0), { reveal: true }));
      const t = document.createElement('div');
      t.innerHTML = `<b>${band.name}</b><span>body ${band.key === 'doji' ? '1' : band.key === 'spinner' ? '2–4' : band.key === 'standard' ? '5–7' : band.key === 'heavy' ? '8–10' : '11–13'}</span>`;
      card.appendChild(t);
      bc.appendChild(card);
    });
  } else if (tab === 'brokers') {
    const order = ['legendary', 'rare', 'uncommon', 'common'];
    const st = game.state || { brokers: [], mods: {}, cash: 0, book: [], session: null };
    body.innerHTML = order.map((r) => {
      const list = BROKER_KEYS.filter((k) => BROKERS[k].rarity === r)
        .filter((k) => hit(BROKERS[k].name, typeof BROKERS[k].text === 'function' ? '' : BROKERS[k].text));
      if (!list.length) return '';
      return `<h3 style="color:${RARITY[r].color}">${RARITY[r].name.toUpperCase()} · ${list.length}</h3>
        <div class="comp-list">${list.map((k) => {
          const d = BROKERS[k];
          const inst = makeBroker(k, null);
          const txt = typeof d.text === 'function' ? d.text(inst, st) : d.text;
          return `<div class="cl" style="--rc:${RARITY[r].color}">
            <span class="cl-art">${d.art}</span>
            <span class="cl-body"><b>${d.name}</b><small>${txt}</small></span>
            <span class="cl-cost">$${d.cost}</span></div>`;
        }).join('')}</div>`;
    }).join('') || '<div class="comp-note">Nothing matches that.</div>';
  } else if (tab === 'formations') {
    body.innerHTML = `<div class="comp-note">Contracts level these permanently. Marches read the order you place
      candles in; everything else reads the set.</div>
      <table class="pat-table"><tr><th>FORMATION</th><th>MADE OF</th><th>VOLUME</th><th>LEVERAGE</th></tr>
      ${FORMATION_KEYS.slice().reverse().filter((k) => hit(FORMATIONS[k].name, FORMATIONS[k].made)).map((k) => {
        const f = FORMATIONS[k]; const s = formationStats(k, 1);
        return `<tr><td><b>${f.name}</b></td><td style="color:var(--ink-dim)">${f.made}</td>
          <td class="v">${s.volume}</td><td class="m">x${s.leverage}</td></tr>`;
      }).join('')}</table>`;
  } else if (tab === 'charts') {
    const mk = (obj, label, cls) => {
      const list = Object.values(obj).filter((d) => hit(d.name, consumableText(d, game.state)));
      if (!list.length) return '';
      return `<h3>${label} · ${list.length}</h3><div class="comp-list">${list.map((d) =>
        `<div class="cl ${cls}"><span class="cl-art">${d.art}</span>
          <span class="cl-body"><b>${d.name}</b><small>${consumableText(d, game.state)}</small></span>
          <span class="cl-cost">$${d.cost}</span></div>`).join('')}</div>`;
    };
    body.innerHTML = mk(CHARTS, 'CHARTS', 'k-chart') + mk(CONTRACTS, 'CONTRACTS', 'k-contract') + mk(RUMORS, 'RUMORS', 'k-rumor')
      || '<div class="comp-note">Nothing matches that.</div>';
  } else if (tab === 'bosses') {
    body.innerHTML = `<div class="comp-note">Every third deadline is a boss. Read the rule on the select screen and buy around it.</div>
      <div class="comp-list">${BOSS_KEYS.filter((k) => hit(BOSSES[k].name, BOSSES[k].blurb)).map((k) =>
        `<div class="cl k-boss"><span class="cl-art">${BOSSES[k].art}</span>
          <span class="cl-body"><b>${BOSSES[k].name}</b><small>${BOSSES[k].blurb}</small></span></div>`).join('')}</div>`;
  } else {
    body.innerHTML = `<div class="comp-note">Licences are permanent for the rest of a run, and come in two tiers.</div>
      <div class="comp-list">${LICENSE_KEYS.filter((k) => hit(LICENSES[k].name, LICENSES[k].text)).map((k) =>
        `<div class="cl k-lic"><span class="cl-art">${LICENSES[k].art}</span>
          <span class="cl-body"><b>${LICENSES[k].name}</b><small>${LICENSES[k].text}</small></span>
          <span class="cl-cost">$${LICENSES[k].cost}</span></div>`).join('')}</div>`;
  }

  sheet.querySelectorAll('[data-tab]').forEach((b) =>
    b.onclick = () => { sfx.select(); compendiumScreen(game, back, b.dataset.tab, query); });
  const input = sheet.querySelector('#comp-q');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = input.value;
      compendiumScreen(game, back, tab, v);
      const el = document.getElementById('comp-q');
      el.focus(); el.setSelectionRange(v.length, v.length);
    }, 220);
  });
  sheet.querySelector('#comp-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
// GLOSSARY
// ---------------------------------------------------------------------------
const GLOSSARY = [
  ['Volume', 'The size of your position — the left-hand number. The formation sets a base, then every candle that prints adds its body on top. Brokers that say "+X Volume" add here.', 'vol'],
  ['Leverage', 'The multiplier — the right-hand number. Volume × Leverage = P/L. "+2 Leverage" adds to it; "×1.5 Leverage" multiplies what has already been added, which is why broker order matters.', 'lev'],
  ['P/L', 'Profit and loss. Volume × Leverage, booked against the quota when the trade resolves.'],
  ['Quota', 'The cash you must book before your trades run out. Miss it and the run ends.'],
  ['Trade', 'One placement plus one call. You get four a deadline to start.'],
  ['Sweep', 'Throw candles back and draw replacements without spending a trade. Three a deadline to start.'],
  ['Board', 'The candles in front of you right now — eight to start.'],
  ['Book', 'Your whole collection of candles, 52 at the start of a run. The board is dealt from it.'],
  ['Desk', 'Your broker slots. Five to start. Brokers trigger left to right.'],
  ['Print', 'What a candle does when it scores. Only candles inside the formation print, unless a broker says otherwise.'],
  ['Formation', 'What your placed candles make — Tweezer, Staircase, Cluster, Soldiers and so on. Sets the base Volume and Leverage.'],
  ['March', 'Three White Soldiers or Three Black Crows. The only formations that care about the order you place candles in, and they must be contiguous.'],
  ['Conviction', 'The bonus for your printed candles agreeing with the direction you called. All agreeing is ×1.5 Leverage, most agreeing is ×1.2.'],
  ['Green trade', 'You called the tape correctly. Full P/L.'],
  ['Red trade', 'You called it wrong. You keep 35% — unless a broker says otherwise.'],
  ['Signal', 'The desk arrow showing where the tape goes next. Truthful 68% of the time to start; terminals and phones raise that.'],
  ['Regime', 'The market mood for a deadline — Bull Run, Capitulation, Short Squeeze and five more. Changes what each direction pays.'],
  ['The Floor', 'The shop between deadlines. Brokers, Charts, Contracts, Rumors, packs and one licence.'],
  ['Special candle', 'A candle with an ability printed on it — Bullion, Ember, Janus and nine more. Made with Charts.'],
  ['Edition', 'A shine on a candle or broker: Foiled, Prismatic, Runed, Spectral. Stacks with everything else.'],
  ['Seal', 'A mark on a candle: Echo (prints twice), Anchor (stays on the board), Coin ($3), Rune (leaves a Chart when swept).'],
  ['Licence', 'A permanent run-long upgrade bought on the Floor. Two tiers each.'],
];

export function glossaryScreen(game, back) {
  const sheet = showOverlay(`
    <h2>GLOSSARY</h2>
    <div class="sub">Every term the game uses, in the order you will meet them.</div>
    <div class="gloss">${GLOSSARY.map(([term, def, cls]) =>
      `<div class="gl ${cls ? 'gl-' + cls : ''}"><b>${term}</b><span>${def}</span></div>`).join('')}</div>
    <div class="btn-row"><button class="btn" id="gl-back">BACK</button></div>`,
    { dismissable: false, width: '760px' });
  sheet.querySelector('#gl-back').onclick = () => (back ? back() : closeOverlay());
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------
export function settingsScreen(game, back) {
  const sheet = showOverlay(`
    <h2>SETTINGS</h2>
    <div class="sub">Saved on this device.</div>
    <div class="settings">
      <button class="set-row" id="s-sound"><b>SOUND</b><span id="s-sound-v">${game.muted ? 'OFF' : 'ON'}</span></button>
      <button class="set-row" id="s-motion"><b>AMBIENT MOTION</b><span id="s-motion-v">${game.reducedMotion ? 'OFF' : 'ON'}</span></button>
      <button class="set-row danger" id="s-wipe"><b>ERASE SAVED RUN &amp; STATS</b><span>&nbsp;</span></button>
    </div>
    <div class="btn-row"><button class="btn" id="set-back">BACK</button></div>`,
    { dismissable: false, width: '560px' });
  sheet.querySelector('#s-sound').onclick = () => {
    game.toggleMute();
    sheet.querySelector('#s-sound-v').textContent = game.muted ? 'OFF' : 'ON';
  };
  sheet.querySelector('#s-motion').onclick = () => {
    game.toggleMotion();
    sheet.querySelector('#s-motion-v').textContent = game.reducedMotion ? 'OFF' : 'ON';
  };
  sheet.querySelector('#s-wipe').onclick = () => {
    game.clearSave();
    try { localStorage.removeItem(CAREER_KEY); } catch {}
    sfx.err();
    settingsScreen(game, back);
  };
  sheet.querySelector('#set-back').onclick = () => (back ? back() : closeOverlay());
}
