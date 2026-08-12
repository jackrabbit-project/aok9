// Converts the official AOK9 Sprint Grading Guide xlsx into src/data/grading-guide.json.
// Usage: node scripts/convert-grading-guide.mjs [path-to-xlsx]
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// No default path. This used to fall back to a hardcoded filename, so running
// the script bare after a new guide was published regenerated the OLD one and
// reported success -- the exact mistake this script exists to avoid.
const src = process.argv[2];
if (!src) {
  console.error('Usage: npm run convert-guide -- "<path to AOK9 Sprint Grading Guide .xlsx>"');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(src), { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// Mirrors assertGuideLayout in src/io/gradingGuideImport.ts, which is the
// source of truth. This script already duplicates the whole parser (it runs on
// plain node and cannot import the TS module); keep the two in step by hand.
const EXPECTED_HEADINGS = [
  [0, 'REG#'], [1, 'NAME'], [2, 'BWAVE'], [3, 'MWAVE'], [4, 'REGISTERED NAME'], [5, 'OWNER'],
  [7, 'BRC'], [8, 'NBRC'], [9, 'MRC'], [10, 'NMRC'], [11, 'TRC'],
  [13, 'MEET'], [15, 'SCORE'], [16, 'MEET'], [18, 'SCORE'], [19, 'MEET'], [21, 'SCORE'],
  [22, 'MEET'], [24, 'SCORE'], [25, 'MEET'], [27, 'SCORE'], [28, 'MEET'], [30, 'SCORE'],
];
const columnLetter = (i) => {
  const last = String.fromCharCode(65 + (i % 26));
  return i < 26 ? last : String.fromCharCode(64 + Math.floor(i / 26)) + last;
};
const headerRow = rows[4];
if (!headerRow) {
  console.error(`No column headings found on row 5 of ${src} -- is this a Grading Guide?`);
  process.exit(1);
}
for (const [i, expected] of EXPECTED_HEADINGS) {
  const found = String(headerRow[i] ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (found !== expected) {
    console.error(
      `Layout changed: column ${columnLetter(i)} should be "${expected}" but reads ` +
        `"${found || '(blank)'}". Refusing to convert -- the columns are read by position, ` +
        `so this would silently misread every dog's WAVE.`
    );
    process.exit(1);
  }
}

// Layout (0-indexed columns), header rows 0-5, data starts ~row 5:
// 0 REG#, 1 CALL NAME, 2 BWAVE, 3 MWAVE, 4 REGISTERED NAME, 5 OWNER,
// 6 DQ Career, 7 BRC, 8 NBRC, 9 MRC, 10 NMRC, 11 TRC, 12 DQ YTD,
// 13-15 Recent B (meet,date,score), 16-18 Middle B, 19-21 Oldest B,
// 22-24 Recent M, 25-27 Middle M, 28-30 Oldest M
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v) => (v === null || v === undefined ? null : String(v).trim() || null);
const meet = (r, i) => {
  const id = str(r[i]);
  const score = num(r[i + 2]);
  if (id === null && score === null) return null;
  return { meet: id, score };
};

const dogs = [];
let breed = null;
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
    breedMeets: [meet(r, 13), meet(r, 16), meet(r, 19)].filter(Boolean),
    mixedMeets: [meet(r, 22), meet(r, 25), meet(r, 28)].filter(Boolean),
  });
}

const out = {
  source: src.split('\\').pop(),
  convertedAt: new Date().toISOString(),
  dogs,
};
mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'grading-guide.json'), JSON.stringify(out));
console.log(`Wrote ${dogs.length} dogs from ${new Set(dogs.map((d) => d.breed)).size} breeds.`);
