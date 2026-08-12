// Summarises the difference between two converted Grading Guides as markdown,
// for the body of a refresh pull request.
//
// grading-guide.json is written minified, so its diff on GitHub is one
// unreadable line. Without this the PR would be unreviewable and the reviewer
// would be approving a blob.
//
// Usage: node scripts/diff-grading-guide.mjs <old.json> <new.json>

import { readFileSync } from 'node:fs';

const [, , oldPath, newPath] = process.argv;
if (!oldPath || !newPath) {
  console.error('Usage: node scripts/diff-grading-guide.mjs <old.json> <new.json>');
  process.exit(1);
}

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const before = read(oldPath);
const after = read(newPath);

/**
 * Dogs are keyed by registration number AND call name.
 *
 * The source data gives the same registration number to two different dogs in
 * 17 cases, so keying on the number alone silently collapses those pairs and
 * reports renames that never happened. The cost of including the call name is
 * that a genuine rename shows up as one dog leaving and another arriving, which
 * is the safer way round for a human to read.
 */
const key = (d) => `${d.regNo}|${d.callName}`;
const index = (guide) => new Map(guide.dogs.map((d) => [key(d), d]));

const b = index(before);
const a = index(after);
const breeds = (g) => new Set(g.dogs.map((d) => d.breed)).size;

const added = [...a.values()].filter((d) => !b.has(key(d)));
const removed = [...b.values()].filter((d) => !a.has(key(d)));

const waveChanges = [];
const pointChanges = [];
for (const [k, dog] of a) {
  const old = b.get(k);
  if (!old) continue;
  if (old.bwave !== dog.bwave || old.mwave !== dog.mwave) {
    waveChanges.push({ dog, old });
  }
  if (
    old.brc !== dog.brc || old.nbrc !== dog.nbrc || old.mrc !== dog.mrc ||
    old.nmrc !== dog.nmrc || old.trc !== dog.trc
  ) {
    pointChanges.push({ dog, old });
  }
}

const out = [];
const w = (line = '') => out.push(line);
const num = (v) => (v === null || v === undefined ? '—' : String(v));
const delta = (n) => (n > 0 ? ` (+${n})` : n < 0 ? ` (${n})` : '');

/** Print at most `limit` rows, and say plainly when rows were left out. */
function table(title, rows, header, render, limit = 40) {
  if (rows.length === 0) return;
  w(`#### ${title} (${rows.length})`);
  w();
  w(`| ${header.join(' | ')} |`);
  w(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows.slice(0, limit)) w(`| ${render(row).join(' | ')} |`);
  if (rows.length > limit) {
    w();
    w(`_${rows.length - limit} more not shown — the full list is in the file diff._`);
  }
  w();
}

w(`**${before.source}** → **${after.source}**`);
w();
w(`| | before | after |`);
w(`| --- | --- | --- |`);
w(`| Dogs | ${before.dogs.length} | ${after.dogs.length}${delta(after.dogs.length - before.dogs.length)} |`);
w(`| Breeds | ${breeds(before)} | ${breeds(after)}${delta(breeds(after) - breeds(before))} |`);
w();

if (!added.length && !removed.length && !waveChanges.length && !pointChanges.length) {
  w('No dogs were added, removed, regraded or rescored. Only the source stamp changed.');
}

table('New dogs', added, ['Breed', 'Dog', 'Reg #', 'BWAVE', 'MWAVE'], ({ breed, callName, regNo, bwave, mwave }) =>
  [breed, callName, regNo, num(bwave), num(mwave)]
);

table('Dogs no longer listed', removed, ['Breed', 'Dog', 'Reg #'], ({ breed, callName, regNo }) =>
  [breed, callName, regNo]
);

table('WAVE changes', waveChanges, ['Dog', 'Breed', 'BWAVE', 'MWAVE'], ({ dog, old }) => [
  dog.callName,
  dog.breed,
  old.bwave === dog.bwave ? num(dog.bwave) : `${num(old.bwave)} → **${num(dog.bwave)}**`,
  old.mwave === dog.mwave ? num(dog.mwave) : `${num(old.mwave)} → **${num(dog.mwave)}**`,
]);

table('Championship point changes', pointChanges, ['Dog', 'Breed', 'BRC', 'NBRC', 'MRC', 'NMRC', 'TRC'], ({ dog, old }) =>
  [
    dog.callName,
    dog.breed,
    ...['brc', 'nbrc', 'mrc', 'nmrc', 'trc'].map((f) =>
      old[f] === dog[f] ? String(dog[f]) : `${old[f]} → **${dog[f]}**`
    ),
  ]
);

w('---');
w();
w(
  'A dog carrying a title in the guide but not flagged as one here is corrected on the ' +
    'Entries screen, not in this file — the guide publishes points, not titles.'
);

console.log(out.join('\n'));
