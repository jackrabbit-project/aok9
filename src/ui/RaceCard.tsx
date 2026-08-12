import React, { useState } from 'react';
import { useMeet } from '../store/meetStore';
import { scoreRace, validatePlaces } from '../domain/points';
import { redrawPosts } from '../domain/draw';
import { Jacket, Warn } from './common';
import type { Division, Entry, Race, RaceOutcome } from '../domain/types';

const STATUSES = ['OC', 'DNF', 'DQ', 'ABS'] as const;
const STATUS_LABEL: Record<string, string> = { OC: 'OC', DNF: 'DNF', DQ: 'DQ', ABS: 'SCR' };

export function RaceCard({
  race,
  division,
  entryMap,
  locked,
  swapMode,
  onSwapPick,
  swapPick,
}: {
  race: Race;
  division: Division;
  entryMap: Map<string, Entry>;
  locked: boolean;
  swapMode: boolean;
  onSwapPick: (entryId: string) => void;
  swapPick: string | null;
}) {
  const { dispatch } = useMeet();
  const [draft, setDraft] = useState<Record<string, RaceOutcome> | null>(null);
  const [err, setErr] = useState('');

  const outcomes = draft ?? race.outcomes;
  const points = race.finished ? scoreRace(race, division.ungraded) : null;

  const setOutcome = (entryId: string, oc: RaceOutcome | null) => {
    const next = { ...(draft ?? race.outcomes) };
    if (oc === null) delete next[entryId];
    else next[entryId] = oc;
    setDraft(next);
    setErr('');
  };

  const save = () => {
    const current = draft ?? race.outcomes;
    const missing = race.slots.filter((s) => !current[s.entryId]);
    if (missing.length > 0) {
      setErr(`No result for: ${missing.map((s) => entryMap.get(s.entryId)?.callName).join(', ')}`);
      return;
    }
    const places = Object.values(current)
      .filter((o): o is Extract<RaceOutcome, { kind: 'placed' }> => o.kind === 'placed')
      .map((o) => o.place);
    const v = validatePlaces(places);
    if (v) {
      setErr(v + ' (a DQ’d dog is left out of the placements — place the rest as if it had not run, 6.1.3)');
      return;
    }
    dispatch({ type: 'setRaceResult', raceId: race.id, outcomes: current, finished: true });
    setDraft(null);
    setErr('');
  };

  const slots = [...race.slots].sort((a, b) => (a.post ?? 9) - (b.post ?? 9));

  return (
    <div className={`race-card ${race.finished ? 'done' : ''}`}>
      <div className="race-head">
        <b>
          Race {race.raceNo}
          {race.isHP && <span className="badge hp">HIGH POINT</span>}
          {race.slots.length === 1 && <span className="badge">RUNS ALONE</span>}
        </b>
        <span className="race-flags">
          {!locked && (
            <button
              className="secondary sm"
              onClick={() => dispatch({ type: 'setRace', race: redrawPosts(race, Math.random) })}
            >
              Redraw posts
            </button>
          )}
          {locked && (
            <>
              <label className="row-check sm">
                <input
                  type="checkbox"
                  checked={race.rerun}
                  onChange={(e) => dispatch({ type: 'setRaceFlags', raceId: race.id, rerun: e.target.checked })}
                />
                rerun
              </label>
              <label className="row-check sm" title="6.5.1(b): split all points equally among participants">
                <input
                  type="checkbox"
                  checked={race.splitAllPoints}
                  onChange={(e) =>
                    dispatch({ type: 'setRaceFlags', raceId: race.id, splitAllPoints: e.target.checked })
                  }
                />
                split pts
              </label>
            </>
          )}
        </span>
      </div>
      <table className="tbl race-tbl">
        <tbody>
          {slots.map((slot) => {
            const e = entryMap.get(slot.entryId)!;
            const oc = outcomes[slot.entryId];
            return (
              <tr key={slot.entryId} className={swapPick === slot.entryId ? 'picked' : ''}>
                <td className="post-cell">
                  <Jacket post={slot.post} />
                </td>
                <td
                  className={swapMode && !locked ? 'swap-target' : ''}
                  onClick={() => swapMode && !locked && onSwapPick(slot.entryId)}
                >
                  <b>{e.callName}</b> <small>{e.breed}</small>
                </td>
                {locked && (
                  <td className="outcome-cell">
                    {race.slots.map((_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`pl sm ${oc?.kind === 'placed' && oc.place === p ? 'on' : ''}`}
                        onClick={() =>
                          setOutcome(slot.entryId, oc?.kind === 'placed' && oc.place === p ? null : { kind: 'placed', place: p })
                        }
                      >
                        {p}
                      </button>
                    ))}
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        className={`st sm ${oc?.kind === s ? 'on' : ''}`}
                        title={s === 'ABS' ? 'Scratched / did not run' : s}
                        onClick={() => setOutcome(slot.entryId, oc?.kind === s ? null : ({ kind: s } as RaceOutcome))}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </td>
                )}
                {points && (
                  <td className="pts-cell">{points[slot.entryId] ?? 0} pts</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {locked && (
        <div className="race-foot">
          <input
            className="note"
            placeholder="note (fouls, reruns…)"
            value={race.note}
            onChange={(e) => dispatch({ type: 'setRaceFlags', raceId: race.id, note: e.target.value })}
          />
          <button onClick={save} disabled={draft === null && race.finished}>
            {race.finished ? (draft ? 'Save changes' : 'Saved ✓') : 'Save race result'}
          </button>
        </div>
      )}
      {err && <Warn>{err}</Warn>}
    </div>
  );
}
