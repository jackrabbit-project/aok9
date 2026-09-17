// Renders a published meet as a plain HTML page.
//
// No framework, no external scripts: the page has to open on any phone in a
// paddock, including ones that will never be updated. Every string from the
// snapshot passes through esc(), because all of it was typed by someone.
// The look follows the app's tokens; the fonts come from the same origin,
// which already serves them for the app.

import type { PublicDivision, PublicMeet, PublicProgram, PublicRace } from '../../src/publish/types';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const num = (n: number): string => String(Math.round(n * 1000) / 1000);

const CSS = `
@font-face{font-family:'Fraunces';src:url('/fonts/fraunces-latin-var.woff2') format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:'IBM Plex Mono';src:url('/fonts/plex-mono-500.woff2') format('woff2');font-weight:500;font-display:swap}
:root{--paper:#f7f5ef;--panel:#e8efea;--surface:#fcfbf6;--ink:#2b2a26;--muted:#6e6c64;--line:#dcd8cc;--line-strong:#c9c4b6;--green:#2c6e49;--rust:#a44a2f;--well:#22261f;--well-ink:#f7f5ef}
*{box-sizing:border-box}html,body{margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink);font-size:15px;line-height:1.45}
.mono{font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
header{background:var(--panel);border-bottom:1px solid var(--line);padding:18px 16px 14px}
.wrap{max-width:820px;margin:0 auto}
h1{font-family:'Fraunces',Georgia,serif;font-weight:580;letter-spacing:-.015em;line-height:1.1;font-size:26px;margin:0 0 4px}
h2{font-family:'Fraunces',Georgia,serif;font-weight:560;font-size:20px;margin:0}
h3{font-family:'Fraunces',Georgia,serif;font-weight:550;font-size:16px;margin:16px 0 6px}
.kicker{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.status{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;margin-top:8px}
.status b{font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--rust)}
main{padding:14px 16px 32px}
section.card{background:var(--surface);border:1px solid var(--line);padding:16px 16px 18px;margin:0 0 14px}
.card-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:8px}
.badge{display:inline-block;margin-left:6px;padding:2px 6px;font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:#edece6;color:#6b675e;vertical-align:middle}
.badge.hp{background:#e8efea;color:#2c6e49}.badge.lo{background:#f3e0da;color:#7a3422}
table{width:100%;border-collapse:collapse;margin:4px 0 6px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
th{font-family:'IBM Plex Mono',monospace;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom-color:var(--line-strong);white-space:nowrap}
td.num,th.num{text-align:right;font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
td.post{text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:500;width:44px}
td.post-1{background:#f7d6d6}td.post-2{background:#d6e2f5}td.post-3{background:#fff;box-shadow:inset 0 0 0 1px var(--line-strong)}td.post-4{background:#d8ead9}
td.res{font-family:'IBM Plex Mono',monospace;font-weight:500;white-space:nowrap}
.dogs{columns:2;column-gap:24px;margin:0;padding-left:18px}.dogs li{break-inside:avoid;margin:3px 0}
small{color:var(--muted)}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
footer{background:var(--well);color:rgba(247,245,239,.85);font-size:13px;padding:18px 16px 26px}
footer a{color:var(--well-ink)}
@media(max-width:520px){.dogs{columns:1}th.opt,td.opt{display:none}}
`;

