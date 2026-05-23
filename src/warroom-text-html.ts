/**
 * Text War Room dashboard page.
 *
 * Three-zone layout (roster | transcript | composer) with SSE-driven live
 * updates. All agent-rendered strings are escaped at render time — every
 * transcript write uses element.textContent, never innerHTML, so the XSS
 * class we patched on the voice page can't recur here.
 *
 * Status indicators are text + icon, never color-only, for color-blind
 * accessibility and screen-reader clarity.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getWarRoomTextHtml(token: string, chatId: string, meetingId: string): string {
  const safeToken = escapeHtml(token);
  const safeChatId = escapeHtml(chatId);
  const safeMeetingId = escapeHtml(meetingId);
  const jsToken = JSON.stringify(token);
  const jsChatId = JSON.stringify(chatId);
  const jsMeetingId = JSON.stringify(meetingId);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>War Room · Text</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #050505;
    --bg-elev: #0b0b0f;
    --bg-elev-2: #13131a;
    --border: rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.16);
    --text: #e5e5ec;
    --text-dim: #9ca3af;
    --text-mute: #6b7280;
    --indigo: #6366f1;
    --indigo-soft: rgba(99,102,241,0.22);
    --green: #22c55e;
    --amber: #f59e0b;
    --blue: #3b82f6;
    --purple: #a855f7;
    --red: #ef4444;
    --user-bubble: #3730a3;
  }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    height: 100vh;
    overflow: hidden;
  }
  .app {
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: 56px 1fr;
    height: 100vh;
  }
  .header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent), var(--bg-elev);
    font-size: 13px;
    height: 56px;
  }
  .header .left {
    display: flex; align-items: center; gap: 18px;
    min-width: 0;
  }
  .header .back {
    display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 8px;
    color: var(--text-dim); text-decoration: none;
    transition: background 120ms ease, color 120ms ease;
    font-size: 16px;
  }
  .header .back:hover, .header .back:focus-visible {
    background: rgba(255,255,255,0.06); color: var(--text); outline: none;
  }
  .header .brand {
    display: flex; flex-direction: column; line-height: 1.1;
  }
  .header .brand-title {
    font-size: 14px; font-weight: 700; color: var(--text); letter-spacing: -0.2px;
  }
  .header .brand-sub {
    font-size: 10px; color: var(--text-mute); letter-spacing: 1.2px;
    text-transform: uppercase; margin-top: 2px;
  }
  .header .meta {
    display: flex; align-items: center; gap: 10px; min-width: 0;
  }
  .header .meta-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-dim);
  }
  .header .meta-chip.timer {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.5px;
  }
  .header .meta-chip.pin {
    background: rgba(99,102,241,0.14);
    border-color: rgba(99,102,241,0.35);
    color: #c7d2fe;
  }
  .header .meta-chip.pin .dot {
    width: 6px; height: 6px; border-radius: 50%; background: var(--indigo);
    box-shadow: 0 0 0 3px rgba(99,102,241,0.18);
  }
  .header .meta-chip.fresh {
    background: rgba(34,197,94,0.12);
    border-color: rgba(34,197,94,0.3);
    color: #86efac;
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .header .right {
    display: flex; gap: 8px; align-items: center;
  }
  .btn {
    font-family: inherit;
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-elev-2);
    color: var(--text);
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .btn:hover, .btn:focus-visible { background: rgba(255,255,255,0.06); border-color: var(--border-strong); outline: none; }
  .btn:focus-visible { box-shadow: 0 0 0 2px rgba(99,102,241,0.55); }
  .btn.danger { color: #fca5a5; border-color: rgba(239,68,68,0.3); }
  .btn.danger:hover { background: rgba(239,68,68,0.1); }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Roster rail ─────────────────────────────────────────────────── */
  .roster {
    grid-column: 1;
    grid-row: 2;
    border-right: 1px solid var(--border);
    background: var(--bg-elev);
    overflow-y: auto;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .roster-header {
    padding: 6px 8px 10px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    color: var(--text-mute);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    display: flex; align-items: center; justify-content: space-between;
  }
  .roster-layout-pick {
    display: inline-flex; gap: 2px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px;
  }
  .roster-layout-pick button {
    background: transparent;
    border: 0;
    padding: 3px 6px;
    border-radius: 4px;
    color: var(--text-mute);
    cursor: pointer;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    transition: background 120ms ease, color 120ms ease;
  }
  .roster-layout-pick button:hover { color: var(--text); }
  .roster-layout-pick button.active { background: var(--indigo); color: #fff; }
  /* Agent rail — vertical card layout. Big round avatar on top, name +
     status stacked underneath. Closer to an MSN/Discord profile card
     than the old horizontal row. The status line uses hive_mind to
     show what each agent last did; cross-fades on update. */
  .agent-row {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 14px 10px 12px;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--bg-elev);
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
    text-align: center;
    color: inherit;
    font: inherit;
    width: 100%;
  }
  .agent-row:hover { background: var(--bg-elev-2); border-color: var(--border-strong); transform: translateY(-1px); }
  .agent-row:focus-visible { outline: none; border-color: var(--indigo); box-shadow: 0 0 0 2px rgba(99,102,241,0.25); }
  .agent-row.pinned { border-color: var(--indigo); background: var(--indigo-soft); }
  .agent-row.selected { border-color: rgba(245,158,11,0.5); background: rgba(245,158,11,0.08); }
  .agent-row.speaking { border-color: rgba(34,197,94,0.6); background: rgba(34,197,94,0.10); }
  .agent-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: #1a1a25;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 700;
    flex-shrink: 0;
    border: 2px solid var(--border-strong);
    overflow: hidden;
    transition: border-color 200ms ease, box-shadow 200ms ease;
    position: relative;
  }
  .agent-row.speaking .agent-avatar { border-color: rgba(34,197,94,0.85); box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
  .agent-row.pinned .agent-avatar { border-color: var(--indigo); box-shadow: 0 0 0 3px rgba(99,102,241,0.20); }
  .agent-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .agent-meta { width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .agent-name {
    font-size: 14px; font-weight: 600; line-height: 1.2;
    white-space: nowrap; text-overflow: ellipsis; overflow: hidden;
    display: inline-flex; align-items: center; gap: 6px;
    max-width: 100%;
  }
  /* MSN-style "what they last did" line. Old text fades out upward as
     the new text fades in — a single line, fixed height, ellipsised.
     With a vertical layout we have a bit more horizontal room so we
     can fit ~2 lines of summary text. */
  .agent-status-line {
    font-size: 11.5px;
    color: var(--text-mute);
    line-height: 1.35;
    width: 100%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: opacity 200ms ease, transform 200ms ease;
    opacity: 1;
    font-style: italic;
  }
  .agent-status-line.fade-out { opacity: 0; transform: translateY(-4px); }
  .agent-status-line.empty {
    font-style: italic;
    opacity: 0.45;
    /* Hairline left accent so the empty state reads as "placeholder"
       rather than "real summary that just happens to be short". */
    border-left: 2px solid rgba(255,255,255,0.07);
    padding-left: 6px;
  }
  .agent-status-line.empty .agent-ticker-text { color: var(--text-faint, #6b7280); }
  .agent-status-time {
    font-size: 10px; color: var(--text-mute); opacity: 0.7;
    margin-top: 2px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  /* Inline status dot beside the name (idle / typing / pinned). Small
     and unobtrusive — speaking gets the pulse + ring on the avatar. */
  .agent-status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--text-mute);
    flex-shrink: 0;
  }
  .agent-row.pinned .agent-status-dot { background: var(--indigo); }
  .agent-row.selected .agent-status-dot { background: var(--amber); }
  .agent-row.speaking .agent-status-dot { background: var(--green); animation: pulse 1.2s ease infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  /* Layout presets — modifier classes on .team. Compact = horizontal
     row (the original layout). Comfortable = vertical card (default).
     Spacious = bigger card with bigger avatar and a 3-line status. */
  .team.layout-compact .agent-row {
    flex-direction: row; align-items: center; text-align: left;
    gap: 12px; padding: 10px 12px; border-radius: 999px 14px 14px 999px;
  }
  .team.layout-compact .agent-avatar { width: 38px; height: 38px; font-size: 13px; }
  .team.layout-compact .agent-meta { align-items: stretch; gap: 2px; }
  .team.layout-compact .agent-name { justify-content: flex-start; font-size: 13px; }
  .team.layout-compact .agent-status-line { -webkit-line-clamp: 1; line-clamp: 1; font-size: 11px; text-align: left; }
  .team.layout-compact .agent-status-time { display: none; }

  .team.layout-spacious .agent-row {
    padding: 18px 12px 14px;
    gap: 10px;
  }
  .team.layout-spacious .agent-avatar { width: 72px; height: 72px; font-size: 22px; }
  .team.layout-spacious .agent-name { font-size: 15px; }
  .team.layout-spacious .agent-status-line { -webkit-line-clamp: 3; line-clamp: 3; font-size: 12px; }

  /* Newscast-style ticker. The summary text scrolls horizontally if it
     overflows (set a CSS variable --ticker-distance from JS), and we
     rotate through the agent's last few hive_mind entries with a fade
     between them. The container clips overflow; the inner span carries
     the animation so we can pause on hover. */
  .agent-ticker {
    display: block;
    width: 100%;
    overflow: hidden;
    position: relative;
    height: 1.35em; /* one line; line-clamp on parent handles multi-line variants */
  }
  .team.layout-spacious .agent-ticker { height: calc(1.35em * 3); }
  .agent-ticker.multiline { white-space: normal; height: auto; }
  .agent-ticker-text {
    display: inline-block;
    white-space: nowrap;
    will-change: transform;
  }
  .agent-ticker.scrolling .agent-ticker-text {
    animation: ticker-scroll var(--ticker-duration, 14s) linear infinite;
  }
  .agent-row:hover .agent-ticker-text { animation-play-state: paused; }
  @keyframes ticker-scroll {
    0%   { transform: translateX(0); }
    8%   { transform: translateX(0); }                          /* hold at start */
    92%  { transform: translateX(var(--ticker-distance, 0px)); } /* scroll across */
    100% { transform: translateX(var(--ticker-distance, 0px)); } /* hold at end */
  }

  /* ── Main pane ───────────────────────────────────────────────────── */
  .main {
    grid-column: 2;
    grid-row: 2;
    display: grid;
    grid-template-rows: auto 1fr auto auto;
    min-width: 0;
    /* min-height: 0 is the crucial one for a nested grid/flex child:
       without it, the 1fr transcript row defaults to min-height: auto,
       grows with its content, and the overflow-y:auto never activates.
       Set on both .main and .transcript for belt-and-suspenders. */
    min-height: 0;
    position: relative;
  }
  .banner {
    padding: 8px 16px;
    background: rgba(99,102,241,0.12);
    border-bottom: 1px solid rgba(99,102,241,0.3);
    font-size: 12px;
    color: #c7d2fe;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .banner.warn { background: rgba(245,158,11,0.1); border-bottom-color: rgba(245,158,11,0.3); color: #fcd34d; }
  .banner.error { background: rgba(239,68,68,0.12); border-bottom-color: rgba(239,68,68,0.35); color: #fca5a5; }
  .banner.hidden { display: none; }
  .transcript {
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    padding: 20px 24px 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scroll-behavior: smooth;
  }
  .load-earlier {
    align-self: center;
    padding: 6px 14px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
    margin-bottom: 4px;
  }
  .load-earlier:hover, .load-earlier:focus-visible {
    background: rgba(255,255,255,0.06);
    color: var(--text);
    outline: none;
  }
  .load-earlier:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .transcript-empty {
    flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: var(--text-mute);
    font-size: 13px;
    text-align: center;
    padding: 40px 20px;
    gap: 8px;
  }
  .transcript-empty .lg { font-size: 15px; color: var(--text-dim); font-weight: 500; }
  .bubble {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    max-width: 100%;
  }
  /* User bubbles: flex-end pushes them to the right. The .user-body wrapper
     is capped at 520px absolute (not a percentage of the parent, which was
     resolving to 0 and forcing one-char-per-line wrapping). */
  .bubble.user {
    justify-content: flex-end;
  }
  .bubble.user .user-body {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    max-width: 520px;
    /* Short messages like "hi" used to collapse to single-char width and
       wrap vertically. 120px minimum gives every message breathing room
       while still hugging the right edge for long messages. */
    min-width: 120px;
    width: fit-content;
  }
  .bubble.user .content {
    background: var(--user-bubble);
    border-radius: 14px 14px 4px 14px;
    padding: 10px 14px;
    font-size: 14px;
    color: #eef2ff;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    line-height: 1.45;
    /* Stretch to fill the user-body width so the bubble chrome matches the
       container's min/max width, regardless of how short the text is.
       Without this, content sized to its own intrinsic width and short
       messages like "hi" wrapped character-by-character. */
    align-self: stretch;
    min-width: 0;
  }
  .bubble.user.failed .content { background: #7f1d1d; opacity: 0.85; }
  .bubble.user .retry {
    font-size: 11px; color: #fca5a5; cursor: pointer; background: transparent; border: none; padding: 2px 6px;
  }
  .bubble.user .ts { font-size: 10px; color: #a5b4fc; margin-top: 2px; text-align: right; opacity: 0.8; }
  /* align-self: flex-start is required because the transcript is a flex
     column container with the default align-items:stretch, which ignores
     max-width on auto-width children. Without it, agent bubbles stretched
     past the viewport. */
  .bubble.agent { flex-direction: row; max-width: 820px; align-self: flex-start; }
  .bubble.agent.intervener { margin-left: 24px; max-width: 740px; align-self: flex-start; }
  .bubble.user { align-self: flex-end; }
  .bubble.agent .avatar {
    width: 32px; height: 32px; border-radius: 50%; background: #1a1a25; border: 1px solid var(--border);
    flex-shrink: 0; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: var(--text-dim);
  }
  .bubble.agent .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .bubble.agent .body { flex: 1; min-width: 0; }
  .bubble.agent .header-line { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .bubble.agent .name { font-size: 13px; font-weight: 600; }
  .bubble.agent .ts { font-size: 10px; color: var(--text-mute); }
  .bubble.agent .tag {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
    padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: var(--text-dim);
  }
  .bubble.agent .tag.incomplete { background: rgba(239,68,68,0.18); color: #fca5a5; }
  /* Tool-call disclosure. Collapsed by default — the chat reads clean,
     and curious users can click "▸ N tool calls" to peek under the
     hood. Native <details>/<summary> handles keyboard + a11y. */
  .bubble.agent .tool-calls {
    margin-top: 4px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px; line-height: 1.45; color: var(--text-mute);
  }
  /* Hide the default browser triangle so we can render our own. */
  .bubble.agent .tool-calls > summary.tool-summary {
    cursor: pointer; user-select: none; list-style: none;
    color: var(--text-mute); opacity: 0.6;
    padding: 2px 0; outline: none;
    transition: opacity 0.15s ease;
  }
  .bubble.agent .tool-calls > summary.tool-summary::-webkit-details-marker { display: none; }
  .bubble.agent .tool-calls > summary.tool-summary::before {
    content: '▸'; display: inline-block; width: 12px;
    transition: transform 0.15s ease;
  }
  .bubble.agent .tool-calls[open] > summary.tool-summary::before {
    transform: rotate(90deg);
  }
  .bubble.agent .tool-calls:hover > summary.tool-summary,
  .bubble.agent .tool-calls[open] > summary.tool-summary {
    opacity: 1;
  }
  .bubble.agent .tool-calls > summary.tool-summary:focus-visible {
    outline: 1px solid var(--text-dim); outline-offset: 2px; border-radius: 3px;
  }
  /* The expanded list. Each call is a compact row. */
  .bubble.agent .tool-list {
    display: flex; flex-direction: column; gap: 2px;
    margin-top: 4px;
  }
  .bubble.agent .tool-call {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px;
    padding: 3px 8px; border-radius: 6px;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    color: var(--text-dim);
  }
  .bubble.agent .tool-call.pending { opacity: 0.7; }
  .bubble.agent .tool-call.ok { border-color: rgba(34,197,94,0.35); }
  .bubble.agent .tool-call.failed { border-color: rgba(239,68,68,0.45); background: rgba(239,68,68,0.06); }
  .bubble.agent .tool-call .tool-icon { font-size: 11px; opacity: 0.7; }
  .bubble.agent .tool-call .tool-name { color: var(--text); font-weight: 600; }
  .bubble.agent .tool-call .tool-args { color: var(--text-mute); word-break: break-all; }
  .bubble.agent .tool-call .tool-status { color: var(--text-dim); margin-left: auto; white-space: nowrap; }
  .bubble.agent .tool-call.ok .tool-status { color: #4ade80; }
  .bubble.agent .tool-call.failed .tool-status { color: #fca5a5; }
  .bubble.agent .tool-call .tool-result-preview { color: var(--text-mute); white-space: normal; }
  .bubble.agent .content {
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-left-width: 2px;
    border-radius: 12px;
    padding: 10px 14px;
    font-size: 14px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    min-height: 20px;
  }
  /* Inline typing indicator shown inside a brand-new agent bubble before
     the first token arrives. Three dots that fade in sequence. Replaces
     the ugly empty box Mark saw during the 3-5s pre-stream window. */
  .typing-dots {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 2px 0;
  }
  .typing-dots span {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--text-dim);
    opacity: 0.3;
    animation: typing-bounce 1.1s infinite ease-in-out;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes typing-bounce {
    0%, 70%, 100% { opacity: 0.3; transform: translateY(0); }
    35% { opacity: 0.9; transform: translateY(-2px); }
  }
  /* Thinking caption that rotates next to the typing dots while the
     model is still composing. Disappears the instant the first token
     streams in. Same vibe as Claude Code's "Marinating / Pondering"
     loop — gives the user something to read instead of staring at
     dots for 5-10 seconds. */
  .thinking {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .thinking-caption {
    font-size: 12px;
    font-style: italic;
    color: var(--text-dim);
    opacity: 0.7;
    transition: opacity 200ms ease;
  }
  .thinking-caption.fade { opacity: 0; }
  .bubble.agent .copy {
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-mute);
    cursor: pointer;
    background: transparent;
    border: none;
    padding: 0;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  .bubble.agent:hover .copy, .bubble.agent:focus-within .copy { opacity: 1; }
  .bubble.system .content, .bubble.divider .content {
    font-size: 12px; color: var(--text-mute); text-align: center; padding: 4px 10px;
    font-style: italic;
    margin: 4px auto;
  }
  .bubble.divider .content {
    border-top: 1px dashed var(--border);
    border-bottom: 1px dashed var(--border);
    padding: 6px 10px;
    font-style: normal;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .bubble.system.warn .content { color: #fcd34d; }

  /* Agent accent colors for bubble left border */
  .accent-main { border-left-color: var(--green); }
  .accent-research { border-left-color: var(--blue); }
  .accent-comms { border-left-color: var(--purple); }
  .accent-content { border-left-color: var(--amber); }
  .accent-ops { border-left-color: var(--red); }
  .accent-default { border-left-color: var(--indigo); }

  .scroll-pill {
    position: absolute;
    right: 24px;
    bottom: 130px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    font-size: 11px;
    color: var(--text-dim);
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    opacity: 0;
    pointer-events: none;
    /* visibility:hidden also removes it from tab order so sighted and
       keyboard users don't get stuck on a pill they can't see. */
    visibility: hidden;
    transition: opacity 140ms ease;
  }
  .scroll-pill.show { opacity: 1; pointer-events: auto; visibility: visible; }

  /* ── Status bar ──────────────────────────────────────────────────── */
  /* Sits directly above the composer so progressive status (Routing…
     → Starting X → X is typing…) reads as part of the composer region
     rather than floating in the transcript. Reserves a permanent 30px
     row with opacity fade between idle/active so the bar's appearance
     never visually clips the last bubble (the height: 0 → 30px animation
     used to consume the bottom 30px of the transcript mid-stream). */
  .status-bar {
    min-height: 30px;
    height: 30px;
    padding: 6px 16px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-elev);
    overflow: hidden;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .status-bar.active {
    opacity: 1;
  }
  .status-bar.idle { color: var(--text-mute); }
  .status-bar .pulse {
    width: 6px; height: 6px; border-radius: 50%; background: var(--indigo);
    animation: pulse 1.2s ease infinite;
    flex-shrink: 0;
  }
  .status-bar.idle .pulse { display: none; }

  /* ── Composer ────────────────────────────────────────────────────── */
  .composer {
    position: relative;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg-elev);
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }
  .composer textarea {
    flex: 1;
    resize: none;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    color: var(--text);
    font: inherit;
    font-size: 14px;
    line-height: 1.5;
    min-height: 40px;
    max-height: 180px;
    font-family: inherit;
  }
  .composer textarea:focus { outline: none; border-color: var(--border-strong); box-shadow: 0 0 0 2px rgba(99,102,241,0.35); }
  .composer textarea:disabled { opacity: 0.6; }
  .composer .actions { display: flex; gap: 8px; align-items: stretch; }
  .composer .send {
    padding: 10px 16px;
    background: var(--indigo);
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .composer .send:disabled { background: #2a2a3a; color: var(--text-mute); cursor: not-allowed; }
  .composer .stop {
    padding: 10px 14px;
    background: #7f1d1d;
    color: #fecaca;
    border: 1px solid rgba(239,68,68,0.4);
    border-radius: 10px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    display: none;
  }
  .composer .stop.show { display: inline-flex; }
  .composer .send:focus-visible, .composer .stop:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.5); }

  /* ── @mention autocomplete ──────────────────────────────────────── */
  .mention-popup {
    position: absolute;
    left: 16px;
    bottom: 100%;
    margin-bottom: 6px;
    min-width: 280px;
    max-width: 340px;
    max-height: 280px;
    overflow-y: auto;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.2);
    z-index: 50;
    padding: 4px;
  }
  .mention-popup[hidden] { display: none; }
  .mention-item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 9px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
  }
  .mention-item:hover, .mention-item.active {
    background: var(--indigo-soft);
  }
  .mention-item .m-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: #15151f; overflow: hidden;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .mention-item .m-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .mention-item .m-body { flex: 1; min-width: 0; line-height: 1.2; }
  .mention-item .m-name {
    font-size: 13px; font-weight: 600; color: var(--text);
    white-space: nowrap; text-overflow: ellipsis; overflow: hidden;
  }
  .mention-item .m-role {
    font-size: 11px; color: var(--text-mute);
    white-space: nowrap; text-overflow: ellipsis; overflow: hidden;
    margin-top: 1px;
  }
  .mention-hint {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 9px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--text-mute);
    padding: 6px 10px 3px;
  }

  /* Slash command popup — same chrome as the mention popup so the
     visual vocabulary stays consistent. The slash item shows the
     command name in mono, a short label, and a placeholder hint for
     commands that take an argument. */
  .slash-popup {
    position: absolute;
    left: 16px;
    bottom: 100%;
    margin-bottom: 6px;
    min-width: 320px;
    max-width: 420px;
    max-height: 320px;
    overflow-y: auto;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.2);
    z-index: 50;
    padding: 4px;
  }
  .slash-popup[hidden] { display: none; }
  .slash-item {
    display: flex; align-items: baseline; gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
  }
  .slash-item:hover, .slash-item.active { background: var(--indigo-soft); }
  .slash-item .s-cmd {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 13px; font-weight: 600; color: var(--text);
    flex-shrink: 0;
  }
  .slash-item .s-cmd .s-arg {
    color: var(--text-mute);
    font-weight: 400;
    margin-left: 4px;
  }
  .slash-item .s-label { font-size: 12px; color: var(--text-mute); line-height: 1.3; min-width: 0; }
  .slash-item.local .s-cmd { color: #a5b4fc; }

  /* "Commands" button next to Send — discoverability for users who
     don't know slash commands exist. Clicking pops the same list as
     the autocomplete but as a persistent popover. */
  .composer .commands-btn {
    padding: 10px 12px;
    background: var(--bg-elev-2);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .composer .commands-btn:hover { background: var(--indigo-soft); color: var(--text); border-color: var(--indigo); }
  .composer .commands-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.5); }
  .composer .commands-btn[aria-expanded="true"] { background: var(--indigo-soft); color: var(--text); border-color: var(--indigo); }

  /* ── Dialog ──────────────────────────────────────────────────────── */
  .dialog-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: none; align-items: center; justify-content: center;
    z-index: 100;
  }
  .dialog-backdrop.show { display: flex; }
  .dialog {
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    border-radius: 14px;
    padding: 20px 22px;
    max-width: 420px;
    width: 90%;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
  }
  .dialog h2 { font-size: 16px; margin-bottom: 8px; }
  .dialog p { font-size: 13px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; }
  .dialog .actions { display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Warmup intro overlay ────────────────────────────────────────── */
  /* Shown on page load while the backend SDK warms up. The animation
     covers the ~4s cold start so the first user turn feels fast, and
     gives the meeting a "team is assembling" vibe. */
  .warmup-overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: radial-gradient(1400px 700px at 50% 35%, #0d0d1f 0%, #050508 55%, #020204 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 20px;
    transition: opacity 700ms ease;
  }
  .warmup-overlay.fade-out { opacity: 0; pointer-events: none; }
  .warmup-title {
    font-size: clamp(32px, 5vw, 48px);
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(180deg, #fff 0%, #9ca3af 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    opacity: 0;
    transform: translateY(-6px);
    transition: opacity 500ms ease, transform 500ms ease;
  }
  .warmup-title.show { opacity: 1; transform: translateY(0); }
  .warmup-subtitle {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
    color: var(--text-mute);
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-top: -32px;
    opacity: 0;
    transition: opacity 400ms ease 120ms;
  }
  .warmup-subtitle.show { opacity: 1; }
  .warmup-lineup {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 720px;
  }
  .warmup-seat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: opacity 380ms ease, transform 380ms ease;
  }
  .warmup-seat.show { opacity: 1; transform: translateY(0) scale(1); }
  .warmup-avatar {
    width: 64px; height: 64px; border-radius: 50%;
    background: #15151f;
    border: 1px solid var(--border);
    overflow: hidden;
    position: relative;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; color: var(--text-dim);
    font-size: 18px;
  }
  .warmup-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .warmup-avatar::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 2px solid transparent;
    animation: warmup-glow 1400ms ease-out forwards;
  }
  @keyframes warmup-glow {
    0% { border-color: rgba(99,102,241,0); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    30% { border-color: rgba(99,102,241,0.7); box-shadow: 0 0 18px 2px rgba(99,102,241,0.4); }
    100% { border-color: rgba(99,102,241,0.15); box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  .warmup-name {
    font-size: 12px; font-weight: 600; color: var(--text);
  }
  .warmup-status {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 9px; letter-spacing: 1.2px; text-transform: uppercase;
    color: var(--green);
    opacity: 0;
    transition: opacity 260ms ease;
  }
  .warmup-seat.show .warmup-status { opacity: 1; }
  .warmup-progress {
    width: 240px;
    height: 2px;
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    overflow: hidden;
    opacity: 0;
    transition: opacity 400ms ease;
  }
  .warmup-progress.show { opacity: 1; }
  .warmup-progress .bar {
    height: 100%;
    width: 0;
    background: linear-gradient(90deg, #6366f1, #22c55e);
    transition: width 180ms linear;
  }
  .warmup-caption {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--text-mute);
    min-height: 14px;
    text-align: center;
    opacity: 0;
    transition: opacity 300ms ease;
  }
  .warmup-caption.show { opacity: 1; }

  /* ── Reduced motion ──────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .agent-row.speaking .agent-status .dot,
    .status-bar .pulse { animation: none; }
    .transcript { scroll-behavior: auto; }
    .warmup-avatar::after { animation: none; }
    .warmup-title, .warmup-subtitle, .warmup-seat,
    .warmup-progress, .warmup-caption {
      transition: none;
    }
  }
</style>
</head>
<body>
<div class="app">
  <header class="header" role="banner">
    <div class="left">
      <a class="back" href="/?token=${safeToken}${safeChatId ? `&chatId=${safeChatId}` : ''}" aria-label="Back to Mission Control" title="Back to Mission Control">←</a>
      <div class="brand">
        <div class="brand-title">War Room</div>
        <div class="brand-sub">Text mode</div>
      </div>
      <div class="meta">
        <span class="meta-chip timer" title="Elapsed time"><span id="elapsed">0:00</span></span>
        <span class="meta-chip pin" id="pinInfo" style="display:none"><span class="dot" aria-hidden="true"></span><span id="pinInfoAgent"></span> pinned</span>
        <span class="meta-chip fresh" id="freshBadge" style="display:none">fresh meeting</span>
      </div>
    </div>
    <div class="right">
      <button class="btn" id="btn-switch-voice" aria-label="Switch to voice mode">Voice mode</button>
      <button class="btn danger" id="btn-end" aria-label="End meeting">End meeting</button>
    </div>
  </header>

  <nav class="roster team" aria-label="Agents" id="roster">
    <div class="roster-header">
      <span role="heading" aria-level="2">Team</span>
      <div class="roster-layout-pick" role="group" aria-label="Agent rail layout">
        <button type="button" data-layout="compact"     title="Compact (row)">S</button>
        <button type="button" data-layout="comfortable" title="Comfortable (card)">M</button>
        <button type="button" data-layout="spacious"    title="Spacious (large card)">L</button>
      </div>
    </div>
    <div role="list" id="roster-list"></div>
  </nav>

  <main class="main">
    <div class="banner hidden" id="banner" role="status" aria-live="polite"></div>
    <div class="transcript" id="transcript" role="log" aria-live="polite" aria-relevant="additions"></div>
    <button class="scroll-pill" id="scrollPill">↓ New messages</button>
    <div class="status-bar idle" id="statusBar" role="status" aria-live="polite">
      <span class="pulse" aria-hidden="true"></span>
      <span id="statusText"></span>
    </div>
    <form class="composer" id="composerForm">
      <div class="mention-popup" id="mention-popup" role="listbox" aria-label="Agent suggestions" hidden></div>
      <div class="slash-popup" id="slash-popup" role="listbox" aria-label="Slash commands" hidden></div>
      <textarea
        id="composer"
        placeholder="Message the team — try /standup or @agent"
        rows="1"
        aria-label="Message composer"
        aria-autocomplete="list"
        aria-controls="mention-popup slash-popup"
        autofocus></textarea>
      <div class="actions">
        <button type="button" class="commands-btn" id="btn-commands" aria-haspopup="listbox" aria-controls="slash-popup" aria-expanded="false" title="Show slash commands">/ Commands</button>
        <button type="button" class="stop" id="btn-stop" aria-label="Stop current turn">Stop</button>
        <button type="submit" class="send" id="btn-send" disabled>Send</button>
      </div>
    </form>
  </main>
</div>

<div class="warmup-overlay" id="warmup" role="status" aria-live="polite" aria-label="Assembling the team">
  <div class="warmup-title" id="warmup-title">The War Room</div>
  <div class="warmup-subtitle" id="warmup-subtitle">assembling the team</div>
  <div class="warmup-lineup" id="warmup-lineup"></div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
    <div class="warmup-progress" id="warmup-progress"><div class="bar" id="warmup-bar"></div></div>
    <div class="warmup-caption" id="warmup-caption"></div>
  </div>
</div>

<div class="dialog-backdrop" id="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="dialog">
    <h2 id="dialog-title"></h2>
    <p id="dialog-body"></p>
    <div class="actions">
      <button class="btn" id="dialog-cancel">Cancel</button>
      <button class="btn danger" id="dialog-confirm"></button>
    </div>
  </div>
</div>

<script>
'use strict';
const TOKEN = ${jsToken};
const CHAT_ID = ${jsChatId};
const MEETING_ID = ${jsMeetingId};
const API = window.location.origin;
// Q/MEETING_Q carry chatId so the server can validate that the request
// matches the meeting's chat_id (strict-validate guard). Server treats
// the param as authoritative — a stale meetingId from another chat is
// rejected with 403 rather than silently scoping under the wrong chat.
const Q = '?token=' + encodeURIComponent(TOKEN) + (CHAT_ID ? '&chatId=' + encodeURIComponent(CHAT_ID) : '');
const MEETING_Q = Q + '&meetingId=' + encodeURIComponent(MEETING_ID);

// Single avatar URL builder. Hits the same tokenized /api endpoint
// Mission Control uses, so the user's uploaded or Telegram-cached
// photo propagates everywhere instead of dropping back to repo art.
// avatarEtag (mtime+size) is appended for cache busting; the server
// also serves no-cache + ETag so 304 revalidation handles steady state.
function avatarUrl(agentId, avatarEtag) {
  let url = '/api/agents/' + encodeURIComponent(agentId) + '/avatar' + Q;
  if (avatarEtag) url += '&v=' + encodeURIComponent(avatarEtag);
  return url;
}

// Client-side XSS defense. We only ever inject user-controlled text via
// .textContent, but a few spots set innerHTML with static templates that
// include escaped values.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Minimal + safe markdown renderer. Escapes ALL input first, then applies a
// whitelist of formatting patterns. Supports: **bold**, *italic*, \`inline code\`,
// single-line code fences. Anything else stays as text (pre-wrap preserves
// whitespace so lists like "- item" and "1. item" read fine without <ul>).
// Always called AFTER esc() so no raw HTML can slip through.
function mdInline(escapedText) {
  // Inline code first so its contents don't get asterisk-processed.
  let out = escapedText.replace(/\`([^\`\\n]+?)\`/g, (_, code) => {
    return '<code style="font-family:ui-monospace,monospace;font-size:12px;background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:4px">' + code + '</code>';
  });
  // Bold then italic. Non-greedy. Require non-space at boundaries so we don't
  // match stray asterisks.
  out = out.replace(/\\*\\*([^*\\n][^*\\n]*?)\\*\\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\\*([^*\\s][^*\\n]*?)\\*/g, '$1<em>$2</em>');
  return out;
}
function renderMarkdown(raw) {
  // Strip leading/trailing whitespace and collapse any run of 3+ newlines
  // to a single paragraph break. Models occasionally prepend "\\n\\n" to
  // their responses; without this the bubble starts with visible blank
  // lines because white-space:pre-wrap honors them.
  const cleaned = String(raw == null ? '' : raw)
    .replace(/^[\\s\\n]+/, '')
    .replace(/[\\s\\n]+$/, '')
    .replace(/\\n{3,}/g, '\\n\\n');
  return mdInline(esc(cleaned));
}

// ── Roster ──
let roster = []; // [{id, name, description}]
const rosterById = new Map();
let pinnedAgent = null;

function agentAccent(id) {
  if (['main','research','comms','content','ops'].includes(id)) return 'accent-' + id;
  return 'accent-default';
}
function agentInitials(name) {
  const parts = String(name || '').trim().split(/\\s+/);
  if (parts.length === 0) return '?';
  return (parts[0][0] || '') + (parts[1] ? parts[1][0] : '');
}

function renderRoster() {
  // MSN-style pill layout: round avatar | name + status line | dot.
  // The status line is fed by the hive_mind polling loop below; until
  // that fires, fall back to the agent's description so the row never
  // looks half-empty.
  const el = document.getElementById('roster-list');
  if (!el) return;
  el.innerHTML = '';
  for (const a of roster) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'agent-row';
    row.id = 'agent-row-' + esc(a.id);
    row.setAttribute('data-agent', a.id);
    row.setAttribute('role', 'listitem');

    const av = document.createElement('div');
    av.className = 'agent-avatar';
    const img = document.createElement('img');
    img.src = avatarUrl(a.id, a.avatar_etag);
    img.alt = '';
    img.onerror = () => { img.remove(); av.textContent = agentInitials(a.name).toUpperCase(); };
    av.appendChild(img);

    const meta = document.createElement('div');
    meta.className = 'agent-meta';

    const nm = document.createElement('div');
    nm.className = 'agent-name';
    const nameText = document.createElement('span');
    nameText.textContent = a.name;
    const dot = document.createElement('span');
    dot.className = 'agent-status-dot';
    dot.setAttribute('aria-hidden', 'true');
    nm.appendChild(nameText);
    nm.appendChild(dot);

    // The cascading "what they last did" line. The hive_mind fetcher
    // populates this via setAgentStatus, which both updates the text
    // and (if the text overflows) starts a marquee scroll inside the
    // ticker. The description acts as a placeholder until the first
    // hive_mind fetch completes.
    const statusLine = document.createElement('div');
    statusLine.className = 'agent-status-line empty';
    statusLine.id = 'agent-status-' + esc(a.id);
    const ticker = document.createElement('div');
    ticker.className = 'agent-ticker';
    const tickerText = document.createElement('span');
    tickerText.className = 'agent-ticker-text';
    // Empty placeholder copy: actionable + agent-aware. The previous
    // fallback was the agent.yaml description, which made a zero-hive
    // agent look like a real (but oddly-formatted) entry — spotted in
    // the demo because Content had no hive_mind rows but its row read
    // "YouTube scripts, LinkedIn posts" same as a real summary. Now
    // it reads as a clear placeholder until the first hive entry
    // lands. setAgentStatus flips this to the real entry on update.
    tickerText.textContent = 'No activity yet — @' + a.id + ' to start.';
    ticker.appendChild(tickerText);
    statusLine.appendChild(ticker);

    const time = document.createElement('div');
    time.className = 'agent-status-time';
    time.id = 'agent-status-time-' + esc(a.id);

    meta.appendChild(nm);
    meta.appendChild(statusLine);
    meta.appendChild(time);

    row.appendChild(av);
    row.appendChild(meta);
    row.onclick = () => togglePin(a.id);
    row.setAttribute('aria-label', a.name + ', ' + a.description);
    el.appendChild(row);
  }
  applyRosterState();
  // Kick off the hive-mind backfill so the rail fills in without
  // waiting for the next 30-second tick.
  void refreshAgentStatuses();
}

/** Update one agent's status line with a 200ms cross-fade, then start
 *  the marquee scroll if the new text overflows the container. Newscast-
 *  style: text holds at the start, scrolls right-to-left, holds at the
 *  end, repeats. Idempotent — if the new summary equals the current
 *  text, just leave the existing marquee alone. */
function setAgentStatus(id, summary, ts) {
  const el = document.getElementById('agent-status-' + id);
  const tEl = document.getElementById('agent-status-time-' + id);
  if (!el) return;
  if (el.dataset.summary === summary) return; // no change → no fade
  el.dataset.summary = summary;
  el.classList.add('fade-out');
  setTimeout(() => {
    const ticker = el.querySelector('.agent-ticker');
    const tickerText = el.querySelector('.agent-ticker-text');
    if (tickerText) tickerText.textContent = summary || 'Quiet today.';
    el.classList.toggle('empty', !summary);
    el.classList.remove('fade-out');
    if (tEl) tEl.textContent = ts ? formatStatusTime(ts) : '';
    // Start marquee if text doesn't fit. Compute distance after layout
    // settles. Speed: ~32 chars per second feels readable.
    if (ticker && tickerText) {
      ticker.classList.remove('scrolling');
      requestAnimationFrame(() => {
        const overflow = tickerText.scrollWidth - ticker.clientWidth;
        if (overflow > 8) {
          const seconds = Math.max(8, Math.round(tickerText.scrollWidth / 32));
          ticker.style.setProperty('--ticker-distance', '-' + overflow + 'px');
          ticker.style.setProperty('--ticker-duration', seconds + 's');
          ticker.classList.add('scrolling');
        }
      });
    }
  }, 200);
}

/** Compact relative time for status timestamps. "12s ago" / "5m ago" /
 *  "3h ago" / "2d ago". Mirrors the format helper in the v2 dashboard so
 *  the look is consistent across surfaces. */
function formatStatusTime(unixSecs) {
  const now = Math.floor(Date.now() / 1000);
  const d = Math.max(0, now - unixSecs);
  if (d < 60) return d + 's ago';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

/** Per-agent buffer of recent hive_mind entries. We keep the last 3 so
 *  the rotation tick can cycle through them — newscast style — instead
 *  of just hammering the latest. */
const agentHistory = {};   // { [agent_id]: [{summary, created_at}, ...] }
const agentCursor = {};    // { [agent_id]: index into history }

/** Pull the latest hive_mind entries and patch each agent's buffer.
 *  We fetch in bulk (limit=120) and reduce client-side to "last 3 per
 *  agent" — one round-trip per refresh regardless of roster size. */
async function refreshAgentStatuses() {
  try {
    const res = await fetch(API + '/api/hive-mind?limit=120' + Q.replace(/^\\?/, '&'));
    if (!res.ok) return;
    const data = await res.json();
    const entries = (data && data.entries) ? data.entries : [];
    // entries are returned newest-first
    const buf = {};
    for (const e of entries) {
      if (!buf[e.agent_id]) buf[e.agent_id] = [];
      if (buf[e.agent_id].length < 3) buf[e.agent_id].push(e);
    }
    for (const a of roster) {
      const list = buf[a.id] || [];
      agentHistory[a.id] = list;
      // If the cursor is now past the end, reset it. Otherwise leave
      // the user-visible position alone so the rotation feels smooth.
      if ((agentCursor[a.id] || 0) >= list.length) agentCursor[a.id] = 0;
      const cur = list[agentCursor[a.id] || 0];
      if (cur && cur.summary) setAgentStatus(a.id, cur.summary, cur.created_at);
    }
  } catch (err) {
    // Best effort — leave the existing line in place on network blip.
  }
}

/** Advance every agent's status to the next entry in their history.
 *  Skips agents with only one entry (no cycling needed). Wraps around
 *  at the end. */
function rotateAgentStatuses() {
  for (const a of roster) {
    const list = agentHistory[a.id];
    if (!list || list.length <= 1) continue;
    const next = ((agentCursor[a.id] || 0) + 1) % list.length;
    agentCursor[a.id] = next;
    const e = list[next];
    if (e && e.summary) setAgentStatus(a.id, e.summary, e.created_at);
  }
}

// Refresh from the server every 30s, rotate through each agent's
// recent entries every 6s. The first refresh is kicked off by
// renderRoster() once the roster is in place.
setInterval(refreshAgentStatuses, 30_000);
setInterval(rotateAgentStatuses, 6_000);

// ── Roster layout picker ──
// Three presets (compact / comfortable / spacious) modify the .team
// container class. Persisted in localStorage so the choice sticks
// across reloads — same per-browser pattern as the other privacy /
// scale prefs in the v2 dashboard.
const LAYOUT_KEY = 'claudeclaw.warroom.rosterLayout';
const VALID_LAYOUTS = ['compact', 'comfortable', 'spacious'];

function applyRosterLayout(name) {
  const next = VALID_LAYOUTS.indexOf(name) >= 0 ? name : 'comfortable';
  const team = document.getElementById('roster');
  if (!team) return;
  for (const v of VALID_LAYOUTS) team.classList.remove('layout-' + v);
  team.classList.add('layout-' + next);
  // Reflect on the picker buttons.
  document.querySelectorAll('.roster-layout-pick button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === next);
  });
  try { localStorage.setItem(LAYOUT_KEY, next); } catch {}
  // Marquee distance changes with the new layout — recompute on each
  // visible status line so the scroll matches the new container width.
  setTimeout(() => {
    for (const a of roster) {
      const list = agentHistory[a.id];
      if (!list) continue;
      const cur = list[agentCursor[a.id] || 0];
      if (!cur) continue;
      // Force re-evaluation by clearing the dataset cache and re-applying.
      const el = document.getElementById('agent-status-' + a.id);
      if (el) el.dataset.summary = '__forced__';
      setAgentStatus(a.id, cur.summary, cur.created_at);
    }
  }, 50);
}

function initRosterLayoutPicker() {
  let initial = 'comfortable';
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v && VALID_LAYOUTS.indexOf(v) >= 0) initial = v;
  } catch {}
  applyRosterLayout(initial);
  document.querySelectorAll('.roster-layout-pick button').forEach((b) => {
    b.addEventListener('click', () => applyRosterLayout(b.dataset.layout));
  });
}
// Attach as soon as the DOM is parsed. The script lives at the end of
// <body> so the picker buttons are guaranteed to exist by now.
initRosterLayoutPicker();

function applyRosterState() {
  // The row classes (pinned/selected/speaking) drive the avatar ring,
  // border, background, and the status dot's color via CSS — no need to
  // touch a label element. Just keep aria-label fresh for screen readers.
  for (const a of roster) {
    const row = document.getElementById('agent-row-' + a.id);
    if (!row) continue;
    // Priority: speaking > selected > pinned > idle
    row.classList.remove('pinned', 'selected', 'speaking');
    if (speakingAgents.has(a.id)) {
      row.classList.add('speaking');
      row.setAttribute('aria-label', a.name + ', typing');
    } else if (selectedAgents.has(a.id)) {
      row.classList.add('selected');
      row.setAttribute('aria-label', a.name + ', selected this turn');
    } else if (pinnedAgent === a.id) {
      row.classList.add('pinned');
      row.setAttribute('aria-label', a.name + ', pinned as primary');
    } else {
      row.setAttribute('aria-label', a.name + ', ' + a.description);
    }
  }
  // Pin info in header
  const info = document.getElementById('pinInfo');
  const infoAgent = document.getElementById('pinInfoAgent');
  if (pinnedAgent) {
    info.style.display = '';
    infoAgent.textContent = rosterById.get(pinnedAgent)?.name || pinnedAgent;
  } else {
    info.style.display = 'none';
  }
}

const speakingAgents = new Set();
const selectedAgents = new Set();

// ── Transcript ──
const transcriptEl = document.getElementById('transcript');
let nearBottom = true;
// Pagination cursor: oldest row currently rendered. Used by the "Load
// earlier" control to fetch older rows via beforeTs+beforeId.
let oldestTs = null;
let oldestId = null;
let moreHistoryAvailable = false;
let loadingEarlier = false;

function isNearBottom() {
  const { scrollTop, scrollHeight, clientHeight } = transcriptEl;
  return scrollHeight - scrollTop - clientHeight < 120;
}
function scrollToBottom(force) {
  if (force || nearBottom) {
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  } else {
    document.getElementById('scrollPill').classList.add('show');
  }
}
transcriptEl.addEventListener('scroll', () => {
  nearBottom = isNearBottom();
  if (nearBottom) document.getElementById('scrollPill').classList.remove('show');
});
document.getElementById('scrollPill').addEventListener('click', () => {
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  document.getElementById('scrollPill').classList.remove('show');
});

function fmtTs(tsSeconds) {
  const seconds = typeof tsSeconds === 'number' && tsSeconds > 0
    ? tsSeconds
    : Date.now() / 1000;
  const d = new Date(seconds * 1000);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'p' : 'a';
  const hr = h % 12 || 12;
  return hr + ':' + m + ampm;
}

function appendUserBubble(text, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'bubble user';
  const body = document.createElement('div');
  body.className = 'user-body';
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = text;
  body.appendChild(content);
  const ts = document.createElement('div');
  ts.className = 'ts';
  // When rendering history, callers pass opts.createdAt so the stamp
  // reflects when the message was originally sent — not "now".
  ts.textContent = fmtTs(opts && opts.createdAt);
  body.appendChild(ts);
  wrap.appendChild(body);
  if (opts && opts.clientMsgId) wrap.dataset.clientMsgId = opts.clientMsgId;
  // Optional transcriptRowId so position-aware insertion can keep DOM
  // order in sync with DB order. When a slow intervener from the
  // previous turn finishes AFTER the new turn started, its agent_done
  // event lands AFTER turn_start at the client even though its DB row
  // is earlier. Without this hint we'd append the user bubble at the
  // end and visually leapfrog the late intervener.
  if (opts && typeof opts.transcriptRowId === 'number') {
    wrap.dataset.transcriptRowId = String(opts.transcriptRowId);
    insertBubbleByRowId(wrap, opts.transcriptRowId);
  } else {
    transcriptEl.appendChild(wrap);
  }
  scrollToBottom();
  return wrap;
}

// Insert "wrap" into the transcript at the position implied by "rowId".
// We walk existing bubbles and find the first one whose data-transcript-
// row-id is greater than rowId; insert before it. Bubbles without a
// rowId (typing placeholders, divider markers) are skipped — placeholders
// resolve to a real rowId on agent_done, and dividers belong wherever
// they were appended.
function insertBubbleByRowId(wrap, rowId) {
  const sibs = transcriptEl.children;
  for (let i = 0; i < sibs.length; i++) {
    const s = sibs[i];
    const sId = parseInt(s.dataset && s.dataset.transcriptRowId || '0', 10);
    if (sId && sId > rowId) {
      transcriptEl.insertBefore(wrap, s);
      return;
    }
  }
  transcriptEl.appendChild(wrap);
}

function markUserBubbleFailed(clientMsgId, onRetry) {
  const b = transcriptEl.querySelector('.bubble.user[data-client-msg-id="' + CSS.escape(clientMsgId) + '"]');
  if (!b) return;
  b.classList.add('failed');
  const existingRetry = b.querySelector('.retry');
  if (!existingRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'retry';
    btn.textContent = 'retry';
    btn.onclick = () => { btn.remove(); b.classList.remove('failed'); onRetry && onRetry(); };
    b.querySelector('div').appendChild(btn);
  }
}

const agentBubbleByTurn = new Map(); // turnId+agent -> element

// Rotating thinking-state captions shown next to the typing dots while
// the model is still composing. Same vibe as Claude Code's "Marinating /
// Pondering / Synthesizing" loop. Stops the moment a real chunk lands
// (phase flips off 'waiting').
const THINKING_CAPTIONS = [
  'thinking',
  'marinating',
  'pondering',
  'synthesizing',
  'cross-referencing',
  'putting it together',
  'pulling the thread',
  'connecting the dots',
  'cooking',
  'lining up the angle',
  'gut-checking',
  'checking my notes',
  'reading the room',
  'finding the receipts',
  'sketching it out',
  'sanity-checking',
  'narrowing down',
  'shaping the answer',
  'going deeper',
  'untangling it',
  'almost there',
  'brewing',
  'doing the math',
  'weighing options',
  'getting specific',
  'lining up evidence',
  'considering',
  'reflecting',
  'distilling',
  'rephrasing',
  'sharpening',
  'composing',
];
function pickThinkingCaption(prev) {
  // Avoid repeating the previous caption back-to-back.
  let pick = THINKING_CAPTIONS[Math.floor(Math.random() * THINKING_CAPTIONS.length)];
  if (prev && prev === pick) {
    pick = THINKING_CAPTIONS[(THINKING_CAPTIONS.indexOf(pick) + 1) % THINKING_CAPTIONS.length];
  }
  return pick;
}
function startThinkingRotation(content) {
  const cap = content.querySelector('.thinking-caption');
  if (!cap) return;
  let last = cap.textContent || '';
  const startedAt = Date.now();
  const tick = () => {
    // Bail if streaming has started or the bubble was removed.
    if (!cap.isConnected || content.dataset.phase !== 'waiting') return;
    cap.classList.add('fade');
    setTimeout(() => {
      if (!cap.isConnected || content.dataset.phase !== 'waiting') return;
      last = pickThinkingCaption(last);
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      // Past 8s, append an elapsed-time hint so the user knows the
      // agent is still alive even when the model is cold-starting.
      // This addresses the demo failure mode where Meta took >10s
      // and the user worried the bot was hung.
      const suffix = elapsedSec >= 8 ? ' · still on it (' + elapsedSec + 's)' : '';
      cap.textContent = last + suffix;
      cap.classList.remove('fade');
    }, 220);
  };
  const interval = setInterval(() => {
    if (!cap.isConnected || content.dataset.phase !== 'waiting') {
      clearInterval(interval);
      return;
    }
    tick();
  }, 2400);
}

function appendAgentBubble(turnId, agentId, role, createdAt) {
  const key = turnId + ':' + agentId;
  let el = agentBubbleByTurn.get(key);
  if (el) return el;

  const wrap = document.createElement('div');
  wrap.className = 'bubble agent' + (role === 'intervener' ? ' intervener' : '');
  wrap.dataset.turnId = turnId;
  wrap.dataset.agentId = agentId;

  const av = document.createElement('div');
  av.className = 'avatar';
  const img = document.createElement('img');
  img.src = avatarUrl(agentId, rosterById.get(agentId)?.avatar_etag);
  img.alt = '';
  img.onerror = () => { img.remove(); av.textContent = agentInitials(rosterById.get(agentId)?.name || agentId).toUpperCase(); };
  av.appendChild(img);

  const body = document.createElement('div');
  body.className = 'body';
  const hdr = document.createElement('div');
  hdr.className = 'header-line';
  const nm = document.createElement('span');
  nm.className = 'name';
  nm.textContent = rosterById.get(agentId)?.name || agentId;
  const ts = document.createElement('span');
  ts.className = 'ts';
  // History-loaded bubbles pass the original createdAt so the timestamp
  // reflects when the agent actually spoke, not reload time.
  ts.textContent = fmtTs(createdAt);
  hdr.appendChild(nm);
  hdr.appendChild(ts);
  if (role === 'intervener') {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'chiming in';
    hdr.appendChild(tag);
  }
  const content = document.createElement('div');
  content.className = 'content ' + agentAccent(agentId);
  // Screen readers watching the transcript log would otherwise announce
  // every streaming delta. aria-busy="true" suppresses announcement while
  // chunks flow; finalizeAgentBubble flips it to false so SRs read the
  // complete message once. Matches the pattern recommended by WAI-ARIA.
  content.setAttribute('aria-busy', 'true');
  // Fresh bubbles get a typing-dots placeholder so the bubble never shows
  // as an empty box during the pre-stream window. The first chunk wipes
  // the placeholder and starts appending text. A rotating "thinking
  // caption" sits next to the dots so the user has something more
  // textured than three dots while the SDK is cold-starting.
  content.dataset.phase = 'waiting';
  const startCaption = pickThinkingCaption();
  content.innerHTML =
    '<span class="thinking">' +
      '<span class="typing-dots"><span></span><span></span><span></span></span>' +
      '<span class="thinking-caption" data-thinking-caption="1">' + startCaption + '</span>' +
    '</span>';
  startThinkingRotation(content);
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'copy';
  copyBtn.textContent = '📋 Copy';
  copyBtn.setAttribute('aria-label', 'Copy response from ' + (rosterById.get(agentId)?.name || agentId));
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(content.textContent || '').then(() => {
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
    });
  };

  body.appendChild(hdr);
  body.appendChild(content);
  body.appendChild(copyBtn);
  wrap.appendChild(av);
  wrap.appendChild(body);
  transcriptEl.appendChild(wrap);
  agentBubbleByTurn.set(key, wrap);
  scrollToBottom();
  return wrap;
}

function finalizeAgentBubble(turnId, agentId, text, incomplete, role, transcriptRowId) {
  // Role defaults to primary for legacy callers. The chiming-in tag
  // and indented layout come from passing 'intervener' here — critical
  // for the reload/reconnect path where we receive agent_done without
  // a prior agent_typing that would have set the role.
  const bubble = appendAgentBubble(turnId, agentId, role || 'primary');
  // Reconnect path: a previously-rendered bubble may have been created
  // with the wrong role (e.g. agent_chunk arrived without a role hint
  // before agent_done landed). Update its style to match the canonical
  // role from agent_done so the chiming-in indent + tag are correct.
  if (role === 'intervener') {
    bubble.classList.add('intervener');
    const hdr = bubble.querySelector('.header-line');
    if (hdr && !hdr.querySelector('.tag:not(.incomplete)')) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'chiming in';
      hdr.appendChild(tag);
    }
  } else if (role === 'primary') {
    bubble.classList.remove('intervener');
  }
  // Anchor for history/SSE dedup. Without this attribute, a reload after
  // an agent_done lands could double-render the same row.
  if (transcriptRowId != null) {
    bubble.dataset.transcriptRowId = String(transcriptRowId);
    // Position-aware repositioning: if a later sibling already carries a
    // larger rowId, this bubble was appended out of order (a late-finishing
    // intervener whose agent_done arrived after a newer turn's turn_start
    // already appended its user bubble). Re-slot the bubble where it
    // belongs so DOM order matches DB order.
    const sibs = transcriptEl.children;
    const myIdx = Array.prototype.indexOf.call(sibs, bubble);
    let shouldMove = false;
    for (let i = 0; i < myIdx; i++) {
      const sId = parseInt(sibs[i].dataset && sibs[i].dataset.transcriptRowId || '0', 10);
      if (sId && sId > transcriptRowId) { shouldMove = true; break; }
    }
    if (shouldMove) insertBubbleByRowId(bubble, transcriptRowId);
  }
  const content = bubble.querySelector('.content');
  // Replace the streamed textContent (or typing-dots placeholder) with a
  // rendered, whitespace-normalized markdown version. Leading newlines
  // from the model are stripped; excessive paragraph breaks are capped
  // at one blank line.
  content.innerHTML = renderMarkdown(text);
  content.dataset.phase = 'done';
  // Flip aria-busy off so screen readers announce the complete message
  // once, instead of chunk-by-chunk during streaming.
  content.setAttribute('aria-busy', 'false');
  if (incomplete) {
    const hdr = bubble.querySelector('.header-line');
    if (hdr && !hdr.querySelector('.tag.incomplete')) {
      const tag = document.createElement('span');
      tag.className = 'tag incomplete';
      tag.textContent = 'incomplete';
      hdr.appendChild(tag);
    }
  }
}

function appendSystemNote(text, tone, opts) {
  const wrap = document.createElement('div');
  wrap.className = 'bubble system' + (tone === 'warn' ? ' warn' : '');
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = text;
  wrap.appendChild(content);
  transcriptEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function appendDivider(text) {
  const wrap = document.createElement('div');
  wrap.className = 'bubble divider';
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = text;
  wrap.appendChild(content);
  transcriptEl.appendChild(wrap);
  scrollToBottom();
}

// ── Status bar ──
function setStatus(text, active) {
  const sb = document.getElementById('statusBar');
  document.getElementById('statusText').textContent = text || '';
  // The bar reserves a permanent 30px row and fades via opacity. When
  // there's no real text to display we show the idle (transparent) state.
  const shouldShow = active && !!text;
  sb.classList.toggle('active', shouldShow);
  sb.classList.toggle('idle', !shouldShow);
  // Activation can change effective viewport bottom by 30px; if the user
  // was already pinned to the latest bubble, keep them pinned so the new
  // status text doesn't visually clip the last message. nearBottom is
  // tracked at scroll time in this file.
  if (shouldShow && nearBottom) scrollToBottom(false);
}

// ── Banner (reconnect etc.) ──
function showBanner(text, tone) {
  const b = document.getElementById('banner');
  b.classList.remove('hidden', 'warn', 'error');
  if (tone === 'warn') b.classList.add('warn');
  if (tone === 'error') b.classList.add('error');
  b.textContent = '';
  const msg = document.createElement('span');
  msg.textContent = text;
  b.appendChild(msg);
}
function hideBanner() {
  document.getElementById('banner').classList.add('hidden');
}

// ── Stop button visibility ──
let turnInFlight = false;
function setTurnInFlight(v) {
  turnInFlight = v;
  document.getElementById('btn-stop').classList.toggle('show', v);
  if (!v) {
    selectedAgents.clear();
    speakingAgents.clear();
    applyRosterState();
  }
}

// ── SSE ──
let es = null;
let lastSeq = 0;
let hasConnectedOnce = false;
let currentTurnId = null;
const SEQ_KEY = 'warroom-text-seq:' + MEETING_ID;
try { lastSeq = parseInt(sessionStorage.getItem(SEQ_KEY) || '0', 10) || 0; } catch (e) {}

function connectSSE() {
  if (es) { try { es.close(); } catch (e) {} es = null; }
  const url = API + '/api/warroom/text/stream' + MEETING_Q + '&sinceSeq=' + lastSeq;
  // On the very first connection (fresh page load) we do NOT flash a
  // Reconnecting banner — that's alarming on a pristine demo. Only later
  // retries (triggered from onerror) show the reconnect warning.
  if (hasConnectedOnce) {
    showBanner('Reconnecting…', 'warn');
  }
  const newEs = new EventSource(url);
  es = newEs;
  newEs.onopen = () => {
    // On every reconnect (not the first connect), force-clear any stale
    // typing indicators. Without this, an SSE drop that lands BETWEEN an
    // agent_typing and its agent_done — and outside the ring buffer's
    // replay window — leaves the roster painted with phantom speakers
    // and a stuck "agent typing…" status forever. The replay (sinceSeq)
    // is authoritative for events, so clearing is safe: any genuinely
    // still-typing agent will be repainted by its next chunk replay.
    if (hasConnectedOnce) {
      try {
        speakingAgents.clear();
        selectedAgents.clear();
        applyRosterState();
      } catch (e) {}
    }
    hasConnectedOnce = true;
    hideBanner();
  };
  newEs.onmessage = (e) => handleSSE(JSON.parse(e.data));
  newEs.onerror = () => {
    if (es === newEs) {
      showBanner('Disconnected. Reconnecting…', 'error');
      setTimeout(() => { if (es === newEs) connectSSE(); }, 2000);
    }
  };
}

function handleSSE(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (typeof payload.seq === 'number' && payload.seq > lastSeq) {
    lastSeq = payload.seq;
    try { sessionStorage.setItem(SEQ_KEY, String(lastSeq)); } catch (e) {}
  }
  const ev = payload.event;
  if (!ev || !ev.type) return;

  switch (ev.type) {
    case 'meeting_state': {
      roster = ev.agents;
      rosterById.clear();
      for (const a of roster) rosterById.set(a.id, a);
      pinnedAgent = ev.pinnedAgent;
      renderRoster();
      if (ev.isFresh) {
        const badge = document.getElementById('freshBadge');
        badge.style.display = '';
        setTimeout(() => { badge.style.display = 'none'; }, 5000);
      }
      break;
    }
    case 'turn_start': {
      setTurnInFlight(true);
      // Track the active turn so downstream turn_aborted handlers can
      // tell whether the abort applies to this turn or a stale one.
      if (ev.turnId) currentTurnId = ev.turnId;
      // Render user bubble if not already (e.g. coming back on a different tab).
      // If the optimistic local bubble already exists (created in sendMessage
      // before the server roundtrip), stamp the authoritative rowId onto it
      // so position-aware re-insertion via insertBubbleByRowId works for
      // late-arriving agent_done events from the previous turn.
      if (ev.clientMsgId) {
        const existing = transcriptEl.querySelector('.bubble.user[data-client-msg-id="' + CSS.escape(ev.clientMsgId) + '"]');
        if (existing) {
          if (typeof ev.userTranscriptRowId === 'number' && !existing.dataset.transcriptRowId) {
            existing.dataset.transcriptRowId = String(ev.userTranscriptRowId);
            // Re-slot if a later sibling has a smaller rowId (out-of-order).
            const sibs = transcriptEl.children;
            const myIdx = Array.prototype.indexOf.call(sibs, existing);
            for (let i = myIdx + 1; i < sibs.length; i++) {
              const sId = parseInt(sibs[i].dataset && sibs[i].dataset.transcriptRowId || '0', 10);
              if (sId && sId < ev.userTranscriptRowId) {
                insertBubbleByRowId(existing, ev.userTranscriptRowId);
                break;
              }
            }
          }
        } else {
          appendUserBubble(ev.userText, {
            clientMsgId: ev.clientMsgId,
            transcriptRowId: ev.userTranscriptRowId,
            createdAt: ev.userTs,
          });
        }
      }
      // Routing-degraded UX is delivered as a server-emitted system_note
      // (see orchestrator.ts handleTextTurn). The old turn_start.routerDegraded
      // branch was dead — the server never populated that field.
      break;
    }
    case 'status_update':
      // Streaming phase: the inline typing-dots + roster indicator
      // already convey "X is typing", so don't duplicate it in the
      // bottom status bar. Show everything else (routing, starting,
      // checking interveners).
      if (ev.phase === 'streaming') {
        setStatus('', false);
      } else {
        setStatus(ev.label, true);
      }
      break;
    case 'router_decision':
      selectedAgents.clear();
      if (ev.primary) selectedAgents.add(ev.primary);
      for (const id of ev.interveners || []) selectedAgents.add(id);
      applyRosterState();
      break;
    case 'agent_selected':
      selectedAgents.add(ev.agentId);
      applyRosterState();
      break;
    case 'agent_typing':
      speakingAgents.add(ev.agentId);
      applyRosterState();
      // Ensure the bubble exists so chunks have a target
      appendAgentBubble(ev.turnId, ev.agentId, ev.role);
      break;
    case 'agent_chunk': {
      // role can be missing on legacy events from older buffers; default
      // to 'primary'. New emits include it so reconnect-during-intervener
      // renders with the correct chiming-in style.
      const bubble = appendAgentBubble(ev.turnId, ev.agentId, ev.role || 'primary');
      const content = bubble.querySelector('.content');
      // First chunk arrives: wipe the typing-dots placeholder and start
      // fresh text. Subsequent chunks append normally.
      if (content.dataset.phase === 'waiting') {
        content.textContent = '';
        content.dataset.phase = 'streaming';
      }
      // Strip leading whitespace until the first real character. Models
      // sometimes prepend "\\n\\n" which the bubble's pre-wrap honors as
      // visible vertical gap — looks like an indented paragraph above
      // the actual reply. The finalize path already trims via renderMarkdown,
      // so we only need to handle the streaming case.
      let delta = ev.delta || '';
      if (!content.dataset.seenNonWS) {
        delta = delta.replace(/^\\s+/, '');
        if (delta) content.dataset.seenNonWS = '1';
      }
      if (delta) content.textContent = (content.textContent || '') + delta;
      scrollToBottom();
      break;
    }
    case 'agent_done': {
      speakingAgents.delete(ev.agentId);
      selectedAgents.delete(ev.agentId);
      applyRosterState();
      // Dedup against history: if the persisted transcript already
      // rendered a bubble for this row (via /history), the SSE replay
      // shouldn't duplicate it. The server attaches transcriptRowId to
      // every fresh agent_done specifically to anchor this dedup.
      if (ev.transcriptRowId != null) {
        const existing = transcriptEl.querySelector('[data-transcript-row-id="' + ev.transcriptRowId + '"]');
        if (existing) break;
      }
      finalizeAgentBubble(ev.turnId, ev.agentId, ev.text || '', ev.incomplete, ev.role, ev.transcriptRowId);
      break;
    }
    case 'tool_call': {
      // Tool calls are hidden behind a subtle disclosure so the chat
      // stays clean. A small "▸ 3 tool calls" line appears under the
      // agent's reply; clicking it expands the full list with args +
      // results. Implemented as native <details>/<summary> for keyboard
      // + screen-reader support out of the box.
      const bubble = appendAgentBubble(ev.turnId, ev.agentId, 'primary');
      const body = bubble.querySelector('.body') || bubble;
      let toolStrip = body.querySelector(':scope > .tool-calls');
      if (!toolStrip) {
        toolStrip = document.createElement('details');
        toolStrip.className = 'tool-calls';
        const summary = document.createElement('summary');
        summary.className = 'tool-summary';
        summary.textContent = '0 tool calls';
        toolStrip.appendChild(summary);
        const list = document.createElement('div');
        list.className = 'tool-list';
        toolStrip.appendChild(list);
        body.appendChild(toolStrip);
      }
      const list = toolStrip.querySelector('.tool-list');
      const row = document.createElement('div');
      row.className = 'tool-call pending';
      row.setAttribute('data-tool-use-id', ev.toolUseId);
      const wrench = document.createElement('span');
      wrench.className = 'tool-icon';
      wrench.textContent = '⚙';
      const name = document.createElement('code');
      name.className = 'tool-name';
      name.textContent = ev.tool;
      const args = document.createElement('span');
      args.className = 'tool-args';
      args.textContent = ev.argsPreview ? ' ' + ev.argsPreview : '';
      const status = document.createElement('span');
      status.className = 'tool-status';
      status.textContent = '…running';
      row.appendChild(wrench);
      row.appendChild(name);
      row.appendChild(args);
      row.appendChild(status);
      list.appendChild(row);
      updateToolSummary(toolStrip);
      break;
    }
    case 'tool_result': {
      const bubble = appendAgentBubble(ev.turnId, ev.agentId, 'primary');
      const body = bubble.querySelector('.body') || bubble;
      const row = body.querySelector('.tool-call[data-tool-use-id="' + CSS.escape(ev.toolUseId) + '"]');
      if (!row) break;
      row.classList.remove('pending');
      row.classList.add(ev.status === 'error' ? 'failed' : 'ok');
      const status = row.querySelector('.tool-status');
      if (status) {
        status.textContent = ev.status === 'error' ? '✗ error' : '✓ done';
        if (ev.resultPreview) {
          const detail = document.createElement('span');
          detail.className = 'tool-result-preview';
          detail.textContent = ' — ' + ev.resultPreview;
          status.appendChild(detail);
        }
      }
      // Re-summarize so the disclosure label reflects the latest state
      // (e.g. "3 tool calls (1 failed)") without expanding it.
      const strip = row.closest('.tool-calls');
      if (strip) updateToolSummary(strip);
      break;
    }
    case 'intervention_skipped': {
      selectedAgents.delete(ev.agentId);
      speakingAgents.delete(ev.agentId);
      applyRosterState();
      const key = ev.turnId + ':' + ev.agentId;
      const bubble = agentBubbleByTurn.get(key);
      if (!bubble) break;
      const content = bubble.querySelector('.content');
      const hadStream = content && content.dataset.phase === 'streaming';
      // Three sub-cases:
      //  (a) Primary that started typing then failed → KEEP the bubble
      //      with a clear "no reply / timed out" tag. Otherwise the
      //      visible "Research is typing…" just vanishes and the user
      //      thinks the system ate the response.
      //  (b) Intervener (or unknown role) that streamed real text then
      //      aborted → KEEP partial text with an "incomplete" tag.
      //  (c) Anything else (placeholder bubble, no real content,
      //      intervener that never streamed) → REMOVE the bubble.
      if (ev.role === 'primary') {
        if (content) {
          content.setAttribute('aria-busy', 'false');
          content.dataset.phase = 'done';
          if (!hadStream) {
            content.innerHTML = '<span style="opacity:0.55;font-style:italic">no reply produced</span>';
          }
        }
        const hdr = bubble.querySelector('.header-line');
        if (hdr && !hdr.querySelector('.tag.incomplete')) {
          const tag = document.createElement('span');
          tag.className = 'tag incomplete';
          tag.textContent = (ev.reason && ev.reason.indexOf('timed') >= 0) ? 'timed out' : 'no reply';
          hdr.appendChild(tag);
        }
      } else if (hadStream) {
        if (content) {
          content.setAttribute('aria-busy', 'false');
          content.dataset.phase = 'done';
        }
        const hdr = bubble.querySelector('.header-line');
        if (hdr && !hdr.querySelector('.tag.incomplete')) {
          const tag = document.createElement('span');
          tag.className = 'tag incomplete';
          tag.textContent = 'incomplete';
          hdr.appendChild(tag);
        }
      } else {
        bubble.remove();
        agentBubbleByTurn.delete(key);
      }
      break;
    }
    case 'turn_complete': {
      // Sweep any bubble for THIS turn that's still in pre-stream or
      // mid-stream phase:
      //   - phase 'waiting' (typing-dots placeholder, zero real content):
      //     REMOVE the bubble entirely. No card for an agent who never
      //     actually produced anything.
      //   - phase 'streaming' (got partial text before interruption):
      //     keep the partial content, mark [interrupted].
      // Scoping by turnId is important: a stale watchdog turn_complete
      // arriving while a newer turn is mid-stream shouldn't slap an
      // "interrupted" tag on the new turn's live bubbles.
      const sweepTurnId = ev.turnId;
      const selector = sweepTurnId
        ? '.bubble.agent[data-turn-id="' + CSS.escape(sweepTurnId) + '"]'
        : '.bubble.agent';
      const stuck = transcriptEl.querySelectorAll(selector);
      stuck.forEach((el) => {
        const content = el.querySelector('.content');
        if (!content) return;
        const phase = content.dataset.phase;
        const busy = content.getAttribute('aria-busy') === 'true';
        if (phase === 'waiting') {
          const key = (el.dataset.turnId || '') + ':' + (el.dataset.agentId || '');
          el.remove();
          agentBubbleByTurn.delete(key);
          return;
        }
        if (phase === 'streaming' || busy) {
          content.setAttribute('aria-busy', 'false');
          content.dataset.phase = 'done';
          const hdr = el.querySelector('.header-line');
          if (hdr && !hdr.querySelector('.tag.incomplete')) {
            const tag = document.createElement('span');
            tag.className = 'tag incomplete';
            tag.textContent = 'interrupted';
            hdr.appendChild(tag);
          }
        }
      });
      // Only collapse roster + status state if this turn_complete applies
      // to the currently active turn. A stale completion shouldn't yank
      // the spinner out from under a newer turn.
      const isCurrent = !currentTurnId || ev.turnId === currentTurnId;
      if (isCurrent) {
        selectedAgents.clear();
        speakingAgents.clear();
        applyRosterState();
        setTurnInFlight(false);
        currentTurnId = null;
        setStatus('', false);
      }
      updateEmptyState();
      break;
    }
    case 'turn_aborted': {
      // Only hide the Stop button / clear in-flight state when this abort
      // applies to the CURRENT turn. A stale abort (e.g. fast send ->
      // abort firing after a newer turn started) must not strip the Stop
      // button from the live turn.
      const isCurrent = !currentTurnId || ev.turnId === currentTurnId;
      if (isCurrent) {
        setTurnInFlight(false);
        currentTurnId = null;
        setStatus('Turn stopped.', false);
        appendSystemNote('Turn stopped.', 'info');
      }
      // Sweep ALL bubbles tied to this turnId, not just clearedAgents:
      //   - clearedAgents is empty for the watchdog backstop, but we still
      //     want to clean up any visible "Research is typing…" placeholders
      //     left mid-stream when the turn died.
      //   - phase 'waiting' (typing dots only) → REMOVE.
      //   - phase 'streaming' or busy → mark interrupted, keep partial text.
      const sweepTurnId = ev.turnId;
      const stuckSelector = sweepTurnId
        ? '.bubble.agent[data-turn-id="' + CSS.escape(sweepTurnId) + '"]'
        : '.bubble.agent';
      const stuck = transcriptEl.querySelectorAll(stuckSelector);
      stuck.forEach((el) => {
        const content = el.querySelector('.content');
        if (!content) return;
        const phase = content.dataset.phase;
        const busy = content.getAttribute('aria-busy') === 'true';
        if (phase === 'waiting') {
          const key = (el.dataset.turnId || '') + ':' + (el.dataset.agentId || '');
          el.remove();
          agentBubbleByTurn.delete(key);
          return;
        }
        if (phase === 'streaming' || busy) {
          content.setAttribute('aria-busy', 'false');
          content.dataset.phase = 'done';
          const hdr = el.querySelector('.header-line');
          if (hdr && !hdr.querySelector('.tag.incomplete')) {
            const tag = document.createElement('span');
            tag.className = 'tag incomplete';
            tag.textContent = 'interrupted';
            hdr.appendChild(tag);
          }
        }
      });
      // clearedAgents drives roster-indicator cleanup explicitly — bubbles
      // got swept above already.
      for (const agentId of ev.clearedAgents || []) {
        if (isCurrent) {
          selectedAgents.delete(agentId);
          speakingAgents.delete(agentId);
        }
      }
      if (isCurrent) applyRosterState();
      break;
    }
    case 'system_note':
      appendSystemNote(ev.text, ev.tone);
      break;
    case 'divider':
      appendDivider(ev.text);
      break;
    case 'error':
      appendSystemNote('Error: ' + ev.message, 'warn');
      setTurnInFlight(false);
      break;
    case 'meeting_ended': {
      // Sweep any in-flight agent bubbles before disabling the composer.
      // Without this a typing-dots placeholder for an agent that was
      // mid-think when /end (or auto-end from another tab's /new) fired
      // hangs visible forever.
      const stuck = transcriptEl.querySelectorAll('.bubble.agent');
      stuck.forEach((el) => {
        const content = el.querySelector('.content');
        if (!content) return;
        const phase = content.dataset.phase;
        const busy = content.getAttribute('aria-busy') === 'true';
        if (phase === 'waiting') {
          const key = (el.dataset.turnId || '') + ':' + (el.dataset.agentId || '');
          el.remove();
          agentBubbleByTurn.delete(key);
          return;
        }
        if (phase === 'streaming' || busy) {
          content.setAttribute('aria-busy', 'false');
          content.dataset.phase = 'done';
          const hdr = el.querySelector('.header-line');
          if (hdr && !hdr.querySelector('.tag.incomplete')) {
            const tag = document.createElement('span');
            tag.className = 'tag incomplete';
            tag.textContent = 'interrupted';
            hdr.appendChild(tag);
          }
        }
      });
      selectedAgents.clear();
      speakingAgents.clear();
      applyRosterState();
      setTurnInFlight(false);
      currentTurnId = null;
      setStatus('', false);
      disableComposerForEnded();
      if (es) { try { es.close(); } catch (e) {} es = null; }
      break;
    }
    case 'meeting_state_update':
      // Pin/unpin pushed to all tabs. Update local pin state and roster
      // indicator without reload.
      pinnedAgent = ev.pinnedAgent ?? null;
      renderRoster();
      break;
    case 'replay_gap':
      // Server told us our cached lastSeq is too old to replay safely.
      // Surface a brief banner so the user understands why the
      // transcript is being rebuilt — without this, content silently
      // jumps and a careful user might wonder if they hit a bug.
      showBanner('Reloading transcript…', 'warn');
      setTimeout(hideBanner, 3000);
      try { sessionStorage.removeItem(SEQ_KEY); } catch (e) {}
      lastSeq = 0;
      if (es) { try { es.close(); } catch (e) {} es = null; }
      // Wipe the transcript and let loadHistoryThenConnect rebuild it.
      // Full reload is safer than trying to reconcile in-place.
      while (transcriptEl.firstChild) transcriptEl.removeChild(transcriptEl.firstChild);
      agentBubbleByTurn.clear();
      loadHistoryThenConnect();
      break;
    case 'ping':
      break;
  }
}

function disableComposerForEnded() {
  // Freeze the elapsed timer the moment the meeting closes — without
  // this the header clock keeps ticking past "Meeting ended." which is
  // confusing.
  stopElapsedTimer();
  const composer = document.getElementById('composer');
  const sendBtn = document.getElementById('btn-send');
  const stopBtn = document.getElementById('btn-stop');
  if (composer) { composer.disabled = true; composer.placeholder = 'Meeting ended.'; }
  if (sendBtn) sendBtn.disabled = true;
  if (stopBtn) stopBtn.classList.remove('show');
  setStatus('Meeting ended.', false);
  // Only append once — guard against repeated SSE events
  if (!document.querySelector('.meeting-ended-note')) {
    const wrap = document.createElement('div');
    wrap.className = 'bubble system meeting-ended-note';
    const c = document.createElement('div');
    c.className = 'content';
    c.textContent = 'This meeting has ended.';
    wrap.appendChild(c);
    document.getElementById('transcript').appendChild(wrap);
  }
}

// ── Empty-state handling ──
// ── Load earlier ──
function renderLoadEarlierButton() {
  let btn = document.getElementById('load-earlier');
  if (!moreHistoryAvailable) {
    if (btn) btn.remove();
    return;
  }
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'load-earlier';
    btn.className = 'load-earlier';
    btn.type = 'button';
    btn.textContent = 'Load earlier messages';
    btn.addEventListener('click', loadEarlier);
    transcriptEl.insertBefore(btn, transcriptEl.firstChild);
  }
}
async function loadEarlier() {
  if (loadingEarlier || !moreHistoryAvailable) return;
  loadingEarlier = true;
  const btn = document.getElementById('load-earlier');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  try {
    const params = new URLSearchParams({
      token: TOKEN, meetingId: MEETING_ID, limit: '200',
      beforeTs: String(oldestTs), beforeId: String(oldestId),
    });
    const res = await fetch(API + '/api/warroom/text/history?' + params.toString());
    const data = await res.json();
    if (!res.ok || !Array.isArray(data.transcript) || data.transcript.length === 0) {
      moreHistoryAvailable = false;
      renderLoadEarlierButton();
      return;
    }
    // Preserve scroll position relative to current top so viewport
    // doesn't jump when older content prepends.
    const prevScrollHeight = transcriptEl.scrollHeight;
    const prevScrollTop = transcriptEl.scrollTop;

    // Remove button, prepend rows, put button back on top after.
    if (btn) btn.remove();
    const oldFirstChild = transcriptEl.firstElementChild;
    for (const row of data.transcript) {
      const el = renderTranscriptRow(row);
      if (el) transcriptEl.insertBefore(el, oldFirstChild);
    }
    const first = data.transcript[0];
    oldestTs = first.created_at;
    oldestId = first.id;
    moreHistoryAvailable = data.transcript.length >= 200;
    renderLoadEarlierButton();

    // Restore scroll: keep the user anchored to what they were reading.
    const newScrollHeight = transcriptEl.scrollHeight;
    transcriptEl.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
  } catch (e) {
    console.warn('load earlier failed', e);
  } finally {
    loadingEarlier = false;
  }
}

// Render a single transcript row into a bubble element (used by both
// initial load and /load earlier). Returns null if the row is unknown.
/**
 * Re-render the count line on a tool-calls disclosure. Called every time
 * a tool_call or tool_result lands so the collapsed label stays current
 * ("3 tool calls" / "3 tool calls · 1 failed"). Pluralization handled.
 */
function updateToolSummary(strip) {
  const summary = strip.querySelector(':scope > summary.tool-summary');
  const rows = strip.querySelectorAll(':scope > .tool-list > .tool-call');
  if (!summary || !rows) return;
  const total = rows.length;
  let failed = 0, pending = 0;
  rows.forEach(r => {
    if (r.classList.contains('failed')) failed++;
    else if (r.classList.contains('pending')) pending++;
  });
  const noun = total === 1 ? 'tool call' : 'tool calls';
  let label = total + ' ' + noun;
  const tags = [];
  if (pending > 0) tags.push(pending + ' running');
  if (failed > 0) tags.push(failed + ' failed');
  if (tags.length > 0) label += ' · ' + tags.join(' · ');
  summary.textContent = label;
}

function renderTranscriptRow(row) {
  if (row.speaker === 'user') {
    const wrap = document.createElement('div');
    wrap.className = 'bubble user';
    const body = document.createElement('div');
    body.className = 'user-body';
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = row.text;
    body.appendChild(content);
    const ts = document.createElement('div');
    ts.className = 'ts';
    ts.textContent = fmtTs(row.created_at);
    body.appendChild(ts);
    wrap.appendChild(body);
    // Stamp the rowId so position-aware reordering works for late
    // interveners arriving after a new turn started.
    if (typeof row.id === 'number') wrap.dataset.transcriptRowId = String(row.id);
    return wrap;
  }
  if (row.speaker === 'system') {
    const wrap = document.createElement('div');
    wrap.className = 'bubble system';
    const c = document.createElement('div');
    c.className = 'content';
    c.textContent = row.text;
    wrap.appendChild(c);
    if (typeof row.id === 'number') wrap.dataset.transcriptRowId = String(row.id);
    return wrap;
  }
  if (row.speaker === '__divider__') {
    const wrap = document.createElement('div');
    wrap.className = 'bubble divider';
    const c = document.createElement('div');
    c.className = 'content';
    c.textContent = row.text;
    wrap.appendChild(c);
    if (typeof row.id === 'number') wrap.dataset.transcriptRowId = String(row.id);
    return wrap;
  }
  // Agent message. Honor row.role when present so historical intervener
  // messages keep their "chiming in" tag on reload (previously this was
  // hardcoded to 'primary' and the tag silently disappeared on refresh).
  const turnId = 'hist_' + row.created_at + '_' + row.id;
  const role = (row.role === 'intervener') ? 'intervener' : 'primary';
  const bubble = appendAgentBubble(turnId, row.speaker, role, row.created_at);
  bubble.dataset.transcriptRowId = String(row.id);
  bubble.remove();  // detach so caller can insert at the right position
  const content = bubble.querySelector('.content');
  content.innerHTML = renderMarkdown(row.text);
  content.setAttribute('aria-busy', 'false');
  content.dataset.phase = 'done';
  return bubble;
}

function updateEmptyState() {
  const hasContent = transcriptEl.querySelector('.bubble') !== null;
  const existing = transcriptEl.querySelector('.transcript-empty');
  if (hasContent) {
    if (existing) existing.remove();
    return;
  }
  if (!existing) {
    const e = document.createElement('div');
    e.className = 'transcript-empty';
    const l = document.createElement('div');
    l.className = 'lg';
    l.textContent = 'Start with a specific question.';
    const s = document.createElement('div');
    s.textContent = 'Mention an agent with @ to talk to them directly. The team will chime in when it matters.';
    e.appendChild(l);
    e.appendChild(s);
    transcriptEl.appendChild(e);
  }
}

// ── Composer ──
const composerEl = document.getElementById('composer');
const sendBtn = document.getElementById('btn-send');
const stopBtn = document.getElementById('btn-stop');
const formEl = document.getElementById('composerForm');
const mentionPopupEl = document.getElementById('mention-popup');
let mentionMatches = [];
let mentionIndex = 0;
let mentionToken = '';  // the @query text we're matching against

// ── Slash command metadata ──
// Single source of truth for both the inline autocomplete popup and the
// persistent Commands-button popover. Server-side commands (standup,
// discuss) round-trip to the orchestrator. Local commands (pin, unpin,
// clear, end) are intercepted client-side in handleSlashCommand().
const SLASH_COMMANDS = [
  { name: 'standup', arg: true,  placeholder: '[@agent ...]', label: 'Each agent reports — add @-mentions to pick who runs' },
  { name: 'discuss', arg: true,  placeholder: '[@agent ...] <topic>', label: 'Open discussion — add @-mentions to pick who weighs in' },
  { name: 'pin',     arg: true,  placeholder: '<agent>', label: 'Pin one agent so they lead every reply', local: true },
  { name: 'unpin',   arg: false, label: 'Release the pinned agent', local: true },
  { name: 'clear',   arg: false, label: 'Reset agents\\' sessions for this meeting', local: true },
  { name: 'end',     arg: false, label: 'End the meeting', local: true },
];

const slashPopupEl = document.getElementById('slash-popup');
const commandsBtnEl = document.getElementById('btn-commands');
let slashMatches = [];
let slashIndex = 0;
let slashPersistent = false; // true when opened by the Commands button (no auto-close on input change)

function slashFilter(query) {
  const q = (query || '').toLowerCase();
  return SLASH_COMMANDS.filter((c) => !q || c.name.startsWith(q));
}

function renderSlashPopup() {
  slashPopupEl.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'mention-hint';
  hint.textContent = slashPersistent ? 'slash commands' : 'matching /';
  slashPopupEl.appendChild(hint);
  slashMatches.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'slash-item' + (c.local ? ' local' : '') + (i === slashIndex ? ' active' : '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', i === slashIndex ? 'true' : 'false');
    row.dataset.idx = String(i);
    const cmd = document.createElement('div');
    cmd.className = 's-cmd';
    cmd.textContent = '/' + c.name;
    if (c.arg) {
      const arg = document.createElement('span');
      arg.className = 's-arg';
      arg.textContent = ' ' + (c.placeholder || '<arg>');
      cmd.appendChild(arg);
    }
    const label = document.createElement('div');
    label.className = 's-label';
    label.textContent = c.label;
    row.appendChild(cmd);
    row.appendChild(label);
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSlash(i);
    });
    slashPopupEl.appendChild(row);
  });
  slashPopupEl.hidden = false;
  if (commandsBtnEl) commandsBtnEl.setAttribute('aria-expanded', 'true');
}

function updateSlashPopup() {
  // Inline (typed) trigger: only when the composer is exactly /token at
  // the start of the input. Once the user types a space it's a real
  // command line — close.
  const value = composerEl.value;
  const m = value.match(/^\\/([a-z]*)$/i);
  if (!m) { closeSlashPopup(); return; }
  slashPersistent = false;
  const matches = slashFilter(m[1]);
  if (matches.length === 0) { closeSlashPopup(); return; }
  slashMatches = matches;
  slashIndex = 0;
  renderSlashPopup();
}

function openSlashPopupPersistent() {
  slashPersistent = true;
  slashMatches = SLASH_COMMANDS.slice();
  slashIndex = 0;
  renderSlashPopup();
}

function closeSlashPopup() {
  slashPopupEl.hidden = true;
  slashMatches = [];
  slashIndex = 0;
  slashPersistent = false;
  if (commandsBtnEl) commandsBtnEl.setAttribute('aria-expanded', 'false');
}

function selectSlash(idx) {
  const c = slashMatches[idx];
  if (!c) { closeSlashPopup(); return; }
  // Replace the whole composer value when triggered persistently OR
  // when typed inline (which is also at the start of the string). In
  // both cases the user is at the slash, so set the composer to the
  // command + (trailing space if it takes an argument).
  const next = '/' + c.name + (c.arg ? ' ' : '');
  composerEl.value = next;
  composerEl.focus();
  composerEl.selectionStart = composerEl.selectionEnd = next.length;
  composerEl.dispatchEvent(new Event('input', { bubbles: true }));
  closeSlashPopup();
}

if (commandsBtnEl) {
  commandsBtnEl.addEventListener('click', (e) => {
    e.preventDefault();
    if (!slashPopupEl.hidden && slashPersistent) {
      closeSlashPopup();
      composerEl.focus();
    } else {
      openSlashPopupPersistent();
      composerEl.focus();
    }
  });
}

// Detect an @mention in progress at the caret and update the suggestion
// popup. The query is whatever letters follow the @ up to the caret.
function updateMentionPopup() {
  const pos = composerEl.selectionStart || 0;
  const before = composerEl.value.slice(0, pos);
  // Must be @ at start of string or after whitespace, followed by an
  // optional agent-id-like token (letters/digits/underscore/hyphen).
  const m = before.match(/(?:^|\\s)@([a-z0-9_-]*)$/i);
  if (!m) { closeMentionPopup(); return; }
  const query = m[1].toLowerCase();
  mentionToken = query;
  const source = (roster && roster.length) ? roster : getRoster();
  // Score: exact id prefix > name starts with > id contains > name contains
  const scored = source.map((a) => {
    const id = (a.id || '').toLowerCase();
    const name = (a.name || '').toLowerCase();
    let score = -1;
    if (query === '') score = 0;
    else if (id.startsWith(query)) score = 4;
    else if (name.startsWith(query)) score = 3;
    else if (id.includes(query)) score = 2;
    else if (name.includes(query)) score = 1;
    return { a, score };
  }).filter(x => x.score >= 0);
  scored.sort((x, y) => y.score - x.score);
  mentionMatches = scored.slice(0, 6).map(x => x.a);
  if (mentionMatches.length === 0) { closeMentionPopup(); return; }
  mentionIndex = 0;
  renderMentionPopup();
}

function renderMentionPopup() {
  mentionPopupEl.innerHTML = '';
  const hint = document.createElement('div');
  hint.className = 'mention-hint';
  hint.textContent = mentionToken ? 'matching @' + mentionToken : 'mention an agent';
  mentionPopupEl.appendChild(hint);
  mentionMatches.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'mention-item' + (i === mentionIndex ? ' active' : '');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', i === mentionIndex ? 'true' : 'false');
    row.dataset.idx = String(i);
    const av = document.createElement('div');
    av.className = 'm-avatar';
    const img = document.createElement('img');
    img.src = avatarUrl(a.id, a.avatar_etag);
    img.alt = '';
    img.onerror = () => { img.remove(); av.textContent = (a.name || a.id).slice(0, 2).toUpperCase(); };
    av.appendChild(img);
    const body = document.createElement('div');
    body.className = 'm-body';
    const name = document.createElement('div');
    name.className = 'm-name';
    name.textContent = a.name || a.id;
    const role = document.createElement('div');
    role.className = 'm-role';
    role.textContent = a.description || '';
    body.appendChild(name);
    body.appendChild(role);
    row.appendChild(av);
    row.appendChild(body);
    row.addEventListener('mousedown', (e) => {
      // mousedown (not click) because the document-level mousedown
      // handler closes the popup on click outside; the item itself is
      // inside the popup so it's fine, but we avoid any flicker.
      e.preventDefault();
      selectMention(i);
    });
    mentionPopupEl.appendChild(row);
  });
  mentionPopupEl.hidden = false;
}

