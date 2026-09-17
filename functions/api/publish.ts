// POST /api/publish   { readKey, writeKey, snapshot }  -> { ok, url }
// DELETE /api/publish { readKey, writeKey }            -> 204
//
// A meet's page is created by whoever first publishes under a read key, and
// from then on only the matching write key may update or remove it. Keys are
// generated in the app; nothing here is a secret of the server's.

import { KEY_PATTERN, MAX_BODY_BYTES, validatePublish } from '../lib/validate';
import type { PublicMeet } from '../../src/publish/types';

interface Env {
  MEETS: KVNamespace;
}

interface Stored {
  writeKey: string;
  snapshot: PublicMeet;
}

/** Pages are kept a season and a bit; a republish extends it. */
const TTL_SECONDS = 400 * 24 * 60 * 60;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function readBody(request: Request): Promise<unknown | null> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = validatePublish(await readBody(request));
  if (!body) return json(400, { ok: false, error: 'bad request' });

  const key = `meet:${body.readKey}`;
  const existing = await env.MEETS.get<Stored>(key, 'json');
  if (existing && existing.writeKey !== body.writeKey) {
    return json(403, { ok: false, error: 'not your meet' });
  }
  const stored: Stored = { writeKey: body.writeKey, snapshot: body.snapshot };
  await env.MEETS.put(key, JSON.stringify(stored), { expirationTtl: TTL_SECONDS });

  const url = new URL(request.url);
  return json(200, { ok: true, url: `${url.origin}/r/${body.readKey}` });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await readBody(request)) as { readKey?: unknown; writeKey?: unknown } | null;
  const readKey = body?.readKey;
  const writeKey = body?.writeKey;
  if (typeof readKey !== 'string' || !KEY_PATTERN.test(readKey)) return json(400, { ok: false });
  if (typeof writeKey !== 'string' || !KEY_PATTERN.test(writeKey)) return json(400, { ok: false });

  const key = `meet:${readKey}`;
  const existing = await env.MEETS.get<Stored>(key, 'json');
  if (!existing) return new Response(null, { status: 204 });
  if (existing.writeKey !== writeKey) return json(403, { ok: false, error: 'not your meet' });
  await env.MEETS.delete(key);
  return new Response(null, { status: 204 });
};
