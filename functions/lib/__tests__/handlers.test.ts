// Drives the two Pages Functions the way Cloudflare would, with a KV stand-in,
// so the claim-then-update-only-with-the-write-key rule is tested rather than
// assumed.

import { describe, expect, it } from 'vitest';
import meet2 from '../../../src/data/sample-meet-2.json';
import { normalizeMeet } from '../../../src/store/meetStore';
import { buildSnapshot } from '../../../src/publish/snapshot';
import { onRequestDelete, onRequestPost } from '../../api/publish';
import { onRequestGet } from '../../r/[key]';
import type { MeetState } from '../../../src/domain/types';

const finished = normalizeMeet(meet2 as unknown as MeetState);
const snapshot = buildSnapshot(finished, new Date('2026-09-17T12:00:00Z'), '1.4.0');

/** Just enough of KVNamespace for the handlers. */
function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string, type?: string) => {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  } as unknown as KVNamespace;
}

const ctx = (request: Request, env: { MEETS: KVNamespace }, params: Record<string, string> = {}) =>
  ({ request, env, params } as unknown as Parameters<typeof onRequestPost>[0]);

const post = (body: unknown) =>
  new Request('https://aok9rms.gazehound.io/api/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const READ = 'abcdefghij1234';
const WRITE = 'w'.repeat(32);

describe('publish endpoint', () => {
  it('claims a page on first publish and returns its address', async () => {
    const env = { MEETS: fakeKv() };
    const res = await onRequestPost(ctx(post({ readKey: READ, writeKey: WRITE, snapshot }), env));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: `https://aok9rms.gazehound.io/r/${READ}` });
    const stored = JSON.parse((env.MEETS as unknown as { store: Map<string, string> }).store.get(`meet:${READ}`)!);
    expect(stored.writeKey).toBe(WRITE);
    expect(stored.snapshot.info.meetId).toBe('2026-A02');
  });

  it('updates with the same write key and refuses any other', async () => {
    const env = { MEETS: fakeKv() };
    await onRequestPost(ctx(post({ readKey: READ, writeKey: WRITE, snapshot }), env));
    const again = await onRequestPost(
      ctx(post({ readKey: READ, writeKey: WRITE, snapshot: { ...snapshot, status: 'Program 3 in progress' } }), env)
    );
    expect(again.status).toBe(200);
    const stranger = await onRequestPost(
      ctx(post({ readKey: READ, writeKey: 'x'.repeat(32), snapshot }), env)
    );
    expect(stranger.status).toBe(403);
    const page = await onRequestGet(ctx(new Request(`https://aok9rms.gazehound.io/r/${READ}`), env, { key: READ }));
    expect(await page.text()).toContain('Program 3 in progress');
  });

  it('rejects a malformed request before touching storage', async () => {
    const env = { MEETS: fakeKv() };
    const res = await onRequestPost(ctx(post({ readKey: 'nope', writeKey: WRITE, snapshot }), env));
    expect(res.status).toBe(400);
    expect((env.MEETS as unknown as { store: Map<string, string> }).store.size).toBe(0);
    const junk = new Request('https://aok9rms.gazehound.io/api/publish', { method: 'POST', body: '{not json' });
    expect((await onRequestPost(ctx(junk, env))).status).toBe(400);
  });

  it('serves the page, and a not-found page for a wrong or removed key', async () => {
    const env = { MEETS: fakeKv() };
    await onRequestPost(ctx(post({ readKey: READ, writeKey: WRITE, snapshot }), env));
    const ok = await onRequestGet(ctx(new Request(`https://aok9rms.gazehound.io/r/${READ}`), env, { key: READ }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/html');
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await ok.text()).toContain('High Desert Racing Club');

    const missing = await onRequestGet(ctx(new Request('https://aok9rms.gazehound.io/r/zzzzzzzzzzzzzz'), env, { key: 'zzzzzzzzzzzzzz' }));
    expect(missing.status).toBe(404);
    const bad = await onRequestGet(ctx(new Request('https://aok9rms.gazehound.io/r/../etc'), env, { key: '../etc' }));
    expect(bad.status).toBe(404);
  });

  it('takes a page down only for its own write key', async () => {
    const env = { MEETS: fakeKv() };
    await onRequestPost(ctx(post({ readKey: READ, writeKey: WRITE, snapshot }), env));
    const del = (writeKey: string) =>
      new Request('https://aok9rms.gazehound.io/api/publish', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readKey: READ, writeKey }),
      });
    expect((await onRequestDelete(ctx(del('y'.repeat(32)), env))).status).toBe(403);
    expect((await onRequestDelete(ctx(del(WRITE), env))).status).toBe(204);
    const gone = await onRequestGet(ctx(new Request(`https://aok9rms.gazehound.io/r/${READ}`), env, { key: READ }));
    expect(gone.status).toBe(404);
  });
});
