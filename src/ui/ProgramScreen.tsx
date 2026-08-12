import React, { useMemo, useState } from 'react';
import { buildDivisionDraw, buildProgramDraws, useMeet } from '../store/meetStore';
import { totalsThrough } from '../domain/rotation';
import { entryGrade } from '../domain/draw';
import { JACKET_COLORS } from '../domain/types';
import { Hint, Section, Warn } from './common';
import { RaceCard } from './RaceCard';

export function ProgramScreen({ program }: { program: 1 | 2 | 3 }) {
  const { state, dispatch } = useMeet();
  const entryMap = useMemo(() => new Map(state.entries.map((e) => [e.id, e])), [state.entries]);
  const [swapPick, setSwapPick] = useState<{ divisionId: string; entryId: string } | null>(null);

  const draws = state.draws.filter((d) => d.program === program);
  const prevDraws = state.draws.filter((d) => d.program === program - 1);
  const prevComplete =
    program === 1 || (prevDraws.length > 0 && prevDraws.every((d) => d.races.every((r) => r.finished)));
  const drawn = draws.length > 0;
  const locked = drawn && draws.every((d) => d.locked);
  const allFinished = drawn && draws.every((d) => d.races.every((r) => r.finished));

  const unassigned = state.entries.filter(
    (e) => !e.preScratched && !state.divisions.some((d) => d.entryIds.includes(e.id))
  );
  const canDraw = state.divisions.length > 0 && unassigned.length === 0 && prevComplete;

  const handleSwapPick = (divisionId: string) => (entryId: string) => {
    if (!swapPick || swapPick.divisionId !== divisionId) {
      setSwapPick({ divisionId, entryId });
      return;
    }
    if (swapPick.entryId !== entryId) {
      dispatch({ type: 'swapDogs', program, divisionId, a: swapPick.entryId, b: entryId });
    }
    setSwapPick(null);
  };

  return (
    <div>
      {!drawn && (
        <Section title={`Program ${program} — Draw`}>
          {!prevComplete && <Warn>Finish all races of Program {program - 1} first.</Warn>}
          {unassigned.length > 0 && <Warn>Assign all dogs to divisions first.</Warn>}
          <p>
            {program === 1
              ? 'Groups each division by WAVE (graded) or random draw (ungraded), splits races per Figure 8.1 and draws post positions.'
              : 'Drops grades, ranks every dog by points earned so far, regroups races per Figure 8.1 (ties per 4.3.4.1) and draws new post positions.'}
          </p>
          <button
            className="big"
            disabled={!canDraw}
            onClick={() =>
              dispatch({
                type: 'setProgramDraws',
                program,
                draws: buildProgramDraws(state, program, Math.random),
              })
            }
          >
            Draw Program {program}
          </button>
        </Section>
      )}

      {drawn &&
        state.divisions.map((division) => {
          const draw = draws.find((d) => d.divisionId === division.id);
          if (!draw) return null;
          const totals = totalsThrough(division, state.draws, program);
          const ranked = Object.entries(totals)
            .filter(([id]) => draw.races.some((r) => r.slots.some((s) => s.entryId === id)))
            .sort((a, b) => b[1] - a[1]);
          return (
            <Section
              key={division.id}
              title={
                <>
                  {division.type === 'breed' ? 'Breed' : 'Mixed'}: {division.name}
                  {division.ungraded && <span className="badge">UNGRADED</span>}
                </>
              }
              right={
                !draw.locked ? (
                  <div className="btn-row">
                    <button
                      className="secondary"
                      onClick={() =>
                        dispatch({
                          type: 'setDivisionDraw',
                          program,
                          divisionId: division.id,
                          draw: buildDivisionDraw(state, program, division.id, Math.random),
                        })
                      }
                    >
                      Redraw division
                    </button>
                  </div>
                ) : undefined
              }
            >
              {draw.tieDecisions.length > 0 && (
                <div className="tie-box">
                  <b>Tie decisions (4.3.4.1):</b>
                  <ul>
                    {draw.tieDecisions.map((t, i) => (
                      <li key={i}>{t.explanation}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!draw.locked && (
                <Hint>
                  Review the groups. Click two dogs to swap them between races if the committee
                  adjusts the draw; redraw posts per race as needed. Races run in order — Race 1
                  (lowest) first{draw.races.length > 1 ? `, Race ${draw.races.length} (top) last` : ''}. Then lock to enter results.
                </Hint>
              )}
              <div className="race-grid">
                {draw.races.map((race) => (
                  <RaceCard
                    key={race.id}
                    race={race}
                    division={division}
                    entryMap={entryMap}
                    locked={draw.locked}
                    swapMode={!draw.locked}
                    onSwapPick={handleSwapPick(division.id)}
                    swapPick={swapPick?.divisionId === division.id ? swapPick.entryId : null}
                  />
                ))}
              </div>
              {draw.locked && (
                <details className="totals">
                  <summary>Running totals after Program {program}</summary>
                  <table className="tbl">
                    <tbody>
                      {ranked.map(([id, pts]) => (
                        <tr key={id}>
                          <td>{entryMap.get(id)?.callName}</td>
                          <td>{pts} pts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </Section>
          );
        })}

      {drawn && !locked && (
        <div className="btn-row sticky-actions">
          <button className="big" onClick={() => dispatch({ type: 'lockProgram', program })}>
            Lock Program {program} & print / enter results
          </button>
        </div>
      )}
      {locked && (
        <div className="btn-row sticky-actions">
          <button className="secondary" onClick={() => window.print()}>
            Print program sheet
          </button>
          {allFinished && program < 3 && (
            <button
              className="big"
              onClick={() => dispatch({ type: 'setPhase', phase: `program${(program + 1) as 2 | 3}` })}
            >
              Continue to Program {program + 1} →
            </button>
          )}
          {allFinished && program === 3 && (
            <button className="big" onClick={() => dispatch({ type: 'setPhase', phase: 'results' })}>
              Final results →
            </button>
          )}
        </div>
      )}

      {/* Print-only race program */}
      {drawn && (
        <div className="print-only">
          <h1>
            {state.info.clubName} — {state.info.meetId} — {state.info.date}
          </h1>
          <h2>Program {program} race sheet</h2>
          {state.divisions.map((division) => {
            const draw = draws.find((d) => d.divisionId === division.id);
            if (!draw) return null;
            return (
              <div key={division.id} className="print-division">
                <h3>
                  {division.type === 'breed' ? 'Breed' : 'Mixed'} Division: {division.name}
                  {division.ungraded ? ' (ungraded)' : ''}
                </h3>
                {draw.races.map((race) => (
                  <table className="print-tbl" key={race.id}>
                    <thead>
                      <tr>
                        <th colSpan={4}>
                          Race {race.raceNo}
                          {race.isHP ? ' — HIGH POINT' : ''}
                        </th>
                      </tr>
                      <tr>
                        <th>Post</th>
                        <th>Jacket</th>
                        <th>Dog</th>
                        <th>{program === 1 ? 'Grade / WAVE' : 'Points so far'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...race.slots]
                        .sort((a, b) => (a.post ?? 9) - (b.post ?? 9))
                        .map((slot) => {
                          const e = entryMap.get(slot.entryId)!;
                          const totals = totalsThrough(division, state.draws, program - 1);
                          return (
                            <tr key={slot.entryId}>
                              <td>{slot.post}</td>
                              <td>{slot.post ? JACKET_COLORS[slot.post] : ''}</td>
                              <td>
                                {e.callName} ({e.breed})
                              </td>
                              <td>
                                {program === 1
                                  ? `${entryGrade(e, division)} / ${
                                      (division.type === 'mixed' || division.leftoverIds.includes(e.id)
                                        ? e.mwave
                                        : e.bwave) ?? 'FTE'
                                    }`
                                  : `${totals[slot.entryId] ?? 0}`}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
