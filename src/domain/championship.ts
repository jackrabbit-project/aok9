// Chapter V — championship points (BRC / MRC / National / TRC) and trophies.

import { computeStandings } from './scoring';
import type { ChampAward, Division, DivisionResults, Entry, ProgramDraw, Standing } from './types';

/** BRC / MRC / NRC points chart (5.2, 5.3, 5.6): [High Score, 2nd, 3rd, 4th]. */
export function chartRow(n: number): number[] {
  if (n >= 41) return [8.0, 6.0, 4.0, 2.0];
  if (n >= 31) return [7.0, 5.0, 3.0, 0];
  if (n >= 22) return [6.0, 4.0, 2.0, 0];
  if (n >= 16) return [5.0, 3.0, 1.5, 0];
  if (n >= 11) return [4.0, 2.0, 1.0, 0];
  if (n >= 8) return [3.0, 1.5, 0.5, 0];
  if (n >= 5) return [2.0, 1.0, 0, 0];
  if (n >= 2) return [1.0, 0.5, 0, 0];
  return [0, 0, 0, 0];
}

const emptyAward = (): ChampAward => ({ brc: 0, nbrc: 0, mrc: 0, nmrc: 0, trc: 0, notes: [] });

interface Row extends Standing {
  entry: Entry;
}

/** Basic Chapter V eligibility: finished every race, not last in the list, defeated somebody. */
function eligible(row: Row, isLast: boolean, breedPoints = false): { ok: boolean; why: string | null } {
  if (!row.finishedAllRaces) return { ok: false, why: 'did not finish all races' };
  if (isLast) return { ok: false, why: 'finished last in the division' };
  if (!(breedPoints ? row.defeatedBreedDog : row.defeatedSomeone)) {
    return {
      ok: false,
      why: breedPoints ? 'did not defeat a dog of the breed (the leftover does not count, 5.2)' : 'did not defeat at least one dog',
    };
  }
  return { ok: true, why: null };
}

/**
 * Eligible entry (5.2/5.3): subtract titled champions that place above the
 * first non-titled dog; the first non-titled dog and everyone below counts.
 */
export function eligibleEntry(rows: Row[], isTitled: (e: Entry) => boolean): number {
  const idx = rows.findIndex((r) => !isTitled(r.entry));
  if (idx === -1) return 0;
  return rows.length - idx;
}

/**
 * Distribute an award row down a placement list.
 *
 * Slot model: a dog that cannot take the points does not occupy a paying
 * place, so the points "drop up" to the next dog that can. That holds for
 * titled champions (5.2/5.3 eligible entry, 5.7 example #1) and for a dog
 * that did not finish all races, finished last or defeated no dog: 5.7 says
 * "Unlike regular championship points, TRC points ... do not 'drop up'",
 * which is to say regular points do.
 *
 * - `consumes`: whether a row occupies an award slot as it passes.
 * - `receives`: whether a row may actually be awarded points.
 * - Dogs tied on racing points that both receive points split the summed award
 *   equally (5.2/5.3/5.6).
 */
