// The shape of a meet as published to its public results page.
//
// Shared by the app (which builds it) and the Pages Function (which renders
// it), so this file must stay free of anything browser- or worker-specific.
//
// What is here is what the paddock board shows: call names, breeds, the
// draw, results and points. What is deliberately not here: owners, reg
// numbers, WAVEs, sex, and anything the secretary typed into a note.

export type PublicResult = '1st' | '2nd' | '3rd' | '4th' | 'OC' | 'DNF' | 'DQ' | 'SCR';

export interface PublicSlot {
  post: number | null;
  jacket: string; // colour name, or '' before the post draw
  name: string;
  breed: string;
  result?: PublicResult;
  points?: number;
}

export interface PublicRace {
  raceNo: number;
  isHP: boolean;
  finished: boolean;
  slots: PublicSlot[];
}

export interface PublicProgram {
  program: 1 | 2 | 3;
  /** Every race of this program scored. */
  complete: boolean;
  races: PublicRace[];
}

export interface PublicStanding {
  place: number;
  name: string;
  breed: string;
  total: number;
  brc: number;
  nbrc: number;
  mrc: number;
  nmrc: number;
  trc: number;
  leftover: boolean;
  incomplete: boolean;
}

export interface PublicDivision {
  name: string;
  type: 'breed' | 'mixed';
  ungraded: boolean;
  dogs: { name: string; breed: string; leftover: boolean; fte: boolean }[];
  /** Locked programs only, in order. A draw that is still being adjusted is not shown. */
  programs: PublicProgram[];
  /** Points so far, after the latest fully scored program. */
  totals: { name: string; total: number }[];
  /** Present once the division's third program is fully scored. */
  standings: PublicStanding[] | null;
}

export interface PublicMeet {
  v: 1;
  updatedAt: string;
  app: string;
  info: { clubName: string; meetId: string; date: string };
  /** One line saying how far the meet has got, for the top of the page. */
  status: string;
  divisions: PublicDivision[];
}
