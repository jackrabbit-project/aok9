// GET /r/<readKey> -- the public results page for a published meet.

import { KEY_PATTERN } from '../lib/validate';
import { renderMeet, renderNotFound } from '../lib/render';
import type { PublicMeet } from '../../src/publish/types';

interface Env {
  MEETS: KVNamespace;
}

const html = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Results change every few minutes at a meet; nothing in between should
      // hand someone a stale copy.
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const key = String(params.key ?? '');
  if (!KEY_PATTERN.test(key)) return html(404, renderNotFound());
  const stored = await env.MEETS.get<{ snapshot: PublicMeet }>(`meet:${key}`, 'json');
  if (!stored) return html(404, renderNotFound());
  return html(200, renderMeet(stored.snapshot));
};
