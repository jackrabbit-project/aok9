import React, { useMemo } from 'react';
import { useMeet } from '../store/meetStore';
import { fteFraction, newId, suggestDivisions, ungradedSuggested } from '../domain/divisions';
import { MAX_CHART_DOGS } from '../domain/chart';
import { entryGrade } from '../domain/draw';
import { Hint, Section, Warn } from './common';
import { wave } from './fmt';
import { PrintQr } from './Qr';
import type { Division } from '../domain/types';

export function DivisionsScreen() {
  const { state, dispatch } = useMeet();
  const entryMap = useMemo(() => new Map(state.entries.map((e) => [e.id, e])), [state.entries]);
  const active = state.entries.filter((e) => !e.preScratched);
  const assigned = new Set(state.divisions.flatMap((d) => d.entryIds));
  const unassigned = active.filter((e) => !assigned.has(e.id));
  const locked = state.draws.length > 0;

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
          Racing has started — divisions are locked. Start a new draw of Program 1 only if you
          really need to change them (results will be kept but may no longer match).
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
            const frac = fteFraction(d, entryMap);
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
                  {frac >= state.info.fteThreshold ? ' — allowed per 4.4' : ' — below threshold'})
                </label>
                <ul className="dog-list">
                  {dogs.map((e) => (
                    <li key={e.id}>
                      <span>
                        <b>{e.callName}</b> <small>({e.breed})</small>
                        {d.leftoverIds.includes(e.id) && <span className="badge leftover">LEFTOVER</span>}
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
                {dogs.length === 1 && (
                  <Warn>
                    Single dog: runs alone — no championship points; schooling meet if it runs all
                    three programs alone (4.2.2.4).
                  </Warn>
                )}
                {dogs.length > MAX_CHART_DOGS && (
                  <Warn>Over {MAX_CHART_DOGS} dogs — Figure 8.1 has no row for this size.</Warn>
                )}
                {d.type === 'breed' && new Set(dogs.filter((x) => !d.leftoverIds.includes(x.id)).map((x) => x.breed)).size > 1 && (
                  <Warn>Breed division contains multiple breeds — mark extras as Leftover (L) or make it mixed.</Warn>
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
