import React, { useMemo } from 'react';
import { useMeet } from '../store/meetStore';
import { fteFraction, newId, suggestDivisions, ungradedSuggested } from '../domain/divisions';
import { MAX_CHART_DOGS } from '../domain/chart';
import { Hint, Section, Warn } from './common';
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
                    className="danger sm"
                    disabled={locked}
                    onClick={() => setDivisions(state.divisions.filter((x) => x.id !== d.id))}
                  >
                    ✕
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
                            className="secondary sm"
                            disabled={locked}
                            title="Leftover dog: competes for mixed (MRC) points only (4.1.7)"
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
                            L
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
        {state.divisions.length === 0 && <Hint>Create at least one division first.</Hint>}
        {state.divisions.length > 0 && unassigned.length > 0 && (
          <Hint>Assign every active dog to a division before drawing.</Hint>
        )}
      </div>
    </div>
  );
}
