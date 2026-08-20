export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function money(n) {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return (neg ? '-$' : '$') + v.toLocaleString('en-US');
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