function selectMention(idx) {
  const a = mentionMatches[idx];
  if (!a) { closeMentionPopup(); return; }
  const pos = composerEl.selectionStart || 0;
  const before = composerEl.value.slice(0, pos);
  const after = composerEl.value.slice(pos);
  // Replace the trailing @token with @<agentId> + space
  const replaced = before.replace(/(^|\\s)@([a-z0-9_-]*)$/i, (_m, pre) => pre + '@' + a.id + ' ');
  composerEl.value = replaced + after;
  composerEl.focus();
  composerEl.selectionStart = composerEl.selectionEnd = replaced.length;
  composerEl.dispatchEvent(new Event('input', { bubbles: true }));
  closeMentionPopup();
}

function closeMentionPopup() {
  mentionPopupEl.hidden = true;
  mentionMatches = [];
  mentionIndex = 0;
  mentionToken = '';
}

composerEl.addEventListener('input', () => {
  sendBtn.disabled = composerEl.value.trim().length === 0;
  // Auto-grow
  composerEl.style.height = 'auto';
  composerEl.style.height = Math.min(180, composerEl.scrollHeight) + 'px';
  updateMentionPopup();
  // Only re-trigger the typed slash popup if we're not in a persistent
  // (button-opened) state — that one stays open across keystrokes.
  if (!slashPersistent) updateSlashPopup();
});
composerEl.addEventListener('keydown', (e) => {
  // Slash popup keys take priority when it's open
  if (!slashPopupEl.hidden) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      slashIndex = Math.min(slashMatches.length - 1, slashIndex + 1);
      renderSlashPopup();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      slashIndex = Math.max(0, slashIndex - 1);
      renderSlashPopup();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectSlash(slashIndex);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSlashPopup();
      return;
    }
  }
  // Mention popup keys take priority when it's open
  if (!mentionPopupEl.hidden) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionIndex = Math.min(mentionMatches.length - 1, mentionIndex + 1);
      renderMentionPopup();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionIndex = Math.max(0, mentionIndex - 1);
      renderMentionPopup();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectMention(mentionIndex);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionPopup();
      return;
    }
  }
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    formEl.requestSubmit();
  } else if (e.key === 'Escape' && turnInFlight) {
    e.preventDefault();
    abortTurn();
  }
});
// Close popups if user clicks outside. Commands button has its own
// click handler so don't auto-close when the user clicks it.
document.addEventListener('mousedown', (e) => {
  if (!mentionPopupEl.hidden && !mentionPopupEl.contains(e.target) && e.target !== composerEl) {
    closeMentionPopup();
  }
  if (!slashPopupEl.hidden && !slashPopupEl.contains(e.target) && e.target !== composerEl && e.target !== commandsBtnEl) {
    closeSlashPopup();
  }
});
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    composerEl.focus();
  }
});

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = composerEl.value;
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (handleSlashCommand(trimmed)) {
    composerEl.value = '';
    composerEl.dispatchEvent(new Event('input'));
    return;
  }
  sendMessage(trimmed);
  composerEl.value = '';
  composerEl.dispatchEvent(new Event('input'));
});

