import React, { useMemo } from 'react';
import { useMeet } from '../store/meetStore';
import { fteFraction, meetsThreshold, newId, suggestDivisions, ungradedSuggested } from '../domain/divisions';
import { MAX_CHART_DOGS } from '../domain/chart';
import { entryGrade } from '../domain/draw';
import { Hint, Section, Warn } from './common';
import { wave } from './fmt';
import { PrintQr } from './Qr';
import type { Division } from '../domain/types';
import { Icon } from './icons';

export function DivisionsScreen() {
  const { state, dispatch } = useMeet();
  const entryMap = useMemo(() => new Map(state.entries.map((e) => [e.id, e])), [state.entries]);
  const active = state.entries.filter((e) => !e.preScratched);
  const assigned = new Set(state.divisions.flatMap((d) => d.entryIds));
  const unassigned = active.filter((e) => !assigned.has(e.id));
  const locked = state.draws.length > 0;
  const anyResults = state.draws.some((d) => d.races.some((r) => r.finished));

  const setDivisions = (divisions: Division[]) => dispatch({ type: 'setDivisions', divisions });

  const moveDog = (entryId: string, targetId: string) => {
    setDivisions(
      state.divisions.map((d) => {
        const without = {
          ...d,
          entryIds: d.entryIds.filter((id) => id !== entryId),
          leftoverIds: d.leftoverIds.filter((id) => id !== entryId),
        };
        if (d.id === targetId) return { ...without, entryIds: [...without.entryIds, entryId] };
        return without;
      })
    );
  };

  return (
    <div>
      {locked && (
        <Warn>
          {anyResults
            ? 'Racing has started — divisions are locked for the rest of the meet. A dog that cannot run is marked SCR in its race.'
            : 'Program 1 has been drawn, so divisions are locked. To change them, go to Program 1 and discard the draw — possible until the first result is saved — then draw again.'}
        </Warn>
      )}
      <Section
        title={`Divisions (${state.divisions.length})`}
        right={
          <div className="btn-row">
            <button
              disabled={locked}
              onClick={() => {
                const suggested = suggestDivisions(state.entries).map((d) => ({
                  ...d,
                  ungraded: ungradedSuggested(
                    d,
                    entryMap,
                    state.info.fteThreshold
                  ),
                }));
                setDivisions(suggested);
              }}
            >
              Auto-suggest divisions
            </button>
            <button
              className="secondary"
              disabled={locked}
              onClick={() =>
                setDivisions([
                  ...state.divisions,
                  {
                    id: newId('div'),
                    type: 'mixed',
                    name: `MIXED ${state.divisions.length + 1}`,
                    entryIds: [],
                    leftoverIds: [],
                    ungraded: false,
                  },
                ])
              }
            >
              + Empty division
            </button>
          </div>
        }
      >
        {state.divisions.length === 0 && (
          <Hint>
            Use <b>Auto-suggest</b>: breeds with 2+ dogs become breed divisions (4.1.5); everything
            else is pooled into a mixed division for you to arrange by size/speed/type (4.1.6).
          </Hint>
        )}
        <div className="division-grid">
          {state.divisions.map((d) => {
            const dogs = d.entryIds.map((id) => entryMap.get(id)!).filter(Boolean);
            // Counts below are of dogs that will run: a dog scratched before
            // racing stays listed but is not drawn.
            const runners = dogs.filter((x) => !x.preScratched);
            const frac = fteFraction(d, entryMap);
            const allowedUngraded = meetsThreshold(frac, state.info.fteThreshold);
            const breedDogs = runners.filter((x) => !d.leftoverIds.includes(x.id));
            const mainBreed = breedDogs[0]?.breed;
            const sameBreedLeftover = runners.some((x) => d.leftoverIds.includes(x.id) && x.breed === mainBreed);
            return (
              <div className="division-card" key={d.id}>
                <div className="division-head">
                  <input
                    className="division-name"
                    value={d.name}
                    disabled={locked}
                    onChange={(e) =>
                      dispatch({ type: 'updateDivision', id: d.id, patch: { name: e.target.value.toUpperCase() } })
                    }
                  />
                  <select
                    value={d.type}
                    disabled={locked}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateDivision',
                        id: d.id,
                        patch: { type: e.target.value as Division['type'], leftoverIds: [] },
                      })
                    }
                  >
                    <option value="breed">Breed</option>
                    <option value="mixed">Mixed</option>
                  </select>
                  <button
                    className="outline-danger sm"
                    disabled={locked}
                    aria-label={`Delete division ${d.name}`}
                    onClick={() => setDivisions(state.divisions.filter((x) => x.id !== d.id))}
                  >
                    Remove
                  </button>
                </div>
                <label className="row-check">
                  <input
                    type="checkbox"
                    checked={d.ungraded}
                    disabled={locked}
                    onChange={(e) =>
                      dispatch({ type: 'updateDivision', id: d.id, patch: { ungraded: e.target.checked } })
                    }
                  />
                  Ungraded races ({Math.round(frac * 100)}% FTE
                  {allowedUngraded ? ' — allowed per 4.4' : ' — below threshold'})
                </label>
                <ul className="dog-list">
                  {dogs.map((e) => (
                    <li key={e.id}>
                      <span>
                        <b>{e.callName}</b> <small>({e.breed})</small>
                        {d.leftoverIds.includes(e.id) && <span className="badge leftover">LEFTOVER</span>}
                        {e.preScratched && <span className="badge">SCRATCHED</span>}
                      </span>
                      <span className="dog-actions">
                        {d.type === 'breed' && (
                          <button
                            className={`title-chip sm ${d.leftoverIds.includes(e.id) ? 'on' : ''}`}
                            disabled={locked}
                            aria-pressed={d.leftoverIds.includes(e.id)}
                            title="Leftover: a dog of another breed running here, competing for mixed (MRC) points only (4.1.7)"
                            onClick={() =>
                              dispatch({
                                type: 'updateDivision',
                                id: d.id,
                                patch: {
                                  leftoverIds: d.leftoverIds.includes(e.id)
                                    ? d.leftoverIds.filter((x) => x !== e.id)
                                    : [...d.leftoverIds, e.id],
                                },
                              })
                            }
                          >
                            Leftover
                          </button>
                        )}
                        <select
                          value={d.id}
                          disabled={locked}
                          onChange={(ev) => moveDog(e.id, ev.target.value)}
                        >
                          {state.divisions.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </span>
                    </li>
                  ))}
                </ul>
                {d.ungraded && !allowedUngraded && (
                  <Warn>
                    Marked ungraded, but only {Math.round(frac * 100)}% of the dogs are first-time
                    entered. 4.4 allows ungraded races when at least{' '}
                    {state.info.fteThreshold >= 0.75 ? '¾' : '⅔'} are.
                  </Warn>
                )}
                {runners.length === 0 && dogs.length > 0 && (
                  <Warn>Every dog here is scratched — remove the division or move dogs into it before drawing.</Warn>
                )}
                {runners.length === 1 && (
                  <Warn>
                    Single dog: runs alone — no championship points; schooling meet if it runs all
                    three programs alone (4.2.2.4).
                  </Warn>
                )}
                {runners.length > MAX_CHART_DOGS && (
                  <Warn>Over {MAX_CHART_DOGS} dogs — Figure 8.1 has no row for this size.</Warn>
                )}
                {d.type === 'breed' && new Set(breedDogs.map((x) => x.breed)).size > 1 && (
                  <Warn>Breed division contains multiple breeds — mark extras as Leftover or make it mixed.</Warn>
                )}
                {d.type === 'breed' && breedDogs.length === 1 && runners.length > 1 && (
                  <Warn>
                    Only one dog of the breed — a breed division needs at least two (4.1.5). Run it
                    as a mixed division, or move the leftover elsewhere.
                  </Warn>
                )}
                {d.type === 'breed' && sameBreedLeftover && (
                  <Warn>
                    A dog of the division's own breed is marked Leftover. A leftover is a dog of a
                    different breed (4.1.7) — clear the mark so it earns breed points.
                  </Warn>
                )}
              </div>
            );
          })}
        </div>
        {unassigned.length > 0 && (
          <Warn>
            Unassigned dogs: {unassigned.map((e) => e.callName).join(', ')} — every active dog must
            be in a division before the draw.
          </Warn>
        )}
      </Section>

      {/* Mirrors what ProgramScreen requires before Draw Program 1, so a
          blocker surfaces here instead of after a wasted trip forward. */}
      <div className="btn-row sticky-actions">
        <button
          className="big"
          disabled={state.divisions.length === 0 || unassigned.length > 0}
          onClick={() => dispatch({ type: 'setPhase', phase: 'program1' })}
        >
          Continue to Program 1 →
        </button>
        <button
          className="secondary"
          disabled={state.divisions.length === 0}
          onClick={() => window.print()}
        >
          <Icon name="print" />
          Print divisions
        </button>
        {state.divisions.length === 0 && <Hint>Create at least one division first.</Hint>}
        {state.divisions.length > 0 && unassigned.length > 0 && (
          <Hint>Assign every active dog to a division before drawing.</Hint>
        )}
        {state.divisions.length > 0 && !state.publish?.enabled && (
          <Hint>Results online is off, so the sheet prints without a QR code. Turn it on in Setup.</Hint>
        )}
      </div>

      {/* Print-only divisions sheet: the first thing pinned to the board, and
          the one that carries the QR code for the rest of the day. */}
      {state.divisions.length > 0 && (
        <div className="print-only">
          <h1>
            {state.info.clubName} — {state.info.meetId} — {state.info.date}
          </h1>
          <h2>Divisions</h2>
          <PrintQr />
          {state.divisions.map((d) => {
            const dogs = d.entryIds.map((id) => entryMap.get(id)!).filter((e) => e && !e.preScratched);
            return (
              <div key={d.id} className="print-division">
                <h3>
                  {d.type === 'breed' ? 'Breed' : 'Mixed'} Division: {d.name}
                  {d.ungraded ? ' (ungraded)' : ''} — {dogs.length} dogs
                </h3>
                <table className="print-tbl">
                  <thead>
                    <tr>
                      <th>Dog</th>
                      <th>Breed</th>
                      {/* 3.2(b): the program lists entries by breed, WAVE, name of dog and owner. */}
                      <th>Owner</th>
                      <th>Grade / WAVE</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dogs.map((e) => {
                      const asMixed = d.type === 'mixed' || d.leftoverIds.includes(e.id);
                      const w = asMixed ? e.mwave : e.bwave;
                      return (
                        <tr key={e.id}>
                          <td>{e.callName}</td>
                          <td>{e.breed}</td>
                          <td>{e.owner ?? ''}</td>
                          <td>
                            {entryGrade(e, d)} / {w === null ? 'FTE' : wave(w)}
                          </td>
                          <td>
                            {[d.leftoverIds.includes(e.id) && 'Leftover', e.fte && 'FTE']
                              .filter(Boolean)
                              .join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
