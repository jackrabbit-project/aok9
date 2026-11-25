// A paddock scratch is scored exactly as a scratch, and recorded as PSCR
// wherever the meet report or the results page names the outcome.

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { scoreRace } from '../points';
import { activeForNextProgram } from '../rotation';
import { buildReportWorkbook } from '../../io/reportExport';
import { buildSnapshot } from '../../publish/snapshot';
import { validateSnapshot } from '../../../functions/lib/validate';
import { normalizeMeet } from '../../store/meetStore';
import fixture from '../../io/__tests__/fixture-meet.json';
import type { Division, MeetState, ProgramDraw, Race, RaceOutcome } from '../types';

function race(outcomes: Record<string, RaceOutcome>, program: 1 | 2 | 3 = 1): Race {
  return {
    id: 'r1',
    divisionId: 'd1',
    program,
    raceNo: 1,
    isHP: true,
    slots: Object.keys(outcomes).map((entryId, i) => ({ entryId, post: i + 1 })),
    outcomes,
    finished: true,
    rerun: false,
    splitAllPoints: false,
    note: '',
  } as Race;
}

describe('PSCR scoring', () => {
  it('scores like SCR: nothing for the dog, the others placed as they finished', () => {
    const scr = scoreRace(race({ a: { kind: 'placed', place: 1 }, b: { kind: 'placed', place: 2 }, c: { kind: 'ABS' } }), false);
    const pscr = scoreRace(race({ a: { kind: 'placed', place: 1 }, b: { kind: 'placed', place: 2 }, c: { kind: 'PSCR' } }), false);
    expect(pscr).toEqual(scr);
    expect(pscr.c).toBe(0);
  });

  it('leaves the dog out of the next program, as SCR does', () => {
    const division = { id: 'd1', entryIds: ['a', 'b', 'c'], leftoverIds: [] } as unknown as Division;
    const draws: ProgramDraw[] = [
      { program: 1, divisionId: 'd1', locked: true, tieDecisions: [],
        races: [race({ a: { kind: 'placed', place: 1 }, b: { kind: 'placed', place: 2 }, c: { kind: 'PSCR' } })] },
    ];
    expect(activeForNextProgram(division, draws, 1)).toEqual(['a', 'b']);
  });
});

describe('PSCR in what the app writes out', () => {
  // A dog placed in program 2 becomes a paddock scratch there instead. (A dog
  // scratched in program 1 never started, so it has no place on the Summary at
  // all, SCR or PSCR alike; the standings list program 1 starters only.)
  const state = JSON.parse(JSON.stringify(fixture)) as MeetState;
  const p2 = state.draws.find((d) => d.program === 2)!.races[0];
  const dogId = p2.slots[0].entryId;
  const dogName = state.entries.find((e) => e.id === dogId)!.callName;
  p2.outcomes[dogId] = { kind: 'PSCR' };

  it('names it PSCR on the Summary notes and the RBR sheet', () => {
    const wb = buildReportWorkbook(state);
    const summary = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets.Summary, { header: 1, defval: null });
    const row = summary.find((r) => r[2] === dogName)!;
    expect(row[11]).toContain('PSCR P2');
    const rbr = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets.RBR, { header: 1, defval: null });
    expect(rbr.flat()).toContain('PSCR');
  });

  it('shows PSCR on the results page, and the server accepts it', () => {
    const snap = buildSnapshot(normalizeMeet(state), new Date('2026-11-25T12:00:00Z'), 'test');
    expect(JSON.stringify(snap)).toContain('"result":"PSCR"');
    expect(validateSnapshot(snap)).not.toBeNull();
  });
});