stopBtn.addEventListener('click', () => abortTurn());

async function sendMessage(text, existingClientMsgId) {
  const clientMsgId = existingClientMsgId || crypto.randomUUID();
  if (!existingClientMsgId) appendUserBubble(text, { clientMsgId });
  try {
    const res = await fetch(API + '/api/warroom/text/send' + Q, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: MEETING_ID, text, clientMsgId, chatId: CHAT_ID }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      markUserBubbleFailed(clientMsgId, () => sendMessage(text, clientMsgId));
      showBanner('Send failed: ' + (data.error || res.status), 'error');
      setTimeout(hideBanner, 3500);
    }
  } catch (err) {
    markUserBubbleFailed(clientMsgId, () => sendMessage(text, clientMsgId));
    showBanner('Network error — tap retry on your message.', 'error');
    setTimeout(hideBanner, 3500);
  }
  updateEmptyState();
}

async function abortTurn() {
  try {
    await fetch(API + '/api/warroom/text/abort' + Q, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: MEETING_ID, chatId: CHAT_ID }),
    });
  } catch (e) {}
}

// ── Slash commands ──
// Intercept ONLY the local meta-commands here (/pin, /unpin, /clear, /end).
// Server-side commands like /standup and /discuss return false so the
// composer's normal sendMessage path routes them to the orchestrator,
// which dispatches them as multi-agent turns. Anything else starting with
// '/' also returns false and gets sent — the orchestrator may surface a
// system_note for unknown commands but at least the user is never silently
// blocked.
const SERVER_SLASH_COMMANDS = new Set(['standup', 'discuss']);
function handleSlashCommand(text) {
  if (!text.startsWith('/')) return false;
  const [cmdRaw, ...rest] = text.slice(1).split(/\\s+/);
  const cmd = cmdRaw.toLowerCase();
  const arg = rest.join(' ').trim();
  // Server-side: don't intercept; let sendMessage POST it.
  if (SERVER_SLASH_COMMANDS.has(cmd)) return false;
  if (cmd === 'pin') {
    if (!arg) { appendSystemNote('Usage: /pin <agent>', 'warn'); return true; }
    const agent = arg.toLowerCase();
    if (!rosterById.has(agent)) { appendSystemNote('Unknown agent: ' + arg, 'warn'); return true; }
    pinAgent(agent);
    return true;
  }
  if (cmd === 'unpin') {
    pinAgent(null);
    return true;
  }
  if (cmd === 'clear') {
    openDialog('Clear this meeting\\'s agent sessions?', 'Agents will start fresh from here. The transcript above stays visible.', 'Clear sessions', async () => {
      const res = await fetch(API + '/api/warroom/text/clear' + Q, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: MEETING_ID, chatId: CHAT_ID }),
      });
      if (!res.ok) { appendSystemNote('Could not clear sessions.', 'warn'); }
    });
    return true;
  }
  if (cmd === 'end') {
    openDialog('End this meeting?', 'You can reopen it within 24h and resume from where you left off.', 'End meeting', endMeeting);
    return true;
  }
  // Unknown command — let it fall through to sendMessage. The server may
  // ignore it (treat as plain text); future server-side commands work
  // automatically without a client update.
  return false;
}

