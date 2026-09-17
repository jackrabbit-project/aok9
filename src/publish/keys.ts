// Keys for a meet's results page, and the address they make.

import { APP_URL } from '../ui/common';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Random lower-case alphanumerics from the browser's CSPRNG. Bytes at or
 * above 252 are thrown away rather than folded, so every character is
 * equally likely; 14 characters is 6e21 possibilities for the read key.
 */
export function randomKey(length: number): string {
  let out = '';
  const bytes = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= 252) continue;
      out += ALPHABET[b % 36];
      if (out.length === length) break;
    }
  }
  return out;
}

/** The page's address: what goes in the QR code and on the sheets. */
export function publicUrl(readKey: string): string {
  return `${APP_URL}r/${readKey}`;
}
