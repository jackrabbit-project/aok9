import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { useMeet } from '../store/meetStore';
import { publicUrl } from '../publish/keys';

/** A QR code as inline SVG: one path of the dark modules, so it prints crisp
    at any size and needs no image request -- which matters, because the sheet
    it is on may be printed with no signal. */
export function Qr({ text, size = 128, label }: { text: string; size?: number; label?: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { n: count, d: path };
  }, [text]);
  return (
    <svg
      className="qr"
      viewBox={`-2 -2 ${n + 4} ${n + 4}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? 'QR code'}
      shapeRendering="crispEdges"
    >
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** The results page's QR and address, for the corner of every printed sheet.
    Renders nothing unless the meet is published. */
export function PrintQr() {
  const { state } = useMeet();
  if (!state.publish?.enabled) return null;
  const url = publicUrl(state.publish.readKey);
  return (
    <div className="print-qr">
      <Qr text={url} size={92} label="QR code for the live results page" />
      <div className="print-qr-text">
        <b>Live results</b>
        <br />
        {url}
      </div>
    </div>
  );
}
