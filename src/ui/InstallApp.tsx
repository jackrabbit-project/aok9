// "Get the app" -- the home-screen route to installing AOK9.
//
// Browsers do offer this themselves, but the affordance is a small icon buried
// in the address bar that most secretaries will never find, and Safari offers
// nothing at all. Since installing is what makes the app dependable at a field
// with no signal, it gets a plain button here.

import { useEffect, useState } from 'react';

/** Not in lib.dom yet; Chromium-only. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, told apart by touch support.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates display-mode and is still what it sets.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallApp() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      // Suppress the browser's own mini-infobar so the button below is the
      // single, obvious way in.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      // The event is single-use whatever the outcome.
      setDeferred(null);
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <p className="muted small">
        Running as an installed app — it will open at the field with no signal.
      </p>
    );
  }

  if (deferred) {
    return (
      <>
        <p>
          Install AOK9 on this device. It gets its own icon, opens without the browser bar, and
          works with no internet — which is what you want at a field.
        </p>
        <div className="btn-row">
          <button onClick={() => void install()} disabled={busy}>
            {busy ? 'Installing…' : 'Install AOK9'}
          </button>
        </div>
      </>
    );
  }

  if (isIOS()) {
    return (
      <>
        <p>
          Add AOK9 to your home screen so it opens at the field with no signal. Tap the{' '}
          <b>Share</b> button, then <b>Add to Home Screen</b>.
        </p>
      </>
    );
  }

  // Desktop Firefox, or Chrome that has already dealt with the prompt this
  // session. Point at the browser's own control rather than show a dead button.
  return (
    <p className="muted small">
      To install, use your browser menu — look for <b>Install</b> or <b>Add to Home screen</b>.
      Once installed it opens with no internet.
    </p>
  );
}
