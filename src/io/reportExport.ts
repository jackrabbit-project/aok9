// Builds the official "AOK9 Race Meet Report" workbook (Summary + RBR sheets)
// from the finished meet, plus an unofficial WAVE projection sheet.
//
// Layout follows the sprint / oval template AOK9 published in November 2026
// (Google Sheet 1CdKhZCDa0pOIT3pQ4QOEk3rjNYFrRBeRwAKH_-p3ymk): the Summary gains
// a BREED column (M), and the RBR tab keeps three races across per block with
// the notes key DQ, SCR, PSCR, OC, DNF. The template's Registry tab and its
// lookup formulas are left out -- the app fills every value itself.

import * as XLSX from 'xlsx';
import { computeDivisionResults } from '../domain/championship';
import { scoreRace } from '../domain/points';
import { projectWaves } from '../domain/update';
import type { ChampAward, Division, Entry, MeetState, ProgramDraw } from '../domain/types';

type Row = (string | number | null)[];

/** The template's notes key. The app's "did not run" outcome is SCR. */
const NOTE_CODE: Record<string, string> = { OC: 'OC', DNF: 'DNF', DQ: 'DQ', ABS: 'SCR', PSCR: 'PSCR' };

/** Breed as the template's lookup prints it: PROPER(), e.g. "Border Collie". */
function properCase(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/(^|[^a-z'])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

function outcomesNote(division: Division, draws: ProgramDraw[], entryId: string): string {
  const notes: string[] = [];
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
  const summary: Row[] = [
    [`CLUB NAME: ${state.info.clubName}`],
    ['MEET TYPE: SPRINT'],
    [`DATE: ${state.info.date}`],
    // Row 4 holds the template's how-to note; the meet ID goes there instead,
    // so each division block starts on row 5 as in the template.
    [`MEET ID: ${state.info.meetId}`],
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
        outcomesNote(division, state.draws, s.entryId),
        // The template's rule: a dog with pending registration MUST carry
        // its breed. Every row carries one, as the template's lookup does.
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
        header.push('Place', race ? `Program ${draw!.program}, Race ${rn}${race.isHP ? ' (HP)' : ''}` : '', 'Score');
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

  // ---------- WAVE projection (unofficial helper) ----------
  const waveRows: Row[] = [
    ['PROJECTED WAVES AFTER THIS MEET (unofficial — NRD maintains the official guide)'],
    ['REG#', 'CALL NAME', 'DIVISION', 'TYPE', 'MEET SCORE', 'COMPLETE', 'OLD WAVE', 'NEW WAVE'],
  ];
  for (const division of state.divisions) {
    for (const p of projectWaves(division, state.draws, entryMap)) {
      const e = entryMap.get(p.entryId)!;
      waveRows.push([
        e.regNo ?? 'PENDING',
        e.callName,
        division.name,
        p.kind === 'breed' ? 'BWAVE' : 'MWAVE',
        p.meetScore,
        p.complete ? 'YES' : 'NO',
        p.oldWave,
        p.newWave,
      ]);
    }
  }
  const wsWave = XLSX.utils.aoa_to_sheet(waveRows);
  wsWave['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 8 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, wsWave, 'WAVE Projection');

  return wb;
}

export function downloadReport(state: MeetState): void {
  const wb = buildReportWorkbook(state);
  const name = `AOK9 Race Meet Report - ${state.info.meetId || state.info.date}.xlsx`;
  XLSX.writeFile(wb, name);
}
