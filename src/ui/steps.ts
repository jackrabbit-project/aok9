// The eight steps of a meet and how far each has got, for the header.
//
// The tabs used to show only where you were. A meet has a shape -- setup,
// entries, divisions, three programs, results, export -- and the person
// running it wants to see at a glance what is finished and what is next, not
// just which screen is open. The readiness rules here are the same ones the
// screens already apply before letting you continue; this puts them in the
// chrome rather than making you go and look.

import type { MeetState, Phase } from '../domain/types';

export type StepPhase = Exclude<Phase, 'home'>;
export type StepState = 'done' | 'current' | 'todo';

export const STEPS: { phase: StepPhase; n: number; name: string }[] = [
  { phase: 'setup', n: 1, name: 'Meet setup' },
  { phase: 'entries', n: 2, name: 'Entries' },
  { phase: 'divisions', n: 3, name: 'Divisions' },
  { phase: 'program1', n: 4, name: 'Program 1' },
  { phase: 'program2', n: 5, name: 'Program 2' },
  { phase: 'program3', n: 6, name: 'Program 3' },
  { phase: 'results', n: 7, name: 'Results' },
  { phase: 'export', n: 8, name: 'Export' },
];

function programDone(state: MeetState, program: 1 | 2 | 3): boolean {
  const draws = state.draws.filter((d) => d.program === program);
  // Every division drawn, locked, and every race scored -- ProgramScreen's
  // own "all finished" condition, with the lock added so a drawn-but-still-
  // adjustable program does not read as finished.
  return (
    draws.length > 0 &&
    draws.length === state.divisions.length &&
    draws.every((d) => d.locked && d.races.every((r) => r.finished))
  );
}

/** What each step has reached. The open screen is always 'current'. */
export function stepStatus(state: MeetState): Record<StepPhase, StepState> {
  const active = state.entries.filter((e) => !e.preScratched);
  const assigned = new Set(state.divisions.flatMap((d) => d.entryIds));

  const done: Record<StepPhase, boolean> = {
    setup: Boolean(state.info.clubName.trim() && state.info.meetId.trim() && state.info.date),
    entries: active.length > 0,
    divisions: state.divisions.length > 0 && active.every((e) => assigned.has(e.id)),
    program1: programDone(state, 1),
    program2: programDone(state, 2),
    program3: programDone(state, 3),
    results: programDone(state, 3),
    // Nothing marks an export as complete; the report can be sent any number
    // of times. It is current or it is ahead.
    export: false,
  };

  const out = {} as Record<StepPhase, StepState>;
  for (const { phase } of STEPS) {
    out[phase] = state.phase === phase ? 'current' : done[phase] ? 'done' : 'todo';
  }
  return out;
}
