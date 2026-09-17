// Keeps a published meet's page current.
//
// Turning publishing on for a meet is the secretary's consent; from then on
// this sends a fresh snapshot after every change, a few seconds after the
// last keystroke, whenever the app has signal. Nothing here decides what is
// sent -- buildSnapshot does -- and nothing is sent twice: the snapshot is
// keyed by content, so a change that does not alter the page (a note, a
// scratch that is already reflected) costs no request.
//
// Runs once, in the shell. Screens read the status through PublishCtx.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { buildSnapshot, snapshotKey } from './snapshot';
import type { Action } from '../store/meetStore';
import type { MeetState, PublishConfig } from '../domain/types';

export type PublishStatus = 'off' | 'pending' | 'sending' | 'published' | 'offline' | 'error';

export interface PublisherApi {
  status: PublishStatus;
  error: string | null;
  /** Send now, debounce or not. Resolves true when the page is current. */
  publishNow: () => Promise<boolean>;
  /** Take the page down and forget the keys. */
  stop: () => Promise<void>;
}

export const PublishCtx = createContext<PublisherApi>({
  status: 'off',
  error: null,
  publishNow: async () => false,
  stop: async () => undefined,
});

export const usePublish = () => useContext(PublishCtx);

const DEBOUNCE_MS = 3000;
const RETRY_MS = 30000;
const EPOCH = new Date(0);

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function usePublisher(state: MeetState, dispatch: React.Dispatch<Action>): PublisherApi {
  const [status, setStatus] = useState<PublishStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastSent = useRef<string | null>(null);
  const lastKeys = useRef<string | null>(null);
  const inFlight = useRef(false);

  const send = useCallback(async (): Promise<boolean> => {
    const cfg = stateRef.current.publish;
    if (!cfg?.enabled) return false;
    const snapshot = buildSnapshot(stateRef.current, new Date(), __APP_VERSION__);
    const key = snapshotKey(snapshot);
    if (key === lastSent.current) {
      setStatus('published');
      return true;
    }
    if (offline()) {
      setStatus('offline');
      return false;
    }
    if (inFlight.current) return false;
    inFlight.current = true;
    setStatus('sending');
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readKey: cfg.readKey, writeKey: cfg.writeKey, snapshot }),
      });
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? 'That address already belongs to a different meet.'
            : `The server answered ${res.status}.`
        );
      }
      lastSent.current = key;
      setError(null);
      setStatus('published');
      dispatch({ type: 'markPublished', at: new Date().toISOString() });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(offline() ? 'offline' : 'error');
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [dispatch]);

  // What would be sent, keyed by content. Cheap: the snapshot is small.
  const enabled = Boolean(state.publish?.enabled);
  const readKey = state.publish?.readKey ?? null;
  const contentKey = enabled ? snapshotKey(buildSnapshot(state, EPOCH, __APP_VERSION__)) : null;

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    // New keys mean a new page: nothing has been sent to it yet.
    if (readKey !== lastKeys.current) {
      lastKeys.current = readKey;
      lastSent.current = null;
    }
    if (contentKey === lastSent.current) return;
    setStatus('pending');
    // The first send for a page goes at once -- the secretary is waiting for
    // an address to print. Later ones wait for the typing to stop.
    const delay = lastSent.current === null ? 0 : DEBOUNCE_MS;
    const id = window.setTimeout(() => void send(), delay);
    return () => window.clearTimeout(id);
  }, [enabled, readKey, contentKey, send]);

  // Signal comes and goes at a field. Try again when it returns, and every
  // half minute while something is unsent.
  useEffect(() => {
    const onOnline = () => void send();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [send]);
  useEffect(() => {
    if (status !== 'error' && status !== 'offline') return;
    const id = window.setInterval(() => void send(), RETRY_MS);
    return () => window.clearInterval(id);
  }, [status, send]);

  const stop = useCallback(async () => {
    const cfg = stateRef.current.publish;
    dispatch({ type: 'setPublish', publish: null });
    lastSent.current = null;
    if (!cfg) return;
    try {
      await fetch('/api/publish', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ readKey: cfg.readKey, writeKey: cfg.writeKey }),
      });
    } catch {
      // The page expires on its own within the season; the keys are gone
      // either way, so nobody can update it again.
    }
  }, [dispatch]);

  return { status, error, publishNow: send, stop };
}

/** A line for the header and the panel. */
export function publishStatusText(status: PublishStatus, cfg: PublishConfig | null): string {
  switch (status) {
    case 'off':
      return '';
    case 'pending':
      return 'update pending';
    case 'sending':
      return 'publishing…';
    case 'published':
      return cfg?.lastPublishedAt
        ? `published ${new Date(cfg.lastPublishedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'published';
    case 'offline':
      return 'waiting for signal';
    case 'error':
      return 'not published — retrying';
  }
}
