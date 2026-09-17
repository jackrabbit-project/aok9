// Core domain types for an AOK9 Sprint race meet (Rule Book v3.0).

export type Sex = 'M' | 'F' | '';
export type Grade = 'A' | 'B' | 'C' | 'D';
export type DivisionType = 'breed' | 'mixed';

/** Outcome of one dog in one race. */
export type RaceOutcome =
  | { kind: 'placed'; place: number } // finished; place 1..4 (ties allowed: same place twice)
  | { kind: 'OC' } // off course: scores 0
  | { kind: 'DNF' } // did not finish: scores 0
  | { kind: 'DQ' } // disqualified (intentional foul): scored as if absent, dismissed from meet
  | { kind: 'ABS' }; // did not run its assigned race (scratch/no-show): 0, out of meet

export interface GuideMeet {
  meet: string | null;
  score: number | null;
}

/** A dog as listed in the official Grading Guide. */
export interface GuideDog {
  regNo: string;
  callName: string;
  breed: string | null;
  bwave: number | null;
  mwave: number | null;
  registeredName: string | null;
  owner: string | null;
  brc: number;
  nbrc: number;
  mrc: number;
  nmrc: number;
  trc: number;
  breedMeets: GuideMeet[];
  mixedMeets: GuideMeet[];
}

/** A dog entered in this meet. */
export interface Entry {
  id: string;
  regNo: string | null; // null/pending for FTE without a number yet
  callName: string;
  registeredName: string | null;
  breed: string; // breed, or mix type treated as its own "breed" (e.g. "TERRIER MIX")
  sex: Sex;
  owner: string | null;
  fte: boolean;
  bwave: number | null;
  mwave: number | null;
  /** FTE insertion grade per 4.3.1.3 (D default; C via schooling; B max via oval record). */
  fteGrade: Grade;
  /** Championship title flags ("champion of record"), prefilled from guide points, editable. */
  hasBRC: boolean;
  hasMRC: boolean;
  hasSBRC: boolean;
  hasSMRC: boolean;
  /** Accumulated points from the guide (for reference/report). */
  guidePoints: { brc: number; nbrc: number; mrc: number; nmrc: number; trc: number };
  /** Last recorded meets from the guide (most recent first) for WAVE recalc. */
  guideBreedMeets: GuideMeet[];
  guideMixedMeets: GuideMeet[];
  /** Marked scratched before racing began (never started program 1). */
  preScratched: boolean;
}

export interface Division {
  id: string;
  type: DivisionType;
  name: string; // breed name for breed divisions, custom label for mixed
  entryIds: string[];
  /** Entries running as "leftover" dogs in a breed division (compete for mixed points only). */
  leftoverIds: string[];
  /** Run as ungraded (>= threshold FTE, 4.4). Secretary may toggle. */
  ungraded: boolean;
}

export interface RaceSlot {
  entryId: string;
  post: number | null; // 1..4 after post draw; jacket color follows post
}

export interface Race {
  id: string;
  divisionId: string;
  program: 1 | 2 | 3;
  /** 1 = lowest race (run first) .. n = High Point race (run last). */
  raceNo: number;
  isHP: boolean;
  slots: RaceSlot[];
  outcomes: Record<string, RaceOutcome>; // entryId -> outcome (present once results entered)
  finished: boolean;
  rerun: boolean; // marked as a rerun per 6.5
  /** 6.5.1(b): split all the race's points equally among all participants. */
  splitAllPoints: boolean;
  note: string;
}

export interface TieDecision {
  entryIds: string[];
  explanation: string;
}

export interface ProgramDraw {
  program: 1 | 2 | 3;
  divisionId: string;
  races: Race[];
  /** Audit trail of tie-break decisions made while grouping (4.3.4.1). */
  tieDecisions: TieDecision[];
  locked: boolean;
}

export interface MeetInfo {
  clubName: string;
  meetId: string; // e.g. 2026-S54
  date: string; // ISO date
  fteThreshold: number; // fraction of FTEs that allows ungraded (rule book: 0.75)
}

export type Phase =
  | 'home'
  | 'setup'
  | 'entries'
  | 'divisions'
  | 'program1'
  | 'program2'
  | 'program3'
  | 'results'
  | 'export';

/**
 * The meet's public results page, once the secretary has turned it on.
 *
 * Two keys because the read key is printed on paper as a QR code in the
 * paddock: whatever is in the QR cannot also be what authorises an update.
 * The write key never leaves the app except inside a publish request.
 */
export interface PublishConfig {
  readKey: string;
  writeKey: string;
  enabled: boolean;
  lastPublishedAt: string | null;
}

export interface MeetState {
  info: MeetInfo;
  phase: Phase;
  entries: Entry[];
  divisions: Division[];
  draws: ProgramDraw[]; // one per division per program once drawn
  /** Manual championship point overrides applied on the results screen. */
  overrides: Record<string, Partial<ChampAward>>;
  /** Null until the secretary publishes the meet. */
  publish: PublishConfig | null;
}

/** Final standing of one dog within its division. */
export interface Standing {
  entryId: string;
  place: number; // 1-based final placement in the division
  total: number;
  /** started program 1 */
  started: boolean;
  /** ran and finished every race of all three programs (no OC/DNF/DQ/ABS) */
  finishedAllRaces: boolean;
  /** completed all three programs (ran in each) */
  completedMeet: boolean;
  defeatedSomeone: boolean;
  isLeftover: boolean;
}

export interface ChampAward {
  brc: number;
  nbrc: number; // national breed points
  mrc: number;
  nmrc: number; // national mixed points
  trc: number;
  notes: string[];
}

export interface DivisionResults {
  divisionId: string;
  standings: Standing[];
  awards: Record<string, ChampAward>; // entryId -> awards
  eligibleEntryBreed: number | null;
  eligibleEntryMixed: number | null;
  startersForNational: number;
  explanations: string[];
}

export const JACKET_COLORS: Record<number, string> = {
  1: 'Red',
  2: 'Blue',
  3: 'White',
  4: 'Green',
};

export type Rng = () => number;
