import { describe, expect, it } from 'vitest';
import { drawFirstProgram, firstProgramOrder } from '../draw';
import { entryMap, mkDivision, mkEntry, seededRng } from './helpers';

describe('first program draw (4.3.3)', () => {
  it('groups by WAVE: top 4 in the HP race, races numbered low-to-high', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      mkEntry({ id: `d${i}`, callName: `Dog${i}`, bwave: 20 - i })
    );
    const division = mkDivision(entries.map((e) => e.id));
    const draw = drawFirstProgram(division, entryMap(entries), seededRng(42));

    // 10 dogs -> 4/3/3 (HP first per Figure 8.1); run order: race1=3, race2=3, race3=4(HP)
    expect(draw.races.map((r) => r.slots.length)).toEqual([3, 3, 4]);
    expect(draw.races[2].isHP).toBe(true);
    expect(draw.races[0].isHP).toBe(false);

    // Top 4 WAVEs are in the HP race (raceNo 3)
    const hpIds = draw.races[2].slots.map((s) => s.entryId).sort();
    expect(hpIds).toEqual(['d0', 'd1', 'd2', 'd3']);
    // Lowest 3 WAVEs in race 1
    const lowIds = draw.races[0].slots.map((s) => s.entryId).sort();
    expect(lowIds).toEqual(['d7', 'd8', 'd9']);
  });

  it('slots FTE dogs by their assigned grade nominal WAVE', () => {
    const a = mkEntry({ id: 'a', callName: 'A', bwave: 12 });
    const b = mkEntry({ id: 'b', callName: 'B', bwave: 9 });
    const fteC = mkEntry({ id: 'c', callName: 'C-FTE', fte: true, fteGrade: 'C' });
    const d = mkEntry({ id: 'd', callName: 'D', bwave: 4 });
    const division = mkDivision(['a', 'b', 'c', 'd']);
    const order = firstProgramOrder(division, entryMap([a, b, fteC, d]), seededRng(1));
    expect(order).toEqual(['a', 'b', 'c', 'd']); // C-grade FTE (5.5) above the 4-WAVE dog
  });

  it('every race gets distinct post positions 1..size', () => {
    const entries = Array.from({ length: 9 }, (_, i) =>
      mkEntry({ id: `d${i}`, callName: `Dog${i}`, bwave: 15 - i })
    );
    const division = mkDivision(entries.map((e) => e.id));
    const draw = drawFirstProgram(division, entryMap(entries), seededRng(7));
    expect(draw.races.map((r) => r.slots.length)).toEqual([3, 2, 4]); // 9 dogs: HP 4, mid 2, low 3
    for (const race of draw.races) {
      const posts = race.slots.map((s) => s.post).sort();
      expect(posts).toEqual(Array.from({ length: race.slots.length }, (_, i) => i + 1));
    }
  });

  it('a dog with no one to run against gets a single non-HP race (4.2.2.4)', () => {
    // One dog is outside Figure 8.1 entirely. It still needs a race so the meet
    // can be completed, but it cannot be a High Point race -- nobody was beaten.
    const solo = mkEntry({ id: 'solo', callName: 'Solo', bwave: 10 });
    const division = mkDivision(['solo']);
    const draw = drawFirstProgram(division, entryMap([solo]), seededRng(4));
    expect(draw.races).toHaveLength(1);
    expect(draw.races[0].slots.map((s) => s.entryId)).toEqual(['solo']);
    expect(draw.races[0].isHP).toBe(false);
    expect(draw.races[0].slots[0].post).toBe(1);
  });

  it('ungraded division uses random order but the same chart split', () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      mkEntry({ id: `d${i}`, callName: `Dog${i}`, fte: true })
    );
    const division = mkDivision(entries.map((e) => e.id), { ungraded: true });
    const draw = drawFirstProgram(division, entryMap(entries), seededRng(3));
    expect(draw.races.map((r) => r.slots.length)).toEqual([3, 4]);
    // ungraded program 1 has no HP race (4.3.5 / 8.2B)
    expect(draw.races.every((r) => !r.isHP)).toBe(true);
  });
});
