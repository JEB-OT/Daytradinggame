// Deterministic, seedable RNG so runs can be shared / replayed.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = 'MARGIN') {
    this.seedString = String(seed);
    this.state = hashString(this.seedString) || 0x9e3779b9;
    this.calls = 0;
  }

  // mulberry32
  next() {
    this.calls++;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) { return min + this.next() * (max - min); }
  int(min, max) { return Math.floor(this.float(min, max + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  pickWeighted(entries) {
    // entries: [{ item, weight }]
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    if (total <= 0) return entries.length ? entries[0].item : null;
    let roll = this.next() * total;
    for (const e of entries) {
      roll -= Math.max(0, e.weight);
      if (roll <= 0) return e.item;
    }
    return entries[entries.length - 1].item;
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Take n distinct items (no replacement) from a pool.
  sample(arr, n) {
    return this.shuffle(arr).slice(0, Math.min(n, arr.length));
  }

  fork(tag = '') {
    const child = new RNG(this.seedString + '|' + tag + '|' + this.calls);
    return child;
  }
}

export function randomSeedString(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
