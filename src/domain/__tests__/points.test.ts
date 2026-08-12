import { describe, expect, it } from 'vitest';
import { pointsForPlace, roundPoints, scoreRace } from '../points';
import type { Race } from '../types';

const mkRace = (over: Partial<Race>): Race => ({
  id: 'r1',
  divisionId: 'd1',
  program: 1,
  raceNo: 1,
  isHP: false,
  slots: [],
  outcomes: {},
  finished: true,
  rerun: false,
  splitAllPoints: false,
  note: '',
  ...over,
});

describe('roundPoints', () => {
  it('makes mathematically equal totals compare equal despite float error', () => {
    const share = (3 + 2 + 0) / 3; // 3-way dead heat for 2nd, non-HP: 1.666...
    // Same three values, different programs -> different addition order. Float
    // addition is not associative, so the raw sums are not equal.
    expect((share + 6) + 4).not.toBe((6 + 4) + share);
    expect(roundPoints((share + 6) + 4)).toBe(roundPoints((6 + 4) + share));
  });

  it('leaves ordinary totals untouched and keeps real gaps apart', () => {
    expect(roundPoints(11)).toBe(11);
    expect(roundPoints(2.25)).toBe(2.25);
    expect(roundPoints((5 + 3 + 2) / 3)).toBe(3.333);
    // The smallest gap real point values can produce is 1/6 -- far above 0.001.
    expect(roundPoints(3.333)).not.toBe(roundPoints(3.5));
  });
});

describe('validatePlaces / splitAllPoints', () => {
  it('accepts consecutive and dead-heat sequences, rejects gaps', async () => {
    const { validatePlaces } = await import('../points');
    expect(validatePlaces([1, 2, 3, 4])).toBeNull();
    expect(validatePlaces([1, 1, 3])).toBeNull();
    expect(validatePlaces([1, 1, 2])).toContain('expected');
    expect(validatePlaces([2, 3])).toContain('expected');
  });

  it('6.5.1(b) split shares all points equally among participants', () => {
    const race = mkRace({
      isHP: true,
      program: 1,
      splitAllPoints: true,
      slots: ['a', 'b', 'c', 'd'].map((entryId) => ({ entryId, post: 1 })),
      outcomes: {
        a: { kind: 'placed', place: 1 },
        b: { kind: 'placed', place: 2 },
        c: { kind: 'OC' },
        d: { kind: 'ABS' },
      },
    });
    // participants a, b, c share (8+6+4)/3 = 6 each; ABS dog gets 0
    expect(scoreRace(race, false)).toEqual({ a: 6, b: 6, c: 6, d: 0 });
  });
});

describe('Figure 8.2A graded points', () => {
  it('program 1 & 3 HP races award 8/6/4/3', () => {
    for (const p of [1, 3] as const) {
      expect([1, 2, 3, 4].map((pl) => pointsForPlace(false, p, true, pl))).toEqual([8, 6, 4, 3]);
    }
  });
  it('program 2 HP race awards 6/4/3/2', () => {
    expect([1, 2, 3, 4].map((pl) => pointsForPlace(false, 2, true, pl))).toEqual([6, 4, 3, 2]);
  });
  it('all other graded races award 5/3/2/0', () => {
    for (const p of [1, 2, 3] as const) {
      expect([1, 2, 3, 4].map((pl) => pointsForPlace(false, p, false, pl))).toEqual([5, 3, 2, 0]);
    }
  });
});

describe('Figure 8.2B ungraded points', () => {
  it('program 1: all races 5/3/2/0 (no HP)', () => {
    expect([1, 2, 3, 4].map((pl) => pointsForPlace(true, 1, true, pl))).toEqual([5, 3, 2, 0]);
    expect([1, 2, 3, 4].map((pl) => pointsForPlace(true, 1, false, pl))).toEqual([5, 3, 2, 0]);
  });
  it('programs 2-3: HP 8/5/3/0, others 5/3/2/0', () => {
    for (const p of [2, 3] as const) {
      expect([1, 2, 3, 4].map((pl) => pointsForPlace(true, p, true, pl))).toEqual([8, 5, 3, 0]);
      expect([1, 2, 3, 4].map((pl) => pointsForPlace(true, p, false, pl))).toEqual([5, 3, 2, 0]);
    }
  });
});

describe('scoreRace', () => {
  it('scores a normal HP race', () => {
    const race = mkRace({
      isHP: true,
      program: 1,
      slots: ['a', 'b', 'c', 'd'].map((entryId) => ({ entryId, post: 1 })),
      outcomes: {
        a: { kind: 'placed', place: 2 },
        b: { kind: 'placed', place: 1 },
        c: { kind: 'placed', place: 3 },
        d: { kind: 'placed', place: 4 },
      },
    });
    expect(scoreRace(race, false)).toEqual({ a: 6, b: 8, c: 4, d: 3 });
  });

  it('OC and DNF score zero (4.3.5)', () => {
    const race = mkRace({
      slots: ['a', 'b', 'c', 'd'].map((entryId) => ({ entryId, post: 1 })),
      outcomes: {
        a: { kind: 'placed', place: 1 },
        b: { kind: 'OC' },
        c: { kind: 'DNF' },
        d: { kind: 'placed', place: 2 },
      },
    });
    expect(scoreRace(race, false)).toEqual({ a: 5, b: 0, c: 0, d: 3 });
  });

  it('DQ dog scores zero and others are placed as if it had not run (6.1.3)', () => {
    // DQ'd dog excluded from placements: remaining dogs entered as 1..3.
    const race = mkRace({
      isHP: true,
      program: 3,
      slots: ['a', 'b', 'c', 'd'].map((entryId) => ({ entryId, post: 1 })),
      outcomes: {
        a: { kind: 'DQ' },
        b: { kind: 'placed', place: 1 },
        c: { kind: 'placed', place: 2 },
        d: { kind: 'placed', place: 3 },
      },
    });
    expect(scoreRace(race, false)).toEqual({ a: 0, b: 8, c: 6, d: 4 });
  });

  it('dead-heat tie splits the summed points equally (4.3.4.1)', () => {
    // Two dogs tied for 1st in a P1 HP race: (8+6)/2 = 7 each; next dog is 3rd.
    const race = mkRace({
      isHP: true,
      program: 1,
      slots: ['a', 'b', 'c', 'd'].map((entryId) => ({ entryId, post: 1 })),
      outcomes: {
        a: { kind: 'placed', place: 1 },
        b: { kind: 'placed', place: 1 },
        c: { kind: 'placed', place: 3 },
        d: { kind: 'placed', place: 4 },
      },
    });
    expect(scoreRace(race, false)).toEqual({ a: 7, b: 7, c: 4, d: 3 });
  });
});
