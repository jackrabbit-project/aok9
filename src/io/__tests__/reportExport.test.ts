// Verifies the NRD report workbook built from a REAL meet driven through the
// UI (fixture captured from the app after a full 9-dog, 2-division meet).

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildReportWorkbook } from '../reportExport';
import fixture from './fixture-meet.json';
import type { MeetState } from '../../domain/types';

const state = fixture as unknown as MeetState;

function sheetRows(wb: XLSX.WorkBook, name: string): (string | number | null)[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
}

describe('NRD report workbook', () => {
  const wb = buildReportWorkbook(state);

  it('has the official template sheets plus the WAVE helper', () => {
    expect(wb.SheetNames).toEqual(['Summary', 'RBR', 'WAVE Projection']);
  });

  it('Summary sheet follows the template layout with correct standings', () => {
    const rows = sheetRows(wb, 'Summary');
    expect(rows[0][0]).toBe('CLUB NAME: Phoenix All-Breed Racing Club');
    expect(rows[1][0]).toBe('MEET TYPE: SPRINT');
    expect(rows[2][0]).toBe('DATE: 2026-07-19');

    const bcHeaderIdx = rows.findIndex((r) => r[0] === 'DIVISION TYPE: BREED - BORDER COLLIE');
    expect(bcHeaderIdx).toBeGreaterThan(0);
    expect(rows[bcHeaderIdx + 1]).toEqual([
      'ARN*', 'PLACE', 'CALL NAME', 'OWNER NAME', 'SCORE',
      'BRC', 'NBRC', 'MRC', 'NMRC', 'TRC', 'NAT', 'NOTES (DQ, SCR, OC)', 'BREED',
    ]);

    // Standings: Chili & Critter 19 (dead heat), Akira 12, Creek 11, Atari 11, Ambush 9
    const bc = rows.slice(bcHeaderIdx + 2, bcHeaderIdx + 8);
    expect(bc.map((r) => [r[2], r[4]])).toEqual([
      ['Chili', 19], ['Critter', 19], ['Akira', 12], ['Creek', 11], ['Atari', 11], ['Ambush', 9],
    ]);
    // BRC split for the 19-pt tie: 1.5 each; TRC 2.0 for last-placed Ambush
    const byName = Object.fromEntries(bc.map((r) => [r[2] as string, r]));
    expect(byName['Chili'][5]).toBe(1.5);
    expect(byName['Critter'][5]).toBe(1.5);
    expect(byName['Chili'][6]).toBe(1.5); // national breed split
    expect(byName['Creek'][5]).toBeNull(); // BRC-titled: no BRC points
    expect(byName['Ambush'][9]).toBe(2); // TRC = first-place equivalent

    // Mixed division: Henry 20 MRC 1.0, Pixel 18 MRC 0.5, Bentley OC note
    const mxHeaderIdx = rows.findIndex((r) => r[0] === 'DIVISION TYPE: MIXED - MIXED');
    const mx = rows.slice(mxHeaderIdx + 2, mxHeaderIdx + 5);
    expect(mx.map((r) => [r[2], r[4], r[7]])).toEqual([
      ['Henry', 20, 1], ['Pixel', 18, 0.5], ['Bentley', 7, null],
    ]);
    expect(mx[2][11]).toContain('OC P1');
    // FTE without reg number: PENDING, with its breed in the BREED column
    expect(mx[1][0]).toBe('PENDING');
    expect(mx[1][12]).toBe('Labrador Retriever');
    expect(bc[0][12]).toBe('Border Collie');
  });

  it('RBR sheet lays out race-by-race blocks for all three programs', () => {
    const rows = sheetRows(wb, 'RBR');
    expect(rows[1][0]).toBe('RACE BY RACE RESULTS');
    // Template positions: DATE label in E1, the date beside it.
    expect(rows[0][4]).toBe('DATE');
    expect(rows[0][6]).toBe('2026-07-19');
    // Division label in column B, as in the template.
    expect(rows.some((r) => r[1] === 'DIVISION (BREED OR MIXED): BREED - BORDER COLLIE')).toBe(true);
    // The app's internal "did not run" code never reaches the report.
    expect(rows.flat().includes('ABS')).toBe(false);
    // Notes key at the foot of the sheet.
    expect(rows.some((r) => r[1] === 'PSCR - paddock scratch')).toBe(true);
    const header = rows.find((r) => typeof r[1] === 'string' && (r[1] as string).startsWith('Program 1, Race 1'));
    expect(header).toBeTruthy();
    // HP race header carries the (HP) marker
    expect(rows.some((r) => typeof r[1] === 'string' && (r[1] as string).includes('Race 2 (HP)'))).toBe(true);
  });

  it('WAVE projection recomputes per the 4.2.2 formulas', () => {
    const rows = sheetRows(wb, 'WAVE Projection');
    const chili = rows.find((r) => r[1] === 'Chili')!;
    // meet score 19, history 16, 11 (last three: [19, 16, 11] all complete)
    expect(chili[4]).toBe(19);
    expect(chili[7]).toBeCloseTo((19 + 0.7 * 16 + 0.5 * 11) / 2.2, 3);
    const pixel = rows.find((r) => r[1] === 'Pixel')!;
    expect(pixel[7]).toBe(18); // FTE first meet: WAVE = that score
  });
});
