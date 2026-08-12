// Fetches the currently published AOK9 Sprint Grading Guide and converts it
// into src/data/grading-guide.json.
//
// Usage: npm run refresh-guide

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The Grading Guide is a Google Sheet the NRD revises in place, linked from the
 * AOK9 documents page. The document id is therefore stable across editions and
 * is pinned here.
 *
 * The failure this guards against: if they ever publish a *new* sheet rather
 * than editing this one, the id below would keep resolving, every refresh would
 * report success, and the app would quietly freeze on an edition nobody is
 * using. So the documents page is checked for this id before the download is
 * trusted — see assertStillPublished.
 */
const SHEET_ID = '1fsoX7xh3Inj9Bgsvzs6GGQp36KSHp7Wwfp_hsBBj7sQ';
const DOCUMENTS_PAGE = 'https://www.aok9racing.com/documents--forms.html';
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The published filename, e.g. "AOK9 Sprint Grading Guide - updated 8_4_26.xlsx".
 *
 * Google sends it twice: `filename=` with the punctuation stripped out, and
 * `filename*=` RFC 5987-encoded with it intact. The encoded one is the useful
 * one, but it decodes to a date containing slashes ("8/4/26") which cannot be a
 * filename — so slashes become underscores, which is how these files get named
 * by hand anyway, and keeps `source` reading the same as a manual conversion.
 */
function publishedName(disposition = '') {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    return decodeURIComponent(encoded[1]).replace(/[/\\]/g, '_').trim();
  }
  const plain = /filename="([^"]+)"/i.exec(disposition);
  return plain ? plain[1] : 'AOK9 Sprint Grading Guide.xlsx';
}

/** Refuse to refresh from a sheet the documents page no longer points at. */
async function assertStillPublished() {
  let page;
  try {
    const res = await fetch(DOCUMENTS_PAGE, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    page = await res.text();
  } catch (err) {
    // Not being able to read the page is not itself a reason to reject the
    // guide — the page is a courtesy check, the export endpoint is the source.
    console.warn(`! Could not check the documents page (${err.message}). Continuing.`);
    return;
  }
  if (!page.includes(SHEET_ID)) {
    throw new Error(
      `The AOK9 documents page no longer links sheet ${SHEET_ID}.\n` +
        `The published guide has moved to a different sheet. Update SHEET_ID in ` +
        `scripts/refresh-grading-guide.mjs rather than refreshing from a guide ` +
        `that is no longer the published one.`
    );
  }
}

async function download() {
  const res = await fetch(EXPORT_URL, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Download failed: HTTP ${res.status} ${res.statusText}. ` +
        `A 401 or 403 means the sheet is no longer shared publicly.`
    );
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith(XLSX_TYPE)) {
    // Google answers 200 with an HTML sign-in page when a sheet stops being
    // world-readable, so status alone does not prove we got a spreadsheet.
    throw new Error(`Expected a spreadsheet but the server sent "${type}".`);
  }
  const name = publishedName(res.headers.get('content-disposition') ?? '');
  const dir = join(root, '.guide-cache');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return { path, name };
}

await assertStillPublished();
const { path, name } = await download();
console.log(`Downloaded ${name}`);

// The converter owns the layout check and the parse; this script only decides
// which file it runs on.
const convert = spawnSync(
  process.execPath,
  [join(root, 'scripts', 'convert-grading-guide.mjs'), path],
  { stdio: 'inherit' }
);
process.exit(convert.status ?? 1);
