// ---------------------------------------------------------------------------
// LICENSES — permanent, run-long upgrades bought on the Floor (vouchers).
// Each base license unlocks its tier-2 upgrade for later weeks.
// ---------------------------------------------------------------------------
export const LICENSES = {
  discountTerminal: { key: 'discountTerminal', name: 'Discount Terminal', art: '🏷️', cost: 10, tier: 1, upgrade: 'liquidation',
    text: 'All Floor items cost 25% less', mods: { discountPct: 0.25 } },
  liquidation: { key: 'liquidation', name: 'Liquidation Sale', art: '🔻', cost: 10, tier: 2, requires: 'discountTerminal',
    text: 'All Floor items cost 50% less', mods: { discountPct: 0.25 } },

  extraBandwidth: { key: 'extraBandwidth', name: 'Extra Bandwidth', art: '📡', cost: 10, tier: 1, upgrade: 'darkFiber',
    text: '+1 item slot on the Floor', mods: { shopSlots: 1 } },
  darkFiber: { key: 'darkFiber', name: 'Dark Fiber', art: '🛰️', cost: 10, tier: 2, requires: 'extraBandwidth',
    text: '+1 more item slot on the Floor', mods: { shopSlots: 1 } },

  prepaidReroll: { key: 'prepaidReroll', name: 'Prepaid Rerolls', art: '🔁', cost: 10, tier: 1, upgrade: 'houseAccount',
    text: 'Rerolls cost $2 less', mods: { rerollDiscount: 2 } },
  houseAccount: { key: 'houseAccount', name: 'House Account', art: '🏠', cost: 10, tier: 2, requires: 'prepaidReroll',
    text: 'Rerolls cost $2 less again', mods: { rerollDiscount: 2 } },

  overdraft: { key: 'overdraft', name: 'Overdraft', art: '💳', cost: 10, tier: 1, upgrade: 'overdraftII',
    text: '+1 sweep every deadline', mods: { discards: 1 } },
  overdraftII: { key: 'overdraftII', name: 'Overdraft II', art: '💸', cost: 10, tier: 2, requires: 'overdraft',
    text: '+1 more sweep every deadline', mods: { discards: 1 } },

  extraShift: { key: 'extraShift', name: 'Extra Shift', art: '🕗', cost: 12, tier: 1, upgrade: 'doubleShift',
    text: '+1 trade every deadline', mods: { trades: 1 } },
  doubleShift: { key: 'doubleShift', name: 'Double Shift', art: '🕛', cost: 14, tier: 2, requires: 'extraShift',
    text: '+1 more trade every deadline', mods: { trades: 1 } },

  ergoDesk: { key: 'ergoDesk', name: 'Ergonomic Desk', art: '🪑', cost: 10, tier: 1, upgrade: 'tradingPit',
    text: '+1 board size', mods: { handSize: 1 } },
  tradingPit: { key: 'tradingPit', name: 'The Pit', art: '🏟️', cost: 10, tier: 2, requires: 'ergoDesk',
    text: '+1 more board size', mods: { handSize: 1 } },

  researchBudget: { key: 'researchBudget', name: 'Research Budget', art: '📚', cost: 10, tier: 1, upgrade: 'researchWing',
    text: '+1 Chart slot', mods: { chartSlots: 1 } },
  researchWing: { key: 'researchWing', name: 'Research Wing', art: '🏫', cost: 10, tier: 2, requires: 'researchBudget',
    text: '+1 more Chart slot', mods: { chartSlots: 1 } },

  dataFeed: { key: 'dataFeed', name: 'Data Feed', art: '📶', cost: 10, tier: 1, upgrade: 'directFeed',
    text: '+12% signal accuracy', mods: { accuracy: 0.12 } },
  directFeed: { key: 'directFeed', name: 'Direct Feed', art: '🔌', cost: 12, tier: 2, requires: 'dataFeed',
    text: '+18% more signal accuracy', mods: { accuracy: 0.18 } },

  retirement: { key: 'retirement', name: 'Retirement Account', art: '🥧', cost: 10, tier: 1, upgrade: 'trustFund',
    text: 'Interest pays up to $10 a deadline instead of $5 — maxed once you hold $50',
    mods: { interestCap: 5 } },
  trustFund: { key: 'trustFund', name: 'Trust Fund', art: '🎩', cost: 12, tier: 2, requires: 'retirement',
    text: 'Interest pays up to $15 a deadline — maxed once you hold $75',
    mods: { interestCap: 5 } },
  vaultKeys: { key: 'vaultKeys', name: 'The Vault Keys', art: '🗝️', cost: 16, tier: 3, requires: 'trustFund',
    text: 'Interest pays up to $25 a deadline — maxed once you hold $125',
    mods: { interestCap: 10 } },

  clearingHouse: { key: 'clearingHouse', name: 'Clearing House', art: '🏤', cost: 10, tier: 1, upgrade: 'primeBroker',
    text: 'Contract Packs appear far more often', mods: { contractWeight: 2 } },
  primeBroker: { key: 'primeBroker', name: 'Prime Broker', art: '🎖️', cost: 12, tier: 2, requires: 'clearingHouse',
    text: 'Rumor Packs appear far more often too', mods: { rumorWeight: 2 } },

  complianceWaiver: { key: 'complianceWaiver', name: 'Compliance Waiver', art: '📋', cost: 12, tier: 1, upgrade: 'regCapture',
    text: 'Boss quotas are 15% lower', mods: { bossQuotaMult: 0.85 } },
  regCapture: { key: 'regCapture', name: 'Regulatory Capture', art: '🎭', cost: 14, tier: 2, requires: 'complianceWaiver',
    text: 'Boss debuffs are disabled on the first trade of a boss deadline', mods: { bossGrace: 1 } },

  seedRound: { key: 'seedRound', name: 'Seed Round', art: '🌰', cost: 10, tier: 1, upgrade: 'seriesA',
    text: '+$3 at the start of every deadline', mods: { deadlineStipend: 3 } },
  seriesA: { key: 'seriesA', name: 'Series A', art: '🚀', cost: 12, tier: 2, requires: 'seedRound',
    text: '+$4 more at the start of every deadline', mods: { deadlineStipend: 4 } },

  floorConviction: { key: 'floorConviction', name: 'Conviction Coach', art: '🧭', cost: 10, tier: 1, upgrade: 'convictionGuru',
    text: 'Conviction bonuses are worth an extra x0.2', mods: { convictionBonus: 0.2 } },
  convictionGuru: { key: 'convictionGuru', name: 'The True Believer', art: '🕯️', cost: 12, tier: 2, requires: 'floorConviction',
    text: 'Conviction triggers at half your candles instead of most of them', mods: { convictionThreshold: 0.5 } },

  darkTerminal: { key: 'darkTerminal', name: 'Grey Terminal', art: '🖲️', cost: 12, tier: 1, upgrade: 'blackTerminal',
    text: 'Brokers on the Floor are more likely to be Rare', mods: { rareBoost: 1 } },
  blackTerminal: { key: 'blackTerminal', name: 'Black Terminal', art: '🕹️', cost: 16, tier: 2, requires: 'darkTerminal',
    text: 'Legendary brokers can now appear on the Floor', mods: { allowLegendary: true } },
};
export const LICENSE_KEYS = Object.keys(LICENSES);

export function availableLicenses(state) {
  return LICENSE_KEYS.filter((k) => {
    const l = LICENSES[k];
    if (state.licenses.includes(k)) return false;
    if (l.requires && !state.licenses.includes(l.requires)) return false;
    return true;
  });
}
