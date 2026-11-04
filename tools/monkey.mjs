// The UI monkey: drive the real game in a browser at random — clicks, keys,
// paint strokes, drags, right-clicks, resizes, reloads — and report anything
// that breaks: page errors, console errors, NaN/undefined on screen, a page
// that scrolls sideways, a game stuck busy, a screen with no way forward, a
// desk with no candles.
//
//   node tools/monkey.mjs [sessions] [steps] [startSeed]
//
// MC_SETTINGS (JSON) plays every session with those settings — game speed,
// graphics quality, animations — since timing bugs hide at 1× and show at 8×.
//
// Needs a running server (MC_NO_UPDATE_CHECK=1 NO_OPEN=1 node server.js) and
// Playwright, which the game itself does not depend on; PLAYWRIGHT_CHROMIUM may
// point at a Chromium binary. Every session is seeded, so a problem it reports
// can be replayed by starting from the same seed. Engine-level bugs are the
// fuzzer's job (npm run fuzz); this is for the interface.
import { chromium } from 'playwright';

const SESSIONS = +(process.argv[2] || 12);
const STEPS = +(process.argv[3] || 300);
const START = +(process.argv[4] || 0);
const URL = process.env.URL || 'http://localhost:8080/';
const VIEWPORTS = [[1440, 900], [1280, 720], [1920, 1080], [1100, 700], [1600, 1000]];

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const problems = new Map();
const note = (kind, msg, ctx) => {
  const key = kind + ': ' + String(msg).replace(/\d+/g, '#').slice(0, 180);
  if (!problems.has(key)) problems.set(key, { count: 0, ctx });
  problems.get(key).count++;
};

