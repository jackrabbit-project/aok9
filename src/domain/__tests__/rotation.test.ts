import { describe, expect, it } from 'vitest';
import { drawFirstProgram } from '../draw';
import { drawNextProgram, rotationOrder, totalsThrough } from '../rotation';
import { entryMap, finishRace, mkDivision, mkEntry, raceWith, seededRng } from './helpers';
import type { ProgramDraw, Race } from '../types';

/** 10-dog graded division, deterministic WAVEs 20..11. */
function setup10() {
  const entries = Array.from({ length: 10 }, (_, i) =>
    mkEntry({ id: `d${i}`, callName: `Dog${i}`, bwave: 20 - i })
  );
  const division = mkDivision(entries.map((e) => e.id));
  const map = entryMap(entries);
  const rng = seededRng(99);
  const p1 = drawFirstProgram(division, map, rng);
  return { entries, division, map, rng, p1 };
}

/** A finished race with every dog placed, built by hand so a specific set of
 *  point values can be arranged across programs. */
function mkRace(program: 1 | 2 | 3, raceNo: number, isHP: boolean, places: Record<string, number>): Race {
  return {
    id: `r${program}-${raceNo}`,
    divisionId: 'div1',
    program,
    raceNo,
    isHP,
    slots: Object.keys(places).map((entryId, i) => ({ entryId, post: i + 1 })),
    outcomes: Object.fromEntries(
      Object.entries(places).map(([id, place]) => [id, { kind: 'placed' as const, place }])
    ),
    finished: true,
    rerun: false,
    splitAllPoints: false,
    note: '',
  };
}

const mkDraw = (program: 1 | 2 | 3, races: Race[]): ProgramDraw => ({
  program,
  divisionId: 'div1',
  races,
  tieDecisions: [],
  locked: true,
});

describe('point totals (4.3.5)', () => {
  it('two dogs tied on 11 2/3 read as tied even though the shares land in different programs', () => {
    // 'a' takes a 3-way dead heat for 2nd in program 1 -- (3+2+0)/3 = 1.666...,
    // which has no exact binary form -- then 6 and 4. 'b' takes the same three
    // values in the reverse order. They are mathematically level on 11 2/3, but
    // the raw sums differ by ~2e-15, and that epsilon decides whether they split
    // an award value (5.2) and share a rotation group (4.3.4.1).
    const division = mkDivision(['a', 'b', 'f1', 'f2', 'f3', 'g1', 'g2', 'g3']);
    const draws = [
      mkDraw(1, [
        mkRace(1, 1, false, { f1: 1, a: 2, f2: 2, f3: 2 }), // a: (3+2+0)/3
        mkRace(1, 2, true, { g1: 1, b: 2, g2: 3, g3: 4 }), // b: 6
      ]),
      mkDraw(2, [mkRace(2, 1, true, { a: 1, b: 2, g1: 3, g2: 4 })]), // a: 6, b: 4
      mkDraw(3, [
        mkRace(3, 1, true, { g1: 1, g2: 2, a: 3, g3: 4 }), // a: 4
        mkRace(3, 2, false, { f1: 1, b: 2, f2: 2, f3: 2 }), // b: (3+2+0)/3
      ]),
    ];

    const totals = totalsThrough(division, draws, 3);
    expect(totals.a).toBe(totals.b);
    expect(totals.a).toBe(11.667);
  });
});

