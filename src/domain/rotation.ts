// Second and third program draw — Rotation by Points (4.3.4) with the
// tie-resolution chain of 4.3.4.1, producing an audit trail of decisions.

import { scoreRace, effectivePlace, roundPoints } from './points';
import { relevantWave } from './divisions';
import { buildRaces } from './draw';
import type { Division, Entry, ProgramDraw, Race, Rng, TieDecision } from './types';

/** All races of a division up to and including `throughProgram`. */
function racesThrough(draws: ProgramDraw[], divisionId: string, throughProgram: number): Race[] {
  return draws
    .filter((d) => d.divisionId === divisionId && d.program <= throughProgram)
    .flatMap((d) => d.races);
}

/** Total points per entry across all finished races up to a program. */
export function totalsThrough(
  division: Division,
  draws: ProgramDraw[],
  throughProgram: number
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of division.entryIds) totals[id] = 0;
  for (const race of racesThrough(draws, division.id, throughProgram)) {
    if (!race.finished) continue;
    const pts = scoreRace(race, division.ungraded);
    for (const [entryId, p] of Object.entries(pts)) {
      totals[entryId] = (totals[entryId] ?? 0) + p;
    }
  }
  for (const id of Object.keys(totals)) totals[id] = roundPoints(totals[id]);
  return totals;
}

/** The race a dog ran in a given program, if any. */
export function raceOf(draws: ProgramDraw[], divisionId: string, program: number, entryId: string): Race | null {
  const draw = draws.find((d) => d.divisionId === divisionId && d.program === program);
  if (!draw) return null;
  return draw.races.find((r) => r.slots.some((s) => s.entryId === entryId)) ?? null;
}

/** Dogs eligible to be rotated into the next program: ran (started) the
 *  previous program's assigned race and were not DQ'd / scratched out. */
export function activeForNextProgram(
  division: Division,
  draws: ProgramDraw[],
  prevProgram: number
): string[] {
  const out: string[] = [];
  for (const id of division.entryIds) {
    const race = raceOf(draws, division.id, prevProgram, id);
    if (!race) continue;
    const oc = race.outcomes[id];
    if (!oc) continue; // no result recorded -> treat as not started
    if (oc.kind === 'DQ' || oc.kind === 'ABS') continue; // dismissed / out (6.1.4, 4.1.3)
    out.push(id);
  }
  return out;
}

/**
 * Compare two tied dogs for grouping into the next program (4.3.4.1), looking
 * at `program` first, then walking back program by program, finally the WAVE.
 * Returns negative when a should be placed HIGHER than b, plus an explanation.
 */
export function breakTie(
  a: string,
  b: string,
  division: Division,
  draws: ProgramDraw[],
  entries: Map<string, Entry>,
  program: number
): { cmp: number; why: string } {
  for (let p = program; p >= 1; p--) {
    const ra = raceOf(draws, division.id, p, a);
    const rb = raceOf(draws, division.id, p, b);
    if (ra && rb) {
      if (ra.raceNo !== rb.raceNo) {
        return {
          cmp: rb.raceNo - ra.raceNo,
          why: `ran in the higher race of program ${p} (race ${Math.max(ra.raceNo, rb.raceNo)})`,
        };
      }
      const pa = effectivePlace(ra.outcomes[a]);
      const pb = effectivePlace(rb.outcomes[b]);
      if (pa !== null && pb !== null && pa !== pb) {
        return {
          cmp: pa - pb,
          why: `placed higher (${Math.min(pa, pb)} vs ${Math.max(pa, pb)}) in the same race of program ${p}`,
        };
      }
      if (pa !== null && pb === null) return { cmp: -1, why: `finished program ${p} race while the other did not` };
      if (pa === null && pb !== null) return { cmp: 1, why: `finished program ${p} race while the other did not` };
      // identical race and both unplaced -> keep walking back
    }
  }
  const wa = relevantWave(entries.get(a)!, division) ?? -1;
  const wb = relevantWave(entries.get(b)!, division) ?? -1;
  if (wa !== wb) {
    return { cmp: wb - wa, why: `higher WAVE in the Grading Guide (${Math.max(wa, wb)} vs ${Math.min(wa, wb)})` };
  }
  return { cmp: 0, why: 'still tied after all tie-breaks (order kept stable)' };
}

/**
 * Order the active dogs for the next program, best first: cumulative points
 * descending, ties resolved by the 4.3.4.1 chain. Records every tie decision.
 *
 * The ordering and the audit trail are two separate passes on purpose. Building
 * the trail inside the sort comparator looks tempting, but `Array.sort` decides
 * how many comparisons to make and between which pairs: it compares dogs that
 * do not end up next to each other, and may compare the same pair twice. That
 * produced a log with (measured, 24 tied dogs) 76 lines for 23 real adjacent
 * ties, two thirds of them about pairs the secretary never sees side by side.
 * This list is what gets handed over during a protest, so it walks the finished
 * order instead and emits exactly one line per adjacent pair that was actually
 * separated by a tie-break.
 */
export function rotationOrder(
  division: Division,
  draws: ProgramDraw[],
  entries: Map<string, Entry>,
  prevProgram: number
): { order: string[]; decisions: TieDecision[] } {
  const totals = totalsThrough(division, draws, prevProgram);
  const active = activeForNextProgram(division, draws, prevProgram);

  const order = [...active].sort((a, b) => {
    const diff = (totals[b] ?? 0) - (totals[a] ?? 0);
    if (diff !== 0) return diff;
    return breakTie(a, b, division, draws, entries, prevProgram).cmp;
  });

  const decisions: TieDecision[] = [];
  for (let i = 0; i + 1 < order.length; i++) {
    const above = order[i];
    const below = order[i + 1];
    if ((totals[above] ?? 0) !== (totals[below] ?? 0)) continue;
    const { cmp, why } = breakTie(above, below, division, draws, entries, prevProgram);
    if (cmp === 0) continue; // genuinely inseparable: nothing was decided
    decisions.push({
      entryIds: [above, below],
      explanation:
        `${entries.get(above)?.callName ?? above} placed above ` +
        `${entries.get(below)?.callName ?? below} ` +
        `(${totals[above] ?? 0} pts each): ${why}.`,
    });
  }
  return { order, decisions };
}

/** Build the full draw for program 2 or 3. */
export function drawNextProgram(
  division: Division,
  draws: ProgramDraw[],
  entries: Map<string, Entry>,
  program: 2 | 3,
  rng: Rng
): ProgramDraw {
  const { order, decisions } = rotationOrder(division, draws, entries, program - 1);
  return {
    program,
    divisionId: division.id,
    races: buildRaces(division, program, order, rng),
    tieDecisions: decisions,
    locked: false,
  };
}
