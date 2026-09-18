import React, { useState } from 'react';
import { useMeet } from '../store/meetStore';
import { publicUrl, randomKey } from '../publish/keys';
import { publishStatusText, usePublish } from '../publish/usePublisher';
import { Hint, Section, Warn } from './common';
import { Qr } from './Qr';

const SHARE_TEXT = 'Live results for the AOK9 meet:';

/** Turns publishing on: fresh keys now, the first snapshot goes out at once. */
export function publishMeet(dispatch: ReturnType<typeof useMeet>['dispatch']) {
  dispatch({
    type: 'setPublish',
    publish: {
      readKey: randomKey(14),
      writeKey: randomKey(32),
      enabled: true,
      lastPublishedAt: null,
    },
  });
}

function CopyLink({ url, className }: { url: string; className: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the address is on screen to copy by hand */
        }
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

/**
 * Turns a meet's results page on and off, and hands out its address.
 *
 * Lives on the Setup screen: publishing is decided once for the meet, like
 * the date, and Setup is the one step that is done before the divisions
 * sheet is printed with the QR code on it. The Results screen gets the
 * one-line PublishLine below, for the link at the end of the day.
 */
export function PublishPanel() {
  const { state, dispatch } = useMeet();
  const pub = usePublish();
  const cfg = state.publish;

  if (!cfg?.enabled) {
    return (
      <Section title="Results online">
        <p>
          Publish this meet to a page anyone can open from a link or a QR code. It shows the
          divisions now, each program&rsquo;s draw once it is locked, results as they are saved,
          and the final standings — and keeps itself current whenever this device has signal.
        </p>
        <p className="muted small">
          What goes on the page is what the paddock board shows: call names, breeds, posts,
          results and points. No owners, registration numbers or WAVEs.
        </p>
        <div className="btn-row">
          <button onClick={() => publishMeet(dispatch)}>Publish this meet</button>
        </div>
        <Hint>
          Nothing leaves this device until you press it. You can stop publishing at any time and
          the page comes down.
        </Hint>
      </Section>
    );
  }

  const url = publicUrl(cfg.readKey);
  const encoded = encodeURIComponent(`${SHARE_TEXT} ${url}`);
  const statusText = publishStatusText(pub.status, cfg);

  return (
    <Section title="Results online" right={<span className="publish-status">{statusText}</span>}>
      <div className="publish-row">
        <Qr text={url} size={140} label="QR code for the results page" />
        <div className="publish-info">
          <div className="publish-url">{url}</div>
          <div className="btn-row">
            <CopyLink url={url} className="secondary" />
            {/* Person to person, from this phone's own messaging app. */}
            <a className="share-btn" href={`sms:?&body=${encoded}`}>
              Text the link
            </a>
            <a
              className="share-btn"
              href={`https://wa.me/?text=${encoded}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
            <a
              className="share-btn"
              href={`mailto:?subject=${encodeURIComponent('AOK9 meet — live results')}&body=${encoded}`}
            >
              Email
            </a>
            <a className="share-btn" href={url} target="_blank" rel="noopener noreferrer">
              Open the page
            </a>
          </div>
          <p className="muted small">
            Print the divisions sheet and this code is on it; it is in the corner of every program
            sheet too. The page updates on its own a few seconds after each change, whenever the
            app has signal.
          </p>
          {pub.error && <Warn>{pub.error} The app will keep trying.</Warn>}
          <div className="btn-row">
            <button className="secondary sm" onClick={() => void pub.publishNow()}>
              Publish now
            </button>
            <button
              className="outline-danger sm"
              onClick={() => {
                if (confirm('Stop publishing? The page comes down and this link and QR code stop working.')) {
                  void pub.stop();
                }
              }}
            >
              Stop publishing
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/**
 * One line for the Results screen: the page's address and state, or the
 * button to turn publishing on for a meet that was scored without it. The
 * QR code, the sharing buttons and Stop publishing stay in Setup.
 */
export function PublishLine() {
  const { state, dispatch } = useMeet();
  const pub = usePublish();
  const cfg = state.publish;

  if (!cfg?.enabled) {
    return (
      <div className="publish-line">
        <span className="publish-status">Results online: off</span>
        <button className="secondary sm" onClick={() => publishMeet(dispatch)}>
          Publish this meet
        </button>
        <span className="muted small">
          Puts these results on a page you can text or email. The QR code and sharing buttons are
          in Setup.
        </span>
      </div>
    );
  }

  const url = publicUrl(cfg.readKey);
  return (
    <div className="publish-line">
      <span className="publish-status">Results online · {publishStatusText(pub.status, cfg)}</span>
      <a className="publish-url" href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
      <CopyLink url={url} className="secondary sm" />
    </div>
  );
}
