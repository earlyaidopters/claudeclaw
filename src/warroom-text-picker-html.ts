/**
 * War Room mode picker.
 *
 * Two tiles: Voice (cinematic meeting) and Text (group chat). Clicking
 * Text auto-creates a fresh meetingId via POST /api/warroom/text/new and
 * navigates to /warroom/text?meetingId=...&token=.... Clicking Voice deep
 * links to /warroom?mode=voice&token=... which the dashboard serves as the
 * existing cinematic voice page.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getWarRoomPickerHtml(token: string, chatId: string): string {
  const safeToken = escapeHtml(token);
  const safeChatId = escapeHtml(chatId);
  const jsToken = JSON.stringify(token);
  const jsChatId = JSON.stringify(chatId);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>War Room</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: radial-gradient(1200px 600px at 50% 20%, #0a0a18 0%, #050505 55%, #020204 100%);
    color: #e0e0e0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .wrapper { width: 100%; max-width: 960px; }
  .header {
    text-align: center;
    margin-bottom: 48px;
  }
  .title {
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 800;
    letter-spacing: -1px;
    background: linear-gradient(180deg, #fff 0%, #7a7a92 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
  }
  .subtitle {
    font-size: 14px;
    color: #7a7a92;
    letter-spacing: 0.2px;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 720px) {
    .tiles { grid-template-columns: 1fr; }
  }
  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 28px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.01));
    /* Buttons don't inherit color or font by default — they use UA 'buttontext'
       (usually black) and Arial, which looked horrific on the dark tile. */
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    min-height: 280px;
    overflow: hidden;
  }
  .tile-title { color: #e5e5ec; }
  .tile-cta { color: #e5e5ec; }
  .tile:hover, .tile:focus-visible {
    transform: translateY(-2px);
    border-color: rgba(255,255,255,0.2);
    outline: none;
  }
  .tile:focus-visible {
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.6);
  }
  .tile-voice {
    background-image: linear-gradient(180deg, rgba(79,70,229,0.12), rgba(79,70,229,0.02));
  }
  .tile-text {
    background-image: linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.02));
  }
  .tile-accent {
    position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
  }
  .tile-voice .tile-accent { background: linear-gradient(90deg, #4f46e5, #a78bfa); }
  .tile-text  .tile-accent { background: linear-gradient(90deg, #22c55e, #10b981); }
  .tile-kicker {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #9ca3af;
    margin-bottom: 12px;
  }
  .tile-voice .tile-kicker { color: #a78bfa; }
  .tile-text  .tile-kicker { color: #34d399; }
  .tile-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
  }
  .tile-sub {
    font-size: 13px;
    color: #9ca3af;
    line-height: 1.5;
    margin-bottom: 20px;
  }
  .tile-spec {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #8a8aa0;
  }
  .tile-spec .row { display: flex; justify-content: space-between; }
  .tile-spec .row .k { color: #6b7280; }
  .tile-cta {
    margin-top: 18px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    font-weight: 600;
    text-align: center;
    transition: background 140ms ease;
  }
  .tile:hover .tile-cta { background: rgba(255,255,255,0.09); }
  .tile-error {
    margin-top: 10px;
    font-size: 11px;
    color: #f87171;
    min-height: 14px;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 28px;
    font-size: 12px;
    color: #6b7280;
    text-decoration: none;
    transition: color 120ms ease;
  }
  .back:hover { color: #a78bfa; }
  .history {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .history-title {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #9ca3af;
    margin-bottom: 12px;
  }
  .history-empty { font-size: 12px; color: #6b7280; }
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .history-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .history-row:hover, .history-row:focus-visible {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.18);
    outline: none;
  }
  .history-row .preview {
    flex: 1;
    font-size: 13px;
    color: #d1d5db;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-row .meta {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    color: #6b7280;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .history-row .badge {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 9px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .history-row .badge.live {
    background: rgba(34,197,94,0.15);
    color: #34d399;
  }
  .history-row .badge.ended {
    background: rgba(255,255,255,0.04);
    color: #6b7280;
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="title">War Room</div>
    <div class="subtitle">Pick how you want to meet with the team.</div>
  </div>
  <div class="tiles">
    <button class="tile tile-voice" id="tile-voice" aria-label="Start a voice meeting">
      <div class="tile-accent"></div>
      <div class="tile-kicker">Voice</div>
      <div class="tile-title">Voice meeting</div>
      <div class="tile-sub">Cinematic boardroom. Talk to agents out loud, they answer in real time. Best for brainstorms and calls you want to feel like a meeting.</div>
      <div class="tile-spec">
        <div class="row"><span class="k">Latency</span><span>sub-second</span></div>
        <div class="row"><span class="k">Arbitration</span><span>pin an agent or hand-up auto-route</span></div>
        <div class="row"><span class="k">Stack</span><span>Pipecat + Gemini Live</span></div>
      </div>
      <div class="tile-cta">Enter voice room →</div>
    </button>
    <button class="tile tile-text" id="tile-text" aria-label="Start a text meeting">
      <div class="tile-accent"></div>
      <div class="tile-kicker">Text</div>
      <div class="tile-title">Text group chat</div>
      <div class="tile-sub">Same team, typed instead. A primary agent leads, others chime in when it matters. Best for planning, triage, and things you want on record.</div>
      <div class="tile-spec">
        <div class="row"><span class="k">Responders</span><span>1 primary + up to 2 chime-ins</span></div>
        <div class="row"><span class="k">Memory</span><span>fresh per meeting (isolated from Telegram)</span></div>
        <div class="row"><span class="k">Stack</span><span>Claude Agent SDK (subscription)</span></div>
      </div>
      <div class="tile-cta" id="tile-text-cta">Start text room →</div>
      <div class="tile-error" id="tile-text-error" role="alert" aria-live="polite"></div>
    </button>
  </div>
  <div class="history" id="history">
    <div class="history-title">Recent text meetings</div>
    <div class="history-empty" id="history-empty">Loading…</div>
    <div class="history-list" id="history-list" hidden></div>
  </div>
  <a class="back" href="/?token=${safeToken}${safeChatId ? `&chatId=${safeChatId}` : ''}">← Back to Mission Control</a>
</div>
<script>
const TOKEN = ${jsToken};
const CHAT_ID = ${jsChatId};

document.getElementById('tile-voice').addEventListener('click', () => {
  const q = new URLSearchParams({ token: TOKEN, mode: 'voice' });
  if (CHAT_ID) q.set('chatId', CHAT_ID);
  window.location.href = '/warroom?' + q.toString();
});

const textCta = document.getElementById('tile-text-cta');
const textError = document.getElementById('tile-text-error');
document.getElementById('tile-text').addEventListener('click', async () => {
  textError.textContent = '';
  textCta.textContent = 'Creating meeting…';
  try {
    const res = await fetch('/api/warroom/text/new?token=' + encodeURIComponent(TOKEN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT_ID || '' }),
    });
    const data = await res.json();
    if (!res.ok || !data.meetingId) throw new Error(data.error || 'create_failed');
    const q = new URLSearchParams({ token: TOKEN, meetingId: data.meetingId });
    if (CHAT_ID) q.set('chatId', CHAT_ID);
    window.location.href = '/warroom/text?' + q.toString();
  } catch (err) {
    textCta.textContent = 'Start text room →';
    textError.textContent = 'Could not start meeting: ' + (err && err.message ? err.message : err);
  }
});

// Recent meetings list. Persisted in SQLite (warroom_meetings + warroom_transcript)
// so the user can revisit prior conversations. Clicking a row navigates
// to /warroom/text with the existing meetingId — ended meetings render
// read-only via disableComposerForEnded() on the text page.
function fmtRelative(ts) {
  const ms = Date.now() - ts * 1000;
  if (ms < 60_000) return 'just now';
  if (ms < 3600_000) return Math.floor(ms / 60_000) + 'm ago';
  if (ms < 86400_000) return Math.floor(ms / 3600_000) + 'h ago';
  return Math.floor(ms / 86400_000) + 'd ago';
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
async function loadHistory() {
  const empty = document.getElementById('history-empty');
  const list = document.getElementById('history-list');
  try {
    // Scope by current chat. Server filters when chatId is present;
    // legacy meetings (chat_id='') only appear when CHAT_ID is also ''.
    const res = await fetch('/api/warroom/text/list?token=' + encodeURIComponent(TOKEN) + '&limit=15&chatId=' + encodeURIComponent(CHAT_ID || ''));
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.meetings)) throw new Error(data.error || 'load_failed');
    if (data.meetings.length === 0) {
      empty.textContent = 'No prior text meetings yet.';
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = '';
    for (const m of data.meetings) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-row';
      const preview = (m.preview || '(no messages)').trim() || '(no messages)';
      const ended = m.ended_at !== null;
      btn.innerHTML =
        '<span class="badge ' + (ended ? 'ended' : 'live') + '">' +
          (ended ? 'ended' : 'live') +
        '</span>' +
        '<span class="preview">' + escHtml(preview) + '</span>' +
        '<span class="meta">' + (m.entry_count || 0) + ' msg · ' + fmtRelative(m.started_at) + '</span>';
      btn.addEventListener('click', () => {
        const q = new URLSearchParams({ token: TOKEN, meetingId: m.id });
        if (CHAT_ID) q.set('chatId', CHAT_ID);
        // Ended meetings need archive=1 so the server doesn't redirect
        // them straight back to this picker (refresh-becomes-fresh
        // behaviour). Open meetings just route normally.
        if (ended) q.set('archive', '1');
        window.location.href = '/warroom/text?' + q.toString();
      });
      list.appendChild(btn);
    }
  } catch (err) {
    empty.textContent = 'Could not load past meetings.';
  }
}
loadHistory();
</script>
</body>
</html>`;
}
