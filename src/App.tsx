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
import { RELEASES_URL } from './ui/common';
import { STEPS, stepStatus } from './ui/steps';
import type { Phase } from './domain/types';
import { JackrabbitMark } from './ui/JackrabbitMark';

function Shell() {
  const { state, dispatch, lastSaved } = useMeet();
  const phase = state.phase;
  const progress = stepStatus(state);
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
        <div className="app-header-inner">
          <button className="brand" onClick={() => dispatch({ type: 'setPhase', phase: 'home' })}>
            <JackrabbitMark />
            <span className="brand-text">
              <span className="brand-name">AOK9 Race Secretary</span>
              <span className="brand-sub">Sprint meets · Rule Book v3.0</span>
            </span>
          </button>
          {/* Number and name are separate so the tab can style them differently.
              "4. Program 1" puts two unrelated numbers side by side -- the step's
              place in the sequence and the program's own number -- and they read
              as one. The number is only position, so it is set back and the name
              leads; a finished step shows a check in its place instead. */}
          <nav className="steps">
            {STEPS.map((s) => {
              const st = progress[s.phase];
              return (
                <button
                  key={s.phase}
                  className={`step ${st === 'current' ? 'active' : ''} ${st === 'done' ? 'done' : ''}`}
                  // Two spans with a CSS gap read as "4Program 1" to a screen
                  // reader, so spell the name out and mark which one is current.
                  aria-label={`Step ${s.n}: ${s.name}${st === 'done' ? ' (done)' : ''}`}
                  aria-current={st === 'current' ? 'step' : undefined}
                  onClick={() => dispatch({ type: 'setPhase', phase: s.phase })}
                >
                  <span className="step-n" aria-hidden="true">
                    {st === 'done' ? '✓' : s.n}
                  </span>
                  <span className="step-name">{s.name}</span>
                </button>
              );
            })}
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
                  {progress[s.phase] === 'done' ? '✓' : s.n}. {s.name}
                </option>
              ))}
            </select>
          </label>
          <span className="save-status">{status}</span>
        </div>
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
          v{__APP_VERSION__} (build {__BUILD_SHA__}) ·{' '}
          {/* Most secretaries will never open the repo, so the release notes
              need a way in from inside the app. */}
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
            What&rsquo;s new
          </a>{' '}
          · Questions or a suspected error:{' '}
          <a href="mailto:info@gazehound.io">info@gazehound.io</a> ·{' '}
          <a
            className="jackrabbit-link"
            href="https://github.com/jackrabbit-project/jackrabbit"
            target="_blank"
            rel="noopener noreferrer"
          >
            <JackrabbitMark />
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