async function pinAgent(agentId) {
  const url = agentId ? '/api/warroom/text/pin' : '/api/warroom/text/unpin';
  const body = JSON.stringify(agentId
    ? { meetingId: MEETING_ID, agentId, chatId: CHAT_ID }
    : { meetingId: MEETING_ID, chatId: CHAT_ID });
  const res = await fetch(API + url + Q, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.ok) {
    pinnedAgent = agentId;
    applyRosterState();
    if (agentId) {
      appendSystemNote((rosterById.get(agentId)?.name || agentId) + ' pinned. They will lead every turn.', 'info');
    } else {
      appendSystemNote('Pin cleared.', 'info');
    }
  } else {
    appendSystemNote('Pin failed.', 'warn');
  }
}

function togglePin(agentId) {
  if (pinnedAgent === agentId) pinAgent(null);
  else pinAgent(agentId);
}

async function endMeeting() {
  try {
    await fetch(API + '/api/warroom/text/end' + Q, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: MEETING_ID, chatId: CHAT_ID }),
    });
  } catch (e) {}
  setStatus('Meeting ended.', false);
  document.getElementById('composer').disabled = true;
  document.getElementById('btn-send').disabled = true;
  setTimeout(() => {
    const q = new URLSearchParams({ token: TOKEN });
    if (CHAT_ID) q.set('chatId', CHAT_ID);
    window.location.href = '/warroom?' + q.toString();
  }, 1500);
}

