// Nudge for iOS, which never offers to install a web app by itself.
//
// Chrome and Edge surface their own install control, and Android prompts. Only
// Safari leaves the user to find Share -> Add to Home Screen, and installing is
// what makes the app reliably available at a field with no signal -- so on iOS,
// and only there, say so once.

import { useState } from 'react';

const DISMISSED_KEY = 'aok9.installHintDismissed';

function isIOS(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, distinguished by touch support.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates display-mode and is still what it sets.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dismissed || !isIOS() || isStandalone()) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private browsing can refuse writes; hiding for this session is enough.
    }
    setDismissed(true);
  }

  return (
    <div className="install-hint">
      <span>
        <strong>Add AOK9 to your home screen</strong> so it opens at the field without a signal.
        Tap Share, then <em>Add to Home Screen</em>.
      </span>
      <button type="button" className="secondary" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}
