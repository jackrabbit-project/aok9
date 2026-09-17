import { describe, expect, it } from 'vitest';
import meet2 from '../../data/sample-meet-2.json';
import { emptyMeet, normalizeMeet } from '../../store/meetStore';
import { buildSnapshot, meetStatus, snapshotKey } from '../snapshot';
import type { MeetState } from '../../domain/types';

const finished = normalizeMeet(meet2 as unknown as MeetState);
const now = new Date('2026-09-17T12:00:00Z');

describe('buildSnapshot', () => {
  it('carries what the paddock board shows and nothing else', () => {
    const s = buildSnapshot(finished, now, '1.4.0');
    const text = JSON.stringify(s);
    // Present: names, breeds, divisions, results.
    expect(s.info.meetId).toBe('2026-A02');
    expect(s.divisions.map((d) => d.name)).toContain('WHIPPET');
    expect(text).toContain('Annex');
    // Absent: every field that identifies a person or is not on the board.
    for (const owner of finished.entries.map((e) => e.owner).filter(Boolean) as string[]) {
      expect(text).not.toContain(owner);
    }
    for (const reg of finished.entries.map((e) => e.regNo).filter(Boolean) as string[]) {
      expect(text).not.toContain(reg);
    }
    expect(text).not.toMatch(/"owner"|"regNo"|"bwave"|"mwave"|"sex"|"note"|"writeKey"/);
  });

  it('leaves out a dog scratched before the draw', () => {
    const s = buildSnapshot(finished, now, '1.4.0');
    const scratched = finished.entries.find((e) => e.preScratched)!;
    expect(JSON.stringify(s.divisions.map((d) => d.dogs))).not.toContain(scratched.callName);
  });

  it('shows only locked programs, with results and points once scored', () => {
    const s = buildSnapshot(finished, now, '1.4.0');
    const whippets = s.divisions.find((d) => d.name === 'WHIPPET')!;
    expect(whippets.programs.map((p) => p.program)).toEqual([1, 2, 3]);
    const race = whippets.programs[0].races[0];
    expect(race.finished).toBe(true);
    expect(race.slots.every((sl) => sl.result && typeof sl.points === 'number')).toBe(true);
    expect(race.slots.map((sl) => sl.jacket)).toEqual(['Red', 'Blue', 'White'].slice(0, race.slots.length));
    // An unlocked draw is not published: it is still being adjusted.
    const unlocked: MeetState = {
      ...finished,
      draws: finished.draws.map((d) => (d.program === 3 ? { ...d, locked: false } : d)),
    };
    const s2 = buildSnapshot(unlocked, now, '1.4.0');
    expect(s2.divisions[0].programs.map((p) => p.program)).toEqual([1, 2]);
    expect(s2.divisions[0].standings).toBeNull();
  });

  it('publishes final standings with the secretary\'s overrides applied', () => {
    const overridden: MeetState = {
      ...finished,
      overrides: { [finished.entries[0].id]: { brc: 9.5 } },
    };
    const s = buildSnapshot(overridden, now, '1.4.0');
    const div = s.divisions.find((d) => d.dogs.some((x) => x.name === finished.entries[0].callName))!;
    const row = div.standings!.find((r) => r.name === finished.entries[0].callName)!;
    expect(row.brc).toBe(9.5);
    expect(div.standings!.length).toBeGreaterThan(0);
    expect(s.status).toBe('Final results');
  });

  it('says how far the meet has got', () => {
    expect(meetStatus([])).toBe('Meet set up');
    expect(buildSnapshot({ ...emptyMeet(), divisions: finished.divisions, entries: finished.entries }, now, 'x').status)
      .toBe('Divisions set — racing has not started');
    const midway: MeetState = {
      ...finished,
      draws: finished.draws
        .filter((d) => d.program <= 2)
        .map((d) => (d.program === 2 ? { ...d, races: d.races.map((r, i) => (i === 0 ? { ...r, finished: false } : r)) } : d)),
    };
    expect(buildSnapshot(midway, now, 'x').status).toBe('Program 2 in progress');
    const afterTwo: MeetState = { ...finished, draws: finished.draws.filter((d) => d.program <= 2) };
    expect(buildSnapshot(afterTwo, now, 'x').status).toBe('Program 2 results');
  });

  it('keys a snapshot by content, not by when it was taken', () => {
    const a = buildSnapshot(finished, now, '1.4.0');
    const b = buildSnapshot(finished, new Date('2026-09-18T12:00:00Z'), '1.4.0');
    expect(a.updatedAt).not.toBe(b.updatedAt);
    expect(snapshotKey(a)).toBe(snapshotKey(b));
  });
});