function distribute(
  rows: Row[],
  values: number[],
  opts: { consumes: (r: Row) => boolean; receives: (r: Row) => boolean; breedPoints?: boolean },
  label: string,
  explanations: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  const lastPlace = rows.length > 1 ? rows[rows.length - 1].place : -1;

  // Walk the standings, assigning slot indices to consuming rows.
  const slotted: { row: Row; slot: number; receives: boolean }[] = [];
  let slot = 0;
  for (const r of rows) {
    if (!opts.consumes(r)) continue;
    // Past the last award slot, keep only dogs tied on points with the last
    // slotted dog: "If there is a tie in racing points for placements which are
    // to receive ... points, the ... points are to be split equally among the
    // racers with the tied points" (5.2/5.3/5.6), so a 5th dog level with the
    // 4th shares the 4th place's points.
    if (slot >= values.length) {
      const prev = slotted[slotted.length - 1];
      if (!prev || prev.row.total !== r.total) break;
    }
    const receives = opts.receives(r);
    if (receives) {
      const el = eligible(r, r.place === lastPlace, opts.breedPoints);
      if (!el.ok) {
        // Not slotted: its place's points drop up to the next dog that can take them.
        explanations.push(`${r.entry.callName}: no ${label} points — ${el.why}; the points pass to the next dog.`);
        continue;
      }
    }
    slotted.push({ row: r, slot, receives });
    slot += 1;
  }

  // Split award values among receiving dogs tied on racing points (consecutive
  // slots with equal totals).
  let k = 0;
  while (k < slotted.length) {
    const group = [slotted[k]];
    while (
      k + group.length < slotted.length &&
      slotted[k + group.length].row.total === slotted[k].row.total
    ) {
      group.push(slotted[k + group.length]);
    }
    const receivers = group.filter((g) => g.receives);
    if (receivers.length > 0) {
      const pool = receivers.reduce((s, g) => s + (values[g.slot] ?? 0), 0);
      const share = Math.round((pool / receivers.length) * 100) / 100;
      for (const g of receivers) {
        if (share > 0) {
          out[g.row.entryId] = share;
          explanations.push(
            receivers.length > 1
              ? `${g.row.entry.callName}: ${share} ${label} points (tie on ${g.row.total} pts — split of ${pool}).`
              : `${g.row.entry.callName}: ${share} ${label} points (${ordinal(g.slot + 1)}).`
          );
        }
      }
    }
    k += group.length;
  }
  return out;
}

function ordinal(n: number): string {
  return n === 1 ? 'High Score' : n === 2 ? '2nd High Score' : n === 3 ? '3rd High Score' : `${n}th High Score`;
}

