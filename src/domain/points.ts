// Figures 8.2A / 8.2B — race points, plus within-race tie splitting and
// DQ handling (6.1.3: a disqualified dog is scored as if it had not run).

import type { Race, RaceOutcome } from './types';

/** Points by finishing place (index 0 = 1st) — Figure 8.2A, graded races. */
const GRADED: Record<number, { hp: number[]; other: number[] }> = {
  1: { hp: [8, 6, 4, 3], other: [5, 3, 2, 0] },
  2: { hp: [6, 4, 3, 2], other: [5, 3, 2, 0] },
  3: { hp: [8, 6, 4, 3], other: [5, 3, 2, 0] },
};

/** Figure 8.2B, ungraded races. Program 1 has no HP race (all races 5/3/2/0). */
const UNGRADED: Record<number, { hp: number[]; other: number[] }> = {
  1: { hp: [5, 3, 2, 0], other: [5, 3, 2, 0] },
  2: { hp: [8, 5, 3, 0], other: [5, 3, 2, 0] },
  3: { hp: [8, 5, 3, 0], other: [5, 3, 2, 0] },
};

export function pointsForPlace(
  ungraded: boolean,
  program: 1 | 2 | 3,
  isHP: boolean,
  place: number
): number {
  const table = (ungraded ? UNGRADED : GRADED)[program];
  const arr = isHP ? table.hp : table.other;
  return arr[place - 1] ?? 0;
}

/** In ungraded meets the first program has no High Point race (4.3.5). */
export function hpExists(ungraded: boolean, program: 1 | 2 | 3): boolean {
  return !(ungraded && program === 1);
}

/**
 * Score one race: returns entryId -> points earned.
 *
 * - OC / DNF / ABS score 0 (4.3.5).
 * - DQ: points and placings are distributed as if the dog had not participated
 *   (6.1.3) — callers must already have entered the other dogs' places 1..n
 *   ignoring the DQ'd dog; the DQ'd dog itself scores 0 here.
 * - Dead-heat ties: dogs entered with the same place split the sum of the
 *   points for the places they occupy (4.3.4.1). E.g. two dogs tied for 1st in
 *   an HP P1 race share (8+6)/2 = 7 each; the next dog places 3rd.
 */
export function scoreRace(race: Race, ungraded: boolean): Record<string, number> {
  const out: Record<string, number> = {};

  // 6.5.1(b): after a rerun stalemate the Race Committee may split all the
  // race's points equally among all participants (dogs that actually ran).
  if (race.splitAllPoints) {
    const participants = race.slots.filter((s) => {
      const oc = race.outcomes[s.entryId];
      return oc && oc.kind !== 'ABS' && oc.kind !== 'DQ';
    });
    let sum = 0;
    for (let p = 1; p <= participants.length; p++) {
      sum += pointsForPlace(ungraded, race.program, race.isHP, p);
    }
    const share = participants.length ? sum / participants.length : 0;
    for (const slot of race.slots) {
      const oc = race.outcomes[slot.entryId];
      if (!oc) continue;
      out[slot.entryId] = oc.kind === 'ABS' || oc.kind === 'DQ' ? 0 : share;
    }
    return out;
  }

  const placed: { entryId: string; place: number }[] = [];
  for (const slot of race.slots) {
    const oc = race.outcomes[slot.entryId];
    if (!oc) continue;
    if (oc.kind === 'placed') placed.push({ entryId: slot.entryId, place: oc.place });
    else out[slot.entryId] = 0;
  }
  placed.sort((a, b) => a.place - b.place);

  // Walk groups of equal declared place; each group occupies consecutive
  // point positions and splits their sum equally.
  let pos = 1; // next point position to consume
  let i = 0;
  while (i < placed.length) {
    const group = [placed[i]];
    while (i + group.length < placed.length && placed[i + group.length].place === placed[i].place) {
      group.push(placed[i + group.length]);
    }
    let sum = 0;
    for (let k = 0; k < group.length; k++) {
      sum += pointsForPlace(ungraded, race.program, race.isHP, pos + k);
    }
    const share = sum / group.length;
    for (const g of group) out[g.entryId] = share;
    pos += group.length;
    i += group.length;
  }
  return out;
}

/**
 * Round an accumulated point total to a fixed precision.
 *
 * A dead heat (or a 6.5.1(b) split) among three dogs shares 5 points as
 * 1.666..., which has no exact binary representation. Two dogs that are
 * mathematically tied can then differ by ~1e-15 depending on which program the
 * split landed in, because floating-point addition is not associative. That
 * epsilon is invisible but decides real awards: `===` on the totals is what
 * makes tied dogs split an award value (5.2/5.3) and share a rotation group
 * (4.3.4.1). Rounding here — every total passes through this — keeps the
 * comparison honest and keeps 1.667 out of the standings table as
 * 1.6666666666666667. Real point gaps are never smaller than 1/6, so three
 * decimals cannot merge two genuinely different totals.
 */
export function roundPoints(total: number): number {
  return Math.round(total * 1000) / 1000;
}

/** Effective placement used for tie-breaking: lower is better; null = unplaced. */
export function effectivePlace(outcome: RaceOutcome | undefined): number | null {
  return outcome && outcome.kind === 'placed' ? outcome.place : null;
}

/**
 * Validate finisher places for a race: must run 1..n consecutively, with
 * dead-heat ties consuming their positions (e.g. [1,1,3] is valid, [1,1,2]
 * and [2,3] are not). Returns an error message or null when valid.
 */
export function validatePlaces(places: number[]): string | null {
  const sorted = [...places].sort((a, b) => a - b);
  let pos = 1;
  let i = 0;
  while (i < sorted.length) {
    let k = 1;
    while (i + k < sorted.length && sorted[i + k] === sorted[i]) k++;
    if (sorted[i] !== pos) {
      return `Places must run consecutively from 1 (found ${sorted[i]} where ${pos} was expected).`;
    }
    pos += k;
    i += k;
  }
  return null;
}
