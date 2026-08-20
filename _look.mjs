import { chromium } from 'playwright';
const SC = process.env.SC;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' | ' + (e.stack||'').split('\n')[1]));
const shot = n => p.screenshot({ path: `${SC}/shots3/${n}.png` });

await p.goto('http://localhost:8099/index.html?cb=' + Date.now(), { waitUntil: 'networkidle' });
await shot('01-title');
await p.fill('#seed-input','LOOK1'); await p.click('#t-new'); await p.waitForTimeout(400);
await shot('02-select');

// stack a desk and give the board one of every special candle
await p.evaluate(async () => {
  const S = await import('/src/game/state.js');
  const { makeBroker } = await import('/src/game/brokers.js');
  const { makeConsumable } = await import('/src/game/consumables.js');
  const { ENHANCEMENT_KEYS } = await import('/src/game/candles.js');
  const st = window.game.state;
  st.cash = 420;
  st.brokers = ['frontRunner','pyramid','arbBot','drillSergeant','theWolf'].map(k => makeBroker(k, null));
  st.brokers[1].edition='algorithmic'; st.brokers[3].edition='holographic'; st.brokers[4].edition='offbook';
  st.consumables = [makeConsumable('forge'), makeConsumable('hex')];
  ENHANCEMENT_KEYS.forEach((e,i) => { if (st.book[i]) { st.book[i].enhancement = e; st.book[i].body = 3+i; } });
  st.book[0].stamp='reissue'; st.book[1].edition='holographic'; st.book[2].edition='algorithmic';
  S.computeMods(st); window.game.render();
});
await p.click('[data-play="0"]'); await p.waitForTimeout(600);
// force every special onto the board so they can be seen together
await p.evaluate(async () => {
  const S = await import('/src/game/state.js');
  const st = window.game.state;
  st.session.board = st.book.filter(c => c.enhancement).slice(0, 8);
  window.game.renderBoard();
});
await p.waitForTimeout(400);
await shot('03-specials');
await p.keyboard.press('1'); await p.keyboard.press('2'); await p.keyboard.press('3'); await p.keyboard.press('4');
await p.waitForTimeout(300); await shot('04-placed');
await p.hover('#board-row .candle:nth-child(3)'); await p.waitForTimeout(400); await shot('05-tooltip');
await p.hover('#broker-row .broker:nth-child(2)'); await p.waitForTimeout(400); await shot('06-brokertip');
await p.click('#btn-long'); await p.waitForTimeout(2400); await shot('07-scoring');
await p.waitForTimeout(11000);
await p.evaluate(() => { const g=window.game; if (g.state.session) g.state.session.profit = g.state.session.quota; });
if (await p.$('#btn-long:not([disabled])')) { await p.keyboard.press('1'); await p.click('#btn-long'); await p.waitForTimeout(11000); }
if (await p.$('#p-ok')) { await p.click('#p-ok'); await p.waitForTimeout(700); }
await shot('08-floor');
await p.click('#shop-book'); await p.waitForTimeout(500); await shot('09-book');
console.log('errors:', errors.length ? errors : 'none');
await b.close();
