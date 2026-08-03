import React, { useMemo, useState } from 'react';
import { blankFteEntry, entryFromGuide, useMeet } from '../store/meetStore';
import { useGuide } from '../guide';
import { gradeForWave } from '../domain/wave';
import { Hint, Section, Warn } from './common';
import type { Entry, Grade, Sex } from '../domain/types';

export function EntriesScreen() {
  const { state, dispatch } = useMeet();
  const { guide } = useGuide();
  const [q, setQ] = useState('');
  const [fte, setFte] = useState<Entry | null>(null);

  const enteredRegNos = useMemo(
    () => new Set(state.entries.map((e) => e.regNo).filter(Boolean)),
    [state.entries]
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return guide.dogs
      .filter(
        (d) =>
          d.callName.toLowerCase().includes(term) ||
          d.regNo.toLowerCase().includes(term) ||
          (d.breed ?? '').toLowerCase().includes(term) ||
          (d.owner ?? '').toLowerCase().includes(term)
      )
      .slice(0, 25);
  }, [q, guide]);

  // Title status is guessed from the guide's accumulated points, which cannot
  // always distinguish "earned 12 points" from "holds the title". A wrong value
  // changes the eligible entry and silently redistributes championship points
  // (5.2/5.3), so the secretary must be able to correct it.
  const TITLES = [
    { key: 'hasBRC', label: 'BRC' },
    { key: 'hasSBRC', label: 'SBRC' },
    { key: 'hasMRC', label: 'MRC' },
    { key: 'hasSMRC', label: 'SMRC' },
  ] as const;

  return (
    <div>
      <Section title={`Entries (${state.entries.length})`}>
        {state.entries.length === 0 && <Hint>No dogs entered yet. Search the guide below or add an FTE dog.</Hint>}
        {state.entries.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Reg#</th>
                <th>Call name</th>
                <th>Breed</th>
                <th>Sex</th>
                <th>BWAVE</th>
                <th>MWAVE</th>
                <th>Grade</th>
                <th>Titles</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.entries.map((e) => (
                <tr key={e.id} className={e.preScratched ? 'scratched' : ''}>
                  <td>{e.regNo ?? <i>FTE</i>}</td>
                  <td>
                    <b>{e.callName}</b>
                    {e.fte && <span className="badge fte">FTE</span>}
                  </td>
                  <td>{e.breed}</td>
                  <td>
                    <select
                      value={e.sex}
                      onChange={(ev) =>
                        dispatch({ type: 'updateEntry', id: e.id, patch: { sex: ev.target.value as Sex } })
                      }
                    >
                      <option value="">?</option>
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </td>
                  <td>{e.bwave ?? '—'}</td>
                  <td>{e.mwave ?? '—'}</td>
                  <td>
                    {e.fte ? (
                      <select
                        value={e.fteGrade}
                        title="FTE insertion grade (4.3.1.3): D default, C via schooling, B max from oval record"
                        onChange={(ev) =>
                          dispatch({
                            type: 'updateEntry',
                            id: e.id,
                            patch: { fteGrade: ev.target.value as Grade },
                          })
                        }
                      >
                        <option value="D">D</option>
                        <option value="C">C</option>
                        <option value="B">B</option>
                      </select>
                    ) : (
                      gradeForWave(e.bwave ?? e.mwave)
                    )}
                  </td>
                  <td className="title-toggles">
                    {TITLES.map((t) => (
                      <button
                        key={t.key}
                        className={`title-chip sm ${e[t.key] ? 'on' : ''}`}
                        title={`${e[t.key] ? 'Remove' : 'Mark as'} ${t.label} champion of record`}
                        onClick={() =>
                          dispatch({ type: 'updateEntry', id: e.id, patch: { [t.key]: !e[t.key] } })
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </td>
                  <td>{e.owner ?? ''}</td>
                  <td className="btn-cell">
                    <button
                      className="secondary sm"
                      title="Scratch before racing (fees per 1.9)"
                      onClick={() =>
                        dispatch({ type: 'updateEntry', id: e.id, patch: { preScratched: !e.preScratched } })
                      }
                    >
                      {e.preScratched ? 'Unscratch' : 'Scratch'}
                    </button>
                    <button
                      className="danger sm"
                      onClick={() => dispatch({ type: 'removeEntry', id: e.id })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {state.entries.some((e) => !e.sex && !e.preScratched) && (
          <Warn>Some dogs have no sex recorded — needed for the High Score Opposite Sex award.</Warn>
        )}
        {state.entries.length > 0 && (
          <Hint>
            Titles are pre-filled from the Grading Guide point columns and may be wrong — click a
            chip to correct it. Champion status decides the eligible entry, so it changes how BRC
            and MRC points are shared out (5.2, 5.3).
          </Hint>
        )}
      </Section>

      <Section title="Add from Grading Guide">
        <input
          className="search"
          placeholder="Search by call name, reg#, breed or owner (min 2 letters)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length > 0 && (
          <table className="tbl">
            <tbody>
              {results.map((d) => {
                const entered = enteredRegNos.has(d.regNo);
                return (
                  <tr key={d.regNo}>
                    <td>{d.regNo}</td>
                    <td>
                      <b>{d.callName}</b>
                    </td>
                    <td>{d.breed}</td>
                    <td>B:{d.bwave ?? '—'} M:{d.mwave ?? '—'}</td>
                    <td>{d.owner}</td>
                    <td>
                      <button
                        className="sm"
                        disabled={entered}
                        onClick={() => dispatch({ type: 'addEntry', entry: entryFromGuide(d) })}
                      >
                        {entered ? 'Entered' : 'Enter'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="Add First Time Entered (FTE) dog"
        right={
          !fte && (
            <button onClick={() => setFte(blankFteEntry())}>+ New FTE dog</button>
          )
        }
      >
        {fte && (
          <div className="form-grid">
            <label>
              Call name*
              <input value={fte.callName} onChange={(e) => setFte({ ...fte, callName: e.target.value })} />
            </label>
            <label>
              Breed / mix type*
              <input
                value={fte.breed}
                placeholder="e.g. WHIPPET or TERRIER MIX"
                onChange={(e) => setFte({ ...fte, breed: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              Sex
              <select value={fte.sex} onChange={(e) => setFte({ ...fte, sex: e.target.value as Sex })}>
                <option value="">?</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label>
              Registered name
              <input
                value={fte.registeredName ?? ''}
                onChange={(e) => setFte({ ...fte, registeredName: e.target.value || null })}
              />
            </label>
            <label>
              Owner
              <input value={fte.owner ?? ''} onChange={(e) => setFte({ ...fte, owner: e.target.value || null })} />
            </label>
            <label>
              Reg# (if issued)
              <input value={fte.regNo ?? ''} onChange={(e) => setFte({ ...fte, regNo: e.target.value || null })} />
            </label>
            <label>
              Initial grade (4.3.1.3)
              <select
                value={fte.fteGrade}
                onChange={(e) => setFte({ ...fte, fteGrade: e.target.value as Grade })}
              >
                <option value="D">D (default)</option>
                <option value="C">C (schooling races)</option>
                <option value="B">B (oval record, max)</option>
              </select>
            </label>
            <div className="btn-row">
              <button
                disabled={!fte.callName.trim() || !fte.breed.trim()}
                onClick={() => {
                  dispatch({ type: 'addEntry', entry: fte });
                  setFte(null);
                }}
              >
                Add dog
              </button>
              <button className="secondary" onClick={() => setFte(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <Hint>
          FTE dogs must have completed a qualifying run for a racing license (1.10.1). Grade C/B
          insertion only per 4.3.1.3 (schooling results / oval record).
        </Hint>
      </Section>

      {/* Every other step ends with a way forward; this one only had the tabs. */}
      <div className="btn-row sticky-actions">
        <button
          className="big"
          disabled={state.entries.length === 0}
          onClick={() => dispatch({ type: 'setPhase', phase: 'divisions' })}
        >
          Continue to Divisions →
        </button>
        {state.entries.length === 0 && <Hint>Enter at least one dog first.</Hint>}
      </div>
    </div>
  );
}
