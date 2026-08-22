/**
 * The build the player is actually running.
 *
 * The game has no build step, so nothing stamps a commit into the page — which
 * makes "am I on the latest version?" impossible to answer by looking. This is
 * the answer: it is printed on the home screen and in the menu, and the README
 * says which version each patch should show. If the number on your title screen
 * is behind the one in the README, you are running an old copy — see
 * `npm run update`.
 *
 * Bump VERSION and add a CHANGELOG entry whenever a patch ships.
 */
export const VERSION = 'v1.8.0';
export const VERSION_NAME = 'Compound Interest';

/** Newest first. Kept short — the README carries the detail. */
export const CHANGELOG = [
  {
    version: 'v1.8.0',
    name: 'Compound Interest',
    notes: [
      'Past act 1 the quota compounds the way a desk does — week 15 asks e44 where it used to ask e8',
      "Today's Tape now says what you still owe and what one more trade has to be worth",
      'Golden Parachute: 3 rolls in a thousand, signs a random Legendary, no cost and no catch',
      'Money over a trillion is printed readably instead of as fifty digits',
    ],
  },
  {
    version: 'v1.7.0',
    name: 'The Long Game',
    notes: [
      'Every act past the first is far steeper than the last — endless mode gets harder now, not just longer',
      'One boss per rule for the whole of weeks 1-8; from week 9 they repeat freely, in any order',
      'The REROLL button keeps its width, so the buttons beside it stop moving under your cursor',
      'Rumors come out of Rumor Packs only — and Insider Line, a new Rare broker, puts them back on the Floor',
      'The two pack licences finally stock the packs their cards name',
    ],
  },
  {
    version: 'v1.6.0',
    name: 'Every Copy',
    notes: [
      'The book shows every copy of a candle on its own card — no more ×3 badge hiding which versions you own',
      "A rumor's edition is sealed onto the broker it lands on: nothing can replace it, and it lasts until you sell",
      'Eight more brokers that multiply on every print, from Ember and Cursed candles to stamps, editions and Dojis',
      'The Fool is rare and Stone Grip uncommon — the clown was always the better of the two',
      'Shapeshifter and Hairline are rare',
    ],
  },
  {
    version: 'v1.5.0',
    name: 'The Fine Print',
    notes: [
      'The rumors that were free money now print what they cost you, in red, on the card',
      'Cards name what they do — "Foiled (+50 Volume)", not "laminated"',
      'The book opens from anywhere, packs included, and doubles as the way to aim a Chart at a candle',
      'Every dollar in or out floats off the cash you are looking at',
      'npm start prints the version and branch it is running, every time — so an old copy is visible before you play it',
    ],
  },
  {
    version: 'v1.4.0',
    name: 'Payday',
    notes: [
      'The tape prints live when you call it — the candle opens flat, wanders inside its own range, then settles on its close',
      'Beat the quota and the money comes out of the Volume and Leverage chips: a handful for a squeaker, a screenful for a blowout',
    ],
  },
  {
    version: 'v1.3.3',
    name: 'The Print Shop',
    notes: [
      'The sort you pick sticks — rearranging a placement no longer leaves the board unsorted for the rest of the deadline',
      'Reordering your placement moves only the candles you placed; the rest hold station',
    ],
  },
  {
    version: 'v1.3.2',
    name: 'The Print Shop',
    notes: [
      'npm start now tells you when a newer version of the game exists, instead of leaving you to find out',
    ],
  },
  {
    version: 'v1.3.1',
    name: 'The Print Shop',
    notes: [
      'Hovering cards no longer jitters — a hover can only grow a card now, never slide it out from under the cursor',
      'A card you have placed answers hover again instead of ignoring it',
      'Click the DECK to see what is still left to draw; click SWEPT for the whole book',
    ],
  },
  {
    version: 'v1.3.0',
    name: 'The Print Shop',
    notes: [
      'The deck and the swept pile sit either side of your board — candles fly out of one and onto the other',
      'The book is a deck view: fanned rows per sector, a per-body tally, and a REMAINING tab for what is left to draw',
      '12 print-shop brokers built on making a candle print more than once',
      'One of each broker, Floor-wide — Hall of Mirrors is the only way round it',
      'Your desk and Charts stay usable while a pack is open',
      'Moving a candle moves it in the print order',
      'Quotas get steeper every eight weeks instead of flattening out',
    ],
  },
  {
    version: 'v1.2.0',
    name: 'The Desk',
    notes: [
      'Sweeping animates, duplicate brokers barred, Reshuffle escalates, the desk can be dragged',
    ],
  },
];
