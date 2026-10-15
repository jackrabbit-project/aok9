// Rebuilds the app's icon files from the Jackrabbit Project mark set.
//
//   npm i --no-save sharp
//   node scripts/make-icons.mjs [path/to/jackrabbit/assets]
//
// The set lives at github.com/jackrabbit-project/jackrabbit (assets/); the
// default path expects a clone beside this repo. mark.svg (two colours) makes
// the icons; the inline header/footer mark in src/ui/JackrabbitMark.tsx is the
// single-colour path from mark-mono.svg and is updated by hand from that file.
//
// Framing: the mark centred on the icons' near-white ground, 80% of the canvas
// for ordinary icons and 68% for the maskable one, which Android crops to its
// own shape and must keep inside the safe zone. sharp is not a dependency of
// the app -- it is a 30 MB native module for a job done once a year.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const sharp = (await import('sharp')).default;

const SET = process.argv[2] ?? join(process.cwd(), '..', 'jackrabbit', 'assets');
const SVG = readFileSync(join(SET, 'mark.svg'));
const PUB = join(process.cwd(), 'public');
const TMP = mkdtempSync(join(tmpdir(), 'aok9-icons-'));
const bg = { r: 250, g: 251, b: 252, alpha: 1 };

async function icon(size, fraction, path) {
  const box = Math.round(size * fraction);
  const mark = await sharp(SVG, { density: 400 }).resize(box, box, { fit: 'inside' }).png().toBuffer();
  const meta = await sharp(mark).metadata();
  const left = Math.round((size - meta.width) / 2);
  const top = Math.round((size - meta.height) / 2);
  const out = await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mark, left, top }])
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  writeFileSync(path, out);
  console.log(path.split(/[\\/]/).pop(), `${size}px, mark ${meta.width}x${meta.height}, ${out.length} bytes`);
  return out;
}

/** An .ico holding PNG-compressed entries, which every current browser reads. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const p16 = await icon(16, 0.94, join(PUB, 'favicon-16x16.png'));
const p32 = await icon(32, 0.9, join(PUB, 'favicon-32x32.png'));
const p48 = await icon(48, 0.88, join(TMP, 'favicon-48.png'));
await icon(180, 0.8, join(PUB, 'apple-touch-icon.png'));
await icon(192, 0.8, join(PUB, 'pwa-192x192.png'));
await icon(512, 0.8, join(PUB, 'pwa-512x512.png'));
await icon(512, 0.68, join(PUB, 'pwa-maskable-512x512.png'));
const favicon = ico([
  { size: 16, png: p16 },
  { size: 32, png: p32 },
  { size: 48, png: p48 },
]);
writeFileSync(join(PUB, 'favicon.ico'), favicon);
console.log('favicon.ico', favicon.length, 'bytes, 3 entries');