describe('rotation by points (4.3.4)', () => {
  it('regroups purely by points, ignoring grades', () => {
    const { division, map, rng, p1 } = setup10();
    // Races: r1 (d7,d8,d9), r2 (d4,d5,d6), r3 HP (d0..d3)
    // Upset: in the HP race the lowest-WAVE dog wins.
    finishRace(raceWith(p1, 'd7'), ['d9', 'd8', 'd7']); // r1: 5,3,2
    finishRace(raceWith(p1, 'd4'), ['d6', 'd5', 'd4']); // r2: 5,3,2
    finishRace(raceWith(p1, 'd0'), ['d3', 'd2', 'd1', 'd0']); // HP: 8,6,4,3

    const totals = totalsThrough(division, [p1], 1);
    expect(totals.d3).toBe(8);
    expect(totals.d9).toBe(5);
    expect(totals.d0).toBe(3);

    const { order } = rotationOrder(division, [p1], map, 1);
    // Points: d3=8, d2=6, {d6,d9}=5, d1=4, {d0,d5,d8}=3, {d4,d7}=2
    expect(order[0]).toBe('d3');
    expect(order[1]).toBe('d2');
    expect(order.slice(2, 4)).toEqual(['d6', 'd9']); // d6 won the higher race
    expect(order[4]).toBe('d1');
  });

  it('breaks point ties by higher race, then placement, then WAVE (4.3.4.1)', () => {
    const { division, map, p1 } = setup10();
    finishRace(raceWith(p1, 'd7'), ['d7', 'd8', 'd9']); // r1 (lowest): d7 wins 5
    finishRace(raceWith(p1, 'd4'), ['d4', 'd5', 'd6']); // r2: d4 wins 5
    finishRace(raceWith(p1, 'd0'), ['d0', 'd1', 'd2', 'd3']); // HP: 8,6,4,3

    const { order, decisions } = rotationOrder(division, [p1], map, 1);
    // Points: d0=8, d1=6, d4=5, d7=5, d2=4, d3=3, d5=3, d8=3, d6=2, d9=2
    expect(order[0]).toBe('d0');
    expect(order[1]).toBe('d1');
    // d4 (won race 2) ranks above d7 (won race 1) — higher race wins the tie
    expect(order.indexOf('d4')).toBeLessThan(order.indexOf('d7'));
    // d3 (4th in HP race 3) above d5 (2nd in race 2): higher race
    expect(order.indexOf('d3')).toBeLessThan(order.indexOf('d5'));
    // d5 (2nd race 2) above d8 (2nd race 1)
    expect(order.indexOf('d5')).toBeLessThan(order.indexOf('d8'));
    // d6 (3rd race 2) above d9 (3rd race 1)
    expect(order.indexOf('d6')).toBeLessThan(order.indexOf('d9'));
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('same race ties: higher placement wins; pre-P2 fallback is WAVE', () => {
    const entries = [
      mkEntry({ id: 'a', callName: 'A', bwave: 12 }),
      mkEntry({ id: 'b', callName: 'B', bwave: 11 }),
      mkEntry({ id: 'c', callName: 'C', bwave: 10 }),
      mkEntry({ id: 'd', callName: 'D', bwave: 9 }),
    ];
    const division = mkDivision(['a', 'b', 'c', 'd']);
    const map = entryMap(entries);
    const p1 = drawFirstProgram(division, map, seededRng(5));
    // Single HP race of 4. Tie both OC: 0 pts each -> WAVE decides.
    finishRace(p1.races[0], ['c', 'd'], { a: 'OC', b: 'OC' });
    const { order, decisions } = rotationOrder(division, [p1], map, 1);
    expect(order).toEqual(['c', 'd', 'a', 'b']); // a over b on WAVE (12 vs 11)
    expect(decisions.some((d) => d.explanation.includes('WAVE'))).toBe(true);
  });

  it('DQ and no-show dogs are dropped from subsequent programs', () => {
    const { division, map, rng, p1 } = setup10();
    finishRace(raceWith(p1, 'd7'), ['d8', 'd9'], { d7: 'ABS' });
    finishRace(raceWith(p1, 'd4'), ['d5', 'd6'], { d4: 'DQ' });
    finishRace(raceWith(p1, 'd0'), ['d0', 'd1', 'd2', 'd3']);

    const p2 = drawNextProgram(division, [p1], map, 2, rng);
    const ids = p2.races.flatMap((r) => r.slots.map((s) => s.entryId));
    expect(ids).toHaveLength(8); // 10 - DQ - no-show
    expect(ids).not.toContain('d4');
    expect(ids).not.toContain('d7');
    // 8 dogs -> two 4-dog races (Figure 8.1)
    expect(p2.races.map((r) => r.slots.length)).toEqual([4, 4]);
    expect(p2.races[1].isHP).toBe(true);
  });

  it('logs one tie decision per adjacent pair, never a duplicate or a stranger', () => {
    const { division, map, p1 } = setup10();
    finishRace(raceWith(p1, 'd7'), ['d7', 'd8', 'd9']);
    finishRace(raceWith(p1, 'd4'), ['d4', 'd5', 'd6']);
    finishRace(raceWith(p1, 'd0'), ['d0', 'd1', 'd2', 'd3']);

    const totals = totalsThrough(division, [p1], 1);
    const { order, decisions } = rotationOrder(division, [p1], map, 1);

    // This list is the protest trail, so every line has to be about two dogs
    // the secretary can see next to each other, tied, in the finished order.
    for (const d of decisions) {
      const [above, below] = d.entryIds;
      expect(order.indexOf(below)).toBe(order.indexOf(above) + 1);
      expect(totals[above]).toBe(totals[below]);
    }
    // Each pair once, and never more lines than there are gaps in the order.
    const pairs = decisions.map((d) => d.entryIds.join('>'));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(decisions.length).toBeLessThanOrEqual(order.length - 1);
    // The real ties here: d4/d7 on 5, d3/d5 and d5/d8 on 3, d6/d9 on 2.
    expect(decisions).toHaveLength(4);
  });

  it('fills races from the High Score race down per Figure 8.1', () => {
    const { division, map, rng, p1 } = setup10();
    finishRace(raceWith(p1, 'd7'), ['d7', 'd8', 'd9']);
    finishRace(raceWith(p1, 'd4'), ['d4', 'd5', 'd6']);
    finishRace(raceWith(p1, 'd0'), ['d0', 'd1', 'd2', 'd3']);
    const p2 = drawNextProgram(division, [p1], map, 2, rng);
    // 10 dogs again: 4/3/3. HP race = top 4 by points+ties: d0(8), d1(6), d4(5), d7(5)
    const hp = p2.races.find((r) => r.isHP)!;
    expect(hp.slots.map((s) => s.entryId).sort()).toEqual(['d0', 'd1', 'd4', 'd7']);
  });
});
