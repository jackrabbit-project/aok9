import React, { useState } from 'react';
import { APP_URL } from './common';

// Share targets are plain links rather than the platforms' script widgets: no
// third-party JavaScript, no tracking of visitors who never click, and nothing
// extra for the browser to fetch.
//
// They all point at APP_URL rather than the address in the bar. These used to
// mirror wherever the app was being served from, which sounds right and is not:
// a share posted from the older gazehound.io reseeds that address with every
// person who clicks it, which is how an old domain outlives the decision to
// stop using it.

const TITLE = 'AOK9 Sprint Race Secretary';
const BLURB =
  'A free, offline tool for running an AOK9 Sprint Racing meet — draws, rotations, results and the NRD report.';

function Icon({ path, label }: { path: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" role="img" aria-label={label}>
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  facebook:
    'M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6A21 21 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8z',
  x: 'M18.9 2.2H22l-6.9 7.9L23.2 21.8h-6.3l-5-6.5-5.7 6.5H3.1l7.4-8.4L2.4 2.2h6.5l4.5 5.9zm-1.1 17.7h1.7L7.9 4h-1.8z',
  whatsapp:
    'M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2m0 1.8a8.1 8.1 0 1 1-4.1 15.1l-.3-.2-3 .8.8-2.9-.2-.3A8.1 8.1 0 0 1 12 3.8m-3 4c-.2 0-.5.1-.7.4s-.9.9-.9 2.1.9 2.4 1 2.6c.1.2 1.7 2.7 4.2 3.7 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2l-.6-.3s-1.4-.7-1.6-.8c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.3-.4v-.4L10 8.2c-.1-.3-.3-.3-.4-.3z',
  email: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1m1.6 2L12 12.3 19.4 7zM4 17h16V8.9l-8 5.7-8-5.7z',
  link: 'M10.6 13.4a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0M9 17l-1.4 1.4a3 3 0 0 1-4.2-4.2L6.2 11a3 3 0 0 1 4.2 0l-1.4 1.4a1 1 0 0 0-1.4 0l-2.8 2.8a1 1 0 0 0 1.4 1.4L7.6 15.4zm6-10 1.4-1.4a3 3 0 0 1 4.2 4.2L17.8 13a3 3 0 0 1-4.2 0l1.4-1.4a1 1 0 0 0 1.4 0l2.8-2.8a1 1 0 0 0-1.4-1.4L16.4 8.6z',
};

export function ShareLinks() {
  const [copied, setCopied] = useState(false);

  const u = encodeURIComponent(APP_URL);
  const text = encodeURIComponent(`${TITLE} — ${BLURB}`);

  const targets = [
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${u}&text=${text}` },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${text}%20${u}` },
    {
      key: 'email',
      label: 'Email',
      href: `mailto:?subject=${encodeURIComponent(TITLE)}&body=${text}%0A%0A${u}`,
    },
  ] as const;

  return (
    <div className="share">
      {targets.map((t) => (
        <a
          key={t.key}
          className="share-btn"
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Share on ${t.label}`}
        >
          <Icon path={ICONS[t.key]} label={t.label} />
          <span>{t.label}</span>
        </a>
      ))}
      <button
        type="button"
        className="share-btn"
        title="Copy the link to this app"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(APP_URL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked (insecure context or denied) — leave the label
            // alone rather than claiming a copy that did not happen.
          }
        }}
      >
        <Icon path={ICONS.link} label="Copy link" />
        <span>{copied ? 'Copied' : 'Copy link'}</span>
      </button>
    </div>
  );
}
