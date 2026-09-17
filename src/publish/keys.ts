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

/**
 * The page's address: what goes in the QR code and on the sheets.
 *
 * Built from the origin the app is running on -- the opposite decision from
 * the share links in ShareLinks.tsx, which point at APP_URL on purpose. A
 * meet's page is served by the deployment that stored its snapshot, the one
 * this app posted to, so the link has to name that deployment. On the live
 * site that is APP_URL anyway; on a branch preview it is the preview, which
 * is the only way the feature can be tried there before it is merged.
 * Outside a browser (tests, scripts) there is no origin, so APP_URL it is.
 */
export function publicUrl(readKey: string): string {
  const here = typeof location === 'undefined' ? '' : location.origin;
  const origin = here.startsWith('http://') || here.startsWith('https://') ? here : new URL(APP_URL).origin;
  return `${origin}/r/${readKey}`;
}
