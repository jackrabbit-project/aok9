// Builds the public snapshot of a meet from the app's state.
//
// This is the whole of what leaves the device when a meet is published, so
// it is a pure function of the state, kept small, and tested for what it
// leaves out as much as for what it puts in.

import { computeDivisionResults } from '../domain/championship';
import { scoreRace } from '../domain/points';
import { totalsThrough } from '../domain/rotation';
import { JACKET_COLORS } from '../domain/types';
import type { Division, Entry, MeetState, ProgramDraw, RaceOutcome } from '../domain/types';
import type { PublicDivision, PublicMeet, PublicProgram, PublicResult } from './types';

const ORDINAL: Record<number, PublicResult> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };

function result(oc: RaceOutcome | undefined): PublicResult | undefined {
  if (!oc) return undefined;
  if (oc.kind === 'placed') return ORDINAL[oc.place] ?? (`${oc.place}th` as PublicResult);
  return oc.kind === 'ABS' ? 'SCR' : oc.kind;
}

function programOf(draw: ProgramDraw, division: Division, entries: Map<string, Entry>): PublicProgram {
  return {
    program: draw.program,
    complete: draw.races.every((r) => r.finished),
    races: draw.races.map((race) => {
      const points = race.finished ? scoreRace(race, division.ungraded) : null;
      return {
        raceNo: race.raceNo,
        isHP: race.isHP,
        finished: race.finished,
        slots: [...race.slots]
          .sort((a, b) => (a.post ?? 9) - (b.post ?? 9))
          .map((slot) => {
            const e = entries.get(slot.entryId);
            const out = {
              post: slot.post,
              jacket: slot.post ? JACKET_COLORS[slot.post] : '',
              name: e?.callName ?? '',
              breed: e?.breed ?? '',
            } as PublicProgram['races'][number]['slots'][number];
            const r = result(race.outcomes[slot.entryId]);
            if (r) out.result = r;
            if (points && slot.entryId in points) out.points = points[slot.entryId];
            return out;
          }),
      };
    }),
  };
}

function divisionOf(division: Division, state: MeetState, entries: Map<string, Entry>): PublicDivision {
  const draws = state.draws
    .filter((d) => d.divisionId === division.id && d.locked)
    .sort((a, b) => a.program - b.program);
  const programs = draws.map((d) => programOf(d, division, entries));

  // Running totals stand after the latest program that is fully scored.
  const lastComplete = [...programs].reverse().find((p) => p.complete);
  const totals = lastComplete
    ? Object.entries(totalsThrough(division, state.draws, lastComplete.program))
        .filter(([id]) => entries.has(id))
        .sort((a, b) => b[1] - a[1])
        .map(([id, total]) => ({ name: entries.get(id)!.callName, total }))
    : [];

  // Final standings and championship points once program 3 is scored, with
  // the secretary's overrides applied -- the same numbers as the NRD report.
  let standings: PublicDivision['standings'] = null;
  if (lastComplete?.program === 3) {
    const res = computeDivisionResults(division, state.draws, entries);
    standings = res.standings.map((s) => {
      const e = entries.get(s.entryId)!;
      const a = { ...res.awards[s.entryId], ...state.overrides[s.entryId] };
      return {
        place: s.place,
        name: e.callName,
        breed: e.breed,
        total: s.total,
        brc: a.brc,
        nbrc: a.nbrc,
        mrc: a.mrc,
        nmrc: a.nmrc,
        trc: a.trc,
        leftover: s.isLeftover,
        incomplete: !s.completedMeet || !s.finishedAllRaces,
      };
    });
  }

  return {
    name: division.name,
    type: division.type,
    ungraded: division.ungraded,
    dogs: division.entryIds
      .map((id) => entries.get(id))
      .filter((e): e is Entry => Boolean(e) && !e!.preScratched)
      .map((e) => ({
        name: e.callName,
        breed: e.breed,
        leftover: division.leftoverIds.includes(e.id),
        fte: e.fte,
      })),
    programs,
    totals,
    standings,
  };
}

/** One line for the top of the page. */
export function meetStatus(divisions: PublicDivision[]): string {
  const latest = Math.max(0, ...divisions.flatMap((d) => d.programs.map((p) => p.program)));
  if (latest === 0) return divisions.length ? 'Divisions set — racing has not started' : 'Meet set up';
  const allComplete = divisions.every((d) => {
    const p = d.programs.find((x) => x.program === latest);
    return !p || p.complete;
  });
  if (!allComplete) return `Program ${latest} in progress`;
  return latest === 3 ? 'Final results' : `Program ${latest} results`;
}

export function buildSnapshot(state: MeetState, now: Date, appVersion: string): PublicMeet {
  const entries = new Map(state.entries.map((e) => [e.id, e]));
  const divisions = state.divisions.map((d) => divisionOf(d, state, entries));
  return {
    v: 1,
    updatedAt: now.toISOString(),
    app: appVersion,
    info: { clubName: state.info.clubName, meetId: state.info.meetId, date: state.info.date },
    status: meetStatus(divisions),
    divisions,
  };
}

/** The part of a snapshot that decides whether it is worth sending again. */
export function snapshotKey(s: PublicMeet): string {
  const { updatedAt: _, ...rest } = s;
  return JSON.stringify(rest);
}
