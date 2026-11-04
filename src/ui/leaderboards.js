// ---------------------------------------------------------------------------
// The LEADERBOARDS screen — only on the hosted version (see src/net/online.js).
//
// One tab per board, the top fifty, your own place marked (and shown under
// the table if you are further down), your trader name with a rename, and the
// trader code that carries you to another device.
// ---------------------------------------------------------------------------
import { bignum } from '../engine/util.js';
import { showOverlay, closeOverlay } from './overlays.js';
import { sfx, toast } from './fx.js';
import * as Online from '../net/online.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A board's value as it reads: money for the trade boards, a multiple for Overkill. */
export function formatScore(kind, v) {
  if (kind === 'times') return '×' + (v >= 1000 ? bignum(v) : v.toFixed(1));
  return '$' + bignum(v);
}

let lastTab = 'campaign';

export function leaderboardScreen(game, back, tab = lastTab) {
  const meta = Online.online.health?.boards || {};
  const keys = Object.keys(meta);
  if (!keys.includes(tab)) tab = keys[0];
  lastTab = tab;
  const me = Online.trader();
  const sheet = showOverlay(`
    <div class="sheet-head">
      <div><h2>LEADERBOARDS</h2>
        <div class="sub" style="margin:0">One place per trader on each board — beat your best and your place moves up.</div></div>
    </div>
    <div class="comp-tabs lb-tabs">${keys.map((k) => `<button class="comp-tab ${k === tab ? 'on' : ''}" data-tab="${k}">${esc(meta[k].title)}</button>`).join('')}</div>
    <div class="lb-blurb">${esc(meta[tab]?.blurb || '')}</div>
    <div class="lb-list" id="lb-list"><div class="lb-empty">Fetching the boards…</div></div>
    <div class="lb-you" id="lb-you"></div>
    <h3>YOU</h3>
    <div class="lb-me">
      <div class="lb-me-line">Trading as <b id="lb-name">${esc(me.name)}</b></div>
      <form class="lb-form" id="lb-rename">
        <input id="lb-new" maxlength="18" autocomplete="off" spellcheck="false" placeholder="A new trader name">
        <button class="btn" type="submit">RENAME</button>
      </form>
      <details class="lb-code">
        <summary>Play as this trader on another device</summary>
        <div class="lb-code-body">
          <div>Your trader code — enter it on the other device. <b>Keep it to yourself:</b> whoever has it can post as you.</div>
          <div class="lb-code-row"><code id="lb-code">••••••••••••••••</code>
            <button class="btn tiny" id="lb-show" type="button">SHOW</button>
            <button class="btn tiny" id="lb-copy" type="button">COPY</button></div>
          <form class="lb-form" id="lb-use">
            <input id="lb-code-in" autocomplete="off" spellcheck="false" placeholder="Paste a trader code from another device">
            <button class="btn" type="submit">USE CODE</button>
          </form>
        </div>
      </details>
    </div>
    <div class="btn-row"><button class="btn" id="lb-back">BACK</button></div>`,
    { width: '720px', dismissable: !back });

  const done = () => (back ? back() : closeOverlay());
  sheet.querySelector('#lb-back').onclick = done;
  sheet.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { sfx.select(); leaderboardScreen(game, back, b.dataset.tab); });

  // ---- the board
  const list = sheet.querySelector('#lb-list');
  const you = sheet.querySelector('#lb-you');
  Online.fetchBoards(50).then((data) => {
    if (!sheet.isConnected) return;
    const b = data.boards[tab];
    if (data.you?.name) sheet.querySelector('#lb-name').textContent = data.you.name;
    if (!b || !b.entries.length) {
      list.innerHTML = '<div class="lb-empty">Nobody is on this board yet. The first trade to land here takes #1.</div>';
    } else {
      list.innerHTML = b.entries.map((e) => `
        <div class="lb-row ${e.you ? 'you' : ''} ${e.rank <= 3 ? 'podium p' + e.rank : ''}">
          <span class="lb-rank">${e.rank}</span>
          <span class="lb-who">${esc(e.name)}${e.you ? ' <i>YOU</i>' : ''}</span>
          <span class="lb-val">${formatScore(b.kind, e.value)}</span>
          <span class="lb-week">wk ${e.week}</span>
        </div>`).join('');
    }
    if (b?.you && !b.entries.some((e) => e.you)) {
      you.innerHTML = `You: <b>#${b.you.rank}</b> of ${b.total} — <b>${formatScore(b.kind, b.you.value)}</b> (week ${b.you.week})`;
    } else if (!b?.you) {
      you.innerHTML = 'You are not on this board yet — your best goes in the moment you make it.';
    } else you.textContent = `${b.total} trader${b.total === 1 ? '' : 's'} on this board`;
  }).catch((e) => {
    if (!sheet.isConnected) return;
    list.innerHTML = `<div class="lb-empty bad">Could not reach the leaderboards (${esc(e.message)}). Your bests are kept and sent later.</div>`;
  });

  // ---- rename
  sheet.querySelector('#lb-rename').onsubmit = async (e) => {
    e.preventDefault();
    const input = sheet.querySelector('#lb-new');
    const name = input.value.trim();
    if (!name) return;
    try {
      const n = await Online.rename(name);
      sfx.buy(); toast(`You are now ${n} on every board`, 'good');
      leaderboardScreen(game, back, tab);
    } catch (err) { sfx.err(); toast(err.message, 'bad'); input.focus(); }
  };

  // ---- trader code
  const codeEl = sheet.querySelector('#lb-code');
  sheet.querySelector('#lb-show').onclick = () => { codeEl.textContent = Online.traderCode(); };
  sheet.querySelector('#lb-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(Online.traderCode()); toast('Trader code copied', 'good'); }
    catch { codeEl.textContent = Online.traderCode(); toast('Copy it from the box', ''); }
  };
  sheet.querySelector('#lb-use').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const n = await Online.useCode(sheet.querySelector('#lb-code-in').value);
      sfx.buy(); toast(`Welcome back, ${n}`, 'good');
      leaderboardScreen(game, back, tab);
    } catch (err) { sfx.err(); toast(err.message, 'bad'); }
  };
}
