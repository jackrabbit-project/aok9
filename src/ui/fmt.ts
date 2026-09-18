// Number formatting for the screens and print sheets.
//
// The guide stores WAVEs to eight decimals (17.64705882) and the engine keeps
// point totals to three. Neither is how a secretary reads them off a sheet.
// These format for reading; nothing here touches the stored values.

/** A WAVE, to one decimal, tabular. Null is an em dash, never "0". */
export function wave(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(1);
}

/** A point total: up to three decimals, trailing zeros dropped, so 11 is
    "11", 2.25 is "2.25" and a three-way split reads "9.667". */
export function pts(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return String(Math.round(n * 1000) / 1000);
}

/** A finishing place as people say it: 1st, 2nd, 3rd, 4th. A row of bare
    digits next to a dog could be posts or points; these can only be places. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}
