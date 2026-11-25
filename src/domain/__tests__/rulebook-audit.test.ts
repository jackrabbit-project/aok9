// Cases found when the app was checked against the Sprint Rule Book v3.0,
// section by section. Each test names the rule it holds the app to.

import { describe, expect, it } from 'vitest';
import { computeDivisionResults } from '../championship';
import { computeStandings } from '../scoring';
import { entryMap, mkDivision, mkEntry } from './helpers';
import type { ProgramDraw, Race, RaceOutcome } from '../types';

/** A race with explicit outcomes; `order` lists placed dogs 1st first, and a
    nested array is a dead heat for that place. */
function mkRace(
  divisionId: string,
  program: 1 | 2 | 3,
  raceNo: number,
  isHP: boolean,
  order: (string | string[])[],
  other: Record<string, RaceOutcome> = {}
): Race {
  const outcomes: Record<string, RaceOutcome> = { ...other };
  let place = 1;
  for (const o of order) {
    const ids = Array.isArray(o) ? o : [o];
    for (const id of ids) outcomes[id] = { kind: 'placed', place };
    place += ids.length;
  }
  const ids = Object.keys(outcomes);
  return {
    id: `p${program}r${raceNo}`,
    divisionId,
    program,
    raceNo,
    isHP,
    slots: ids.map((entryId, i) => ({ entryId, post: i + 1 })),
    outcomes,
    finished: true,
    rerun: false,
    splitAllPoints: false,
    note: '',
  };
}

const draw = (divisionId: string, program: 1 | 2 | 3, races: Race[]): ProgramDraw => ({
  program,
  divisionId,
  races,
  tieDecisions: [],
  locked: true,
});

describe('5.2/5.6: a tie for the last paying place is split among every tied dog', () => {
  // 8 dogs, graded. Totals: a 22, b 15, c/e/f 12 each, d 8, g 6, h 0.
  // The chart for 8 is 3 / 1.5 / 0.5 / 0, so c, e and f tie for the 3rd and
  // 4th places and the 5th place beyond them: 0.5 + 0 shared three ways.
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const entries = ids.map((id, i) => mkEntry({ id, callName: id.toUpperCase(), bwave: 20 - i }));
  const division = mkDivision(ids);
  const draws = [
    draw('div1', 1, [mkRace('div1', 1, 1, false, ['e', 'f', 'g', 'h']), mkRace('div1', 1, 2, true, ['a', 'b', 'c', 'd'])]),
    draw('div1', 2, [mkRace('div1', 2, 1, false, ['f', 'e', 'g', 'h']), mkRace('div1', 2, 2, true, ['a', 'c', 'b', 'd'])]),
    draw('div1', 3, [mkRace('div1', 3, 1, false, [['e', 'f'], 'g', 'h']), mkRace('div1', 3, 2, true, ['a', 'b', 'c', 'd'])]),
  ];

  it('gives each of the three tied dogs a third of the 3rd place points', () => {
    const res = computeDivisionResults(division, draws, entryMap(entries));
    const totals = Object.fromEntries(res.standings.map((s) => [s.entryId, s.total]));
    expect([totals.c, totals.e, totals.f]).toEqual([12, 12, 12]);
    for (const id of ['c', 'e', 'f']) {
      expect(res.awards[id].brc).toBe(0.17);
      expect(res.awards[id].nbrc).toBe(0.17);
    }
    expect(res.awards.a.brc).toBe(3);
    expect(res.awards.b.brc).toBe(1.5);
    expect(res.awards.d.brc).toBe(0);
  });
});

describe('6.1.3 / 4.3.5: a dog disqualified in the last program did not complete the meet', () => {
  it('is not counted complete, and drops below a dog level on points', () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => mkEntry({ id, callName: id.toUpperCase(), bwave: 15 }));
    const division = mkDivision(['a', 'b', 'c', 'd']);
    const draws = [
      draw('div1', 1, [mkRace('div1', 1, 1, true, ['a', 'b', 'c', 'd'])]),
      draw('div1', 2, [mkRace('div1', 2, 1, true, ['b', 'a', 'c', 'd'])]),
      // a is disqualified in program 3; the others are placed 1..3 without it.
      draw('div1', 3, [mkRace('div1', 3, 1, true, ['c', 'b', 'd'], { a: { kind: 'DQ' } })]),
    ];
    const standings = computeStandings(division, draws, entryMap(entries));
    const a = standings.find((s) => s.entryId === 'a')!;
    expect(a.completedMeet).toBe(false);
    expect(a.finishedAllRaces).toBe(false);
  });
});

