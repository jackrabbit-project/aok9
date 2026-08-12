// Runtime import of an official Grading Guide xlsx (same layout as bundled).

import * as XLSX from 'xlsx';
import type { GuideDog, GuideMeet } from '../domain/types';

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v).trim() || null;

/** Row (0-indexed) carrying the column headings in the official guide. */
const HEADER_ROW = 4;

/**
 * The columns this parser reads, and the heading that must sit above each one.
 *
 * Nothing in the file keys a value to its meaning -- every field is found by
 * position. A column inserted upstream would therefore not fail; it would
 * quietly shift WAVEs and championship points one place, and the meet would be
 * scored on the wrong numbers with nothing to show for it. Checking the
 * headings turns a silent misread into a message the secretary can act on.
 */
const EXPECTED_HEADINGS: ReadonlyArray<readonly [number, string]> = [
  [0, 'REG#'],
  [1, 'NAME'],
  [2, 'BWAVE'],
  [3, 'MWAVE'],
  [4, 'REGISTERED NAME'],
  [5, 'OWNER'],
  [7, 'BRC'],
  [8, 'NBRC'],
  [9, 'MRC'],
  [10, 'NMRC'],
  [11, 'TRC'],
  // Six Meet/Score triplets: Recent, Middle and Oldest, breed then mixed. The
  // date sits between them and is not read, hence the gaps.
  [13, 'MEET'], [15, 'SCORE'],
  [16, 'MEET'], [18, 'SCORE'],
  [19, 'MEET'], [21, 'SCORE'],
  [22, 'MEET'], [24, 'SCORE'],
  [25, 'MEET'], [27, 'SCORE'],
  [28, 'MEET'], [30, 'SCORE'],
];

/** Spreadsheet column letter for a 0-indexed position: 0 -> A, 30 -> AE. */
function columnLetter(index: number): string {
  const last = String.fromCharCode(65 + (index % 26));
  return index < 26 ? last : String.fromCharCode(64 + Math.floor(index / 26)) + last;
}

const heading = (v: unknown): string =>
  String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Throw unless the sheet still has the layout the offsets above assume. */
export function assertGuideLayout(rows: unknown[][]): void {
  const header = rows[HEADER_ROW];
  if (!header) {
    throw new Error(
      `This does not look like a Grading Guide — no column headings found on row ${HEADER_ROW + 1}.`
    );
  }
  for (const [index, expected] of EXPECTED_HEADINGS) {
    const found = heading(header[index]);
    if (found !== expected) {
      throw new Error(
        `The Grading Guide layout has changed: column ${columnLetter(index)} should be ` +
          `"${expected}" but reads "${found || '(blank)'}". This file cannot be read safely — ` +
          `its columns are matched by position, so a moved column would silently misread ` +
          `every dog's WAVE. Please report this.`
      );
    }
  }
}

function meetAt(row: unknown[], i: number): GuideMeet | null {
  const id = str(row[i]);
  const score = num(row[i + 2]);
  if (id === null && score === null) return null;
  return { meet: id, score };
}

/** Parse a Grading Guide workbook (ArrayBuffer of the xlsx file). */
export function parseGradingGuide(buf: ArrayBuffer): GuideDog[] {
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  assertGuideLayout(rows);
  const dogs: GuideDog[] = [];
  let breed: string | null = null;
  for (let i = 5; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === null)) continue;
    const a = str(r[0]);
    const callName = str(r[1]);
    if (a && !callName && !num(r[2]) && !str(r[4])) {
      breed = a.replace(/\s+/g, ' ').trim();
      continue;
    }
    if (!a || !callName) continue;
    dogs.push({
      regNo: a,
      callName,
      breed,
      bwave: num(r[2]),
      mwave: num(r[3]),
      registeredName: str(r[4]),
      owner: str(r[5]),
      brc: num(r[7]) ?? 0,
      nbrc: num(r[8]) ?? 0,
      mrc: num(r[9]) ?? 0,
      nmrc: num(r[10]) ?? 0,
      trc: num(r[11]) ?? 0,
      breedMeets: [meetAt(r, 13), meetAt(r, 16), meetAt(r, 19)].filter(Boolean) as GuideMeet[],
      mixedMeets: [meetAt(r, 22), meetAt(r, 25), meetAt(r, 28)].filter(Boolean) as GuideMeet[],
    });
  }
  return dogs;
}