// ── Confirmation dialog ──
const dialogEl = document.getElementById('dialog');
const dialogTitle = document.getElementById('dialog-title');
const dialogBody = document.getElementById('dialog-body');
const dialogConfirm = document.getElementById('dialog-confirm');
const dialogCancel = document.getElementById('dialog-cancel');
let dialogOnConfirm = null;
let dialogPriorFocus = null;

function openDialog(title, body, confirmLabel, onConfirm) {
  dialogTitle.textContent = title;
  dialogBody.textContent = body;
  dialogConfirm.textContent = confirmLabel;
  dialogOnConfirm = onConfirm;
  // Remember where focus was so we can restore it when the dialog closes
  // — critical for keyboard users who would otherwise lose their place.
  dialogPriorFocus = document.activeElement;
  dialogEl.classList.add('show');
  dialogCancel.focus();
}
function closeDialog() {
  dialogEl.classList.remove('show');
  dialogOnConfirm = null;
  // Restore the element that had focus before the dialog opened, falling
  // back to the composer if it's gone.
  const target = dialogPriorFocus && document.contains(dialogPriorFocus)
    ? dialogPriorFocus
    : composerEl;
  dialogPriorFocus = null;
  target.focus();
}
dialogCancel.addEventListener('click', closeDialog);
dialogConfirm.addEventListener('click', async () => {
  const fn = dialogOnConfirm;
  closeDialog();
  if (fn) await fn();
});
// Trap Tab inside the dialog so focus can't escape to the background.
// Shift+Tab from Cancel wraps to Confirm; Tab from Confirm wraps to Cancel.
dialogEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); return; }
  if (e.key !== 'Tab') return;
  const order = [dialogCancel, dialogConfirm];
  const current = document.activeElement;
  const idx = order.indexOf(current);
  if (idx === -1) {
    e.preventDefault();
    order[0].focus();
    return;
  }
  const next = e.shiftKey
    ? order[(idx + order.length - 1) % order.length]
    : order[(idx + 1) % order.length];
  e.preventDefault();
  next.focus();
});

