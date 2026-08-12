// Single-meet state store: reducer + React context + localStorage autosave.

import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { drawFirstProgram } from '../domain/draw';
import { drawNextProgram } from '../domain/rotation';
import { newId } from '../domain/divisions';
import type {
  ChampAward,
  Division,
  Entry,
  MeetInfo,
  MeetState,
  Phase,
  ProgramDraw,
  Race,
  RaceOutcome,
  Rng,
} from '../domain/types';

const STORAGE_KEY = 'aok9-meet-v1';

export function emptyMeet(): MeetState {
  return {
    info: {
      clubName: '',
      meetId: '',
      date: new Date().toISOString().slice(0, 10),
      fteThreshold: 0.75,
    },
    phase: 'home',
    entries: [],
    divisions: [],
    draws: [],
    overrides: {},
  };
}

/**
 * Backfill anything a meet file predates, and always open on Home.
 *
 * Every way a meet enters the app — localStorage, a backup file, the bundled
 * sample — comes through here. Backups are explicitly meant to travel between
 * machines and versions and to be attached to bug reports, and the screens
 * index straight into `state.overrides[id]`, so one absent key is a white
 * screen on Results or Export rather than a missing value. Today every file
 * this app has ever written has all the keys; this is here so the next field
 * added to MeetState does not break every backup written before it.
 */
export function normalizeMeet(parsed: Partial<MeetState>): MeetState {
  return {
    info: {
      clubName: parsed.info?.clubName ?? '',
      meetId: parsed.info?.meetId ?? '',
      date: parsed.info?.date ?? '',
      fteThreshold: parsed.info?.fteThreshold ?? 0.75,
    },
    entries: parsed.entries ?? [],
    divisions: parsed.divisions ?? [],
    draws: parsed.draws ?? [],
    overrides: parsed.overrides ?? {},
    // Never drop the secretary into a mid-meet screen: a restored file has to
    // show which meet it is before anything else happens.
    phase: 'home',
  };
}

/**
 * Build every division's draw for a program.
 *
 * Randomness lives here, in the caller, rather than in the reducer. React
 * treats reducers as pure and double-invokes them under StrictMode to say so,
 * and a draw that comes out different when it is replayed cannot be reproduced
 * from a bug report — which for a draw that gets protested is the whole point.
 */
export function buildProgramDraws(state: MeetState, program: 1 | 2 | 3, rng: Rng): ProgramDraw[] {
  const entryMap = new Map(state.entries.map((e) => [e.id, e]));
  const kept = state.draws.filter((d) => d.program !== program);
  return state.divisions.map((division) =>
    program === 1
      ? drawFirstProgram(division, entryMap, rng)
      : drawNextProgram(division, kept, entryMap, program as 2 | 3, rng)
  );
}

/** Rebuild one division's draw for a program, leaving the others alone. */
export function buildDivisionDraw(
  state: MeetState,
  program: 1 | 2 | 3,
  divisionId: string,
  rng: Rng
): ProgramDraw {
  const entryMap = new Map(state.entries.map((e) => [e.id, e]));
  const others = state.draws.filter((d) => !(d.program === program && d.divisionId === divisionId));
  const division = state.divisions.find((d) => d.id === divisionId)!;
  return program === 1
    ? drawFirstProgram(division, entryMap, rng)
    : drawNextProgram(division, others, entryMap, program as 2 | 3, rng);
}

export type Action =
  | { type: 'setInfo'; info: Partial<MeetInfo> }
  | { type: 'setPhase'; phase: Phase }
  | { type: 'addEntry'; entry: Entry }
  | { type: 'updateEntry'; id: string; patch: Partial<Entry> }
  | { type: 'removeEntry'; id: string }
  | { type: 'setDivisions'; divisions: Division[] }
  | { type: 'updateDivision'; id: string; patch: Partial<Division> }
  | { type: 'setProgramDraws'; program: 1 | 2 | 3; draws: ProgramDraw[] }
  | { type: 'setDivisionDraw'; program: 1 | 2 | 3; divisionId: string; draw: ProgramDraw }
  | { type: 'setRace'; race: Race }
  | { type: 'swapDogs'; program: 1 | 2 | 3; divisionId: string; a: string; b: string }
  | { type: 'lockProgram'; program: 1 | 2 | 3 }
  | { type: 'setRaceResult'; raceId: string; outcomes: Record<string, RaceOutcome>; finished: boolean }
  | { type: 'setRaceFlags'; raceId: string; rerun?: boolean; splitAllPoints?: boolean; note?: string }
  | { type: 'setOverride'; entryId: string; patch: Partial<ChampAward> | null }
  | { type: 'importState'; state: MeetState }
  | { type: 'reset' };

function mapRace(draws: ProgramDraw[], raceId: string, fn: (r: ProgramDraw['races'][number]) => ProgramDraw['races'][number]): ProgramDraw[] {
  return draws.map((d) => ({
    ...d,
    races: d.races.map((r) => (r.id === raceId ? fn(r) : r)),
  }));
}

