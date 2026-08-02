// Meet JSON backup export / restore.

import type { MeetState } from '../domain/types';

/** Local-time YYYYMMDD-HHMMSS. Local, not UTC: the secretary reads a wall clock.
    No colons -- Windows rejects them in filenames. */
export function backupStamp(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
    + `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/** meetId is typed by a person, so it can carry characters a filename cannot. */
function safeLabel(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'meet';
}

export function backupFilename(state: MeetState, now: Date = new Date()): string {
  const label = safeLabel(state.info.meetId || state.info.date || '');
  return `aok9-meet-backup-${label}-${backupStamp(now)}.json`;
}

export function downloadBackup(state: MeetState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Every save during a meet used to land on one name, so the browser appended
  // " (1)", " (2)"... At a field, mid-stake, picking the newest from that list
  // is how you restore the wrong one. Timestamp makes the latest self-evident.
  a.download = backupFilename(state);
  a.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): MeetState {
  const parsed = JSON.parse(text) as MeetState;
  if (!parsed || !parsed.info || !Array.isArray(parsed.entries)) {
    throw new Error('Not a valid AOK9 meet backup file');
  }
  return parsed;
}
