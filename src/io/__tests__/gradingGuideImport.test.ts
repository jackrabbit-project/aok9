// The guide is read purely by column position, so the header check is the only
// thing standing between an upstream column insert and a meet scored on WAVEs
// belonging to the wrong field.

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseGradingGuide } from '../gradingGuideImport';

/** The real heading rows of the official guide, rows 1-5 (row 5 is blank). */
const ROW_3 = [
  null, 'CALL', null, null, null, null, 'DQ', null, null, null, null, null, null,
  'Recent B', null, null, 'Middle B', null, null, 'Oldest B', null, null,
  'Recent M', null, null, 'Middle M', null, null, 'Oldest M', null, null,
];
const ROW_4 = [
  'REG#', 'NAME', 'BWAVE', 'MWAVE', 'REGISTERED NAME', 'OWNER', 'Career',
  'BRC', 'NBRC', 'MRC', 'NMRC', 'TRC', 'YTD',
  'Meet', null, 'Score', 'Meet', null, 'Score', 'Meet', null, 'Score',
  'Meet', null, 'Score', 'Meet', null, 'Score', 'Meet', null, 'Score',
];

/** One breed section header followed by one dog, in the real layout. */
const BREED_ROW = ['WHIPPET'];
const DOG_ROW = [
  'WH-999', 'Tester', 12.5, 14, 'Test Registered Name', 'A Handler', 0,
  6, 2, 1, 0, 0, 0,
  '2026-S55', '2026-07-04', 16, null, null, null, null, null, null,
  '2026-S40', '2026-05-02', 18, null, null, null, null, null, null,
];

function workbook(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'gradingguide.xls');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const sheet = (header = ROW_4) =>
  workbook([['/'], ['Hard copies'], ['Send checks'], ROW_3, header, [], BREED_ROW, DOG_ROW]);

describe('parseGradingGuide', () => {
  it('reads a dog out of the official layout', () => {
    const dogs = parseGradingGuide(sheet());
    expect(dogs).toHaveLength(1);
    expect(dogs[0]).toMatchObject({
      regNo: 'WH-999',
      callName: 'Tester',
      breed: 'WHIPPET',
      bwave: 12.5,
      mwave: 14,
      owner: 'A Handler',
      brc: 6,
      nbrc: 2,
      mrc: 1,
    });
    // Meet id and score are three columns apart, with the date skipped between.
    expect(dogs[0].breedMeets).toEqual([{ meet: '2026-S55', score: 16 }]);
    expect(dogs[0].mixedMeets).toEqual([{ meet: '2026-S40', score: 18 }]);
  });

  it('refuses a sheet with a column inserted rather than misreading it', () => {
    // Someone adds a column before BWAVE: every later field shifts one right.
    const shifted = [...ROW_4];
    shifted.splice(2, 0, 'NEW COLUMN');
    expect(() => parseGradingGuide(sheet(shifted))).toThrow(/column C should be "BWAVE"/);
  });

  it('names the column that moved, including in the meet triplets', () => {
    const renamed = [...ROW_4];
    renamed[15] = 'Points';
    expect(() => parseGradingGuide(sheet(renamed))).toThrow(/column P should be "SCORE"/);
  });

  it('rejects a workbook that is not a grading guide at all', () => {
    expect(() => parseGradingGuide(workbook([['hello'], ['world']]))).toThrow(
      /does not look like a Grading Guide/
    );
  });
});