// ── Header buttons ──
document.getElementById('btn-end').addEventListener('click', () => {
  openDialog('End this meeting?', 'You can reopen it within 24h and resume from where you left off.', 'End meeting', endMeeting);
});
document.getElementById('btn-switch-voice').addEventListener('click', () => {
  const q = new URLSearchParams({ token: TOKEN, mode: 'voice' });
  if (CHAT_ID) q.set('chatId', CHAT_ID);
  window.location.href = '/warroom?' + q.toString();
});

// ── Elapsed timer ──
let meetingStartMs = Date.now();
let elapsedInterval = setInterval(tickElapsed, 1000);
function tickElapsed() {
  const s = Math.floor((Date.now() - meetingStartMs) / 1000);
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  const el = document.getElementById('elapsed');
  if (el) el.textContent = m + ':' + ss;
}
function stopElapsedTimer() {
  if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null; }
}

// ── Warmup intro ──
// Runs before history+SSE so the user sees a cinematic "team assembling"
// sequence rather than a blank loading screen. In parallel fires a real
// backend warmup call that primes the Node SDK cache — so the first user
// turn after this intro is noticeably faster than a cold cold-start.
async function runWarmupIntro(rosterForIntro) {
  const overlay = document.getElementById('warmup');
  if (!overlay) return;

  // Kick off backend warmup immediately — fire and forget. Resolves in
  // ~3-6s; we don't wait for it if our animation finishes first, but we
  // do wait if it's still pending at animation end (up to a cap).
  const warmupDone = fetch(API + '/api/warroom/text/warmup' + Q, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).then(r => r.json()).catch(() => null);

  // Rotating captions shown under the progress bar. Feels like the team
  // is doing actual prep work; masks the cold-start wait.
  const captions = [
    'warming up the room',
    'pulling recent context',
    'getting the team online',
    'ready when you are',
  ];

  const title = document.getElementById('warmup-title');
  const subtitle = document.getElementById('warmup-subtitle');
  const lineup = document.getElementById('warmup-lineup');
  const progressWrap = document.getElementById('warmup-progress');
  const bar = document.getElementById('warmup-bar');
  const caption = document.getElementById('warmup-caption');

  await new Promise(r => setTimeout(r, 80));
  title.classList.add('show');
  await new Promise(r => setTimeout(r, 220));
  subtitle.classList.add('show');
  await new Promise(r => setTimeout(r, 380));

  // Build seats for each agent. Cascade reveal.
  const agents = (rosterForIntro && rosterForIntro.length) ? rosterForIntro : getRoster();
  for (const a of agents) {
    const seat = document.createElement('div');
    seat.className = 'warmup-seat';
    const av = document.createElement('div');
    av.className = 'warmup-avatar';
    const img = document.createElement('img');
    img.src = avatarUrl(a.id, a.avatar_etag);
    img.alt = '';
    img.onerror = () => { img.remove(); av.textContent = (a.name || a.id).slice(0, 2).toUpperCase(); };
    av.appendChild(img);
    const nm = document.createElement('div');
    nm.className = 'warmup-name';
    nm.textContent = a.name;
    const st = document.createElement('div');
    st.className = 'warmup-status';
    st.textContent = '● online';
    seat.appendChild(av);
    seat.appendChild(nm);
    seat.appendChild(st);
    lineup.appendChild(seat);
    // Stagger reveal
    requestAnimationFrame(() => seat.classList.add('show'));
    await new Promise(r => setTimeout(r, 220));
  }

  // Show progress bar + start caption rotation. Progress is cosmetic but
  // racing the actual warmup promise underneath.
  progressWrap.classList.add('show');
  caption.classList.add('show');
  caption.textContent = captions[0];

  const overallStart = Date.now();
  const MIN_MS = 2400;        // minimum time users see the intro
  const MAX_MS = 8000;        // hard ceiling even if warmup is slow
  const captionMs = 1600;

  // Progress bar: animates smoothly from 0 → 90% while waiting on warmup.
  // Last 10% snaps when warmup resolves or we hit MAX_MS.
  let pct = 0;
  const progressInterval = setInterval(() => {
    pct = Math.min(90, pct + 3);
    bar.style.width = pct + '%';
  }, 90);

  let captionIdx = 0;
  const captionInterval = setInterval(() => {
    captionIdx = (captionIdx + 1) % captions.length;
    caption.style.opacity = '0';
    setTimeout(() => { caption.textContent = captions[captionIdx]; caption.style.opacity = '1'; }, 180);
  }, captionMs);

  // Wait for both: the warmup response AND the minimum animation time.
  const raceStop = await Promise.race([
    warmupDone.then(() => 'warmup'),
    new Promise(r => setTimeout(() => r('timeout'), MAX_MS)),
  ]);

  // Respect minimum so the intro doesn't feel abrupt if warmup comes back
  // in 2s. Don't wait longer than MAX_MS total.
  const elapsed = Date.now() - overallStart;
  if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed));

  clearInterval(progressInterval);
  clearInterval(captionInterval);
  bar.style.width = '100%';
  caption.textContent = raceStop === 'warmup' ? 'ready when you are' : 'starting anyway';

  // Brief hold on the completed bar, then fade.
  await new Promise(r => setTimeout(r, 500));
  overlay.classList.add('fade-out');
  setTimeout(() => { overlay.style.display = 'none'; }, 750);
}

