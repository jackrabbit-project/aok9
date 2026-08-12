// Final meet scoring (4.3.5): total points, final placements with tie rules,
// completion flags used by Chapter V championship point calculations.

import { scoreRace, effectivePlace, roundPoints } from './points';
import { raceOf, totalsThrough } from './rotation';
import type { Division, Entry, ProgramDraw, Standing } from './types';

/** Did `entryId` start (have a recorded outcome other than ABS) in a program? */
function startedProgram(draws: ProgramDraw[], divisionId: string, program: number, entryId: string): boolean {
  const race = raceOf(draws, divisionId, program, entryId);
  if (!race) return false;
  const oc = race.outcomes[entryId];
  return !!oc && oc.kind !== 'ABS';
}

/** A dog "finished" a race only with a placement (OC/DNF/DQ/ABS are not finishes). */
function finishedRace(draws: ProgramDraw[], divisionId: string, program: number, entryId: string): boolean {
  const race = raceOf(draws, divisionId, program, entryId);
  if (!race) return false;
  const oc = race.outcomes[entryId];
  return !!oc && oc.kind === 'placed';
}

/** Did the dog defeat at least one other dog in at least one race? (Ch. V) */
function defeatedSomeone(division: Division, draws: ProgramDraw[], entryId: string): boolean {
  for (const draw of draws.filter((d) => d.divisionId === division.id)) {
    for (const race of draw.races) {
      const mine = race.outcomes[entryId];
      if (!mine || mine.kind !== 'placed') continue;
      for (const slot of race.slots) {
        if (slot.entryId === entryId) continue;
        const other = race.outcomes[slot.entryId];
        if (!other) continue;
        if (other.kind === 'placed' ? other.place > mine.place : other.kind !== 'DQ') {
          // beat a slower finisher, or a dog that OC'd/DNF'd/no-showed.
          // A DQ'd dog is treated as if it had not run (6.1.3).
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Compute final standings for a division. All dogs that started program 1
 * receive a placement (4.3.5). Ties: higher race in the final program, then
 * higher placement in that race; dogs with incomplete meets go to the bottom
 * of their equal-points group.
 */
export function computeStandings(
  division: Division,
  draws: ProgramDraw[],
  entries: Map<string, Entry>
): Standing[] {
  const totals = totalsThrough(division, draws, 3);
  const starters = division.entryIds.filter((id) => startedProgram(draws, division.id, 1, id));

  const rows = starters.map((id) => {
    const completedMeet = [1, 2, 3].every((p) => startedProgram(draws, division.id, p, id));
    const finishedAllRaces = [1, 2, 3].every((p) => finishedRace(draws, division.id, p, id));
    return {
      entryId: id,
      total: totals[id] ?? 0,
      completedMeet,
      finishedAllRaces,
      defeated: defeatedSomeone(division, draws, id),
    };
  });

  const finalRaceKey = (id: string): { raceNo: number; place: number } => {
    for (let p = 3; p >= 1; p--) {
      const race = raceOf(draws, division.id, p, id);
      if (race) {
        return { raceNo: race.raceNo, place: effectivePlace(race.outcomes[id]) ?? 99 };
      }
    }
    return { raceNo: 0, place: 99 };
  };

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // incomplete meets rank at the bottom of their equal-points group
    if (a.completedMeet !== b.completedMeet) return a.completedMeet ? -1 : 1;
    const ka = finalRaceKey(a.entryId);
    const kb = finalRaceKey(b.entryId);
    if (ka.raceNo !== kb.raceNo) return kb.raceNo - ka.raceNo; // higher race first
    if (ka.place !== kb.place) return ka.place - kb.place; // higher placement first
    return 0;
  });

  return rows.map((r, i) => ({
    entryId: r.entryId,
    place: i + 1,
    total: r.total,
    started: true,
    finishedAllRaces: r.finishedAllRaces,
    completedMeet: r.completedMeet,
    defeatedSomeone: r.defeated,
    isLeftover: division.leftoverIds.includes(r.entryId),
  }));
}

/** Meet score used for the WAVE update: total points earned at this meet. */
export function meetScores(division: Division, draws: ProgramDraw[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const draw of draws.filter((d) => d.divisionId === division.id)) {
    for (const race of draw.races) {
      if (!race.finished) continue;
      const pts = scoreRace(race, division.ungraded);
      for (const [id, p] of Object.entries(pts)) totals[id] = (totals[id] ?? 0) + p;
    }
  }
  for (const id of Object.keys(totals)) totals[id] = roundPoints(totals[id]);
  return totals;
}
