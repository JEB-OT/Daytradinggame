// Scenes for the Art Lab (tools/artlab.html). Each one stages the game in a
// frame into exactly the same state — same seed, same desk, same selection —
// so the only thing that differs between the two sides is the art style.
// They are also what the headless A/B captures stage (tools/ab-capture.mjs).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const mod = (win, path) => win.eval(`import(${JSON.stringify(path)})`);

/** A seeded run with a full desk and charts, standing on the first deadline. */
async function deskRun(win, { select = 3 } = {}) {
  const g = win.game;
  g.hint = () => {};
  const S = await mod(win, '/src/game/state.js');
  const { makeBroker } = await mod(win, '/src/game/brokers.js');
  const { makeConsumable } = await mod(win, '/src/game/consumables.js');
  g.startRun('ARTLAB');
  const st = g.state;
  st.permanent.slots = 6; st.permanent.chartSlots = 3;
  st.brokers = ['theWolf', 'contrarian', 'drillSergeant', 'bankTeller', 'hairline', 'wireTap'].map((k) => makeBroker(k, null));
  st.brokers[1].edition = 'holographic';
  st.consumables = ['lighthouse', 'ct_soldiers', 'goldenChute'].map(makeConsumable);
  S.computeMods(st);
  g.beginDeadline(0);
  const b = st.session.board;
  if (b[5]) b[5].enhancement = 'goldleaf';
  if (b[6]) b[6].edition = 'holographic';
  for (const c of b.slice(0, select)) S.toggleSelect(st, c.uid);
  g.renderBoard();
  g.updatePreview();
  return { g, S, st };
}

export const SCENES = {
  desk: {
    label: 'The desk, mid-placement',
    async stage(win) { await deskRun(win); await wait(1400); },
  },
  floor: {
    label: 'The Floor',
    async stage(win) {
      const { g, S, st } = await deskRun(win, { select: 0 });
      st.session = null; st.cash = 120;
      S.openShop(st);
      (await mod(win, '/src/ui/overlays.js')).shopScreen(g);
      await wait(900);
    },
  },
  deadlines: {
    label: 'Choosing a deadline',
    async stage(win) {
      const g = win.game; g.hint = () => {};
      g.startRun('ARTLAB');
      await wait(800);
    },
  },
  brokers: {
    label: 'Compendium — brokers',
    async stage(win) {
      const g = win.game; g.hint = () => {};
      (await mod(win, '/src/ui/screens.js')).compendiumScreen(g, () => {}, 'brokers');
      await wait(900);
    },
  },
  candles: {
    label: 'Compendium — special candles',
    async stage(win) {
      const g = win.game; g.hint = () => {};
      (await mod(win, '/src/ui/screens.js')).compendiumScreen(g, () => {}, 'candles');
      await wait(900);
    },
  },
  home: {
    label: 'Title screen',
    async stage(win) { win.game.hint = () => {}; await wait(900); },
  },
};