/** Full Chapter V computation for one division. */
export function computeDivisionResults(
  division: Division,
  draws: ProgramDraw[],
  entries: Map<string, Entry>
): DivisionResults {
  const standings = computeStandings(division, draws, entries);
  const rows: Row[] = standings.map((s) => ({ ...s, entry: entries.get(s.entryId)! }));
  const explanations: string[] = [];
  const awards: Record<string, ChampAward> = {};
  for (const r of rows) awards[r.entryId] = emptyAward();

  const isBreed = division.type === 'breed';
  const breedTitled = (e: Entry) => e.hasBRC || e.hasSBRC;
  const mixedTitled = (e: Entry) => e.hasMRC || e.hasSMRC;

  // ---- Breed points (BRC + National Breed) — breed divisions only ----------
  let eligibleBreed: number | null = null;
  let starters = rows.length;
  if (isBreed) {
    // Leftover dogs are excluded from the BRC distribution entirely (5.2) and
    // do not count as starters for National Breed points (5.4).
    const breedRows = rows.filter((r) => !r.isLeftover);
    eligibleBreed = eligibleEntry(breedRows, breedTitled);
    starters = breedRows.length;
    if (breedRows.length !== rows.length) {
      explanations.push(
        `Leftover dog(s) excluded from breed points: ${rows
          .filter((r) => r.isLeftover)
          .map((r) => r.entry.callName)
          .join(', ')}.`
      );
    }
    explanations.push(`Breed eligible entry: ${eligibleBreed} (of ${breedRows.length} starters).`);
    const brc = distribute(
      breedRows,
      chartRow(eligibleBreed),
      { consumes: (r) => !breedTitled(r.entry), receives: (r) => !breedTitled(r.entry), breedPoints: true },
      'BRC',
      explanations
    );
    const nat = distribute(
      breedRows,
      chartRow(starters),
      { consumes: () => true, receives: () => true, breedPoints: true },
      'National Breed',
      explanations
    );
    for (const [id, v] of Object.entries(brc)) awards[id].brc = v;
    for (const [id, v] of Object.entries(nat)) awards[id].nbrc = v;
  }

  // ---- Mixed points (MRC + National Mixed) ---------------------------------
  let eligibleMixed: number | null = null;
  if (!isBreed) {
    eligibleMixed = eligibleEntry(rows, mixedTitled);
    explanations.push(`Mixed eligible entry: ${eligibleMixed} (of ${rows.length} starters).`);
    const mrc = distribute(
      rows,
      chartRow(eligibleMixed),
      { consumes: (r) => !mixedTitled(r.entry), receives: (r) => !mixedTitled(r.entry) },
      'MRC',
      explanations
    );
    const nat = distribute(
      rows,
      chartRow(rows.length),
      { consumes: () => true, receives: () => true },
      'National Mixed',
      explanations
    );
    for (const [id, v] of Object.entries(mrc)) awards[id].mrc = v;
    for (const [id, v] of Object.entries(nat)) awards[id].nmrc = v;
  } else if (division.leftoverIds.length > 0) {
    // Leftover dogs in a breed division compete for MRC points only (4.1.7,
    // 5.3), judged against the whole field they actually raced: breed dogs
    // occupy the high-score positions above them but cannot take mixed points.
    eligibleMixed = eligibleEntry(rows, mixedTitled);
    const mrc = distribute(
      rows,
      chartRow(eligibleMixed),
      { consumes: (r) => !mixedTitled(r.entry), receives: (r) => r.isLeftover },
      'MRC (leftover)',
      explanations
    );
    for (const [id, v] of Object.entries(mrc)) awards[id].mrc = v;
  }

  // ---- Turtle Racing Championship (5.7) ------------------------------------
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const champion = last.entry.hasBRC || last.entry.hasMRC || last.entry.hasSBRC || last.entry.hasSMRC;
    if (champion) {
      explanations.push(`TRC: none — last-placed ${last.entry.callName} is a champion of record.`);
    } else if (!last.finishedAllRaces || !last.completedMeet) {
      explanations.push(`TRC: none — last-placed ${last.entry.callName} did not finish all races.`);
    } else {
      const base = isBreed && !last.isLeftover ? eligibleBreed ?? 0 : eligibleMixed ?? 0;
      const value = chartRow(base)[0];
      if (value > 0) {
        awards[last.entryId].trc = value;
        explanations.push(
          `TRC: ${last.entry.callName} (last place) earns ${value} TRC points — equal to a first-place dog in this division.`
        );
      }
    }
  }

  return {
    divisionId: division.id,
    standings,
    awards,
    eligibleEntryBreed: eligibleBreed,
    eligibleEntryMixed: eligibleMixed,
    startersForNational: starters,
    explanations,
  };
}

/** Trophy winners (5.1) computed from standings. */
export interface Trophies {
  highScore: string | null;
  highScoreOppositeSex: string | null;
  topFive: string[];
  highScoreFTE: string | null;
  highScorePerGrade: Record<string, string>;
}

export function divisionTrophies(
  standings: Standing[],
  entries: Map<string, Entry>,
  gradeOf: (e: Entry) => string
): Trophies {
  const rows = standings.map((s) => ({ s, e: entries.get(s.entryId)! }));
  const top = rows[0] ?? null;
  const opposite =
    top && top.e.sex
      ? rows.find((r) => r.e.sex && r.e.sex !== top.e.sex) ?? null
      : null;
  const perGrade: Record<string, string> = {};
  for (const r of rows) {
    const g = gradeOf(r.e);
    if (!(g in perGrade)) perGrade[g] = r.e.callName;
  }
  return {
    highScore: top?.e.callName ?? null,
    highScoreOppositeSex: opposite?.e.callName ?? null,
    topFive: rows.slice(0, 5).map((r) => r.e.callName),
    highScoreFTE: rows.find((r) => r.e.fte)?.e.callName ?? null,
    highScorePerGrade: perGrade,
  };
}
