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
export const VERSION = 'v1.3.2';
export const VERSION_NAME = 'The Print Shop';

/** Newest first. Kept short — the README carries the detail. */
export const CHANGELOG = [
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
