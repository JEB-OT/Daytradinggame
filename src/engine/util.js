export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function money(n) {
  const neg = n < 0;
  const v = Math.abs(n);
  // Past a trillion the comma form is a fifty-character wall of digits that
  // breaks whatever panel it lands in, and quotas reach that in the mid teens
  // now. Hand those to bignum — the format the rest of the game already reads
  // P/L in — and keep the exact figure for every amount anyone counts.
  if (!isFinite(v) || v >= 1e12) return (neg ? '-' : '') + '$' + bignum(v);
  return (neg ? '-$' : '$') + Math.round(v).toLocaleString('en-US');
}

// Big numbers show up fast in a mult-stacking game; keep them readable.
export function bignum(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n * 10) / 10).replace(/\.0$/, '');
  if (a < 1e6) return (n / 1e3).toFixed(a < 1e4 ? 2 : 1) + 'K';
  if (a < 1e9) return (n / 1e6).toFixed(2) + 'M';
  if (a < 1e12) return (n / 1e9).toFixed(2) + 'B';
  if (a < 1e15) return (n / 1e12).toFixed(2) + 'T';
  const exp = Math.floor(Math.log10(a));
  return (n / Math.pow(10, exp)).toFixed(2) + 'e' + exp;
}

export function pct(n) {
  return Math.round(n * 100) + '%';
}

export function id() {
  id._n = (id._n || 0) + 1;
  return 'x' + id._n.toString(36);
}

/**
 * Make sure id() never hands out a uid that is already taken.
 *
 * The counter lives in the page, so a reload starts it from nothing — while the
 * save being loaded is full of candles numbered by the page before. Without
 * this, the first candle a pack or a Chart made after loading got a uid some
 * card in the book already had, and the game finds cards by uid: selecting,
 * moving or destroying one could act on the other.
 */
export function reserveIds(uids) {
  for (const u of uids) {
    const m = /^x([0-9a-z]+)$/.exec(u || '');
    if (m) id._n = Math.max(id._n || 0, parseInt(m[1], 36));
  }
}

export function deepCopy(v) {
  return JSON.parse(JSON.stringify(v));
}

export function sum(arr, f = (x) => x) {
  let t = 0;
  for (const v of arr) t += f(v);
  return t;
}

export function titleCase(s) {
  return s.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase());
}
