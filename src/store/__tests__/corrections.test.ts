// Correcting a meet after the draw: a program can be unlocked or discarded
// only while nothing in it is scored, removing a dog never leaves a race
// pointing at it, and a file that already does is healed on the way in.

import { describe, expect, it } from 'vitest';
import { blankFteEntry, emptyMeet, normalizeMeet, programCanBeReopened, reducer } from '../meetStore';
import type { Division, MeetState, ProgramDraw, Race } from '../../domain/types';

function dog(id: string): ReturnType<typeof blankFteEntry> {
  return { ...blankFteEntry(), id, callName: id.toUpperCase() };
}

function race(ids: string[], finished = false): Race {
  return {
    id: `r-${ids.join('-')}`,
    divisionId: 'd1',
    program: 1,
    raceNo: 1,
    isHP: true,
    slots: ids.map((entryId, i) => ({ entryId, post: i + 1 })),
    outcomes: finished ? Object.fromEntries(ids.map((id, i) => [id, { kind: 'placed', place: i + 1 }])) : {},
    finished,
    rerun: false,
    splitAllPoints: false,
    note: '',
  } as Race;
}

function meet(finished = false): MeetState {
  const division = { id: 'd1', name: 'WHIPPET', type: 'breed', entryIds: ['a', 'b', 'c'], leftoverIds: [], ungraded: false } as unknown as Division;
  const draw: ProgramDraw = { program: 1, divisionId: 'd1', races: [race(['a', 'b', 'c'], finished)], tieDecisions: [], locked: true };
  return { ...emptyMeet(), entries: [dog('a'), dog('b'), dog('c')], divisions: [division], draws: [draw] };
}

describe('programCanBeReopened', () => {
  it('is true for a drawn program with nothing scored, false otherwise', () => {
    expect(programCanBeReopened(meet(), 1)).toBe(true);
    expect(programCanBeReopened(meet(true), 1)).toBe(false);
    expect(programCanBeReopened(emptyMeet(), 1)).toBe(false);
  });
});

describe('unlockProgram', () => {
  it('reopens the draw while nothing is scored', () => {
    const s = reducer(meet(), { type: 'unlockProgram', program: 1 });
    expect(s.draws[0].locked).toBe(false);
  });
  it('refuses once a race has a result', () => {
    const before = meet(true);
    expect(reducer(before, { type: 'unlockProgram', program: 1 })).toBe(before);
  });
});

describe('discardProgram', () => {
  it('removes the draw while nothing is scored, so divisions open again', () => {
    const s = reducer(meet(), { type: 'discardProgram', program: 1 });
    expect(s.draws).toEqual([]);
    expect(s.divisions[0].entryIds).toEqual(['a', 'b', 'c']);
  });
  it('refuses once a race has a result', () => {
    const before = meet(true);
    expect(reducer(before, { type: 'discardProgram', program: 1 })).toBe(before);
  });
});

describe('removeEntry', () => {
  it('takes the dog out of its race and division as well as the list', () => {
    const s = reducer(meet(true), { type: 'removeEntry', id: 'b' });
    expect(s.entries.map((e) => e.id)).toEqual(['a', 'c']);
    expect(s.divisions[0].entryIds).toEqual(['a', 'c']);
    expect(s.draws[0].races[0].slots.map((x) => x.entryId)).toEqual(['a', 'c']);
    expect(Object.keys(s.draws[0].races[0].outcomes)).toEqual(['a', 'c']);
  });
});

describe('normalizeMeet', () => {
  it('heals a file whose draw names a dog that is no longer entered', () => {
    const broken = meet();
    broken.entries = broken.entries.filter((e) => e.id !== 'b');
    const s = normalizeMeet(broken);
    expect(s.draws[0].races[0].slots.map((x) => x.entryId)).toEqual(['a', 'c']);
    expect(s.divisions[0].entryIds).toEqual(['a', 'c']);
  });
  it('drops a race left with nobody in it', () => {
    const broken = meet();
    broken.entries = [];
    expect(normalizeMeet(broken).draws[0].races).toEqual([]);
  });
});
