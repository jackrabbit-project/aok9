// Builds the official "AOK9 Race Meet Report" workbook (Summary + RBR sheets)
// from the finished meet. Nothing else: neither AOK9 template has a third
// sheet, and projected WAVEs stay on the Results screen.
//
// Layout follows the sprint / oval template AOK9 published in November 2026
// (Google Sheet 1CdKhZCDa0pOIT3pQ4QOEk3rjNYFrRBeRwAKH_-p3ymk): the Summary gains
// a BREED column (M), and the RBR tab keeps three races across per block with
// the notes key DQ, SCR, PSCR, OC, DNF. The template's Registry tab and its
// lookup formulas are left out -- the app fills every value itself.

import * as XLSX from 'xlsx';
import { computeDivisionResults } from '../domain/championship';
import { scoreRace } from '../domain/points';
import type { ChampAward, Division, Entry, MeetState, ProgramDraw } from '../domain/types';

type Row = (string | number | null)[];

/** The template's notes key. The app's "did not run" outcome is SCR. */
const NOTE_CODE: Record<string, string> = { OC: 'OC', DNF: 'DNF', DQ: 'DQ', ABS: 'SCR', PSCR: 'PSCR' };

/** Breed as the template's lookup prints it: PROPER(), e.g. "Border Collie". */
function properCase(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

function outcomesNote(division: Division, draws: ProgramDraw[], entryId: string, entry?: Entry): string {
  const notes: string[] = [];
  if (entry?.withdrawnBefore) notes.push(`SCR P${entry.withdrawnBefore}`);
  for (const draw of draws.filter((d) => d.divisionId === division.id)) {
    for (const race of draw.races) {
      const oc = race.outcomes[entryId];
      if (!oc) continue;
      const code = NOTE_CODE[oc.kind];
      if (code) notes.push(`${code} P${draw.program}`);
    }
  }
  return notes.join(', ');
}

export function mergedAwards(state: MeetState, divisionId: string): Record<string, ChampAward> {
  const division = state.divisions.find((d) => d.id === divisionId)!;
  const entryMap = new Map(state.entries.map((e) => [e.id, e]));
  const res = computeDivisionResults(division, state.draws, entryMap);
  const awards: Record<string, ChampAward> = {};
  for (const [id, a] of Object.entries(res.awards)) {
    awards[id] = { ...a, ...state.overrides[id] };
  }
  return awards;
}

export function buildReportWorkbook(state: MeetState): XLSX.WorkBook {
  const entryMap = new Map(state.entries.map((e) => [e.id, e]));
  const wb = XLSX.utils.book_new();

  // ---------- Summary sheet ----------
  // 4.1.3: a meet is official only when every planned program is complete.
  // A report downloaded before that says so in its first line.
  const unfinished =
    state.divisions.length === 0 ||
    state.divisions.some((d) => {
      const p3 = state.draws.filter((x) => x.divisionId === d.id && x.program === 3);
      return p3.length === 0 || p3.some((x) => x.races.some((r) => !r.finished));
    });
  const summary: Row[] = [

    [`CLUB NAME: ${state.info.clubName}`],
    ['MEET TYPE: SPRINT'],
    [`DATE: ${state.info.date}`],
    // Row 4 holds the template's how-to note; the meet ID goes there instead,
    // so each division block starts on row 5 as in the template.
    [`MEET ID: ${state.info.meetId}${unfinished ? ' — PROVISIONAL: the meet is not finished; programs remain to be run (4.1.3)' : ''}`],
  ];
  for (const division of state.divisions) {
    const res = computeDivisionResults(division, state.draws, entryMap);
    const awards = mergedAwards(state, division.id);
    const label =
      division.type === 'breed' ? `BREED - ${division.name}` : `MIXED - ${division.name}`;
    summary.push([`DIVISION TYPE: ${label}${division.ungraded ? ' (UNGRADED)' : ''}`]);
    summary.push([
      'ARN*',
      'PLACE',
      'CALL NAME',
      'OWNER NAME',
      'SCORE',
      'BRC',
      'NBRC',
      'MRC',
      'NMRC',
      'TRC',
      'NAT',
      'NOTES (DQ, SCR, OC)',
      'BREED',
    ]);
    for (const s of res.standings) {
      const e = entryMap.get(s.entryId)!;
      const a = awards[s.entryId];
      const leftover = division.leftoverIds.includes(s.entryId) ? ' (LEFTOVER)' : '';
      summary.push([
        e.regNo ?? 'PENDING',
        s.place,
        e.callName + leftover,
        e.owner ?? '',
        s.total,
        a.brc || null,
        a.nbrc || null,
        a.mrc || null,
        a.nmrc || null,
        a.trc || null,
        (a.nbrc || 0) + (a.nmrc || 0) || null,
        // 2.2.1(4): first time entered dogs are listed as such.
        [e.fte ? 'FTE' : '', outcomesNote(division, state.draws, s.entryId, e)].filter(Boolean).join(', '),
        // The template's rule: a dog with pending registration MUST carry
        // its breed. Every row carries one, as the template's lookup does.
        properCase(e.breed),
      ]);
    }
    // Every entered dog is listed. A dog that never started -- scratched
    // before racing, or in its program 1 race -- has no placing or score
    // (2.2.1(3): placings are for starters) but is reported with its scratch.
    const placed = new Set(res.standings.map((s) => s.entryId));
    for (const id of division.entryIds) {
      if (placed.has(id)) continue;
      const e = entryMap.get(id);
      if (!e) continue;
      const leftover = division.leftoverIds.includes(id) ? ' (LEFTOVER)' : '';
      const note = e.preScratched ? 'SCR before racing' : 'SCR P1';
      summary.push([
        e.regNo ?? 'PENDING',
        null,
        e.callName + leftover,
        e.owner ?? '',
        null, null, null, null, null, null, null,
        [e.fte ? 'FTE' : '', note].filter(Boolean).join(', '),
        properCase(e.breed),
      ]);
    }
    summary.push(['*Any dogs with pending registration MUST have breed indicated']);
    summary.push([]);
  }
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [
    { wch: 18 }, { wch: 7 }, { wch: 22 }, { wch: 22 }, { wch: 7 },
    { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 24 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ---------- RBR (race-by-race) sheet ----------
  // Row 1: the template's DATE label sits in E1:F1, the date beside it.
  const rbr: Row[] = [[null, null, null, null, 'DATE', null, state.info.date], ['RACE BY RACE RESULTS'], []];
  const rbrMerges: XLSX.Range[] = [
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];
  for (const division of state.divisions) {
    const label =
      division.type === 'breed' ? `BREED - ${division.name}` : `MIXED - ${division.name}`;
    rbrMerges.push({ s: { r: rbr.length, c: 1 }, e: { r: rbr.length, c: 8 } });
    rbr.push([null, `DIVISION (BREED OR MIXED): ${label}${division.ungraded ? ' (UNGRADED)' : ''}`]);
    const draws = ([1, 2, 3] as const).map((p) =>
      state.draws.find((d) => d.divisionId === division.id && d.program === p)
    );
    const maxRaces = Math.max(...draws.map((d) => d?.races.length ?? 0));
    for (let rn = 1; rn <= maxRaces; rn++) {
      const header: Row = [];
      const rows: Row[] = [[], [], [], []];
      for (const draw of draws) {
        const race = draw?.races.find((r) => r.raceNo === rn);
        // 2.2.1(5) and 6.5: the results indicate which races were rerun, and a
        // race whose points were split under 6.5.1(b).
        const flags = race ? [race.isHP && 'HP', race.rerun && 'RERUN', race.splitAllPoints && 'POINTS SPLIT'].filter(Boolean) : [];
        header.push('Place', race ? `Program ${draw!.program}, Race ${rn}${flags.length ? ` (${flags.join(', ')})` : ''}` : '', 'Score');
        const pts = race && race.finished && draw ? scoreRace(race, division.ungraded) : {};
        const ordered = race
          ? [...race.slots].sort((a, b) => {
              const oa = race.outcomes[a.entryId];
              const ob = race.outcomes[b.entryId];
              const pa = oa?.kind === 'placed' ? oa.place : 99;
              const pb = ob?.kind === 'placed' ? ob.place : 99;
              return pa - pb;
            })
          : [];
        for (let i = 0; i < 4; i++) {
          const slot = ordered[i];
          if (!slot) {
            rows[i].push(null, null, null);
            continue;
          }
          const oc = race!.outcomes[slot.entryId];
          const name = entryMap.get(slot.entryId)?.callName ?? '';
          const placeLabel =
            oc?.kind === 'placed' ? oc.place : oc ? NOTE_CODE[oc.kind] ?? oc.kind : '-';
          rows[i].push(placeLabel as string | number, name, pts[slot.entryId] ?? null);
        }
      }
      rbr.push(header, ...rows, []);
    }
    rbr.push([]);
  }
  // The template's key to the codes in the Place columns.
  rbr.push(
    [null, 'DQ - disqualified'],
    [null, 'OC - Off Course'],
    [null, 'SCR - scratch'],
    [null, 'PSCR - paddock scratch'],
    [null, 'DNF - did not finish']
  );
  const wsRbr = XLSX.utils.aoa_to_sheet(rbr);
  wsRbr['!merges'] = rbrMerges;
  wsRbr['!cols'] = Array.from({ length: 9 }, (_, i) => (i % 3 === 1 ? { wch: 26 } : { wch: 8 }));
  XLSX.utils.book_append_sheet(wb, wsRbr, 'RBR');


  return wb;
}

export function downloadReport(state: MeetState): void {
  const wb = buildReportWorkbook(state);
  const name = `AOK9 Race Meet Report - ${state.info.meetId || state.info.date}.xlsx`;
  XLSX.writeFile(wb, name);
}
