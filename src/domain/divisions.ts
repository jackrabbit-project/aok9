// Division organization (4.1.4 - 4.1.7). The engine SUGGESTS divisions; the
// Race Secretary has final judgment (size/speed/type of mixed groups).

import type { Division, Entry } from './types';

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/**
 * Suggest divisions from the entry list:
 * - every breed (or mix type) with >= 2 dogs becomes a breed division (4.1.5)
 * - all remaining dogs are pooled into one suggested mixed division (4.1.6)
 *   for the secretary to split/merge by size, speed and running style.
 */
export function suggestDivisions(entries: Entry[]): Division[] {
  const active = entries.filter((e) => !e.preScratched);
  const byBreed = new Map<string, Entry[]>();
  for (const e of active) {
    const key = e.breed.trim().toUpperCase();
    if (!byBreed.has(key)) byBreed.set(key, []);
    byBreed.get(key)!.push(e);
  }
  const divisions: Division[] = [];
  const leftovers: Entry[] = [];
  for (const [breed, dogs] of byBreed) {
    if (dogs.length >= 2) {
      divisions.push({
        id: newId('div'),
        type: 'breed',
        name: breed,
        entryIds: dogs.map((d) => d.id),
        leftoverIds: [],
        ungraded: false,
      });
    } else {
      leftovers.push(...dogs);
    }
  }
  if (leftovers.length > 0) {
    divisions.push({
      id: newId('div'),
      type: 'mixed',
      name: 'MIXED',
      entryIds: leftovers.map((d) => d.id),
      leftoverIds: [],
      ungraded: false,
    });
  }
  return divisions;
}

/** Fraction of FTE dogs among a division's runners (the ungraded test, 4.4).
    A dog scratched before racing is not drawn, so it does not count. */
export function fteFraction(division: Division, entries: Map<string, Entry>): number {
  const dogs = division.entryIds.map((id) => entries.get(id)!).filter((e) => e && !e.preScratched);
  if (dogs.length === 0) return 0;
  return dogs.filter((d) => d.fte).length / dogs.length;
}

/** Per 4.4 a division MAY run ungraded when FTEs are at least the threshold (default 3/4). */
export function ungradedSuggested(
  division: Division,
  entries: Map<string, Entry>,
  threshold: number
): boolean {
  return meetsThreshold(fteFraction(division, entries), threshold);
}

/** The threshold is stored to four places (0.6667 for 2/3), so compare with a
    small allowance: 2 of 3 dogs is exactly the 2/3 the option means. */
export function meetsThreshold(fraction: number, threshold: number): boolean {
  return fraction >= threshold - 0.001;
}

/** The WAVE relevant to a dog inside a division (Breed WAVE in breed divisions
 *  unless the dog is a leftover; Mixed WAVE otherwise, 4.2.2). */
export function relevantWave(entry: Entry, division: Division): number | null {
  const asMixed = division.type === 'mixed' || division.leftoverIds.includes(entry.id);
  return asMixed ? entry.mwave : entry.bwave;
}
