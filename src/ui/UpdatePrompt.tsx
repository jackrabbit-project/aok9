// Offers a newly deployed version. Never applies one on its own.
//
// The service worker downloads an update in the background, but swapping it in
// reloads the page. A secretary part-way through scoring a meet must not have
// that happen to them, so the new version waits here until they say when.

import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-prompt" role="status">
      <span className="update-prompt-text">
        A new version of AOK9 is ready.
        <span className="update-prompt-note">Your meet stays open — reload when it suits.</span>
      </span>
      <span className="update-prompt-actions">
        <button type="button" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
        <button type="button" className="secondary" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </span>
    </div>
  );
}
