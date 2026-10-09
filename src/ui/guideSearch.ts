// Ranking for the Grading Guide search on the Entries screen.
//
// A plain substring filter in guide order buried WS-67 Ava, a Windsprite,
// under thirty dogs whose owners are called Parravani or Gravatt: Windsprite
// sorts after almost every breed, and the list was cut at 25 with no word
// that anything had been cut. The dog whose call name you typed comes first.

import type { GuideDog } from '../domain/types';

/** Fewer letters than this match half the guide. */
export const MIN_TERM = 2;

/** Where the letters were found, best first; -1 is no match. */
function rank(d: GuideDog, term: string): number {
  const name = d.callName.toLowerCase();
  const reg = d.regNo.toLowerCase();
  if (name === term || reg === term) return 0;
  if (name.startsWith(term)) return 1;
  if (name.includes(term)) return 2;
  if (reg.includes(term)) return 3;
  if ((d.owner ?? '').toLowerCase().includes(term)) return 4;
  if ((d.breed ?? '').toLowerCase().includes(term)) return 5;
  return -1;
}

/** Every dog the search matches, best match first; ties keep guide order. */
export function searchGuide(dogs: GuideDog[], query: string): GuideDog[] {
  const term = query.trim().toLowerCase();
  if (term.length < MIN_TERM) return [];
  return dogs
    .map((d, i) => ({ d, r: rank(d, term), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.d);
}
