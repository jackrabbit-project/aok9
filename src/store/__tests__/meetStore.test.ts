import { describe, expect, it } from 'vitest';
import { emptyMeet, normalizeMeet, reducer } from '../meetStore';
import type { MeetState } from '../../domain/types';

/** A meet file written before `overrides` existed, as an older backup or a
 *  hand-edited JSON attached to a bug report would look. */
const olderFile = {
  info: { clubName: 'Jackrabbit', meetId: '2026-S54', date: '2026-08-01', fteThreshold: 0.75 },
  phase: 'export',
  entries: [],
  divisions: [],
  draws: [],
} as unknown as MeetState;

describe('normalizeMeet', () => {
  it('backfills a field the file predates', () => {
    // Results and Export index straight into state.overrides[id]; without the
    // backfill the app opens the file and then white-screens on those screens.
    expect((olderFile as Partial<MeetState>).overrides).toBeUndefined();
    expect(normalizeMeet(olderFile).overrides).toEqual({});
  });

  it('always opens on Home so the secretary sees which meet was restored', () => {
    expect(normalizeMeet(olderFile).phase).toBe('home');
  });

  it('keeps everything the file did carry', () => {
    const s = normalizeMeet(olderFile);
    expect(s.info.meetId).toBe('2026-S54');
    expect(s.info.clubName).toBe('Jackrabbit');
    expect(s.info.fteThreshold).toBe(0.75);
  });

  it('survives a file missing the collections entirely', () => {
    const s = normalizeMeet({ info: olderFile.info } as Partial<MeetState>);
    expect(s.entries).toEqual([]);
    expect(s.divisions).toEqual([]);
    expect(s.draws).toEqual([]);
    expect(s.overrides).toEqual({});
  });
});

describe('importState', () => {
  it('normalizes on the way in, whatever the load path', () => {
    const s = reducer(emptyMeet(), { type: 'importState', state: olderFile });
    expect(s.overrides).toEqual({});
    expect(s.phase).toBe('home');
    expect(s.info.meetId).toBe('2026-S54');
  });
});
