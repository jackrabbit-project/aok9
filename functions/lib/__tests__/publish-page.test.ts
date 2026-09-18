import { describe, expect, it } from 'vitest';
import meet2 from '../../../src/data/sample-meet-2.json';
import { normalizeMeet } from '../../../src/store/meetStore';
import { buildSnapshot } from '../../../src/publish/snapshot';
import { esc, renderMeet, renderNotFound } from '../render';
import { validatePublish, validateSnapshot } from '../validate';
import type { MeetState } from '../../../src/domain/types';

const finished = normalizeMeet(meet2 as unknown as MeetState);
const snapshot = buildSnapshot(finished, new Date('2026-09-17T12:00:00Z'), '1.4.0');
const keys = { readKey: 'abc123def456', writeKey: 'x'.repeat(32).replace(/x/g, 'k') };

describe('validate', () => {
  it('accepts what the app sends, unchanged in substance', () => {
    const ok = validatePublish({ ...keys, snapshot });
    expect(ok).not.toBeNull();
    expect(ok!.snapshot).toEqual(snapshot);
  });

  it('refuses malformed keys and bodies', () => {
    expect(validatePublish(null)).toBeNull();
    expect(validatePublish({ ...keys, readKey: 'short', snapshot })).toBeNull();
    expect(validatePublish({ ...keys, writeKey: 'has-dash-and-CAPS', snapshot })).toBeNull();
    expect(validatePublish({ ...keys, snapshot: { v: 2 } })).toBeNull();
    expect(validatePublish({ ...keys, snapshot: { ...snapshot, updatedAt: 'yesterday' } })).toBeNull();
  });

  it('copies field by field: unknown keys are dropped, strings are cut, numbers must be finite', () => {
    const dirty = JSON.parse(JSON.stringify(snapshot));
    dirty.extra = 'not stored';
    dirty.info.clubName = 'A'.repeat(500);
    dirty.divisions[0].owner = 'leaks';
    const clean = validateSnapshot(dirty)!;
    expect((clean as unknown as Record<string, unknown>).extra).toBeUndefined();
    expect(clean.info.clubName).toHaveLength(120);
    expect(JSON.stringify(clean)).not.toContain('leaks');
    dirty.divisions[0].totals[0].total = Infinity;
    expect(validateSnapshot(dirty)).toBeNull();
    dirty.divisions[0].totals[0].total = 1;
    dirty.divisions[0].programs[0].races[0].slots[0].result = 'won';
    expect(validateSnapshot(dirty)).toBeNull();
  });
});

describe('render', () => {
  it('escapes everything that came from a keyboard', () => {
    expect(esc(`<script>alert("x")</script> & 'q'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;'
    );
    const hostile = {
      ...snapshot,
      info: { ...snapshot.info, clubName: '<img src=x onerror=alert(1)>' },
      divisions: snapshot.divisions.map((d, i) => (i === 0 ? { ...d, name: '</td><script>1</script>' } : d)),
    };
    const html = renderMeet(hostile);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>1</script>');
    expect(html).toContain('&lt;img src=x');
  });

  it('shows the meet: status, every division, latest program first, final standings', () => {
    const html = renderMeet(snapshot);
    expect(html).toContain('High Desert Racing Club');
    expect(html).toContain('Final results');
    for (const d of snapshot.divisions) expect(html).toContain(esc(d.name));
    expect(html.indexOf('Program 3')).toBeLessThan(html.indexOf('Program 1'));
    expect(html).toContain('Final standings');
    expect(html).toContain('post-1');
    expect(html).toContain('refresh');
    // Nothing that should not be there.
    expect(html).not.toMatch(/owner|regNo|WH-\d/);
  });

  it('lists the dogs when nothing has been drawn yet', () => {
    const early = { ...snapshot, status: 'Divisions set', divisions: snapshot.divisions.map((d) => ({ ...d, programs: [], totals: [], standings: null })) };
    const html = renderMeet(early);
    expect(html).toContain('class="dogs"');
    expect(html).not.toContain('Race 1');
  });

  it('has a page for a wrong link', () => {
    expect(renderNotFound()).toContain('No results at this address');
  });
});

describe('program state', () => {
  it('marks a finished program done and a running one live, in words as well as colour', () => {
    const live = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    const division = live.divisions[0];
    division.programs[division.programs.length - 1].complete = false;
    const html = renderMeet(live);
    expect(html).toContain('<span class="state done">complete</span>');
    expect(html).toContain('<span class="state live">in progress</span>');
    expect(html).toContain('.state.done{color:var(--green)}');
    expect(html).toContain('.state.live{color:var(--rust)}');
  });
});