export function reducer(state: MeetState, action: Action): MeetState {
  switch (action.type) {
    case 'setInfo':
      return { ...state, info: { ...state.info, ...action.info } };
    case 'setPhase':
      return { ...state, phase: action.phase };
    case 'addEntry':
      return { ...state, entries: [...state.entries, action.entry] };
    case 'updateEntry':
      return {
        ...state,
        entries: state.entries.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      };
    case 'removeEntry':
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.id),
        divisions: state.divisions.map((d) => ({
          ...d,
          entryIds: d.entryIds.filter((id) => id !== action.id),
          leftoverIds: d.leftoverIds.filter((id) => id !== action.id),
        })),
      };
    case 'setDivisions':
      return { ...state, divisions: action.divisions };
    case 'updateDivision':
      return {
        ...state,
        divisions: state.divisions.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      };
    case 'setProgramDraws': {
      const kept = state.draws.filter((d) => d.program !== action.program);
      return { ...state, draws: [...kept, ...action.draws] };
    }
    case 'setDivisionDraw': {
      const others = state.draws.filter(
        (d) => !(d.program === action.program && d.divisionId === action.divisionId)
      );
      return { ...state, draws: [...others, action.draw] };
    }
    case 'setRace':
      return { ...state, draws: mapRace(state.draws, action.race.id, () => action.race) };
    case 'swapDogs': {
      return {
        ...state,
        draws: state.draws.map((d) => {
          if (d.program !== action.program || d.divisionId !== action.divisionId) return d;
          return {
            ...d,
            races: d.races.map((r) => ({
              ...r,
              slots: r.slots.map((s) =>
                s.entryId === action.a
                  ? { ...s, entryId: action.b }
                  : s.entryId === action.b
                    ? { ...s, entryId: action.a }
                    : s
              ),
            })),
          };
        }),
      };
    }
    case 'lockProgram':
      return {
        ...state,
        draws: state.draws.map((d) => (d.program === action.program ? { ...d, locked: true } : d)),
      };
    case 'setRaceResult':
      return {
        ...state,
        draws: mapRace(state.draws, action.raceId, (r) => ({
          ...r,
          outcomes: action.outcomes,
          finished: action.finished,
        })),
      };
    case 'setRaceFlags':
      return {
        ...state,
        draws: mapRace(state.draws, action.raceId, (r) => ({
          ...r,
          rerun: action.rerun ?? r.rerun,
          splitAllPoints: action.splitAllPoints ?? r.splitAllPoints,
          note: action.note ?? r.note,
        })),
      };
    case 'setOverride': {
      const overrides = { ...state.overrides };
      if (action.patch === null) delete overrides[action.entryId];
      else overrides[action.entryId] = { ...overrides[action.entryId], ...action.patch };
      return { ...state, overrides };
    }
    case 'importState':
      return normalizeMeet(action.state);
    case 'reset':
      return emptyMeet();
    default:
      return state;
  }
}

export function loadSaved(): MeetState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeetState;
    if (!parsed || !parsed.info) return null;
    return normalizeMeet(parsed);
  } catch {
    return null;
  }
}

const Ctx = createContext<{
  state: MeetState;
  dispatch: React.Dispatch<Action>;
  lastSaved: string;
} | null>(null);

export function MeetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadSaved() ?? emptyMeet());
  const [lastSaved, setLastSaved] = React.useState('');
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setLastSaved(new Date().toLocaleTimeString());
    } catch {
      // storage full/unavailable: keep running, backups still possible via export
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch, lastSaved }), [state, lastSaved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMeet outside provider');
  return ctx;
}

/**
 * Career-point thresholds used to infer championship titles, which the Grading
 * Guide does not publish. A wrong guess silently misallocates BRC/MRC points,
 * so the results are editable chips in Entries — and the constants live here,
 * named and together, to be audited against the rule book in one place.
 */
export const TITLE_THRESHOLDS = {
  /** BRC: career breed points. */
  brc: 12,
  /** MRC: mixed points earned, plus a combined breed+mixed floor. */
  mrcOwn: 2,
  mrcCombined: 12,
  /** SBRC / SMRC: national points. */
  national: 30,
} as const;

/** Create an Entry from a Grading Guide dog. */
export function entryFromGuide(dog: import('../domain/types').GuideDog): Entry {
  return {
    id: newId('entry'),
    regNo: dog.regNo,
    callName: dog.callName,
    registeredName: dog.registeredName,
    breed: dog.breed ?? 'UNKNOWN',
    sex: '',
    owner: dog.owner,
    fte: false,
    bwave: dog.bwave,
    mwave: dog.mwave,
    fteGrade: 'D',
    hasBRC: dog.brc >= TITLE_THRESHOLDS.brc,
    hasMRC: dog.mrc >= TITLE_THRESHOLDS.mrcOwn && dog.brc + dog.mrc >= TITLE_THRESHOLDS.mrcCombined,
    hasSBRC: dog.nbrc >= TITLE_THRESHOLDS.national,
    hasSMRC: dog.nmrc >= TITLE_THRESHOLDS.national,
    guidePoints: { brc: dog.brc, nbrc: dog.nbrc, mrc: dog.mrc, nmrc: dog.nmrc, trc: dog.trc },
    guideBreedMeets: dog.breedMeets,
    guideMixedMeets: dog.mixedMeets,
    preScratched: false,
  };
}

export function blankFteEntry(): Entry {
  return {
    id: newId('entry'),
    regNo: null,
    callName: '',
    registeredName: null,
    breed: '',
    sex: '',
    owner: null,
    fte: true,
    bwave: null,
    mwave: null,
    fteGrade: 'D',
    hasBRC: false,
    hasMRC: false,
    hasSBRC: false,
    hasSMRC: false,
    guidePoints: { brc: 0, nbrc: 0, mrc: 0, nmrc: 0, trc: 0 },
    guideBreedMeets: [],
    guideMixedMeets: [],
    preScratched: false,
  };
}
