// Icons beside button labels, never in place of them: a secretary at a field
// reads the word, the icon only helps the eye find the button again.
//
// Phosphor Icons (MIT, https://phosphoricons.com), regular weight, which
// matches the thin hairlines of the rest of the design. Named imports only,
// so the bundle carries just the icons listed here.

import React from 'react';
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Broadcast,
  ChatText,
  Check,
  DownloadSimple,
  EnvelopeSimple,
  FileXls,
  FolderOpen,
  Link,
  Lock,
  LockOpen,
  Printer,
  Trash,
  WhatsappLogo,
  XCircle,
} from '@phosphor-icons/react';

const ICONS = {
  backup: DownloadSimple,
  check: Check,
  discard: Trash,
  email: EnvelopeSimple,
  link: Link,
  lock: Lock,
  open: FolderOpen,
  openPage: ArrowSquareOut,
  print: Printer,
  publish: Broadcast,
  refresh: ArrowsClockwise,
  report: FileXls,
  stop: XCircle,
  text: ChatText,
  unlock: LockOpen,
  whatsapp: WhatsappLogo,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name }: { name: IconName }) {
  const C = ICONS[name];
  return <C className="btn-icon" size="1.35em" weight="regular" aria-hidden="true" focusable="false" />;
}