function raceTable(r: PublicRace): string {
  const rows = r.slots
    .map((s) => {
      const post = s.post ?? '';
      const cls = s.post ? ` post-${s.post}` : '';
      const res = s.result ? esc(s.result) : r.finished ? '' : '—';
      const pts = s.points !== undefined ? num(s.points) : '';
      return `<tr><td class="post${cls}">${esc(post)}</td><td class="opt">${esc(s.jacket)}</td><td><b>${esc(s.name)}</b> <small>${esc(s.breed)}</small></td><td class="res">${res}</td><td class="num">${pts}</td></tr>`;
    })
    .join('');
  return `<h3>Race ${esc(r.raceNo)}${r.isHP ? '<span class="badge hp">High Point</span>' : ''}${r.finished ? '' : '<span class="badge">not yet run</span>'}</h3>
<div class="tbl-wrap"><table><thead><tr><th>Post</th><th class="opt">Jacket</th><th>Dog</th><th>Result</th><th class="num">Pts</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function programBlock(p: PublicProgram): string {
  return `<div class="program"><div class="kicker">Program ${esc(p.program)}${p.complete ? ' · complete' : ' · in progress'}</div>${p.races.map(raceTable).join('')}</div>`;
}

function divisionCard(d: PublicDivision): string {
  const head = `<div class="card-head"><h2>${d.type === 'breed' ? 'Breed' : 'Mixed'}: ${esc(d.name)}${d.ungraded ? '<span class="badge">ungraded</span>' : ''}</h2><span class="kicker">${d.dogs.length} dogs</span></div>`;

  let body = '';
  if (d.standings) {
    const rows = d.standings
      .map(
        (s) =>
          `<tr><td class="num">${esc(s.place)}</td><td><b>${esc(s.name)}</b>${s.leftover ? '<span class="badge lo">leftover</span>' : ''} <small>${esc(s.breed)}</small>${s.incomplete ? '<span class="badge">incomplete</span>' : ''}</td><td class="num"><b>${num(s.total)}</b></td><td class="num">${num(s.brc)}</td><td class="num opt">${num(s.nbrc)}</td><td class="num">${num(s.mrc)}</td><td class="num opt">${num(s.nmrc)}</td><td class="num">${num(s.trc)}</td></tr>`
      )
      .join('');
    body += `<h3>Final standings</h3><div class="tbl-wrap"><table><thead><tr><th class="num">Place</th><th>Dog</th><th class="num">Score</th><th class="num">BRC</th><th class="num opt">Nat. B</th><th class="num">MRC</th><th class="num opt">Nat. M</th><th class="num">TRC</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } else if (d.totals.length) {
    const rows = d.totals.map((t) => `<tr><td><b>${esc(t.name)}</b></td><td class="num">${num(t.total)}</td></tr>`).join('');
    const after = Math.max(...d.programs.filter((p) => p.complete).map((p) => p.program));
    body += `<h3>Points after program ${esc(after)}</h3><table><tbody>${rows}</tbody></table>`;
  }

  if (d.programs.length) {
    // Latest program first: that is what someone at the field is looking for.
    body += [...d.programs].reverse().map(programBlock).join('');
  } else {
    const items = d.dogs
      .map((x) => `<li><b>${esc(x.name)}</b> <small>${esc(x.breed)}</small>${x.leftover ? '<span class="badge lo">leftover</span>' : ''}${x.fte ? '<span class="badge">FTE</span>' : ''}</li>`)
      .join('');
    body += `<ul class="dogs">${items}</ul>`;
  }
  return `<section class="card">${head}${body}</section>`;
}

/** The whole page. */
export function renderMeet(m: PublicMeet): string {
  const title = `${m.info.clubName || 'AOK9 meet'} — ${m.info.meetId || m.info.date}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="60">
<title>${esc(title)} — results</title><style>${CSS}</style></head>
<body><header><div class="wrap"><div class="kicker">AOK9 Sprint Racing · results</div>
<h1>${esc(m.info.clubName)}</h1>
<div class="status"><span class="mono">${esc(m.info.meetId)} · ${esc(m.info.date)}</span><b>${esc(m.status)}</b>
<span class="kicker">updated <time datetime="${esc(m.updatedAt)}">${esc(m.updatedAt.replace('T', ' ').slice(0, 16))} UTC</time> · refreshes every minute</span></div></div></header>
<main><div class="wrap">${m.divisions.map(divisionCard).join('')}
${m.divisions.length ? '' : '<p>No divisions yet.</p>'}</div></main>
<footer><div class="wrap">Published from the AOK9 Race Secretary app by the meet secretary. Provisional until the official report is filed with the NRD; where they disagree, the official AOK9 materials govern. <a href="https://aok9rms.gazehound.io/">About the app</a></div></footer>
<script>for(const t of document.querySelectorAll('time')){const d=new Date(t.dateTime);if(!isNaN(d))t.textContent=d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}</script>
</body></html>`;
}

export function renderNotFound(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>No such meet</title><style>${CSS}</style></head>
<body><main><div class="wrap"><section class="card"><h2>No results at this address</h2><p>The link or QR code may be from a meet that was never published, or one whose page has been taken down by the secretary.</p></section></div></main></body></html>`;
}