describe('5.2: breed points are distributed as if the leftover dog had not run', () => {
  // Breed dogs a, x, b, c, d and leftover L. In every program x finishes 2nd in
  // the high point race behind a and ahead of L only.
  const entries = [
    ...['a', 'x', 'b', 'c', 'd'].map((id) => mkEntry({ id, callName: id.toUpperCase(), bwave: 15 })),
    mkEntry({ id: 'L', callName: 'Leftover', breed: 'PATTERDALE TERRIER', mwave: 10 }),
  ];
  const division = mkDivision(['a', 'x', 'L', 'b', 'c', 'd'], { leftoverIds: ['L'] });
  const draws = ([1, 2, 3] as const).map((p) =>
    draw('div1', p, [mkRace('div1', p, 1, false, ['b', 'c', 'd']), mkRace('div1', p, 2, true, ['a', 'x', 'L'])])
  );

  it('gives no breed points to a dog that beat only the leftover', () => {
    const res = computeDivisionResults(division, draws, entryMap(entries));
    expect(res.standings.find((s) => s.entryId === 'x')!.defeatedBreedDog).toBe(false);
    expect(res.awards.x.brc).toBe(0);
    expect(res.awards.x.nbrc).toBe(0);
    expect(res.awards.a.brc).toBe(2);
  });
});

describe('4.4: the 2/3 ungraded option includes a division that is exactly 2/3 FTE', () => {
  it('suggests ungraded for 2 FTE dogs out of 3', async () => {
    const { ungradedSuggested, fteFraction } = await import('../divisions');
    const entries = [
      mkEntry({ id: 'f1', callName: 'F1', fte: true }),
      mkEntry({ id: 'f2', callName: 'F2', fte: true }),
      mkEntry({ id: 'g', callName: 'G', bwave: 12 }),
      mkEntry({ id: 's', callName: 'Scratched', fte: true, preScratched: true }),
    ];
    const division = mkDivision(['f1', 'f2', 'g', 's']);
    // The scratched dog is not drawn, so it does not count either way.
    expect(fteFraction(division, entryMap(entries))).toBeCloseTo(2 / 3, 6);
    expect(ungradedSuggested(division, entryMap(entries), 0.6667)).toBe(true);
    expect(ungradedSuggested(division, entryMap(entries), 0.75)).toBe(false);
  });
});

describe('4.2.1 / 4.2.2.4: a guide dog with no AOK9 record enters as first-time entered', () => {
  it('marks a dog with no WAVE and no meets FTE, and a dog with a record not', async () => {
    const { entryFromGuide } = await import('../../store/meetStore');
    const base = { regNo: 'X-1', callName: 'New', breed: 'WHIPPET', registeredName: null, owner: null,
      brc: 0, nbrc: 0, mrc: 0, nmrc: 0, trc: 0 };
    const fresh = entryFromGuide({ ...base, bwave: null, mwave: null, breedMeets: [], mixedMeets: [] });
    expect(fresh.fte).toBe(true);
    expect(fresh.fteGrade).toBe('D');
    const known = entryFromGuide({ ...base, bwave: 9, mwave: null, breedMeets: [{ meet: '2026-S1', score: 9 }], mixedMeets: [] } as never);
    expect(known.fte).toBe(false);
  });
});

describe('2.2.1 / 6.5: the meet report and results page show FTEs, reruns and an unfinished meet', () => {
  it('notes FTE, marks a rerun race, and heads an unfinished meet PROVISIONAL', async () => {
    const XLSX = await import('xlsx');
    const { buildReportWorkbook } = await import('../../io/reportExport');
    const { buildSnapshot } = await import('../../publish/snapshot');
    const { validateSnapshot } = await import('../../../functions/lib/validate');
    const { renderMeet } = await import('../../../functions/lib/render');
    const { normalizeMeet } = await import('../../store/meetStore');
    const fixture = (await import('../../io/__tests__/fixture-meet.json')).default;
    const state = normalizeMeet(JSON.parse(JSON.stringify(fixture)));
    state.draws[0].races[0].rerun = true;

    const wb = buildReportWorkbook(state);
    const summary = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets.Summary, { header: 1, defval: null });
    expect(summary[0][0]).toBe(`CLUB NAME: ${state.info.clubName}`); // finished meet: no PROVISIONAL line
    const fteRow = summary.find((r) => r[0] === 'PENDING')!;
    expect(String(fteRow[11])).toContain('FTE');
    const rbr = XLSX.utils.sheet_to_json<(string | number | null)[]>(wb.Sheets.RBR, { header: 1, defval: null });
    expect(rbr.flat().some((c) => typeof c === 'string' && c.includes('RERUN'))).toBe(true);

    const snap = buildSnapshot(state, new Date('2026-11-25T12:00:00Z'), 'test');
    const checked = validateSnapshot(snap)!;
    expect(checked).not.toBeNull();
    expect(renderMeet(checked)).toContain('>rerun<');

    // Take program 3 away: the report says the meet is not finished.
    const partial = { ...state, draws: state.draws.filter((d) => d.program !== 3) };
    const p = XLSX.utils.sheet_to_json<(string | number | null)[]>(buildReportWorkbook(partial).Sheets.Summary, { header: 1, defval: null });
    expect(String(p[3][0])).toMatch(/PROVISIONAL/);
    expect(String(p[4][0])).toMatch(/^DIVISION TYPE/); // divisions still start on row 5
  });
});

