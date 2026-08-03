import React from 'react';
import { JACKET_COLORS } from '../domain/types';

/** Release notes. Lives here so the footer and the update prompt agree, and so
    neither has to import from App. */
export const RELEASES_URL = 'https://github.com/jackrabbit-project/aok9/releases';

export function Section({
  title,
  children,
  right,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        <div className="section-right">{right}</div>
      </div>
      {children}
    </section>
  );
}

const JACKET_CSS: Record<number, { bg: string; fg: string; border?: string }> = {
  1: { bg: '#c62828', fg: '#fff' },
  2: { bg: '#1565c0', fg: '#fff' },
  3: { bg: '#ffffff', fg: '#111', border: '#999' },
  4: { bg: '#2e7d32', fg: '#fff' },
};

export function Jacket({ post }: { post: number | null }) {
  if (!post) return <span className="jacket unset">?</span>;
  const c = JACKET_CSS[post];
  return (
    <span
      className="jacket"
      style={{ background: c.bg, color: c.fg, borderColor: c.border ?? c.bg }}
      title={`${JACKET_COLORS[post]} jacket`}
    >
      {post}
    </span>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return <div className="warn">{children}</div>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <div className="hint">{children}</div>;
}
