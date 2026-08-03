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

/* Number and name are separate so the tab can style them differently.
   "4. Program 1" puts two unrelated numbers side by side -- the step's place
   in the sequence and the program's own number -- and they read as one. The
   step number is only position, so it is set back and the name leads. */
const STEPS: { phase: Phase; n: number; name: string }[] = [
  { phase: 'setup', n: 1, name: 'Meet setup' },
  { phase: 'entries', n: 2, name: 'Entries' },
  { phase: 'divisions', n: 3, name: 'Divisions' },
  { phase: 'program1', n: 4, name: 'Program 1' },
  { phase: 'program2', n: 5, name: 'Program 2' },
  { phase: 'program3', n: 6, name: 'Program 3' },
  { phase: 'results', n: 7, name: 'Results' },
  { phase: 'export', n: 8, name: 'Export' },
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
              // Two spans with a CSS gap read as "4Program 1" to a screen
              // reader, so spell the name out and mark which one is current.
              aria-label={`Step ${s.n}: ${s.name}`}
              aria-current={phase === s.phase ? 'step' : undefined}
              onClick={() => dispatch({ type: 'setPhase', phase: s.phase })}
            >
              <span className="step-n">{s.n}</span>
              <span className="step-name">{s.name}</span>
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
                {s.n}. {s.name}
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
