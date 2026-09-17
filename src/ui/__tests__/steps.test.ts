import { describe, expect, it } from 'vitest';
import { emptyMeet } from '../../store/meetStore';
import meet2 from '../../data/sample-meet-2.json';
import { STEPS, stepStatus } from '../steps';
import type { MeetState } from '../../domain/types';

const finished = meet2 as unknown as MeetState;

describe('stepStatus', () => {
  it('lists the eight steps in meet order', () => {
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(STEPS.map((s) => s.phase)).toEqual([
      'setup', 'entries', 'divisions', 'program1', 'program2', 'program3', 'results', 'export',
    ]);
  });

  it('starts with nothing done', () => {
    const s = stepStatus(emptyMeet());
    for (const { phase } of STEPS) expect(s[phase]).toBe('todo');
  });

  it('marks the open screen current, even one that is already done', () => {
    expect(stepStatus({ ...finished, phase: 'entries' }).entries).toBe('current');
    expect(stepStatus({ ...finished, phase: 'export' }).export).toBe('current');
  });

  it('reads a finished meet as done through results, with export still ahead', () => {
    const s = stepStatus(finished); // phase is 'home', so nothing is current
    for (const phase of ['setup', 'entries', 'divisions', 'program1', 'program2', 'program3', 'results'] as const) {
      expect(s[phase]).toBe('done');
    }
    expect(s.export).toBe('todo');
  });

  it('applies the same readiness rules as the screens', () => {
    // Setup needs all three fields.
    const noDate: MeetState = { ...emptyMeet(), info: { ...emptyMeet().info, clubName: 'C', meetId: 'M', date: '' } };
    expect(stepStatus(noDate).setup).toBe('todo');
    // Entries: a pre-scratched dog does not count.
    const scratchedOnly: MeetState = {
      ...finished,
      entries: finished.entries.map((e) => ({ ...e, preScratched: true })),
    };
    expect(stepStatus(scratchedOnly).entries).toBe('todo');
    // Divisions: every active dog assigned.
    const oneUnassigned: MeetState = {
      ...finished,
      divisions: finished.divisions.map((d, i) => (i === 0 ? { ...d, entryIds: d.entryIds.slice(1) } : d)),
    };
    expect(stepStatus(oneUnassigned).divisions).toBe('todo');
    // A program with an unscored race is not done, and neither is results.
    const unscored: MeetState = {
      ...finished,
      draws: finished.draws.map((d) =>
        d.program === 3 ? { ...d, races: d.races.map((r, i) => (i === 0 ? { ...r, finished: false } : r)) } : d
      ),
    };
    expect(stepStatus(unscored).program3).toBe('todo');
    expect(stepStatus(unscored).results).toBe('todo');
    expect(stepStatus(unscored).program2).toBe('done');
  });
});