describe('a division with every dog scratched or disqualified', () => {
  it('sits the next program out instead of stopping the draw', async () => {
    const { drawNextProgram } = await import('../rotation');
    const { seededRng } = await import('./helpers');
    const entries = ['a', 'b'].map((id) => mkEntry({ id, callName: id.toUpperCase(), bwave: 12 }));
    const division = mkDivision(['a', 'b']);
    const p1 = draw('div1', 1, [mkRace('div1', 1, 1, true, [], { a: { kind: 'DQ' }, b: { kind: 'PSCR' } })]);
    const p2 = drawNextProgram(division, [p1], entryMap(entries), 2, seededRng(3));
    expect(p2.races).toEqual([]);
  });
});

describe('6.4: an owner scratch between programs', () => {
  it('leaves the dog out of the regrouping and reports it SCR for that program', async () => {
    const { rotationOrder } = await import('../rotation');
    const XLSX = await import('xlsx');
    const { buildReportWorkbook } = await import('../../io/reportExport');
    const { emptyMeet } = await import('../../store/meetStore');
    const entries = ['a', 'b', 'c', 'd'].map((id) => mkEntry({ id, callName: id.toUpperCase(), bwave: 15 }));
    entries[1].withdrawnBefore = 2;
    const division = mkDivision(['a', 'b', 'c', 'd']);
    const p1 = draw('div1', 1, [mkRace('div1', 1, 1, true, ['a', 'b', 'c', 'd'])]);
    const { order } = rotationOrder(division, [p1], entryMap(entries), 1);
    expect(order).toEqual(['a', 'c', 'd']);

    const state = { ...emptyMeet(), info: { clubName: 'C', meetId: 'M', date: '2026-11-25', fteThreshold: 0.75 }, entries, divisions: [division], draws: [p1] };
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(buildReportWorkbook(state).Sheets.Summary, { header: 1, defval: null });
    expect(String(rows.find((r) => r[2] === 'B')![11])).toContain('SCR P2');
  });
});

describe('2.2.1: the Summary lists every entered dog', () => {
  it('includes a dog scratched in program 1 and one scratched before racing, unplaced', async () => {
    const XLSX = await import('xlsx');
    const { buildReportWorkbook } = await import('../../io/reportExport');
    const { emptyMeet } = await import('../../store/meetStore');
    const entries = [
      ...['a', 'b', 'c'].map((id) => mkEntry({ id, callName: id.toUpperCase(), bwave: 15 })),
      mkEntry({ id: 'p', callName: 'Pre', bwave: 10, preScratched: true }),
    ];
    const division = mkDivision(['a', 'b', 'c', 'p']);
    const draws = ([1, 2, 3] as const).map((p) =>
      draw('div1', p, [mkRace('div1', p, 1, true, ['a', 'b'], p === 1 ? { c: { kind: 'ABS' } } : {})])
    );
    const state = { ...emptyMeet(), info: { clubName: 'C', meetId: 'M', date: '2026-11-25', fteThreshold: 0.75 }, entries, divisions: [division], draws };
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(buildReportWorkbook(state).Sheets.Summary, { header: 1, defval: null });
    const c = rows.find((r) => r[2] === 'C')!;
    const p = rows.find((r) => r[2] === 'Pre')!;
    expect(c[1]).toBeNull();
    expect(c[11]).toBe('SCR P1');
    expect(p[11]).toBe('SCR before racing');
    expect(rows.find((r) => r[2] === 'A')![1]).toBe(1);
  });
});

describe('4.2.2: a dog is graded on its record of the other kind when it has none of this kind', () => {
  it('seeds a breed-WAVE dog in a mixed division by that WAVE, not as grade D', async () => {
    const { entryGrade, gradedSortKey } = await import('../draw');
    const afghan = mkEntry({ id: 'af', callName: 'Afghan', breed: 'AFGHAN HOUND', bwave: 12, mwave: null });
    const mixed = mkDivision(['af'], { type: 'mixed', name: 'MIXED' });
    expect(entryGrade(afghan, mixed)).toBe('A');
    expect(gradedSortKey(afghan, mixed)).toBe(12);
    const own = mkEntry({ id: 'm', callName: 'M', bwave: 12, mwave: 7 });
    expect(entryGrade(own, mixed)).toBe('C'); // its own mixed WAVE still governs
  });
});
