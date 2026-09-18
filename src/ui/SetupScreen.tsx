import React, { useRef, useState } from 'react';
import { useMeet } from '../store/meetStore';
import { useGuide } from '../guide';
import { Hint, Section, Warn } from './common';
import { PublishPanel } from './PublishPanel';

export function SetupScreen() {
  const { state, dispatch } = useMeet();
  const { guide, importFile, resetToBundled } = useGuide();
  const guideFileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  return (
    <div>
      <Section title="Meet Information">
        <div className="form-grid">
          <label>
            Club name
            <input
              value={state.info.clubName}
              onChange={(e) => dispatch({ type: 'setInfo', info: { clubName: e.target.value } })}
              placeholder="e.g. Phoenix All-Breed Racing Club"
            />
          </label>
          <label>
            Meet ID
            <input
              value={state.info.meetId}
              onChange={(e) => dispatch({ type: 'setInfo', info: { meetId: e.target.value } })}
              placeholder="e.g. 2026-S54"
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={state.info.date}
              onChange={(e) => dispatch({ type: 'setInfo', info: { date: e.target.value } })}
            />
          </label>
          <label>
            Ungraded threshold (share of FTEs, rule book: 3/4)
            <select
              value={String(state.info.fteThreshold)}
              onChange={(e) =>
                dispatch({ type: 'setInfo', info: { fteThreshold: Number(e.target.value) } })
              }
            >
              <option value="0.75">3/4 (rule book 4.4)</option>
              <option value="0.6667">2/3</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Grading Guide">
        <p>
          Loaded: <b>{guide.source}</b> — {guide.dogs.length} dogs. Upload a newer official guide
          to replace it (same spreadsheet layout).
        </p>
        <p className="muted small">
          The current guide is published on the{' '}
          <a
            href="https://www.aok9racing.com/documents--forms.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            AOK9 Documents &amp; Forms
          </a>{' '}
          page.
        </p>
        <div className="btn-row">
          <button onClick={() => guideFileRef.current?.click()}>Upload Grading Guide (.xlsx)</button>
          <button className="secondary" onClick={resetToBundled}>
            Reset to bundled copy
          </button>
        </div>
        <input
          ref={guideFileRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importFile(f);
              setMsg(`Imported ${f.name}`);
            } catch (err) {
              setMsg(String(err));
            }
            e.target.value = '';
          }}
        />
        {/* A refused guide is the one message here that matters -- the layout
            guard naming a column that moved -- so it must not read as an aside. */}
        {msg && (msg.startsWith('Error') ? <Warn>{msg}</Warn> : <Hint>{msg}</Hint>)}
      </Section>

      <PublishPanel />

      <div className="btn-row sticky-actions">
        <button className="big" onClick={() => dispatch({ type: 'setPhase', phase: 'entries' })}>
          Continue to Entries →
        </button>
      </div>
    </div>
  );
}
