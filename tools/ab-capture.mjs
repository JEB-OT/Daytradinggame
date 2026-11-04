// Headless A/B capture for the Art Lab: stage the same scene in two art
// styles and save them side by side, so a pair can be judged as a picture.
//
//   node tools/ab-capture.mjs <styleA> <styleB> <scene> <out.png> [crop]
//   node tools/ab-capture.mjs --grid <a,b,c,...> <scene> <out.png> <crop>
//
// `crop` is x,y,w,h in game pixels (1440×900) — the same region is cut from
// each style and stacked, for judging detail rather than the whole screen.
// --grid stacks any number of styles that way, for a quick look across a
// round before the pairs are judged one by one.
// Needs a running server (npm start) and Playwright, which the game itself
// does not depend on: PLAYWRIGHT_CHROMIUM may point at a Chromium binary.
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const grid = argv[0] === '--grid' ? argv.splice(0, 2)[1].split(',') : null;
const [a, b, scene = 'desk', out = 'ab.png', crop] = grid ? [null, null, ...argv] : argv;
const styles = grid || [a, b];
const base = process.env.URL || 'http://localhost:8080';
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});

if (crop) {
  // Detail mode: one full-size game per style, the same rectangle from each.
  const [x, y, w, h] = crop.split(',').map(Number);
  const shots = [];
  for (const style of styles) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${base}/tools/artlab.html?a=${style}&b=${style}&scene=${scene}`);
    await page.waitForSelector('body[data-ready]', { timeout: 30000 });
    const frame = page.frames().find((f) => f.url().includes('index.html'));
    const el = await frame.frameElement();
    // render the game at 1:1 for the detail shot
    await page.evaluate(() => { for (const f of document.querySelectorAll('.frame')) f.style.transform = 'none'; for (const h of document.querySelectorAll('.holder')) h.style.height = '900px'; document.querySelector('.pair').style.gridTemplateColumns = '1440px 1440px'; });
    await page.setViewportSize({ width: 2960, height: 1000 });
    const box = await el.boundingBox();
    shots.push(await page.screenshot({ clip: { x: box.x + x, y: box.y + y, width: w, height: h } }));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(`<body style="margin:0;background:#000;display:flex;flex-direction:column;gap:6px;font:bold 16px sans-serif">${shots.map((s, i) => `<div style="position:relative"><span style="position:absolute;left:6px;top:4px;color:${['#40d9ff', '#ffb020', '#45e08d', '#ff5cf0', '#ffd24a', '#ff5468'][i % 6]};background:#000c;padding:1px 6px">${String.fromCharCode(65 + i)} · ${styles[i]}</span><img style="display:block" src="data:image/png;base64,${s.toString('base64')}"></div>`).join('')}</body>`);
  await page.screenshot({ path: out, fullPage: true });
} else {
  const page = await browser.newPage({ viewport: { width: 2940, height: 1000 } });
  await page.goto(`${base}/tools/artlab.html?a=${a}&b=${b}&scene=${scene}`);
  await page.waitForSelector('body[data-ready]', { timeout: 30000 });
  await page.waitForTimeout(400);
  const pair = await page.$('.pair');
  await pair.screenshot({ path: out });
}
await browser.close();
console.log('wrote ' + out);
