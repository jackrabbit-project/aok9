import React from 'react';
import { MeetProvider, useMeet } from './store/meetStore';
import { GuideProvider } from './guide';
import { HomeScreen } from './ui/HomeScreen';
import { SetupScreen } from './ui/SetupScreen';
import { EntriesScreen } from './ui/EntriesScreen';
import { DivisionsScreen } from './ui/DivisionsScreen';
import { ProgramScreen } from './ui/ProgramScreen';
import { ResultsScreen } from './ui/ResultsScreen';
import { ExportScreen } from './ui/ExportScreen';
import type { Phase } from './domain/types';
import jackrabbitIcon from './assets/jackrabbit-icon-40.png';

const STEPS: { phase: Phase; label: string }[] = [
  { phase: 'setup', label: '1. Meet setup' },
  { phase: 'entries', label: '2. Entries' },
  { phase: 'divisions', label: '3. Divisions' },
  { phase: 'program1', label: '4. Program 1' },
  { phase: 'program2', label: '5. Program 2' },
  { phase: 'program3', label: '6. Program 3' },
  { phase: 'results', label: '7. Results' },
  { phase: 'export', label: '8. Export' },
];

function Shell() {
  const { state, dispatch, lastSaved } = useMeet();
  const phase = state.phase;
  const status = [
    state.info.meetId || null,
    `${state.entries.length} dogs`,
    lastSaved ? `saved ${lastSaved}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={() => dispatch({ type: 'setPhase', phase: 'home' })}>
          AOK9 Race Secretary
        </button>
        <nav className="steps">
          {STEPS.map((s) => (
            <button
              key={s.phase}
              className={`step ${phase === s.phase ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'setPhase', phase: s.phase })}
            >
              {s.label}
            </button>
          ))}
        </nav>
        {/* Phones get a picker instead. Eight buttons wrap to three rows there,
            and the header is sticky, so the nav was holding a third to nearly
            half of the screen permanently. CSS swaps which of the two shows. */}
        <label className="steps-picker">
          <span className="sr-only">Go to step</span>
          <select
            value={phase}
            onChange={(e) => dispatch({ type: 'setPhase', phase: e.target.value as Phase })}
          >
            <option value="home">Home</option>
            {STEPS.map((s) => (
              <option key={s.phase} value={s.phase}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="save-status">{status}</span>
      </header>
      <main>
        {phase === 'home' && <HomeScreen />}
        {phase === 'setup' && <SetupScreen />}
        {phase === 'entries' && <EntriesScreen />}
        {phase === 'divisions' && <DivisionsScreen />}
        {phase === 'program1' && <ProgramScreen program={1} />}
        {phase === 'program2' && <ProgramScreen program={2} />}
        {phase === 'program3' && <ProgramScreen program={3} />}
        {phase === 'results' && <ResultsScreen />}
        {phase === 'export' && <ExportScreen />}
      </main>
      <footer className="app-footer">
        {/* The home screen narrows its content to 1000px; the footer follows so
            the credit line starts level with whatever boxes are above it. */}
        <div className={`footer-inner ${phase === 'home' ? 'narrow' : ''}`}>
          v{__APP_VERSION__} (build {__BUILD_SHA__}) · Questions or a suspected error:{' '}
          <a href="mailto:info@gazehound.io">info@gazehound.io</a> ·{' '}
          <a
            className="jackrabbit-link"
            href="https://github.com/jackrabbit-project/jackrabbit"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={jackrabbitIcon} alt="" aria-hidden="true" />
            The Jackrabbit Project
          </a>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <GuideProvider>
      <MeetProvider>
        <Shell />
      </MeetProvider>
    </GuideProvider>
  );
}