for (let n = START; n < START + SESSIONS; n++) {
  const R = rng(n * 7919 + 13);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const [w, h] = VIEWPORTS[n % VIEWPORTS.length];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const log = [];
  const where = () => `session ${n} step ${log.length} (${w}x${h}) after: ${log.slice(-6).join(' → ')}`;
  page.on('pageerror', (e) => note('PAGE ERROR', e.message, where() + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) note('CONSOLE', m.text(), where()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game != null);
  // MC_SETTINGS='{"speed":8,"quality":"low"}' plays every session with those settings.
  await page.evaluate((st) => { localStorage.clear(); if (st) localStorage.setItem('margincall.settings', st); }, process.env.MC_SETTINGS || null);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game != null);
  // quieter, faster: no first-run coaching toasts
  await page.evaluate(() => { window.game.hint = () => {}; });

  let busySince = null;
  for (let step = 0; step < STEPS; step++) {
    let action = '';
    try {
      const snap = await page.evaluate(() => {
        const g = window.game;
        const vis = (el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const top = document.elementFromPoint(x, y);
          return !!top && (top === el || el.contains(top) || top.contains(el));
        };
        const overlay = document.querySelector('#overlay-root .overlay');
        const scope = overlay || document;
        const sel = 'button:not([disabled]), .candle, .broker, .consumable, .pack-opt, .pk-cell, .pile, .tut-dots i, .home-version, .dl-choice';
        const els = [...scope.querySelectorAll(sel)].filter(vis);
        els.forEach((el, i) => el.setAttribute('data-monkey', i));
        const text = document.body.innerText;
        // What sticks out past the right edge, innermost first — so a report
        // names the culprit rather than every box that contains it.
        let wide = '';
        if (document.documentElement.scrollWidth > innerWidth + 2) {
          const out = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 2);
          wide = out.filter((e) => !out.some((o) => o !== e && e.contains(o))).slice(0, 4)
            .map((e) => (e.id ? '#' + e.id : e.tagName.toLowerCase()) + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).join('.') : '')).join(' ');
        }
        const bad = /\bNaN\b|undefined|\[object |Infinity(?!.)/.exec(text);
        return {
          n: els.length, overlay: !!overlay, overlayText: overlay ? overlay.innerText.slice(0, 60) : '',
          busy: !!g.busy, session: !!g.state?.session, phase: g.state?.phase,
          board: g.state?.session?.board.length ?? null, bad: bad ? text.slice(Math.max(0, bad.index - 40), bad.index + 40) : null,
          hscroll: document.documentElement.scrollWidth > innerWidth + 2 && !document.querySelector('.app.shake, .app.shake-big'),
          wide,
          kinds: els.map((e) => e.tagName === 'BUTTON' ? 'button' : e.className.split(' ')[0]),
        };
      });
      if (snap.bad) note('BAD TEXT', snap.bad.replace(/\s+/g, ' '), where());
      if (snap.hscroll) {
        // Only a layout that stays too wide counts: a card mid-flight or a
        // shake can poke past the edge for a frame without anyone seeing it.
        await page.waitForTimeout(900);
        const still = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
        if (still) note('HORIZONTAL OVERFLOW', `${snap.wide} (${snap.overlayText.split('\n')[0]})`, where());
      }
      if (snap.busy) { busySince ??= Date.now(); if (Date.now() - busySince > 15000) { note('STUCK BUSY', 'busy for 15s', where()); busySince = null; } }
      else busySince = null;
      if (snap.n === 0 && !snap.busy) {
        // nothing to click and not mid-animation: give it a moment, then call it
        await page.waitForTimeout(1500);
        const again = await page.evaluate(() => document.querySelectorAll('#overlay-root button:not([disabled]), button:not([disabled])').length);
        if (!again) note('NO WAY FORWARD', snap.overlayText || 'desk', where());
      }
      if (!snap.overlay && snap.session && snap.board === 0 && !snap.busy) note('EMPTY BOARD', 'desk with no candles and no overlay', where());

      // the occasional nudge, so the run gets past week 1 and into the Floor, packs and payouts
      if (R() < 0.07) {
        action = 'nudge';
        await page.evaluate((r) => {
          const g = window.game, st = g.state;
          if (!st) return;
          if (r < 0.5) st.cash += 40;
          else if (st.session && !g.busy) st.session.profit = Math.max(st.session.profit, st.session.quota - 1);
          g.render?.();
        }, R());
      } else if (R() < 0.3) {
        // progress: take the obvious way forward so the run goes deep
        action = 'progress';
        const primary = await page.$('#overlay-root .btn.primary:not([disabled]), #overlay-root [data-play], #overlay-root #p-ok, #overlay-root #b-ok, #overlay-root .pack-opt, #overlay-root #shop-next');
        if (primary) await primary.click({ force: true, timeout: 2000 }).catch(() => {});
        else if (snap.session && !snap.overlay) {
          const k = 1 + Math.floor(R() * 5);
          for (let q = 0; q < k; q++) await page.keyboard.press(String(1 + Math.floor(R() * 8)));
          await page.keyboard.press(R() < 0.5 ? 'l' : 's');
        } else if (await page.$('#h-new')) await page.click('#h-new', { force: true }).catch(() => {});
      } else {
        const r = R();
        if (r < 0.55 && snap.n) {
          // weight overlay buttons and trades so progress happens
          const kinds = snap.kinds;
          let i = Math.floor(R() * snap.n);
          if (!snap.overlay && R() < 0.4) {
            const cand = kinds.map((k, j) => [k, j]).filter(([k]) => k === 'candle');
            if (cand.length) i = pick(cand)[1];
          }
          action = 'click ' + kinds[i];
          await page.click(`[data-monkey="${i}"]`, { force: true, timeout: 2000 });
        } else if (r < 0.75) {
          const k = pick(['l', 's', 'w', 'a', ' ', '1', '2', '3', '4', '5', '6', '0', 'x', 'e', 'b', 'Escape', 'm', '?', 'Enter', 'Tab']);
          action = 'key ' + k;
          await page.keyboard.press(k);
        } else if (r < 0.83) {
          // paint stroke across the board
          action = 'paint';
          const boxes = await page.$$eval('#board-row .candle', (els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height * 0.7]; }));
          if (boxes.length > 1) {
            const a = Math.floor(R() * boxes.length), b = Math.floor(R() * boxes.length);
            await page.mouse.move(...boxes[a]); await page.mouse.down();
            await page.mouse.move(...boxes[b], { steps: 6 }); await page.mouse.up();
          }
        } else if (r < 0.87) {
          action = 'drag';
          const sel = pick(['#board-row .candle.selected', '#broker-row .broker', '.floor-bar .broker']);
          const loc = page.locator(sel);
          const cnt = await loc.count();
          if (cnt > 1) await loc.nth(Math.floor(R() * cnt)).dragTo(loc.nth(Math.floor(R() * cnt)), { force: true, timeout: 2000 }).catch(() => {});
        } else if (r < 0.9) {
          action = 'right-click';
          const els = await page.$$('.broker, .consumable');
          if (els.length) await pick(els).click({ button: 'right', force: true, timeout: 2000 }).catch(() => {});
        } else if (r < 0.94) {
          action = 'hover';
          await page.mouse.move(R() * w, R() * h, { steps: 3 });
        } else if (r < 0.96) {
          const [nw, nh] = pick(VIEWPORTS);
          action = `resize ${nw}x${nh}`;
          await page.setViewportSize({ width: nw, height: nh });
        } else if (r < 0.975) {
          action = 'reload';
          await page.reload({ waitUntil: 'networkidle' });
          await page.waitForFunction(() => window.game != null);
          await page.evaluate(() => { window.game.hint = () => {}; });
          if (await page.$('#h-continue')) await page.click('#h-continue', { force: true }).catch(() => {});
        } else {
          action = 'wait';
          await page.waitForTimeout(400 + R() * 1600);
        }
      }
      log.push(action);
      await page.waitForTimeout(R() < 0.7 ? 30 + R() * 120 : 300 + R() * 900);
    } catch (e) {
      if (!/Timeout|detached|not attached|Target closed|Execution context was destroyed/.test(e.message)) note('MONKEY', e.message.split('\n')[0], where());
      log.push(action + ' (failed)');
    }
  }
  const summary = await page.evaluate(() => ({ week: window.game.state?.week, phase: window.game.state?.phase })).catch(() => ({}));
  console.log(`session ${n} ${w}x${h}: reached week ${summary.week ?? '-'} (${summary.phase ?? 'no run'})`);
  await ctx.close();
}
await browser.close();
console.log(`\n${problems.size} distinct problem(s)`);
for (const [k, v] of problems) console.log(`\n✗ ${k}  ×${v.count}\n   ${v.ctx}`);
