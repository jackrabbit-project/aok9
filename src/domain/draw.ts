// Program 1 draw (4.3.3 graded / 4.4.1 ungraded) and post-position draw (4.3.2).

import { raceSizesRunOrder } from './chart';
import { seedingWave } from './divisions';
import { hpExists } from './points';
import { gradeForWave, nominalWaveForGrade } from './wave';
import type { Division, Entry, ProgramDraw, Race, Rng } from './types';
import { newId } from './divisions';

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sort key for the graded first-program draw: WAVE desc, FTEs slotted by their
 *  assigned grade's nominal WAVE (4.3.1.3), stable within equal keys. */
export function gradedSortKey(entry: Entry, division: Division): number {
  const wave = seedingWave(entry, division);
  if (wave !== null) return wave;
  return nominalWaveForGrade(entry.fteGrade);
}

/**
 * Order the division's dogs for the first program, best first.
 * Graded: by WAVE descending (4.3.3). Ungraded: random draw (4.4.1).
 * The returned order may be manually adjusted by the secretary before the
 * races are built (committee judgment, 4.3.1).
 */
export function firstProgramOrder(division: Division, entries: Map<string, Entry>, rng: Rng): string[] {
  const dogs = division.entryIds
    .map((id) => entries.get(id)!)
    .filter((e) => e && !e.preScratched);
  if (division.ungraded) {
    return shuffle(dogs, rng).map((d) => d.id);
  }
  return dogs
    .map((d, i) => ({ d, i, key: gradedSortKey(d, division) }))
    .sort((a, b) => b.key - a.key || a.i - b.i)
    .map((x) => x.d.id);
}

/**
 * Split an ordered list of dogs (best first) into races per Figure 8.1.
 * The best dogs form the HP race (highest raceNo, run last); races are
 * numbered 1..n in RUN order (1 = lowest, runs first).
 */
export function buildRaces(
  division: Division,
  program: 1 | 2 | 3,
  orderedBestFirst: string[],
  rng: Rng
): Race[] {
  const n = orderedBestFirst.length;
  // A dog running alone (4.2.2.4) is outside Figure 8.1: give it a single
  // non-HP race so the meet can be completed (no points/WAVE consequences).
  const sizesRun = n === 1 ? [1] : raceSizesRunOrder(n); // index 0 = race 1 (LP)
  const raceCount = sizesRun.length;
  const races: Race[] = [];
  let cursor = 0; // walks the ordered list from best to worst
  const withHp = hpExists(division.ungraded, program);
  for (let raceNo = raceCount; raceNo >= 1; raceNo--) {
    const size = sizesRun[raceNo - 1];
    const ids = orderedBestFirst.slice(cursor, cursor + size);
    cursor += size;
    const posts = shuffle(
      Array.from({ length: size }, (_, i) => i + 1),
      rng
    );
    races.push({
      id: newId('race'),
      divisionId: division.id,
      program,
      raceNo,
      isHP: withHp && raceNo === raceCount && size >= 2,
      slots: ids.map((entryId, i) => ({ entryId, post: posts[i] })),
      outcomes: {},
      finished: false,
      rerun: false,
      splitAllPoints: false,
      note: '',
    });
  }
  return races.sort((a, b) => a.raceNo - b.raceNo);
}

/** Redraw post positions for a single race (4.3.2 / 4.3.4.2). */
export function redrawPosts(race: Race, rng: Rng): Race {
  const posts = shuffle(
    Array.from({ length: race.slots.length }, (_, i) => i + 1),
    rng
  );
  return { ...race, slots: race.slots.map((s, i) => ({ ...s, post: posts[i] })) };
}

export function drawFirstProgram(
  division: Division,
  entries: Map<string, Entry>,
  rng: Rng,
  manualOrder?: string[]
): ProgramDraw {
  const order = manualOrder ?? firstProgramOrder(division, entries, rng);
  return {
    program: 1,
    divisionId: division.id,
    races: order.length ? buildRaces(division, 1, order, rng) : [],
    tieDecisions: [],
    locked: false,
  };
}

/** Grade label shown for a dog in program 1 (A/B/C/D from WAVE or FTE grade). */
export function entryGrade(entry: Entry, division: Division) {
  const wave = seedingWave(entry, division);
  return wave === null ? entry.fteGrade : gradeForWave(wave);
}