// ── Load history then connect SSE ──
// Helper: getRoster alias used by the intro before roster is populated.
// Falls back to the default 5 agents so the animation still runs on a
// cold meeting where /history has not resolved yet.
function getRoster() {
  if (roster && roster.length) return roster;
  return [
    { id: 'main', name: 'Main' },
    { id: 'research', name: 'Research' },
    { id: 'comms', name: 'Comms' },
    { id: 'content', name: 'Content' },
    { id: 'ops', name: 'Ops' },
  ];
}

async function loadHistoryThenConnect() {
  // Fire intro + history in parallel. The intro's animation covers SDK
  // cold start while history loads quickly; when both resolve the overlay
  // fades and the chat UI takes over.
  const historyPromise = fetch(API + '/api/warroom/text/history' + MEETING_Q + '&limit=200')
    .then(r => r.json())
    .catch(() => null);

  // Wait up to 600ms for history (so roster is known) before starting
  // the intro. This lets us animate with the REAL roster from the server
  // rather than the default fallback. If history is slow, intro starts
  // with defaults and updates silently.
  const quickData = await Promise.race([
    historyPromise,
    new Promise(r => setTimeout(() => r(null), 600)),
  ]);
  let rosterForIntro = null;
  if (quickData && Array.isArray(quickData.agents)) {
    rosterForIntro = quickData.agents;
    roster = quickData.agents;
    rosterById.clear();
    for (const a of roster) rosterById.set(a.id, a);
    pinnedAgent = quickData.pinnedAgent ?? null;
  }

  // Now run the intro (blocking until it fades out). In parallel,
  // history may still be resolving if the earlier race timed out.
  await runWarmupIntro(rosterForIntro);

  // Re-fetch history if the earlier race didn't have the full data.
  const data = quickData ?? await historyPromise;

  try {
    if (data && Array.isArray(data.agents)) {
      roster = data.agents;
      rosterById.clear();
      for (const a of roster) rosterById.set(a.id, a);
      pinnedAgent = data.pinnedAgent ?? null;
    }
    renderRoster();
    if (data && Array.isArray(data.transcript) && data.transcript.length > 0) {
      // Track the oldest row we've loaded so "Load earlier" can cursor
      // backward. Rows come back newest-first when paginated; on initial
      // load they're already reversed into display order.
      const first = data.transcript[0];
      oldestTs = first.created_at;
      oldestId = first.id;
      // If we got the full page size, there's likely more.
      moreHistoryAvailable = data.transcript.length >= 200;
      renderLoadEarlierButton();
    }
    if (data && Array.isArray(data.transcript)) {
      // Unified rendering: delegate every row to renderTranscriptRow so
      // initial load and "Load earlier" produce identical DOM. Previously
      // these were two separate code paths and intervener role tags
      // diverged (one stamped role='primary' for every history row, the
      // other left intervener tags off). renderTranscriptRow returns a
      // detached element; we append it here.
      for (const row of data.transcript) {
        const bubble = renderTranscriptRow(row);
        if (bubble) transcriptEl.appendChild(bubble);
      }
    }
    if (data && typeof data.meetingStartedAt === 'number') {
      meetingStartMs = data.meetingStartedAt * 1000;
    }
    // Advance lastSeq past any events the server has already emitted
    // before we subscribed. Without this, SSE replays buffered
    // agent_done events on top of history we just rendered, duplicating
    // every bubble on reload.
    if (data && typeof data.latestSeq === 'number' && data.latestSeq > lastSeq) {
      lastSeq = data.latestSeq;
      try { sessionStorage.setItem(SEQ_KEY, String(lastSeq)); } catch (e) {}
    }
    // If the meeting already ended, freeze the elapsed display to the
    // meeting's actual duration BEFORE disabling the composer (which
    // calls stopElapsedTimer). Without this freeze the user sees a
    // ticking wall-clock-since-start that's irrelevant on a closed room.
    if (data && data.endedAt) {
      if (typeof data.meetingStartedAt === 'number') {
        const dur = Math.max(0, data.endedAt - data.meetingStartedAt);
        const m = Math.floor(dur / 60);
        const ss = String(dur % 60).padStart(2, '0');
        const el = document.getElementById('elapsed');
        if (el) el.textContent = m + ':' + ss;
      }
      disableComposerForEnded();
    }
  } catch (e) {
    // Non-fatal — SSE will still populate going forward
  }
  updateEmptyState();
  connectSSE();
}

loadHistoryThenConnect();
</script>
</body>
</html>`;
}
