import React, { useMemo } from 'react';
import { useMeet } from '../store/meetStore';
import { computeDivisionResults, divisionTrophies } from '../domain/championship';
import { projectWaves } from '../domain/update';
import { entryGrade } from '../domain/draw';
import { Section, Table, Warn } from './common';
import { pts, wave } from './fmt';
import type { ChampAward } from '../domain/types';

const AWARD_KEYS: (keyof Omit<ChampAward, 'notes'>)[] = ['brc', 'nbrc', 'mrc', 'nmrc', 'trc'];
const AWARD_LABEL: Record<string, string> = {
  brc: 'BRC',
  nbrc: 'Nat. Breed',
  mrc: 'MRC',
  nmrc: 'Nat. Mixed',
  trc: 'TRC',
};

export function ResultsScreen() {
  const { state, dispatch } = useMeet();
  const entryMap = useMemo(() => new Map(state.entries.map((e) => [e.id, e])), [state.entries]);

  const incomplete = state.divisions.some((division) =>
    state.draws
      .filter((d) => d.divisionId === division.id)
      .some((d) => d.races.some((r) => !r.finished))
  );
  const programsMissing = state.draws.filter((d) => d.program === 3).length === 0;

  return (
    <div>
      {(incomplete || programsMissing) && (
        <Warn>
          The meet is not finished ({programsMissing ? 'program 3 not drawn' : 'unfinished races'}) —
          results below are provisional. All planned programs must be completed for an official meet
          (4.1.3).
        </Warn>
      )}

      {state.divisions.map((division) => {
        const res = computeDivisionResults(division, state.draws, entryMap);
        const waves = projectWaves(division, state.draws, entryMap);
        const trophies = divisionTrophies(res.standings, entryMap, (e) => entryGrade(e, division));
        if (res.standings.length === 0) return null;
        return (
          <Section
            key={division.id}
            title={
              <>
                {division.type === 'breed' ? 'Breed' : 'Mixed'}: {division.name}
                {division.ungraded && <span className="badge">UNGRADED</span>}
              </>
            }
          >
            <Table>
              <thead>
                <tr>
                  <th className="num">Place</th>
                  <th>Dog</th>
                  <th className="num">Score</th>
                  {AWARD_KEYS.map((k) => (
                    <th key={k} className="num">
                      {AWARD_LABEL[k]}
                    </th>
                  ))}
                  <th className="col-wide num">New WAVE</th>
                  <th className="col-wide">Flags</th>
                </tr>
              </thead>
              <tbody>
                {res.standings.map((s) => {
                  const e = entryMap.get(s.entryId)!;
                  const computed = res.awards[s.entryId];
                  const ov = state.overrides[s.entryId] ?? {};
                  const w = waves.find((x) => x.entryId === s.entryId);
                  const flags = [
                    !s.completedMeet && 'incomplete',
                    !s.finishedAllRaces && s.completedMeet && 'OC/DNF',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr key={s.entryId}>
                      <td className="num">{s.place}</td>
                      <td>
                        <b>{e.callName}</b>
                        {division.leftoverIds.includes(s.entryId) && (
                          <span className="badge leftover">LEFTOVER</span>
                        )}
                        {/* New WAVE and flags leave the columns on a phone and
                            ride here instead. */}
                        <span className="subline">
                          WAVE {wave(w?.newWave)}
                          {w && w.oldWave !== null ? ` (was ${wave(w.oldWave)})` : ''}
                          {flags ? ` · ${flags}` : ''}
                        </span>
                      </td>
                      <td className="num">
                        <b>{pts(s.total)}</b>
                      </td>
                      {AWARD_KEYS.map((k) => {
                        const val = (ov[k] ?? computed[k]) as number;
                        const overridden = ov[k] !== undefined && ov[k] !== computed[k];
                        return (
                          <td key={k} className="num">
                            <input
                              className={`award ${overridden ? 'overridden' : ''}`}
                              type="number"
                              step="0.25"
                              min="0"
                              value={val}
                              aria-label={`${e.callName}: ${AWARD_LABEL[k]} points`}
                              title={overridden ? `edited — computed: ${computed[k]}` : 'computed value (editable)'}
                              onChange={(ev) => {
                                const num = Number(ev.target.value);
                                dispatch({
                                  type: 'setOverride',
                                  entryId: s.entryId,
                                  patch: num === computed[k] ? { [k]: undefined } : { [k]: num },
                                });
                              }}
                            />
                            {overridden && <span className="edited">edited</span>}
                          </td>
                        );
                      })}
                      <td className="col-wide num">
                        {wave(w?.newWave)}
                        {w && w.oldWave !== null && <small> (was {wave(w.oldWave)})</small>}
                      </td>
                      <td className="col-wide flags">{flags}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="trophies">
              <b>Trophies (5.1):</b> High Score: <b>{trophies.highScore ?? '—'}</b>
              {' · '}High Score Opposite Sex: <b>{trophies.highScoreOppositeSex ?? '—'}</b>
              {' · '}High Score FTE: <b>{trophies.highScoreFTE ?? '—'}</b>
              {' · '}Per grade:{' '}
              {Object.entries(trophies.highScorePerGrade)
                .map(([g, n]) => `${g}: ${n}`)
                .join(', ') || '—'}
            </div>
            <details>
              <summary>How points were calculated</summary>
              <ul className="explain">
                {res.explanations.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </details>
          </Section>
        );
      })}

      <div className="btn-row sticky-actions">
        <button className="big" onClick={() => dispatch({ type: 'setPhase', phase: 'export' })}>
          Continue to Export →
        </button>
      </div>
    </div>
  );
}
