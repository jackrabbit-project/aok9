// Turns an untrusted publish request into a snapshot we are willing to store
// and render. Everything is copied field by field onto a fresh object --
// unknown keys are dropped, strings are cut to a sane length, numbers must be
// finite, and arrays are capped -- so what reaches KV is only ever the shape
// the page knows how to draw.

import type {
  PublicDivision,
  PublicMeet,
  PublicProgram,
  PublicRace,
  PublicResult,
  PublicSlot,
  PublicStanding,
} from '../../src/publish/types';

export const KEY_PATTERN = /^[a-z0-9]{12,48}$/;
export const MAX_BODY_BYTES = 256 * 1024;

const RESULTS = new Set<PublicResult>(['1st', '2nd', '3rd', '4th', 'OC', 'DNF', 'DQ', 'SCR']);

class Invalid extends Error {}

const str = (v: unknown, max = 120): string => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v: unknown): boolean => v === true;
function num(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Invalid('number expected');
  return v;
}
function list<T>(v: unknown, max: number, each: (x: unknown) => T): T[] {
  if (!Array.isArray(v)) throw new Invalid('list expected');
  if (v.length > max) throw new Invalid('list too long');
  return v.map(each);
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Invalid('object expected');
  return v as Record<string, unknown>;
}

function slot(v: unknown): PublicSlot {
  const o = obj(v);
  const out: PublicSlot = {
    post: o.post === null ? null : num(o.post),
    jacket: str(o.jacket, 12),
    name: str(o.name),
    breed: str(o.breed),
  };
  if (o.result !== undefined) {
    if (!RESULTS.has(o.result as PublicResult)) throw new Invalid('bad result');
    out.result = o.result as PublicResult;
  }
  if (o.points !== undefined) out.points = num(o.points);
  return out;
}

function race(v: unknown): PublicRace {
  const o = obj(v);
  return { raceNo: num(o.raceNo), isHP: bool(o.isHP), finished: bool(o.finished), slots: list(o.slots, 8, slot) };
}

function program(v: unknown): PublicProgram {
  const o = obj(v);
  const p = num(o.program);
  if (p !== 1 && p !== 2 && p !== 3) throw new Invalid('bad program');
  return { program: p, complete: bool(o.complete), races: list(o.races, 40, race) };
}

function standing(v: unknown): PublicStanding {
  const o = obj(v);
  return {
    place: num(o.place),
    name: str(o.name),
    breed: str(o.breed),
    total: num(o.total),
    brc: num(o.brc),
    nbrc: num(o.nbrc),
    mrc: num(o.mrc),
    nmrc: num(o.nmrc),
    trc: num(o.trc),
    leftover: bool(o.leftover),
    incomplete: bool(o.incomplete),
  };
}

function division(v: unknown): PublicDivision {
  const o = obj(v);
  const type = o.type === 'mixed' ? 'mixed' : 'breed';
  return {
    name: str(o.name),
    type,
    ungraded: bool(o.ungraded),
    dogs: list(o.dogs, 200, (d) => {
      const x = obj(d);
      return { name: str(x.name), breed: str(x.breed), leftover: bool(x.leftover), fte: bool(x.fte) };
    }),
    programs: list(o.programs, 3, program),
    totals: list(o.totals, 200, (t) => {
      const x = obj(t);
      return { name: str(x.name), total: num(x.total) };
    }),
    standings: o.standings === null || o.standings === undefined ? null : list(o.standings, 200, standing),
  };
}

/** A clean copy of the snapshot, or null if it is not one. */
export function validateSnapshot(v: unknown): PublicMeet | null {
  try {
    const o = obj(v);
    if (o.v !== 1) throw new Invalid('unknown version');
    const info = obj(o.info);
    const updatedAt = str(o.updatedAt, 40);
    if (Number.isNaN(Date.parse(updatedAt))) throw new Invalid('bad time');
    return {
      v: 1,
      updatedAt,
      app: str(o.app, 20),
      info: { clubName: str(info.clubName), meetId: str(info.meetId, 40), date: str(info.date, 20) },
      status: str(o.status, 80),
      divisions: list(o.divisions, 60, division),
    };
  } catch (err) {
    if (err instanceof Invalid) return null;
    throw err;
  }
}

export interface PublishBody {
  readKey: string;
  writeKey: string;
  snapshot: PublicMeet;
}

/** The whole request body, keys and snapshot, or null. */
export function validatePublish(v: unknown): PublishBody | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const readKey = o.readKey;
  const writeKey = o.writeKey;
  if (typeof readKey !== 'string' || !KEY_PATTERN.test(readKey)) return null;
  if (typeof writeKey !== 'string' || !KEY_PATTERN.test(writeKey)) return null;
  const snapshot = validateSnapshot(o.snapshot);
  if (!snapshot) return null;
  return { readKey, writeKey, snapshot };
}
