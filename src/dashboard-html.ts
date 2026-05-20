export function getDashboardHtml(token: string, chatId: string, warroomEnabled = false): string {
const WARROOM_ENABLED = warroomEnabled;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>ClaudeClaw Mission Control</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  body { background: #0f0f0f; color: #e0e0e0; -webkit-tap-highlight-color: transparent; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .pill-active { background: #064e3b; color: #6ee7b7; }
  .pill-running { background: #1e3a5f; color: #60a5fa; animation: pulse 2s ease-in-out infinite; }
  .pill-paused { background: #422006; color: #fbbf24; }
  .last-success { color: #6ee7b7; }
  .last-failed { color: #f87171; }
  .last-timeout { color: #fbbf24; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
  .pill-connected { background: #064e3b; color: #6ee7b7; }
  .pill-disconnected { background: #3b0f0f; color: #f87171; }
  .stat-val { font-size: 24px; font-weight: 700; color: #fff; }
  .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .model-picker { position: relative; cursor: pointer; margin-top: 2px; }
  .model-current { font-size: 11px; color: #8b5cf6; }
  .model-current:hover { color: #a78bfa; }
  .model-menu { position: absolute; top: 18px; left: 0; z-index: 30; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 4px 0; min-width: 110px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
  .model-opt { padding: 6px 14px; font-size: 12px; color: #9ca3af; cursor: pointer; transition: background 0.1s; }
  .model-opt:hover { background: #2a2a3e; color: #e0e0e0; }
  .model-active { color: #8b5cf6; }
  .model-active::before { content: ''; display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #8b5cf6; margin-right: 6px; vertical-align: middle; }
  details summary { cursor: pointer; list-style: none; }
  details summary::-webkit-details-marker { display: none; }
  .fade-text { color: #f87171; }
  .top-text { color: #6ee7b7; }
  .gauge-bg { fill: #2a2a2a; }
  .refresh-spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  /* Privacy blur */
  .privacy-blur { filter: blur(5px); cursor: pointer; transition: filter 0.2s; user-select: none; }
  .privacy-blur:hover { filter: blur(3px); }
  .privacy-toggle { background: none; border: none; cursor: pointer; color: #888; font-size: 16px; padding: 2px 6px; margin-left: 8px; transition: color 0.15s; vertical-align: middle; }
  .privacy-toggle:hover { color: #ccc; }
  /* Hive Mind table */
  .hive-table { width: 100%; border-collapse: collapse; }
  .hive-table th { text-align: left; padding: 4px 8px; font-size: 11px; color: #666; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #333; white-space: nowrap; }
  .hive-table td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #1e1e1e; vertical-align: top; }
  .hive-table .col-time { white-space: nowrap; color: #9ca3af; }
  .hive-table .col-agent { white-space: nowrap; font-weight: 600; }
  .hive-table .col-action { white-space: nowrap; color: #9ca3af; }
  .hive-table .col-summary { color: #d4d4d8; word-break: break-word; line-height: 1.4; }
  .hive-scroll { max-height: 300px; overflow-y: auto; }
  /* Summary stats bar */
  .summary-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
  .summary-stat { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; gap: 2px; }
  .summary-stat-val { font-size: 20px; font-weight: 700; color: #fff; line-height: 1.2; }
  .summary-stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  @media (max-width: 640px) { .summary-bar { grid-template-columns: repeat(2, 1fr); } }
  /* Memory item expand on click */
  .mem-expand { cursor: pointer; transition: background 0.15s; padding: 4px 6px; margin: 0 -6px; border-radius: 6px; }
  .mem-expand:hover { background: #222; }
  .mem-expand .mem-full { display: none; margin-top: 4px; color: #d4d4d8; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.5; }
  .mem-expand.open .mem-full { display: block; }
  .mem-expand.open .mem-preview { display: none; }
  /* Task prompt text */
  .task-prompt { transition: filter 0.2s; cursor: pointer; }
  .task-title-wrap { position: relative; cursor: default; }
  #task-popup-float { position: fixed; z-index: 60; background: #1e1e2e; border: 1px solid #333; border-radius: 10px; padding: 10px 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); min-width: 200px; display: none; }
  .timer-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .timer-bar { flex: 1; height: 6px; background: #2a2a2a; border-radius: 3px; overflow: hidden; }
  .timer-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
  .timer-adj { background: none; border: 1px solid #444; color: #aaa; border-radius: 4px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
  .timer-adj:hover { border-color: #888; color: #fff; }
  .device-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .device-mobile { background: #1e3a5f; color: #60a5fa; }
  .device-desktop { background: #3b1f5e; color: #c084fc; }
  /* Drawer */
  .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 40; opacity: 0; pointer-events: none; transition: opacity 0.2s; }
  .drawer-overlay.open { opacity: 1; pointer-events: auto; }
  .drawer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #141414; border-top: 1px solid #2a2a2a; border-radius: 16px 16px 0 0; max-height: 85vh; transform: translateY(100%); transition: transform 0.3s ease; display: flex; flex-direction: column; }
  .drawer.open { transform: translateY(0); }
  .drawer-handle { width: 36px; height: 4px; background: #444; border-radius: 2px; margin: 10px auto 0; flex-shrink: 0; }
  .drawer-body { overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 16px; flex: 1; }
  .mem-item { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s; }
  .mem-item:active, .mem-item.expanded { border-color: #444; }
  .mem-item .mem-content { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .mem-item.expanded .mem-content { display: block; -webkit-line-clamp: unset; }
  .salience-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
  .clickable-card { cursor: pointer; transition: border-color 0.15s; }
  .clickable-card:hover, .clickable-card:active { border-color: #444; }
  /* Info tooltips */
  .info-tip { position: relative; display: inline-block; vertical-align: middle; margin-left: 6px; }
  .info-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #333; color: #888; font-size: 11px; cursor: pointer; user-select: none; line-height: 1; transition: background 0.15s, color 0.15s; }
  .info-icon:hover { background: #444; color: #bbb; }
  .info-tooltip { position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 8px); background: #252525; border: 1px solid #3a3a3a; color: #bbb; font-size: 12px; font-weight: 400; line-height: 1.5; padding: 10px 12px; border-radius: 8px; max-width: 280px; min-width: 200px; z-index: 30; opacity: 0; pointer-events: none; transition: opacity 0.15s; white-space: normal; text-transform: none; letter-spacing: normal; }
  .info-tooltip::before { content: ''; position: absolute; top: -6px; left: 50%; transform: translateX(-50%); border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 6px solid #3a3a3a; }
  .info-tooltip::after { content: ''; position: absolute; top: -5px; left: 50%; transform: translateX(-50%); border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 5px solid #252525; }
  .info-tip.active .info-tooltip { opacity: 1; pointer-events: auto; }
  /* Chat FAB */
  .chat-fab { position: fixed; bottom: 24px; right: 24px; z-index: 60; width: 56px; height: 56px; border-radius: 50%; background: #4f46e5; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(79,70,229,0.4); transition: transform 0.15s, background 0.15s; }
  .chat-fab:hover { transform: scale(1.08); background: #4338ca; }
  .chat-fab:active { transform: scale(0.95); }
  .chat-fab-badge { position: absolute; top: -2px; right: -2px; width: 18px; height: 18px; border-radius: 50%; background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; display: none; align-items: center; justify-content: center; border: 2px solid #0f0f0f; }
  /* Chat slide-over panel */
  .chat-overlay { position: fixed; top: 0; right: 0; bottom: 0; width: 560px; max-width: 100vw; z-index: 70; background: #0f0f0f; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: -4px 0 24px rgba(0,0,0,0.5); border-left: 1px solid #2a2a2a; }
  .chat-overlay.open { transform: translateX(0); }
  .chat-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #141414; border-bottom: 1px solid #2a2a2a; flex-shrink: 0; }
  .chat-header-left { display: flex; align-items: center; gap: 8px; }
  .chat-header-title { font-size: 16px; font-weight: 700; color: #fff; }
  .chat-status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  /* Agent tabs */
  .chat-agent-tabs { display: flex; gap: 0; background: #141414; border-bottom: 1px solid #2a2a2a; flex-shrink: 0; overflow-x: auto; padding: 0 12px; }
  .chat-agent-tab { padding: 8px 14px; font-size: 12px; font-weight: 600; color: #6b7280; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
  .chat-agent-tab:hover { color: #d4d4d8; }
  .chat-agent-tab.active { color: #a5b4fc; border-bottom-color: #4f46e5; }
  .chat-agent-tab .agent-dot { width: 6px; height: 6px; border-radius: 50%; }
  .chat-agent-tab .agent-dot.live { background: #22c55e; }
  .chat-agent-tab .agent-dot.dead { background: #ef4444; }
  /* Session info bar */
  .chat-session-bar { display: flex; align-items: center; gap: 12px; padding: 6px 16px; background: #111; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; font-size: 11px; color: #6b7280; }
  .chat-session-bar .session-stat { display: flex; align-items: center; gap: 4px; }
  .chat-session-bar .session-stat-val { color: #a5b4fc; font-weight: 600; }
  .chat-session-bar .session-model { background: #1e1e1e; padding: 2px 8px; border-radius: 4px; color: #9ca3af; font-weight: 600; }
  /* Quick actions */
  .chat-quick-actions { display: flex; gap: 6px; padding: 8px 16px; background: #111; border-bottom: 1px solid #1e1e1e; flex-shrink: 0; overflow-x: auto; }
  .chat-quick-btn { padding: 4px 10px; font-size: 11px; font-weight: 600; color: #9ca3af; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .chat-quick-btn:hover { background: #252525; color: #e0e0e0; border-color: #3a3a3a; }
  .chat-quick-btn.destructive:hover { border-color: #dc2626; color: #fca5a5; }
  .chat-messages { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 16px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .chat-bubble { max-width: 90%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.6; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }
  .chat-bubble-user { background: #3730a3; color: #e0e7ff; align-self: flex-end; border-bottom-right-radius: 4px; }
  .chat-bubble-assistant { background: #1e1e1e; color: #d4d4d8; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #2a2a2a; min-width: 0; }
  .chat-bubble-source { font-size: 10px; color: #6b7280; margin-top: 4px; }
  .chat-bubble code { background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; font-size: 13px; }
  .chat-bubble pre { background: #111; padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 6px 0; font-size: 12px; }
  .chat-bubble pre code { background: none; padding: 0; }
  .code-block-wrap { position: relative; }
  .code-block-wrap .copy-btn { position: absolute; top: 4px; right: 4px; background: #2a2a2a; border: 1px solid #3a3a3a; color: #9ca3af; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer; opacity: 0; transition: opacity 0.15s; z-index: 1; }
  .code-block-wrap:hover .copy-btn { opacity: 1; }
  .copy-btn.copied { color: #6ee7b7; border-color: #064e3b; }
  .chat-bubble table { border-collapse: collapse; width: 100%; font-size: 11px; margin: 6px 0; display: block; overflow-x: auto; }
  .chat-bubble th, .chat-bubble td { padding: 3px 6px; border-bottom: 1px solid #2a2a2a; text-align: left; white-space: nowrap; }
  .chat-bubble th { color: #a5b4fc; font-weight: 600; }
  .chat-progress-bar { display: none; align-items: center; gap: 10px; padding: 10px 16px; background: #141414; border-top: 1px solid #2a2a2a; flex-shrink: 0; position: relative; overflow: hidden; }
  .chat-progress-bar.active { display: flex; }
  .chat-progress-pulse { width: 10px; height: 10px; border-radius: 50%; background: #4f46e5; flex-shrink: 0; animation: progressPulse 1.5s ease-in-out infinite; }
  @keyframes progressPulse { 0%,100% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
  .chat-progress-label { font-size: 13px; color: #9ca3af; }
  .chat-stop-btn { margin-left: auto; background: none; border: 1px solid #4f46e5; color: #4f46e5; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s, color 0.15s; }
  .chat-stop-btn:hover { background: #4f46e5; color: #fff; }
  .chat-progress-shimmer { position: absolute; bottom: 0; left: 0; height: 2px; width: 100%; background: linear-gradient(90deg, transparent, #4f46e5, transparent); animation: shimmer 2s ease-in-out infinite; }
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  .chat-input-area { display: flex; gap: 8px; padding: 12px 16px; background: #141414; border-top: 1px solid #2a2a2a; flex-shrink: 0; }
  .chat-textarea { flex: 1; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; color: #e0e0e0; padding: 10px 14px; font-size: 14px; resize: none; outline: none; max-height: 120px; font-family: inherit; }
  .chat-textarea:focus { border-color: #4f46e5; }
  .chat-send-btn { background: #4f46e5; color: #fff; border: none; border-radius: 12px; padding: 0 16px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.15s; flex-shrink: 0; }
  .chat-send-btn:hover { background: #4338ca; }
  .chat-send-btn:disabled { background: #2a2a2a; color: #666; cursor: not-allowed; }
</style>
</head>
<body class="p-4 select-none">

<!-- Outer wrapper: single column on mobile, wide 2-col on desktop -->
<div class="max-w-lg lg:max-w-6xl mx-auto">

<!-- Top bar -->
<div class="flex items-center justify-between mb-1">
  <div class="flex items-center gap-3">
    <h1 class="text-xl font-bold text-white">ClaudeClaw <span style="font-size:13px;font-weight:400;color:#6b7280">Mission Control</span></h1>
    <span id="device-badge" class="device-badge"></span>
  </div>
  <div class="flex items-center gap-3">
    <span id="last-updated" class="text-xs text-gray-500"></span>
    <button id="refresh-btn" onclick="refreshAll()" class="text-gray-400 hover:text-white transition">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
    </button>
  </div>
</div>
<div id="bot-info" class="flex items-center gap-3 mb-4 text-xs text-gray-500" style="display:none"></div>

<!-- Summary Stats Bar -->
<div id="summary-bar" class="summary-bar" style="display:none">
  <div class="summary-stat clickable-card" onclick="document.getElementById('hive-section').scrollIntoView({behavior:'smooth'})" style="cursor:pointer">
    <span class="summary-stat-val" id="sum-messages">-</span>
    <span class="summary-stat-label">Messages</span>
  </div>
  <div class="summary-stat clickable-card" onclick="document.getElementById('agents-section').scrollIntoView({behavior:'smooth'})" style="cursor:pointer">
    <span class="summary-stat-val" id="sum-agents">-</span>
    <span class="summary-stat-label">Agents</span>
  </div>
  <div class="summary-stat clickable-card" onclick="document.getElementById('tokens-section').scrollIntoView({behavior:'smooth'})" style="cursor:pointer">
    <span class="summary-stat-val" id="sum-cost">-</span>
    <span class="summary-stat-label">Tokens Today</span>
  </div>
  <div class="summary-stat clickable-card" onclick="openMemoryDrawer()" style="cursor:pointer">
    <span class="summary-stat-val" id="sum-memories">-</span>
    <span class="summary-stat-label">Memories</span>
  </div>
</div>

<!-- Agent Status Cards -->
<div id="agents-section" class="mb-5" style="display:none">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Agents</h2>
    <div class="flex items-center gap-2">
      <button onclick="openCreateAgentWizard()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer">+ New Agent</button>
      <div class="model-picker" onclick="toggleModelPicker(this)" style="display:inline-block">
        <span class="model-current" style="color:#6b7280">Set all <span style="font-size:8px;opacity:0.5">&#9662;</span></span>
        <div class="model-menu" style="display:none;right:0;left:auto">
          <div class="model-opt" data-model="claude-opus-4-6" onclick="pickGlobalModel(this)">All Opus</div>
          <div class="model-opt" data-model="claude-sonnet-4-6" onclick="pickGlobalModel(this)">All Sonnet</div>
          <div class="model-opt" data-model="claude-haiku-4-5" onclick="pickGlobalModel(this)">All Haiku</div>
        </div>
      </div>
    </div>
  </div>
  <div id="agents-container" class="flex flex-wrap gap-3"></div>
</div>

<!-- War Room Quick Access (only shown when WARROOM_ENABLED) -->
${WARROOM_ENABLED ? `<div class="card" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;border:1px solid #1e3a5f;background:linear-gradient(135deg,#0f172a 0%,#1a1a1a 100%)" onclick="window.location.href='/warroom?token=${token}&chatId=${chatId}'">
  <div>
    <div style="font-size:14px;font-weight:600;color:#60a5fa">War Room</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px">Voice standup with your agent team</div>
  </div>
  <div style="font-size:20px;color:#3b82f6">&#127908;</div>
</div>` : ''}

<!-- War Room Voice Settings (only shown when WARROOM_ENABLED) -->
${WARROOM_ENABLED ? `<div class="card" style="border:1px solid #1e3a5f">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div>
      <div style="font-size:14px;font-weight:600;color:#a5b4fc">War Room Voices</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">Per-agent Gemini Live voice config. Main keeps Charon unless you change it.</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="voicesSaveBtn" onclick="saveVoices()" disabled style="background:#374151;color:#9ca3af;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:not-allowed">Save</button>
      <button id="voicesApplyBtn" onclick="applyVoices()" style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">Save &amp; Apply</button>
    </div>
  </div>
  <div id="voicesRows" style="display:flex;flex-direction:column;gap:6px">
    <div style="font-size:11px;color:#6b7280;padding:8px 0">Loading voices...</div>
  </div>
  <div id="voicesStatus" style="font-size:11px;color:#6b7280;margin-top:8px;min-height:14px"></div>
</div>` : ''}

<!-- Live Meetings: two modes sharing one card and one sessions list -->
<div class="card" id="meet-card" style="border:1px solid #1e3a5f">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
    <div>
      <div style="font-size:14px;font-weight:600;color:#a5b4fc">Live Meetings</div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">Send an agent into a Google Meet. Pick avatar or voice-only below.</div>
    </div>
    <button onclick="openNewMeet()" style="background:#1a1a1a;color:#60a5fa;border:1px solid #1e3a5f;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">New Meet &#8599;</button>
  </div>

  <!-- Mode 1: Pika avatar (existing, preserved) -->
  <div style="padding:10px 12px;background:#0b0f1a;border:1px solid #1e293b;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:#60a5fa">Avatar mode &middot; Pika</div>
      <div style="font-size:10px;color:#6b7280">Real-time AI avatar, ~$0.28/min, Pika-rendered face &amp; voice</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="meet-agent-select" style="background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;min-width:110px">
        <option value="main">Loading...</option>
      </select>
      <input type="text" id="meet-url-input" placeholder="Paste Meet URL, or leave empty to auto-read clipboard"
        style="flex:1;min-width:220px;background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;font-family:ui-monospace,monospace">
      <label style="display:flex;gap:5px;align-items:center;color:#9ca3af;font-size:11px;cursor:pointer;user-select:none">
        <input type="checkbox" id="meet-auto-brief" checked style="margin:0;accent-color:#4f46e5"> Auto-brief
      </label>
      <button onclick="sendAgentToMeet()" id="meet-send-btn"
        style="background:#4f46e5;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">Send</button>
    </div>
    <div id="meet-status" style="font-size:11px;color:#6b7280;min-height:14px;margin-top:6px"></div>
  </div>

  <!-- Mode 2: Voice-only via Recall.ai (new) -->
  <div style="padding:10px 12px;background:#0f0b1a;border:1px solid #2b1e3b;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:#a78bfa">Voice-only mode &middot; Recall.ai</div>
      <div style="font-size:10px;color:#6b7280">Joins an existing Google Meet URL, audio only, ~$0.01/min</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="meet-voice-agent-select" style="background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;min-width:110px">
        <option value="main">Loading...</option>
      </select>
      <input type="text" id="meet-voice-url-input" placeholder="Paste Meet URL, or leave empty to auto-read clipboard"
        style="flex:1;min-width:220px;background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;font-family:ui-monospace,monospace">
      <label style="display:flex;gap:5px;align-items:center;color:#9ca3af;font-size:11px;cursor:pointer;user-select:none">
        <input type="checkbox" id="meet-voice-auto-brief" checked style="margin:0;accent-color:#a78bfa"> Auto-brief
      </label>
      <button onclick="sendVoiceAgentToMeet()" id="meet-voice-send-btn"
        style="background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">Send</button>
    </div>
    <div id="meet-voice-status" style="font-size:11px;color:#6b7280;min-height:14px;margin-top:6px"></div>
  </div>

  <!-- Mode 3: Daily.co Pipecat pipeline -->
  <div style="padding:10px 12px;background:#0a1410;border:1px solid #1a3b2b;border-radius:8px;margin-bottom:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:12px;font-weight:600;color:#34d399">Daily.co mode &middot; Pipecat + Gemini Live</div>
      <div style="font-size:10px;color:#6b7280">Creates a Daily room, share the link with whoever. Sub-second latency, real tool calling.</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="meet-daily-agent-select" style="background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;min-width:110px">
        <option value="main">Loading...</option>
      </select>
      <select id="meet-daily-mode-select" style="background:#0a0a0a;color:#fff;border:1px solid #2a2a2a;border-radius:6px;padding:6px 10px;font-size:12px;min-width:100px">
        <option value="direct">Direct</option>
        <option value="auto">Hand Up</option>
      </select>
      <label style="display:flex;gap:5px;align-items:center;color:#9ca3af;font-size:11px;cursor:pointer;user-select:none">
        <input type="checkbox" id="meet-daily-auto-brief" style="margin:0;accent-color:#10b981"> Auto-brief
      </label>
      <button onclick="createDailyRoom()" id="meet-daily-send-btn"
        style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer">Create room &amp; dispatch</button>
    </div>
    <div id="meet-daily-status" style="font-size:11px;color:#6b7280;min-height:14px;margin-top:6px"></div>
    <div id="meet-daily-room-box" style="display:none;margin-top:8px;padding:8px 10px;background:#050b08;border:1px solid #1a3b2b;border-radius:6px;font-size:11px;color:#a7f3d0;font-family:ui-monospace,monospace;word-break:break-all">
      <span id="meet-daily-room-url"></span>
      <button id="meet-daily-copy-btn" onclick="copyDailyRoomUrl()" style="margin-left:8px;background:#10b981;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer">Copy</button>
    </div>
  </div>

  <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:1px;margin:6px 2px">Active sessions</div>
  <div id="meet-sessions" style="display:flex;flex-direction:column;gap:6px">
    <div style="font-size:11px;color:#6b7280;padding:4px 0">No active sessions.</div>
  </div>
</div>

<!-- Hive Mind Feed -->
<div id="hive-section" class="mb-5" style="display:none">
  <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Hive Mind<button class="privacy-toggle" onclick="toggleSectionBlur('hive')" title="Toggle blur">&#128065;</button></h2>
  <div id="hive-container" class="card hive-scroll">
    <div class="text-gray-500 text-sm">Loading...</div>
  </div>
</div>

<!-- Tasks Inbox -->
<div id="tasks-inbox-section" class="mb-5" style="display:none">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Tasks</h2>
    <div class="flex gap-2">
      <button onclick="autoAssignAll()" id="auto-assign-all-btn" style="background:#1a1a1a;color:#a78bfa;border:1px solid #2a2a2a;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;display:none">Auto-assign All</button>
      <button onclick="openMissionModal()" style="background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer">+ New</button>
    </div>
  </div>
  <div id="tasks-inbox" class="flex flex-wrap gap-3"></div>
</div>

<!-- Mission Control -->
<div id="mission-section" class="mb-5" style="display:none">
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Mission Control</h2>
    <button onclick="openTaskHistory()" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer">History &rarr;</button>
  </div>
  <div id="mission-board" class="flex gap-3 overflow-x-auto pb-2" style="scroll-snap-type: x mandatory;">
  </div>
</div>

<!-- Mission Task Creation Modal -->
<div id="mission-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:40;opacity:0;pointer-events:none;transition:opacity 0.2s"></div>
<div id="mission-modal" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.95);z-index:50;background:#141414;border:1px solid #2a2a2a;border-radius:12px;width:90%;max-width:440px;opacity:0;pointer-events:none;transition:transform 0.2s ease,opacity 0.2s ease">
  <div class="flex items-center justify-between px-4 pt-4 pb-2">
    <h3 class="text-sm font-bold text-white">New Task</h3>
    <button onclick="closeMissionModal()" class="text-gray-500 hover:text-white" style="background:none;border:none;cursor:pointer;font-size:16px">&times;</button>
  </div>
  <div style="padding:0 16px 16px">
    <input type="text" id="mission-title" placeholder="Title" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;outline:none;margin-bottom:8px;box-sizing:border-box" maxlength="200">
    <textarea id="mission-prompt" rows="3" placeholder="What should the agent do?" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;outline:none;resize:vertical;margin-bottom:8px;box-sizing:border-box" maxlength="10000"></textarea>
    <div class="flex gap-2 items-center">
      <select id="mission-priority" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:6px 10px;color:#e0e0e0;font-size:12px;outline:none">
        <option value="0">Low</option>
        <option value="5" selected>Medium</option>
        <option value="10">High</option>
      </select>
      <select id="mission-timeout" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:6px 10px;color:#e0e0e0;font-size:12px;outline:none">
        <option value="">Timeout: default</option>
        <option value="300000">5 min</option>
        <option value="600000">10 min</option>
        <option value="900000" selected>15 min</option>
        <option value="1800000">30 min</option>
        <option value="3600000">60 min</option>
      </select>
      <button onclick="createMissionTask()" style="flex:1;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:8px;font-size:13px;font-weight:600;cursor:pointer">Create</button>
    </div>
    <div id="mission-error" class="text-red-400 text-xs mt-2" style="display:none"></div>
  </div>
</div>

<div id="task-popup-float"></div>

<!-- Agent Detail Modal -->
<div id="agent-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:40;opacity:0;pointer-events:none;transition:opacity 0.2s"></div>
<div id="agent-modal" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.95);z-index:50;background:#141414;border:1px solid #2a2a2a;border-radius:12px;width:90%;max-width:500px;max-height:80vh;opacity:0;pointer-events:none;transition:transform 0.2s ease,opacity 0.2s ease;display:flex;flex-direction:column">
  <div class="flex items-center justify-between px-4 pt-4 pb-2">
    <h3 class="text-sm font-bold text-white" id="agent-modal-title">Agent</h3>
    <button onclick="closeAgentModal()" class="text-gray-500 hover:text-white" style="background:none;border:none;cursor:pointer;font-size:16px">&times;</button>
  </div>
  <div id="agent-modal-body" style="overflow-y:auto;padding:0 16px 16px;flex:1"></div>
</div>

<!-- Create Agent Wizard Modal -->
<div id="create-agent-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:40;opacity:0;pointer-events:none;transition:opacity 0.2s"></div>
<div id="create-agent-modal" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.95);z-index:50;background:#141414;border:1px solid #2a2a2a;border-radius:12px;width:90%;max-width:480px;max-height:85vh;opacity:0;pointer-events:none;transition:transform 0.2s ease,opacity 0.2s ease;display:flex;flex-direction:column">
  <div class="flex items-center justify-between px-4 pt-4 pb-2">
    <h3 class="text-sm font-bold text-white" id="create-agent-title">New Agent</h3>
    <button onclick="closeCreateAgentWizard()" class="text-gray-500 hover:text-white" style="background:none;border:none;cursor:pointer;font-size:16px">&times;</button>
  </div>
  <!-- Step indicators -->
  <div class="flex gap-2 px-4 mb-3">
    <div id="caw-step-1-dot" style="flex:1;height:3px;border-radius:2px;background:#4f46e5;transition:background 0.2s"></div>
    <div id="caw-step-2-dot" style="flex:1;height:3px;border-radius:2px;background:#2a2a2a;transition:background 0.2s"></div>
    <div id="caw-step-3-dot" style="flex:1;height:3px;border-radius:2px;background:#2a2a2a;transition:background 0.2s"></div>
  </div>
  <div id="create-agent-body" style="overflow-y:auto;padding:0 16px 16px;flex:1">
    <!-- Step 1: Basics -->
    <div id="caw-step-1">
      <label class="text-xs text-gray-400 block mb-1">Agent ID <span class="text-gray-600">(lowercase, no spaces)</span></label>
      <input type="text" id="caw-id" placeholder="e.g. analytics" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;outline:none;margin-bottom:4px;box-sizing:border-box" maxlength="30" oninput="cawIdChanged()">
      <div id="caw-id-status" class="text-xs mb-3" style="min-height:16px"></div>

      <label class="text-xs text-gray-400 block mb-1">Display Name</label>
      <input type="text" id="caw-name" placeholder="e.g. Analytics" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;outline:none;margin-bottom:8px;box-sizing:border-box" maxlength="50" oninput="cawNameManuallyEdited=true">

      <label class="text-xs text-gray-400 block mb-1">Description</label>
      <input type="text" id="caw-desc" placeholder="What this agent does" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;color:#e0e0e0;font-size:13px;outline:none;margin-bottom:8px;box-sizing:border-box" maxlength="200">

      <div class="flex gap-2 mb-3">
        <div style="flex:1">
          <label class="text-xs text-gray-400 block mb-1">Model</label>
          <select id="caw-model" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 10px;color:#e0e0e0;font-size:12px;outline:none">
            <option value="claude-sonnet-4-6" selected>Sonnet 4.6</option>
            <option value="claude-opus-4-6">Opus 4.6</option>
            <option value="claude-haiku-4-5">Haiku 4.5</option>
          </select>
        </div>
        <div style="flex:1">
          <label class="text-xs text-gray-400 block mb-1">Template</label>
          <select id="caw-template" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 10px;color:#e0e0e0;font-size:12px;outline:none">
            <option value="_template">Blank</option>
          </select>
        </div>
      </div>

      <div id="caw-step1-error" class="text-red-400 text-xs mb-2" style="display:none"></div>
      <button onclick="cawGoStep2()" style="width:100%;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">Next: Set up Telegram bot</button>
    </div>

    <!-- Step 2: BotFather + Token -->
    <div id="caw-step-2" style="display:none">
      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:14px;margin-bottom:12px">
        <div class="text-xs text-gray-400 font-semibold uppercase mb-2">Create a Telegram bot</div>
        <div class="text-xs text-gray-300 leading-relaxed">
          1. Open <a href="https://t.me/BotFather" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:none">@BotFather</a> in Telegram<br>
          2. Send <code style="background:#222;padding:1px 4px;border-radius:3px">/newbot</code><br>
          3. Name it: <span id="caw-suggested-name" style="color:#a78bfa;cursor:pointer" onclick="copyToClipboard(this.textContent)" title="Click to copy"></span><br>
          4. Username: <span id="caw-suggested-username" style="color:#a78bfa;cursor:pointer" onclick="copyToClipboard(this.textContent)" title="Click to copy"></span><br>
          5. Copy the token BotFather gives you
        </div>
      </div>

      <label class="text-xs text-gray-400 block mb-1">Bot Token</label>
      <div style="position:relative">
        <input type="text" id="caw-token" placeholder="Paste token from BotFather" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;padding-right:70px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box;font-family:monospace" oninput="cawTokenChanged()">
        <div id="caw-token-status" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px"></div>
      </div>
      <div id="caw-token-info" class="text-xs mt-2" style="min-height:16px"></div>

      <div class="flex gap-2 mt-3">
        <button onclick="cawGoStep1()" style="flex:0 0 auto;background:#1a1a1a;color:#9ca3af;border:1px solid #2a2a2a;border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer">Back</button>
        <button id="caw-create-btn" onclick="cawCreate()" style="flex:1;background:#4f46e5;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;opacity:0.5;pointer-events:none">Create Agent</button>
      </div>
      <div id="caw-step2-error" class="text-red-400 text-xs mt-2" style="display:none"></div>
    </div>

    <!-- Step 3: Confirmation + Activate -->
    <div id="caw-step-3" style="display:none">
      <div style="text-align:center;margin-bottom:16px">
        <div style="width:48px;height:48px;border-radius:50%;background:#064e3b;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">
          <svg width="24" height="24" fill="none" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="text-sm font-semibold text-white">Agent Created</div>
      </div>

      <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:14px;margin-bottom:12px">
        <div id="caw-summary" class="text-xs text-gray-300 leading-relaxed"></div>
      </div>

      <div id="caw-activate-section">
        <button id="caw-activate-btn" onclick="cawActivate()" style="width:100%;background:#064e3b;color:#6ee7b7;border:1px solid #065f46;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer">Activate (install service + start)</button>
        <div id="caw-activate-status" class="text-xs text-center mt-2" style="min-height:16px"></div>
      </div>

      <button onclick="closeCreateAgentWizard();loadAgents();loadMissionControl();" style="width:100%;background:#1a1a1a;color:#9ca3af;border:1px solid #2a2a2a;border-radius:8px;padding:8px;font-size:12px;cursor:pointer;margin-top:8px">Done</button>
    </div>
  </div>
</div>

<!-- Desktop: 2-column grid. Mobile: stacked. -->
<div class="lg:grid lg:grid-cols-2 lg:gap-6">

<!-- LEFT COLUMN -->
<div>

<!-- Scheduled Tasks -->
<div id="tasks-section">
  <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Scheduled Tasks<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Automated tasks scheduled by the bot (e.g. reminders, checks). Shows the schedule, status, and time until next run.</span></span><button class="privacy-toggle" onclick="toggleSectionBlur('tasks')" title="Toggle blur">&#128065;</button></h2>
  <div id="tasks-container"><div class="card text-gray-500 text-sm">Loading...</div></div>
</div>

<!-- Memory Landscape -->
<div id="memory-section" class="mt-5">
  <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Memory Landscape</h2>
  <div class="grid grid-cols-3 gap-3 mb-3">
    <div class="card clickable-card text-center" onclick="openMemoryDrawer()" style="cursor:pointer">
      <div class="stat-val" id="mem-total">-</div>
      <div class="stat-label">Memories</div>
      <div class="text-xs text-gray-600 mt-1">Tap to browse</div>
    </div>
    <div class="card clickable-card text-center" onclick="openInsightsDrawer()" style="cursor:pointer">
      <div class="stat-val" id="mem-consolidations">-</div>
      <div class="stat-label">Insights</div>
      <div class="text-xs text-gray-600 mt-1">Tap to browse</div>
    </div>
    <div class="card clickable-card text-center" onclick="openPinnedDrawer()" style="cursor:pointer">
      <div class="stat-val" id="mem-pinned" style="color:#60a5fa">-</div>
      <div class="stat-label">Pinned</div>
      <div class="text-xs text-gray-600 mt-1">Tap to browse</div>
    </div>
  </div>
  <div class="card">
    <div class="text-xs text-gray-400 mb-2">Importance Distribution<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Distribution of memories by LLM-assigned importance (0-1). Higher = more critical to remember long-term.</span></span></div>
    <canvas id="importance-chart" height="120"></canvas>
  </div>
  <div class="card">
    <div class="flex items-center justify-between mb-1">
      <div class="text-xs text-gray-400">Fading Soon <span class="text-gray-600">(salience &lt; 0.5)</span><span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Memories losing salience. High-importance ones decay slower; low-importance ones fade fast.</span></span></div>
      <button class="text-xs text-gray-600 hover:text-gray-400 transition" onclick="openMemoryDrawer()">Browse all &rarr;</button>
    </div>
    <div id="fading-list" class="text-sm"></div>
  </div>
  <div class="card">
    <div class="flex items-center justify-between mb-1">
      <div class="text-xs text-gray-400">Recently Retrieved<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">High-importance memories recently used in conversations.</span></span></div>
      <button class="text-xs text-gray-600 hover:text-gray-400 transition" onclick="openMemoryDrawer()">Browse all &rarr;</button>
    </div>
    <div id="top-accessed-list" class="text-sm"></div>
  </div>
  <div class="card">
    <div class="flex items-center justify-between mb-1">
      <div class="text-xs text-gray-400">Recent Insights<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Patterns and connections discovered across memories by the consolidation engine.</span></span></div>
    </div>
    <div id="insights-list" class="text-sm"></div>
  </div>
  <div class="card">
    <div class="text-xs text-gray-400 mb-2">Memory Creation (30d)<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Number of new memories created per day over the last 30 days. Only meaningful exchanges get stored.</span></span></div>
    <canvas id="memory-timeline-chart" height="140"></canvas>
  </div>
</div>

</div><!-- end LEFT COLUMN -->

<!-- RIGHT COLUMN -->
<div>

<!-- System Health -->
<div id="health-section" class="mt-5 lg:mt-0">
  <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">System Health</h2>
  <div class="card flex items-center gap-4">
    <div class="relative">
      <svg id="context-gauge" width="90" height="90" viewBox="0 0 90 90"></svg>
      <span class="info-tip" style="position:absolute;top:0;right:-4px;"><span class="info-icon">\u24D8</span><span class="info-tooltip">Percentage of the context window in use. The higher it is, the closer the bot is to its working memory limit.</span></span>
    </div>
    <div class="flex-1">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div>
          <div class="stat-val text-base" id="health-turns">-</div>
          <div class="stat-label">Turns</div>
        </div>
        <div>
          <div class="stat-val text-base" id="health-age">-</div>
          <div class="stat-label">Age</div>
        </div>
        <div>
          <div class="stat-val text-base" id="health-compactions">-</div>
          <div class="stat-label">Compactions</div>
        </div>
      </div>
      <div class="text-center mt-1"><span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Turns = number of exchanges in the session. Age = session duration. Compactions = how many times context was compressed to free up space.</span></span></div>
    </div>
  </div>
  <div class="flex gap-3 mt-1">
    <span class="pill" id="tg-pill">Telegram</span>
    <span class="pill" id="wa-pill">WhatsApp</span>
    <span class="pill" id="slack-pill">Slack</span>
    <span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Connection status for messaging platforms (Telegram, WhatsApp, Slack). Green = connected, Red = disconnected.</span></span>
  </div>
</div>

<!-- Token / Cost -->
<div id="token-section" class="mt-5 mb-8">
  <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2" id="tokens-section">Token Usage<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Token consumption (text units processed by the AI). Today's totals and all-time cumulative. Included in your Max subscription.</span></span></h2>
  <div class="card">
    <div class="flex justify-between items-baseline">
      <div>
        <div class="stat-val" id="token-today-cost">-</div>
        <div class="stat-label">Tokens Today</div>
      </div>
      <div class="text-right">
        <div class="stat-val text-base" id="token-today-turns">-</div>
        <div class="stat-label">Turns today</div>
      </div>
    </div>
    <div class="mt-2 text-xs text-gray-500">All-time: <span id="token-alltime-cost">-</span> tokens across <span id="token-alltime-turns">-</span> turns</div>
  </div>
  <div class="card">
    <div class="text-xs text-gray-400 mb-2">Usage Timeline (30d)<span class="info-tip"><span class="info-icon">\u24D8</span><span class="info-tooltip">Daily token usage over the last 30 days.</span></span></div>
    <canvas id="cost-chart" height="140"></canvas>
  </div>

</div>

</div><!-- end RIGHT COLUMN -->

</div><!-- end grid -->
</div><!-- end outer wrapper -->

<!-- Memory drill-down drawer -->
<div id="drawer-overlay" class="drawer-overlay" onclick="closeDrawer()"></div>
<div id="drawer" class="drawer">
  <div class="drawer-handle"></div>
  <div class="flex items-center justify-between px-4 pt-3 pb-1">
    <h3 class="text-base font-bold text-white" id="drawer-title">Memories</h3>
    <button onclick="closeDrawer()" class="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
  </div>
  <div class="px-4 pb-2 flex items-center gap-2">
    <span class="text-xs text-gray-500" id="drawer-count"></span>
    <span class="text-xs text-gray-600">|</span>
    <span class="text-xs text-gray-500" id="drawer-avg-salience"></span>
  </div>
  <div class="drawer-body" id="drawer-body"></div>
  <div id="drawer-load-more" class="px-4 pb-4 hidden">
    <button onclick="loadMoreMemories()" class="w-full py-2 text-sm text-gray-400 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:text-white transition">Load more</button>
  </div>
</div>

<!-- Task History Drawer -->
<div id="history-overlay" class="drawer-overlay" onclick="closeTaskHistory()"></div>
<div id="history-drawer" class="drawer">
  <div class="drawer-handle"></div>
  <div class="flex items-center justify-between px-4 pt-3 pb-1">
    <h3 class="text-base font-bold text-white">Task History</h3>
    <button onclick="closeTaskHistory()" class="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
  </div>
  <div class="px-4 pb-2"><span class="text-xs text-gray-500" id="history-count"></span></div>
  <div class="drawer-body" id="history-body"></div>
  <div id="history-load-more" class="px-4 pb-4 hidden">
    <button onclick="loadMoreHistory()" class="w-full py-2 text-sm text-gray-400 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:text-white transition">Load more</button>
  </div>
</div>

<script>
const TOKEN = ${JSON.stringify(token)};
const CHAT_ID = ${JSON.stringify(chatId)};
const BASE = location.origin;

// Device detection
function detectDevice() {
  const ua = navigator.userAgent;
  const badge = document.getElementById('device-badge');
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  if (isMobile) {
    badge.textContent = 'MOBILE';
    badge.className = 'device-badge device-mobile';
  } else {
    badge.textContent = 'DESKTOP';
    badge.className = 'device-badge device-desktop';
  }
}
detectDevice();
window.addEventListener('resize', detectDevice);

// Memory drawer state
let drawerOffset = 0;
let drawerTotal = 0;
const DRAWER_PAGE = 30;

function salienceColor(s) {
  if (s >= 4) return '#10b981';
  if (s >= 3) return '#22c55e';
  if (s >= 2) return '#84cc16';
  if (s >= 1) return '#eab308';
  if (s >= 0.5) return '#f97316';
  return '#ef4444';
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMemoryItem(m) {
  let entities = [];
  let topics = [];
  let connections = [];
  try { entities = JSON.parse(m.entities); } catch {}
  try { topics = JSON.parse(m.topics); } catch {}
  try { connections = JSON.parse(m.connections); } catch {}
  const topicTags = topics.length > 0 ? '<div class="mt-1">' + topics.map(t => '<span style="background:#1e293b;padding:1px 6px;border-radius:4px;margin-right:3px;font-size:11px;color:#94a3b8">' + escapeHtml(t) + '</span>').join('') + '</div>' : '';
  const entityLine = entities.length > 0 ? '<div class="text-xs text-gray-600 mt-1">entities: ' + escapeHtml(entities.join(', ')) + '</div>' : '';
  const connLine = connections.length > 0 ? '<div class="text-xs text-gray-600 mt-1">linked to: ' + connections.map(c => '#' + c.linked_to + ' (' + escapeHtml(c.relationship || '') + ')').join(', ') + '</div>' : '';

  return '<div class="mem-item" onclick="this.classList.toggle(&quot;expanded&quot;)">' +
    '<div class="flex items-center gap-2 mb-1">' +
      '<span class="salience-dot" style="background:' + importanceColor(m.importance) + '"></span>' +
      '<span class="text-xs font-semibold" style="color:' + importanceColor(m.importance) + '">' + m.importance.toFixed(2) + '</span>' +
      '<span class="text-xs text-gray-700 ml-1">sal ' + m.salience.toFixed(2) + '</span>' +
      '<span class="text-xs text-gray-600 ml-auto">' + formatDate(m.created_at) + '</span>' +
    '</div>' +
    '<div class="text-sm text-gray-300 mem-content">' + escapeHtml(m.summary) + '</div>' +
    topicTags +
    entityLine +
    connLine +
  '</div>';
}

async function openMemoryDrawer() {
  drawerOffset = 0;
  document.getElementById('drawer-title').textContent = 'All Memories';
  document.getElementById('drawer-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Loading...</div>';
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  await loadDrawerPage();
}

async function openPinnedDrawer() {
  document.getElementById('drawer-title').textContent = 'Pinned Memories';
  document.getElementById('drawer-count').textContent = '';
  document.getElementById('drawer-avg-salience').textContent = '';
  document.getElementById('drawer-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Loading...</div>';
  document.getElementById('drawer-load-more').classList.add('hidden');
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  try {
    var data = await api('/api/memories/pinned?chatId=' + CHAT_ID);
    var mems = data.memories || [];
    document.getElementById('drawer-count').textContent = mems.length + ' pinned';
    if (mems.length === 0) {
      document.getElementById('drawer-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">No pinned memories. Use /pin to make important memories permanent.</div>';
      return;
    }
    document.getElementById('drawer-body').innerHTML = mems.map(renderMemoryItem).join('');
  } catch(e) {
    document.getElementById('drawer-body').innerHTML = '<div class="text-red-400 text-sm text-center py-8">Failed to load pinned memories</div>';
  }
}

async function openInsightsDrawer() {
  document.getElementById('drawer-title').textContent = 'Consolidation Insights';
  document.getElementById('drawer-count').textContent = '';
  document.getElementById('drawer-avg-salience').textContent = '';
  document.getElementById('drawer-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Loading...</div>';
  document.getElementById('drawer-load-more').classList.add('hidden');
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  try {
    var data = await api('/api/memories?chatId=' + CHAT_ID);
    var insights = data.consolidations || [];
    document.getElementById('drawer-count').textContent = insights.length + ' insights';
    if (insights.length === 0) {
      document.getElementById('drawer-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">No insights yet. Consolidation runs every 30 minutes.</div>';
      return;
    }
    document.getElementById('drawer-body').innerHTML = insights.map(function(c) {
      var date = new Date(c.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:12px;margin-bottom:8px">' +
        '<div class="text-xs text-purple-400 mb-1">' + date + '</div>' +
        '<div class="text-sm text-white mb-2">' + escapeHtml(c.insight || c.summary) + '</div>' +
        (c.summary && c.insight ? '<div class="text-xs text-gray-500">' + escapeHtml(c.summary) + '</div>' : '') +
      '</div>';
    }).join('');
  } catch(e) {
    document.getElementById('drawer-body').innerHTML = '<div class="text-red-400 text-sm text-center py-8">Failed to load insights</div>';
  }
}

async function loadDrawerPage() {
  const data = await api('/api/memories/list?chatId=' + CHAT_ID + '&sort=importance&limit=' + DRAWER_PAGE + '&offset=' + drawerOffset);
  drawerTotal = data.total;
  const body = document.getElementById('drawer-body');
  if (drawerOffset === 0) body.innerHTML = '';
  body.innerHTML += data.memories.map(renderMemoryItem).join('');
  drawerOffset += data.memories.length;
  document.getElementById('drawer-count').textContent = drawerTotal + ' total';
  const avgImp = data.memories.length > 0
    ? (data.memories.reduce((s, m) => s + m.importance, 0) / data.memories.length).toFixed(2)
    : '0';
  document.getElementById('drawer-avg-salience').textContent = 'avg importance ' + avgImp;
  const btn = document.getElementById('drawer-load-more');
  if (drawerOffset < drawerTotal) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

async function loadMoreMemories() {
  await loadDrawerPage();
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.body.style.overflow = '';
}

function api(path) {
  const sep = path.includes('?') ? '&' : '?';
  return fetch(BASE + path + sep + 'token=' + TOKEN).then(r => r.json());
}

let salienceChart, memTimelineChart, costChart;

function cronToHuman(cron) {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const time = (hour !== '*' ? hour.padStart(2,'0') : '*') + ':' + (min !== '*' ? min.padStart(2,'0') : '*');
  if (dow === '*' && dom === '*') return 'Daily at ' + time;
  if (dow !== '*' && dom === '*') {
    if (dow === '1-5') return 'Weekdays at ' + time;
    const d = dow.split(',').map(n => days[parseInt(n)] || n).join(', ');
    return d + ' at ' + time;
  }
  return cron;
}

function timeAgo(ts) {
  const diff = Math.floor(Date.now()/1000) - ts;
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff/60) + 'm ago';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
  return Math.floor(diff/86400) + 'd ago';
}

function countdown(ts) {
  const diff = ts - Math.floor(Date.now()/1000);
  if (diff <= 0) return 'now';
  if (diff < 60) return diff + 's';
  if (diff < 3600) return Math.floor(diff/60) + 'm';
  if (diff < 86400) return Math.floor(diff/3600) + 'h ' + Math.floor((diff%3600)/60) + 'm';
  return Math.floor(diff/86400) + 'd';
}
function elapsed(ts) {
  const diff = Math.floor(Date.now()/1000) - ts;
  if (diff < 60) return diff + 's';
  if (diff < 3600) return Math.floor(diff/60) + 'm ' + (diff%60) + 's';
  return Math.floor(diff/3600) + 'h ' + Math.floor((diff%3600)/60) + 'm';
}

async function taskAction(id, action) {
  try {
    if (action === 'delete') {
      await fetch(BASE + '/api/tasks/' + id + '?token=' + TOKEN, { method: 'DELETE' });
    } else {
      await fetch(BASE + '/api/tasks/' + id + '/' + action + '?token=' + TOKEN, { method: 'POST' });
    }
    await loadTasks();
  } catch(e) { console.error('Task action failed:', e); }
}

async function loadTasks() {
  try {
    const data = await api('/api/tasks');
    const c = document.getElementById('tasks-container');
    if (!data.tasks || data.tasks.length === 0) {
      c.innerHTML = '<div class="card text-gray-500 text-sm">No scheduled tasks</div>';
      return;
    }
    c.innerHTML = data.tasks.map(t => {
      const statusCls = t.status === 'running' ? 'pill-running' : t.status === 'active' ? 'pill-active' : 'pill-paused';
      const agentBadge = t.agent_id && t.agent_id !== 'main' ? '<span class="text-xs text-gray-500 ml-2">[' + resolveAgentName(t.agent_id) + ']</span>' : '';
      const lastStatusIcon = t.last_status === 'success' ? '<span class="last-success" title="Last run succeeded">&#10003;</span> ' : t.last_status === 'failed' ? '<span class="last-failed" title="Last run failed">&#10007;</span> ' : t.last_status === 'timeout' ? '<span class="last-timeout" title="Last run timed out">&#9200;</span> ' : '';
      const lastResult = t.last_result ? '<details class="mt-2"><summary class="text-xs text-gray-500">' + lastStatusIcon + 'Last result</summary><pre class="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words">' + escapeHtml(t.last_result) + '</pre></details>' : '';
      const runningInfo = t.status === 'running' && t.started_at ? '<span class="text-xs text-blue-400 ml-2">running for ' + elapsed(t.started_at) + '</span>' : '';
      const pauseBtn = t.status === 'active'
        ? '<button data-task="' + t.id + '" data-action="pause" onclick="taskAction(this.dataset.task,this.dataset.action)" title="Pause" style="background:none;border:none;cursor:pointer;color:#fbbf24;font-size:14px;padding:2px 4px">&#9208;</button>'
        : t.status === 'paused' ? '<button data-task="' + t.id + '" data-action="resume" onclick="taskAction(this.dataset.task,this.dataset.action)" title="Resume" style="background:none;border:none;cursor:pointer;color:#6ee7b7;font-size:14px;padding:2px 4px">&#9654;</button>' : '';
      const deleteBtn = '<button data-task="' + t.id + '" data-action="delete" onclick="taskAction(this.dataset.task,this.dataset.action)" title="Delete" style="background:none;border:none;cursor:pointer;color:#f87171;font-size:14px;padding:2px 4px">&times;</button>';
      const taskBlurState = JSON.parse(localStorage.getItem('privacyBlur_tasks') || '{}');
      const tasksAllRevealed = localStorage.getItem('privacyBlur_tasks_all') === 'revealed';
      const taskBlurred = tasksAllRevealed ? false : (taskBlurState[t.id] !== false);
      const taskBlurClass = taskBlurred ? 'privacy-blur' : '';
      return '<div class="card"><div class="flex justify-between items-start"><div class="flex-1 mr-2"><div class="text-sm text-white task-prompt ' + taskBlurClass + '" data-section="tasks" data-idx="' + t.id + '" onclick="toggleItemBlur(this)">' + escapeHtml(t.prompt) + '</div>' + agentBadge + '<div class="text-xs text-gray-500 mt-1">' + cronToHuman(t.schedule) + ' &middot; next in <span class="countdown" data-ts="' + t.next_run + '">' + countdown(t.next_run) + '</span>' + runningInfo + '</div></div><div class="flex items-center gap-1">' + pauseBtn + deleteBtn + '<span class="pill ' + statusCls + '">' + t.status + '</span></div></div>' + lastResult + '</div>';
    }).join('');
  } catch(e) {
    document.getElementById('tasks-container').innerHTML = '<div class="card text-red-400 text-sm">Failed to load tasks</div>';
  }
}

function importanceColor(imp) {
  if (imp >= 0.8) return '#10b981';
  if (imp >= 0.6) return '#22c55e';
  if (imp >= 0.4) return '#eab308';
  if (imp >= 0.2) return '#f97316';
  return '#ef4444';
}

function renderTopics(topicsJson) {
  try {
    const topics = JSON.parse(topicsJson);
    if (!topics.length) return '';
    return '<div class="text-xs text-gray-600 mt-0.5">' + topics.map(t => '<span style="background:#1e293b;padding:1px 6px;border-radius:4px;margin-right:3px">' + escapeHtml(t) + '</span>').join('') + '</div>';
  } catch { return ''; }
}

async function loadMemories() {
  try {
    const data = await api('/api/memories?chatId=' + CHAT_ID);
    document.getElementById('mem-total').textContent = data.stats.total;
    document.getElementById('mem-consolidations').textContent = data.stats.consolidations;
    document.getElementById('mem-pinned').textContent = data.stats.pinned || '0';

    // Importance distribution chart
    const bucketLabels = ['0-0.2','0.2-0.4','0.4-0.6','0.6-0.8','0.8-1.0'];
    const bucketColors = ['#ef4444','#f97316','#eab308','#22c55e','#10b981'];
    const bucketData = bucketLabels.map(b => {
      const found = data.stats.importanceDistribution.find(d => d.bucket === b);
      return found ? found.count : 0;
    });
    if (salienceChart) salienceChart.destroy();
    salienceChart = new Chart(document.getElementById('importance-chart'), {
      type: 'bar',
      data: { labels: bucketLabels, datasets: [{ data: bucketData, backgroundColor: bucketColors, borderRadius: 4 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#666' }, grid: { color: '#222' } }, x: { ticks: { color: '#666' }, grid: { display: false } } } }
    });

    // Fading
    const fading = document.getElementById('fading-list');
    if (data.fading.length === 0) {
      fading.innerHTML = '<span class="text-gray-600">None fading</span>';
    } else {
      fading.innerHTML = data.fading.map(m => '<div class="fade-text py-0.5 mem-expand" onclick="this.classList.toggle(&quot;open&quot;)"><span class="mem-preview"><span style="color:' + importanceColor(m.importance) + '">[' + m.importance.toFixed(1) + ']</span> ' + escapeHtml(m.summary.slice(0,80)) + (m.summary.length > 80 ? '...' : '') + '</span><div class="mem-full">' + escapeHtml(m.summary) + renderTopics(m.topics) + '</div></div>').join('');
    }

    // Top accessed
    const top = document.getElementById('top-accessed-list');
    if (data.topAccessed.length === 0) {
      top.innerHTML = '<span class="text-gray-600">No memories yet</span>';
    } else {
      top.innerHTML = data.topAccessed.map(m => '<div class="top-text py-0.5 mem-expand" onclick="this.classList.toggle(&quot;open&quot;)"><span class="mem-preview"><span style="color:' + importanceColor(m.importance) + '">[' + m.importance.toFixed(1) + ']</span> ' + escapeHtml(m.summary.slice(0,80)) + (m.summary.length > 80 ? '...' : '') + '</span><div class="mem-full">' + escapeHtml(m.summary) + renderTopics(m.topics) + '</div></div>').join('');
    }

    // Insights
    const insights = document.getElementById('insights-list');
    if (!data.consolidations || data.consolidations.length === 0) {
      insights.innerHTML = '<span class="text-gray-600">No insights yet</span>';
    } else {
      insights.innerHTML = data.consolidations.map(c => '<div class="py-1 mem-expand" onclick="this.classList.toggle(&quot;open&quot;)"><span class="mem-preview" style="color:#a78bfa">' + escapeHtml(c.insight.slice(0,100)) + (c.insight.length > 100 ? '...' : '') + '</span><div class="mem-full" style="color:#d4d4d8">' + escapeHtml(c.summary) + '<div class="text-xs text-gray-600 mt-1">' + formatDate(c.created_at) + '</div></div></div>').join('');
    }

    // Timeline
    if (memTimelineChart) memTimelineChart.destroy();
    if (data.timeline.length > 0) {
      memTimelineChart = new Chart(document.getElementById('memory-timeline-chart'), {
        type: 'line',
        data: {
          labels: data.timeline.map(d => d.date.slice(5)),
          datasets: [
            { label: 'Memories', data: data.timeline.map(d => d.count), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', fill: true, tension: 0.3 }
          ]
        },
        options: { responsive: true, plugins: { legend: { labels: { color: '#888', boxWidth: 12 } } }, scales: { y: { ticks: { color: '#666' }, grid: { color: '#222' } }, x: { ticks: { color: '#666', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } } } }
      });
    }
  } catch(e) {
    console.error('Memory load error', e);
  }
}

function drawGauge(pct) {
  const svg = document.getElementById('context-gauge');
  const r = 36, cx = 45, cy = 45, sw = 8;
  const circ = 2 * Math.PI * r;
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const dashOffset = circ - (circ * clampedPct / 100);
  let color = '#22c55e';
  if (clampedPct >= 75) color = '#ef4444';
  else if (clampedPct >= 50) color = '#f59e0b';
  svg.innerHTML =
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#2a2a2a" stroke-width="'+sw+'"/>' +
    '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+dashOffset+'" transform="rotate(-90 '+cx+' '+cy+')"/>' +
    '<text x="'+cx+'" y="'+cy+'" text-anchor="middle" dominant-baseline="central" fill="'+color+'" font-size="16" font-weight="700">'+clampedPct+'%</text>';
}

async function loadHealth() {
  try {
    const data = await api('/api/health?chatId=' + CHAT_ID);
    drawGauge(data.contextPct);
    document.getElementById('health-turns').textContent = data.turns;
    document.getElementById('health-compactions').textContent = data.compactions;
    document.getElementById('health-age').textContent = data.sessionAge;

    const tgPill = document.getElementById('tg-pill');
    // Relabel based on active messenger — the element id stays 'tg-pill'
    // for back-compat with pre-Signal builds, but Signal users see "Signal".
    var messengerLabel = (data.messengerType || 'telegram') === 'signal' ? 'Signal' : 'Telegram';
    tgPill.textContent = messengerLabel;
    var isConnected = data.messengerConnected !== undefined ? data.messengerConnected : data.telegramConnected;
    tgPill.className = 'pill ' + (isConnected ? 'pill-connected' : 'pill-disconnected');
    const waPill = document.getElementById('wa-pill');
    waPill.className = 'pill ' + (data.waConnected ? 'pill-connected' : 'pill-disconnected');
    const slackPill = document.getElementById('slack-pill');
    slackPill.className = 'pill ' + (data.slackConnected ? 'pill-connected' : 'pill-disconnected');
  } catch(e) {
    drawGauge(0);
  }
}

async function loadTokens() {
  try {
    const data = await api('/api/tokens?chatId=' + CHAT_ID);
    var todayTok = (data.stats.todayInput || 0) + (data.stats.todayOutput || 0);
    document.getElementById('token-today-cost').textContent = todayTok > 1000 ? Math.round(todayTok / 1000).toLocaleString() + 'k' : todayTok.toString();
    document.getElementById('token-today-turns').textContent = data.stats.todayTurns;
    var allTok = (data.stats.allTimeInput || 0) + (data.stats.allTimeOutput || 0);
    document.getElementById('token-alltime-cost').textContent = allTok > 1000000 ? (allTok / 1000000).toFixed(1) + 'M' : allTok > 1000 ? Math.round(allTok / 1000) + 'k' : allTok.toString();
    document.getElementById('token-alltime-turns').textContent = data.stats.allTimeTurns;

    // Usage timeline (turns per day)
    if (costChart) costChart.destroy();
    if (data.costTimeline.length > 0) {
      costChart = new Chart(document.getElementById('cost-chart'), {
        type: 'line',
        data: {
          labels: data.costTimeline.map(d => d.date.slice(5)),
          datasets: [{ label: 'Turns', data: data.costTimeline.map(d => d.turns), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.1)', fill: true, tension: 0.3, pointRadius: 2 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: '#666' }, grid: { color: '#222' } }, x: { ticks: { color: '#666', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } } } }
      });
    }

    // Cache doughnut
    if (cacheChart) cacheChart.destroy();
  } catch(e) {
    console.error('Token load error', e);
  }
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function copyCode(btn) {
  var code = btn.parentElement.querySelector('code');
  if (!code) return;
  var text = code.textContent;
  var onDone = function() {
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  };
  var onFail = function() {
    btn.textContent = 'Failed';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onDone, onFail);
    return;
  }
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) onDone(); else onFail();
  } catch (e) { onFail(); }
}

async function loadInfo() {
  try {
    const r = await fetch(BASE + '/api/info?token=' + TOKEN + '&chatId=' + CHAT_ID);
    const d = await r.json();
    const el = document.getElementById('bot-info');
    const parts = [];
    if (d.botName) parts.push('<span class="font-semibold text-white">' + d.botName + '</span>');
    el.innerHTML = parts.join(' <span class="text-gray-700">|</span> ');
  } catch {}
}

// Tooltip open/close \u2014 capture phase to intercept before inline onclick handlers
document.addEventListener('click', function(e) {
  const icon = e.target.closest('.info-icon');
  if (icon) {
    e.stopPropagation();
    e.preventDefault();
    const tip = icon.parentElement;
    const wasActive = tip.classList.contains('active');
    document.querySelectorAll('.info-tip.active').forEach(t => t.classList.remove('active'));
    if (!wasActive) tip.classList.add('active');
    return;
  }
  const tooltip = e.target.closest('.info-tooltip');
  if (tooltip) {
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  document.querySelectorAll('.info-tip.active').forEach(t => t.classList.remove('active'));
}, true);

// ── War Room voice config ────────────────────────────────────────────
// State lives on window so the edit tracking survives refreshAgents() cycles.
window.__voicesState = { loaded: false, rows: [], catalog: [], dirty: new Set() };

async function loadVoices() {
  const rowsEl = document.getElementById('voicesRows');
  if (!rowsEl) return;
  try {
    const data = await api('/api/warroom/voices');
    if (!data || !data.ok) throw new Error((data && data.error) || 'failed');
    window.__voicesState.rows = data.voices;
    window.__voicesState.catalog = data.gemini_catalog;
    window.__voicesState.dirty = new Set();
    window.__voicesState.loaded = true;
    renderVoices();
  } catch (err) {
    rowsEl.innerHTML = '<div style="font-size:11px;color:#ef4444;padding:8px 0">Failed to load voices: ' + String(err).replace(/</g,'&lt;') + '</div>';
  }
}

function renderVoices() {
  const rowsEl = document.getElementById('voicesRows');
  if (!rowsEl) return;
  const { rows, catalog, dirty } = window.__voicesState;
  const html = rows.map(function(r) {
    const opts = catalog.map(function(v) {
      const selected = v.name === r.gemini_voice ? ' selected' : '';
      return '<option value="' + v.name + '"' + selected + '>' + v.name + ' (' + v.style + ')</option>';
    }).join('');
    const isDirty = dirty.has(r.agent);
    const borderColor = isDirty ? '#6366f1' : 'rgba(255,255,255,0.05)';
    const defaultBadge = r.is_default
      ? '<span style="font-size:9px;color:#6b7280;margin-left:6px;padding:1px 5px;border:1px solid #374151;border-radius:3px">default</span>'
      : '';
    const dirtyBadge = isDirty
      ? '<span style="font-size:9px;color:#818cf8;margin-left:6px;padding:1px 5px;border:1px solid #4f46e5;border-radius:3px;background:rgba(79,70,229,0.1)">unsaved</span>'
      : '';
    return (
      '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid ' + borderColor + ';border-radius:6px">' +
        '<div style="width:80px;font-size:12px;font-weight:600;color:#d1d5db;text-transform:uppercase;letter-spacing:0.5px">' + r.agent + defaultBadge + dirtyBadge + '</div>' +
        '<select data-agent="' + r.agent + '" onchange="onVoiceChange(this)" style="flex:1;max-width:280px;background:#0f172a;color:#e5e7eb;border:1px solid #1e293b;border-radius:4px;padding:4px 8px;font-size:12px;font-family:inherit">' + opts + '</select>' +
        '<div style="flex:1;min-width:0;font-size:10px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (r.name || '') + '</div>' +
      '</div>'
    );
  }).join('');
  rowsEl.innerHTML = html || '<div style="font-size:11px;color:#6b7280;padding:8px 0">No agents found.</div>';

  // Save button enabled only when there are dirty changes
  const saveBtn = document.getElementById('voicesSaveBtn');
  if (saveBtn) {
    if (dirty.size > 0) {
      saveBtn.disabled = false;
      saveBtn.style.background = '#4f46e5';
      saveBtn.style.color = '#fff';
      saveBtn.style.cursor = 'pointer';
    } else {
      saveBtn.disabled = true;
      saveBtn.style.background = '#374151';
      saveBtn.style.color = '#9ca3af';
      saveBtn.style.cursor = 'not-allowed';
    }
  }
}

function onVoiceChange(sel) {
  const agent = sel.getAttribute('data-agent');
  const newVoice = sel.value;
  const row = window.__voicesState.rows.find(function(r) { return r.agent === agent; });
  if (!row) return;
  row.gemini_voice = newVoice;
  row.is_default = false;
  window.__voicesState.dirty.add(agent);
  renderVoices();
}

async function saveVoices(applyAfter) {
  const { rows, dirty } = window.__voicesState;
  if (dirty.size === 0 && !applyAfter) return;
  const updates = rows
    .filter(function(r) { return dirty.has(r.agent) || applyAfter; })
    .map(function(r) { return { agent: r.agent, gemini_voice: r.gemini_voice }; });
  const statusEl = document.getElementById('voicesStatus');
  statusEl.style.color = '#6b7280';
  statusEl.textContent = 'Saving...';
  try {
    const res = await fetch(BASE + '/api/warroom/voices?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updates }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'save failed');
    window.__voicesState.dirty = new Set();
    statusEl.style.color = '#10b981';
    statusEl.textContent = applyAfter ? 'Saved. Applying...' : 'Saved. Use "Save & Apply" to activate now.';
    if (applyAfter) return true;
    // Re-render so dirty badges clear
    renderVoices();
  } catch (err) {
    statusEl.style.color = '#ef4444';
    statusEl.textContent = 'Save failed: ' + String(err);
    return false;
  }
}

async function applyVoices() {
  // Save any pending edits first, then kickstart main so warroom respawns
  const statusEl = document.getElementById('voicesStatus');
  const saveOk = await saveVoices(true);
  if (saveOk === false) return;
  try {
    const res = await fetch(BASE + '/api/warroom/voices/apply?token=' + TOKEN, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'apply failed');
    statusEl.style.color = '#10b981';
    statusEl.textContent = 'Applied. War Room will be back up in ~7s.';
    // Re-load after main has restarted so we see the new server-side state
    setTimeout(function() { loadVoices(); }, 8000);
  } catch (err) {
    statusEl.style.color = '#ef4444';
    statusEl.textContent = 'Apply failed: ' + String(err);
  }
}

// Load voices on dashboard startup
loadVoices();

// ── Live Meetings (Pika video meeting bot) ────────────────────────
// Lets the user pop open meet.google.com/new, then send any agent into the
// meeting as a real-time AI avatar. Clipboard auto-read on first Send.
//
// IMPORTANT: This block is embedded inside a TypeScript template literal
// (see getDashboardHtml), so regex literals and string escapes like \/
// and \' get EATEN at template-literal evaluation time, producing broken
// JS in the browser. We use plain string helpers instead of regex, and
// event delegation instead of inline onclick handlers, to sidestep all
// escape-sequence pitfalls.
const MEET_URL_PREFIX = 'https://meet.google.com/';

function isMeetUrl(s) {
  return typeof s === 'string'
    && s.indexOf(MEET_URL_PREFIX) === 0
    && s.length > MEET_URL_PREFIX.length + 2;
}

function extractMeetUrl(text) {
  // Kept intentionally simple: no regex, no backslash escapes, because
  // everything in this function body is inside a TypeScript template
  // literal where escape sequences get mangled. Meet's "copy meeting
  // link" button puts a clean URL in the clipboard, so trim-then-match
  // covers the whole happy path. Mixed content requires manual paste.
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  return isMeetUrl(trimmed) ? trimmed : null;
}

function openNewMeet() {
  window.open('https://meet.google.com/new', '_blank', 'noopener');
  const status = document.getElementById('meet-status');
  if (status) {
    status.style.color = '#60a5fa';
    status.textContent = 'Meet opened. Start the meeting, copy the link, come back and click Send.';
  }
}

async function loadMeetAgentOptions() {
  // Populates ALL THREE mode dropdowns (avatar, voice, daily) from the
  // /api/agents endpoint. Always includes 'main' at the top.
  const selAvatar = document.getElementById('meet-agent-select');
  const selVoice = document.getElementById('meet-voice-agent-select');
  const selDaily = document.getElementById('meet-daily-agent-select');
  if (!selAvatar && !selVoice && !selDaily) return;
  try {
    const data = await api('/api/agents');
    var agentMap = {};
    agentMap['main'] = 'Main';
    if (data && Array.isArray(data.agents)) {
      for (const a of data.agents) if (a && a.id) agentMap[a.id] = a.name || (a.id.charAt(0).toUpperCase() + a.id.slice(1));
    }
    var sorted = ['main', ...Object.keys(agentMap).filter(function(x){ return x !== 'main'; }).sort()];
    const optionsHtml = sorted.map(function(id) {
      return '<option value="' + id + '">' + (agentMap[id] || id) + '</option>';
    }).join('');
    if (selAvatar) selAvatar.innerHTML = optionsHtml;
    if (selVoice) selVoice.innerHTML = optionsHtml;
    if (selDaily) selDaily.innerHTML = optionsHtml;
  } catch (e) { /* keep the default "Main" only option */ }
}

async function sendAgentToMeet() {
  const agentSel = document.getElementById('meet-agent-select');
  const urlInput = document.getElementById('meet-url-input');
  const autoBrief = document.getElementById('meet-auto-brief').checked;
  const btn = document.getElementById('meet-send-btn');
  const status = document.getElementById('meet-status');

  let meetUrl = (urlInput.value || '').trim();

  // If the input is empty, try the clipboard. First time this runs the
  // browser will show a permission prompt; once granted it's silent.
  if (!meetUrl) {
    try {
      const clipText = await navigator.clipboard.readText();
      const extracted = extractMeetUrl(clipText);
      if (extracted) {
        meetUrl = extracted;
        urlInput.value = meetUrl;
      }
    } catch (e) {
      // permission denied, clipboard empty, or unsupported
    }
  }

  if (!meetUrl) {
    status.style.color = '#f59e0b';
    status.textContent = 'No Meet URL found. Paste one above, or grant clipboard permission and click Send again.';
    return;
  }

  if (!isMeetUrl(meetUrl)) {
    status.style.color = '#f59e0b';
    status.textContent = 'That URL does not look like a Google Meet link.';
    return;
  }

  const agent = agentSel.value;
  btn.disabled = true;
  btn.textContent = 'Dispatching...';
  status.style.color = '#60a5fa';
  status.textContent = autoBrief
    ? 'Briefing ' + agent + ' and joining. This can take 30-90 seconds...'
    : 'Joining as ' + agent + '...';

  try {
    const res = await fetch(BASE + '/api/meet/join?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agent, meet_url: meetUrl, auto_brief: autoBrief }),
    });
    const data = await res.json();
    if (data && data.ok) {
      status.style.color = '#10b981';
      status.textContent = agent + ' is in the meeting. Admit them in the Meet tab.';
      urlInput.value = '';
      refreshMeetSessions();
    } else {
      status.style.color = '#ef4444';
      let errMsg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      if (data && data.checkout_url) {
        errMsg += ' (top up at ' + data.checkout_url + ')';
      }
      status.textContent = 'Failed: ' + errMsg;
    }
  } catch (err) {
    status.style.color = '#ef4444';
    status.textContent = 'Failed: ' + (err && err.message ? err.message : err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

async function sendVoiceAgentToMeet() {
  // Voice-only mode via Recall.ai. Same flow as sendAgentToMeet() but
  // hits /api/meet/join-voice and uses the voice-mode DOM elements.
  // Until RECALL_API_KEY is set and the audio pipeline is wired, the
  // server returns a "needs setup" or "needs implementation" error
  // which we surface clearly so the user knows what to do.
  const agentSel = document.getElementById('meet-voice-agent-select');
  const urlInput = document.getElementById('meet-voice-url-input');
  const autoBrief = document.getElementById('meet-voice-auto-brief').checked;
  const btn = document.getElementById('meet-voice-send-btn');
  const status = document.getElementById('meet-voice-status');

  let meetUrl = (urlInput.value || '').trim();

  if (!meetUrl) {
    try {
      const clipText = await navigator.clipboard.readText();
      const extracted = extractMeetUrl(clipText);
      if (extracted) {
        meetUrl = extracted;
        urlInput.value = meetUrl;
      }
    } catch (e) { /* clipboard unavailable */ }
  }

  if (!meetUrl) {
    status.style.color = '#f59e0b';
    status.textContent = 'No Meet URL found. Paste one above, or grant clipboard permission and click Send again.';
    return;
  }
  if (!isMeetUrl(meetUrl)) {
    status.style.color = '#f59e0b';
    status.textContent = 'That URL does not look like a Google Meet link.';
    return;
  }

  const agent = agentSel.value;
  btn.disabled = true;
  btn.textContent = 'Dispatching...';
  status.style.color = '#a78bfa';
  status.textContent = autoBrief
    ? 'Briefing ' + agent + ' and joining voice-only...'
    : 'Joining ' + agent + ' voice-only...';

  try {
    const res = await fetch(BASE + '/api/meet/join-voice?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agent, meet_url: meetUrl, auto_brief: autoBrief }),
    });
    const data = await res.json();
    if (data && data.ok) {
      status.style.color = '#10b981';
      status.textContent = agent + ' is in the meeting (voice-only). Admit them in the Meet tab.';
      urlInput.value = '';
      refreshMeetSessions();
    } else {
      status.style.color = '#ef4444';
      let errMsg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      if (data && data.needs_setup) {
        errMsg = 'Setup needed: ' + errMsg;
      } else if (data && data.needs_implementation) {
        errMsg = 'Scaffolded only (not wired yet): ' + errMsg;
      }
      status.textContent = errMsg;
    }
  } catch (err) {
    status.style.color = '#ef4444';
    status.textContent = 'Failed: ' + (err && err.message ? err.message : err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

var __lastDailyRoomUrl = '';
async function createDailyRoom() {
  // Daily.co mode. Creates a fresh room server-side and spawns a
  // Pipecat agent in it. Returns the room URL which we display with
  // a copy-to-clipboard button so the user can share it.
  const agentSel = document.getElementById('meet-daily-agent-select');
  const modeSel = document.getElementById('meet-daily-mode-select');
  const autoBrief = document.getElementById('meet-daily-auto-brief').checked;
  const btn = document.getElementById('meet-daily-send-btn');
  const status = document.getElementById('meet-daily-status');
  const roomBox = document.getElementById('meet-daily-room-box');
  const roomUrlEl = document.getElementById('meet-daily-room-url');

  const agent = agentSel.value;
  const mode = modeSel.value;

  btn.disabled = true;
  btn.textContent = 'Creating room...';
  status.style.color = '#34d399';
  status.textContent = autoBrief
    ? 'Briefing ' + agent + ', creating room, spawning Pipecat agent...'
    : 'Creating Daily room and spawning ' + agent + '...';
  roomBox.style.display = 'none';

  try {
    const res = await fetch(BASE + '/api/meet/join-daily?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: agent, mode: mode, auto_brief: autoBrief }),
    });
    const data = await res.json();
    if (data && data.ok) {
      __lastDailyRoomUrl = data.room_url || '';
      roomUrlEl.textContent = __lastDailyRoomUrl;
      roomBox.style.display = 'block';
      status.style.color = '#10b981';
      status.textContent = agent + ' is in the room. Copy the link and share it.';
      refreshMeetSessions();
    } else {
      status.style.color = '#ef4444';
      const errMsg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      status.textContent = 'Failed: ' + errMsg;
    }
  } catch (err) {
    status.style.color = '#ef4444';
    status.textContent = 'Failed: ' + (err && err.message ? err.message : err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create room & dispatch';
  }
}

async function copyDailyRoomUrl() {
  if (!__lastDailyRoomUrl) return;
  const btn = document.getElementById('meet-daily-copy-btn');
  try {
    await navigator.clipboard.writeText(__lastDailyRoomUrl);
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function() { btn.textContent = orig; }, 1500);
    }
  } catch (e) { /* clipboard blocked */ }
}

async function leaveMeetSession(sessionId) {
  if (!sessionId) return;
  const row = document.querySelector('[data-meet-session="' + sessionId + '"]');
  if (row) row.style.opacity = '0.5';
  try {
    const res = await fetch(BASE + '/api/meet/leave?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    const status = document.getElementById('meet-status');
    if (data && data.ok) {
      if (status) {
        status.style.color = '#10b981';
        status.textContent = 'Left the meeting.';
      }
    } else if (status) {
      status.style.color = '#ef4444';
      status.textContent = 'Leave failed: ' + ((data && data.error) || 'unknown');
    }
  } catch (e) { /* silent */ }
  refreshMeetSessions();
}

function formatMeetElapsed(session) {
  const start = session.joined_at || session.created_at;
  if (!start) return '';
  const secs = Math.floor(Date.now() / 1000) - start;
  if (secs < 60) return secs + 's';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  return hrs + 'h ' + (mins % 60) + 'm';
}

async function refreshMeetSessions() {
  const container = document.getElementById('meet-sessions');
  if (!container) return;
  try {
    const data = await api('/api/meet/sessions');
    const active = (data && data.active) || [];
    if (active.length === 0) {
      container.innerHTML = '<div style="font-size:11px;color:#6b7280;padding:4px 0">No active sessions.</div>';
      return;
    }
    // Build rows via DOM APIs rather than innerHTML string concat so we
    // can bind click handlers directly and avoid any quote-escaping
    // landmines inside the surrounding TypeScript template literal.
    container.innerHTML = '';
    active.forEach(function(s) {
      const row = document.createElement('div');
      row.setAttribute('data-meet-session', s.id);
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#0a0a0a;border:1px solid #1f1f1f;border-radius:6px';

      const info = document.createElement('div');
      info.style.cssText = 'min-width:0;flex:1;display:flex;align-items:center;gap:8px';

      // Provider tag: pika avatar / recall voice-only / daily pipecat
      const provider = s.provider || 'pika';
      const tag = document.createElement('span');
      let tagLabel;
      let tagCss;
      if (provider === 'recall') {
        tagLabel = 'Voice';
        tagCss = 'background:rgba(124,58,237,0.15);color:#a78bfa;border:1px solid rgba(124,58,237,0.3)';
      } else if (provider === 'daily') {
        tagLabel = 'Daily';
        tagCss = 'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3)';
      } else {
        tagLabel = 'Avatar';
        tagCss = 'background:rgba(79,70,229,0.15);color:#60a5fa;border:1px solid rgba(79,70,229,0.3)';
      }
      tag.style.cssText = 'flex-shrink:0;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:4px;text-transform:uppercase;' + tagCss;
      tag.textContent = tagLabel;
      info.appendChild(tag);

      const meta = document.createElement('div');
      meta.style.cssText = 'min-width:0;flex:1';
      const title = document.createElement('div');
      title.style.cssText = 'font-size:12px;color:#fff;font-weight:600';
      const agentLabel = resolveAgentName(s.agent_id || 'main');
      title.textContent = agentLabel + ' · ' + (s.status === 'live' ? 'live' : s.status);
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:10px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      const urlShort = (s.meet_url || '').replace(MEET_URL_PREFIX, '');
      sub.textContent = 'meet/' + urlShort + ' · ' + formatMeetElapsed(s);
      meta.appendChild(title);
      meta.appendChild(sub);
      info.appendChild(meta);

      const leaveBtn = document.createElement('button');
      leaveBtn.style.cssText = 'background:#1a1a1a;color:#f87171;border:1px solid #2a2a2a;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:8px';
      leaveBtn.textContent = 'Leave';
      leaveBtn.addEventListener('click', function() { leaveMeetSession(s.id); });

      row.appendChild(info);
      row.appendChild(leaveBtn);
      container.appendChild(row);
    });
  } catch (e) { /* silent */ }
}

// Initial load + polling
loadMeetAgentOptions();
refreshMeetSessions();
setInterval(refreshMeetSessions, 5000);

// ── Agent & Hive Mind ────────────────────────────────────────────────
const AGENT_COLORS = { main: '#4f46e5', comms: '#0ea5e9', content: '#f59e0b', ops: '#10b981', research: '#8b5cf6' };

async function loadAgents() {
  try {
    const data = await api('/api/agents');
    // Populate global name lookup cache
    if (data && Array.isArray(data.agents)) {
      data.agents.forEach(function(a) { if (a && a.id && a.name) agentNameMap[a.id] = a.name; });
    }
    const section = document.getElementById('agents-section');
    const container = document.getElementById('agents-container');
    // Always show agents section so "+ New Agent" button is accessible
    section.style.display = '';
    // Keep shared cache in sync so modal can pull fresh description without refetch
    missionAgentsList = data.agents || [];
    if (!data.agents || data.agents.length <= 1) {
      container.innerHTML = '<div class="text-xs text-gray-600 py-2">No agents yet. Click + New Agent to create one.</div>';
      return;
    }
    container.innerHTML = data.agents.map(a => {
      const color = AGENT_COLORS[a.id] || '#6b7280';
      const dot = a.running ? '<span style="color:#6ee7b7">\u25CF</span>' : '<span style="color:#666">\u25CB</span>';
      const statusText = a.running ? 'live' : 'off';
      const modelOpts = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
      const modelShort = function(m) { return {'claude-opus-4-6':'Opus','claude-sonnet-4-6':'Sonnet','claude-sonnet-4-5':'Sonnet 4.5','claude-haiku-4-5':'Haiku'}[m] || m; };
      const currentModel = a.model || (a.id === 'main' ? 'claude-opus-4-6' : 'claude-sonnet-4-6');
      const modelLabel = modelShort(currentModel);
      const modelSelect = '<div class="model-picker" data-agent="' + a.id + '" onclick="event.stopPropagation();toggleModelPicker(this)">' +
        '<span class="model-current">' + modelLabel + ' <span style="font-size:8px;opacity:0.5">&#9662;</span></span>' +
        '<div class="model-menu" style="display:none">' +
          modelOpts.map(m => '<div class="model-opt' + (currentModel === m ? ' model-active' : '') + '" data-model="' + m + '" onclick="pickModel(this)">' + modelShort(m) + '</div>').join('') +
        '</div>' +
      '</div>';
      // Avatar served from /warroom-avatar/:id (same PNGs War Room uses).
      // The onerror fallback removes the <img> if no avatar file exists so
      // newly-created agents don't show a broken image icon.
      const avatarUrl = '/warroom-avatar/' + encodeURIComponent(a.id) + '?token=' + encodeURIComponent(TOKEN);
      const avatarImg = '<img src="' + avatarUrl + '" alt="" ' +
        'style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ' + color + ';flex-shrink:0;background:#0a0a0a" ' +
        'onerror="this.remove()">';
      const descText = (a.description || '').trim();
      const descBlock = descText
        ? '<div class="text-xs text-gray-400 mt-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.3" title="' + escapeHtml(descText) + '">' + escapeHtml(descText) + '</div>'
        : '<div class="text-xs text-gray-600 italic mt-1">no description</div>';
      const isMain = a.id === 'main';
      const dragAttrs = isMain ? '' : ' draggable="true" ondragstart="agentDragStart(event)" ondragend="agentDragEnd(event)" ondragover="agentDragOver(event)" ondrop="agentDrop(event)"';
      const grabCursor = isMain ? '' : 'cursor:grab;';
      // Per-agent Telegram pill — small indicator next to the agent
      // name showing whether this agent's Telegram bot is connected.
      // The header pill reflects only main's state; this surfaces
      // per-agent drops so sub-agents are visibly tracked too.
      // Green when connected, red when configured-but-disconnected,
      // hidden entirely if the agent isn't currently running (the
      // off/live dot below already conveys process state).
      let tgPill = '';
      if (a.running) {
        const cls = a.telegramConnected ? 'pill-connected' : 'pill-disconnected';
        const title = a.telegramConnected ? 'Telegram connected' : 'Telegram disconnected';
        tgPill = '<span class="pill ' + cls + '" title="' + title + '" style="font-size:10px;padding:1px 6px;margin-left:4px">TG</span>';
      }
      return '<div class="card clickable-card"' + dragAttrs + ' style="min-width:150px;flex:1;max-width:220px;border-left:3px solid ' + color + ';' + grabCursor + 'transition:opacity 0.15s,transform 0.15s" data-agent="' + a.id + '" onclick="toggleAgentDetail(this.dataset.agent)">' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
          avatarImg +
          '<div style="flex:1;min-width:0">' +
            '<div class="font-bold text-white text-sm">' + a.name + tgPill + '</div>' +
            descBlock +
            '<div class="text-xs mt-1">' + dot + ' ' + statusText + '</div>' +
            modelSelect +
            (a.running ? '<div class="text-xs text-gray-400 mt-1">' + a.todayTurns + ' turns</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch {}
}

function toggleModelPicker(el) {
  var menu = el.querySelector('.model-menu');
  var isOpen = menu.style.display !== 'none';
  // Close all other menus first
  document.querySelectorAll('.model-menu').forEach(function(m) { m.style.display = 'none'; });
  menu.style.display = isOpen ? 'none' : '';
}

async function pickModel(optEl) {
  var model = optEl.dataset.model;
  var picker = optEl.closest('.model-picker');
  var agentId = picker.dataset.agent;
  picker.querySelector('.model-menu').style.display = 'none';
  try {
    await fetch(BASE + '/api/agents/' + agentId + '/model?token=' + TOKEN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model }),
    });
    await loadAgents();
  } catch(e) { console.error('Model update failed:', e); }
}

async function pickGlobalModel(optEl) {
  var model = optEl.dataset.model;
  optEl.closest('.model-menu').style.display = 'none';
  try {
    await fetch(BASE + '/api/agents/model?token=' + TOKEN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model }),
    });
    await loadAgents();
  } catch(e) { console.error('Global model update failed:', e); }
}

// Close model menus when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.model-picker')) {
    document.querySelectorAll('.model-menu').forEach(function(m) { m.style.display = 'none'; });
  }
});

async function toggleAgentDetail(agentId) {
  var overlay = document.getElementById('agent-modal-overlay');
  var modal = document.getElementById('agent-modal');
  var title = document.getElementById('agent-modal-title');
  var body = document.getElementById('agent-modal-body');

  // Find agent info
  var agent = missionAgentsList.find(function(a) { return a.id === agentId; });
  var color = AGENT_COLORS[agentId] || '#6b7280';
  title.innerHTML = '<span style="color:' + color + '">' + (agent ? agent.name : agentId) + '</span>';
  body.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Loading...</div>';

  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'auto';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.style.transform = 'translate(-50%,-50%) scale(1)';

  try {
    var results = await Promise.all([
      api('/api/agents/' + agentId + '/tasks'),
      api('/api/hive-mind?agent=' + agentId + '&limit=8'),
      api('/api/agents/' + agentId + '/conversation?chatId=' + CHAT_ID + '&limit=6'),
    ]);
    var tasks = results[0], hive = results[1], convo = results[2];
    var html = '';

    // Editable description (click to edit, Enter/blur saves, Esc cancels)
    var descText = (agent && agent.description) ? agent.description : '';
    var descDisplay = descText
      ? escapeHtml(descText)
      : '<span style="color:#4b5563;font-style:italic">Click to add description...</span>';
    html += '<div id="agent-desc-block" style="margin-bottom:12px">' +
      '<div class="text-xs text-gray-400 font-semibold mb-1 uppercase">Role</div>' +
      '<div id="agent-desc-view" data-agent="' + agentId + '" data-raw="' + escapeHtml(descText) + '" onclick="editAgentDescription()" ' +
        'style="background:#1a1a1a;border:1px dashed #2a2a2a;border-radius:6px;padding:8px;font-size:12px;color:#d1d5db;cursor:text;line-height:1.4" ' +
        'title="Click to edit">' + descDisplay + '</div>' +
      '<div id="agent-desc-status" class="text-xs mt-1" style="min-height:14px"></div>' +
      '</div>';

    // Last conversation
    if (convo.turns && convo.turns.length > 0) {
      html += '<div class="text-xs text-gray-400 font-semibold mb-2 uppercase">Recent conversation</div>';
      var sorted = convo.turns.slice().reverse();
      html += sorted.map(function(t) {
        var role = t.role === 'user' ? '<span style="color:#818cf8">You</span>' : '<span style="color:#6ee7b7">Agent</span>';
        var text = t.content.length > 200 ? t.content.slice(0, 200) + '...' : t.content;
        return '<div style="background:#1a1a1a;border-radius:6px;padding:8px;margin-bottom:4px">' +
          '<div class="text-xs" style="margin-bottom:2px">' + role + '</div>' +
          '<div class="text-xs text-gray-400">' + escapeHtml(text) + '</div></div>';
      }).join('');
    }

    // Hive mind activity
    if (hive.entries && hive.entries.length > 0) {
      html += '<div class="text-xs text-gray-400 font-semibold mt-3 mb-2 uppercase">Hive Mind activity</div>';
      html += hive.entries.map(function(e) {
        var time = new Date(e.created_at * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        return '<div style="background:#1a1a1a;border-radius:6px;padding:8px;margin-bottom:4px">' +
          '<span class="text-xs text-gray-500">' + time + '</span> ' +
          '<span class="text-xs text-gray-400">' + escapeHtml(e.summary) + '</span></div>';
      }).join('');
    }

    // Scheduled tasks
    if (tasks.tasks && tasks.tasks.length > 0) {
      html += '<div class="text-xs text-gray-400 font-semibold mt-3 mb-2 uppercase">Scheduled tasks (' + tasks.tasks.length + ')</div>';
      html += tasks.tasks.slice(0, 5).map(function(t) {
        return '<div style="background:#1a1a1a;border-radius:6px;padding:8px;margin-bottom:4px">' +
          '<div class="text-xs text-gray-300">' + escapeHtml(t.prompt.slice(0, 100)) + '</div>' +
          '<div class="text-xs text-gray-600 mt-1">' + t.schedule + '</div></div>';
      }).join('');
    }

    // Agent management controls (not for main)
    if (agentId !== 'main') {
      html += '<div class="flex gap-2 mt-4 pt-3" style="border-top:1px solid #2a2a2a">';
      if (agent && agent.running) {
        html += '<button data-agent="' + agentId + '" data-act="stop" onclick="agentModalAction(this.dataset.agent,this.dataset.act)" style="flex:1;background:#1a1a1a;color:#f87171;border:1px solid #7f1d1d;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer">Stop</button>';
        html += '<button data-agent="' + agentId + '" data-act="restart" onclick="agentModalAction(this.dataset.agent,this.dataset.act)" style="flex:1;background:#1a1a1a;color:#60a5fa;border:1px solid #1e3a5f;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer">Restart</button>';
      } else {
        html += '<button data-agent="' + agentId + '" data-act="start" onclick="agentModalAction(this.dataset.agent,this.dataset.act)" style="flex:1;background:#064e3b;color:#6ee7b7;border:1px solid #065f46;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer">Start</button>';
      }
      html += '<button data-agent="' + agentId + '" data-act="delete" onclick="agentModalAction(this.dataset.agent,this.dataset.act)" style="background:#1a1a1a;color:#6b7280;border:1px solid #2a2a2a;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">Delete</button>';
      html += '</div>';
      html += '<div id="agent-action-status" class="text-xs text-center mt-2" style="min-height:16px"></div>';
    }

    if (!html) html = '<div class="text-gray-500 text-sm text-center py-8">No activity yet for this agent.</div>';
    body.innerHTML = html;
  } catch(e) { body.innerHTML = '<div class="text-red-400 text-sm text-center py-8">Failed to load agent details</div>'; }
}

function editAgentDescription() {
  var view = document.getElementById('agent-desc-view');
  if (!view || view.dataset.editing === '1') return;
  var agentId = view.dataset.agent;
  var current = view.dataset.raw || '';
  view.dataset.editing = '1';
  view.innerHTML = '<textarea id="agent-desc-input" style="width:100%;background:#0f0f0f;color:#e5e7eb;border:1px solid #2a2a2a;border-radius:4px;padding:6px;font-size:12px;font-family:inherit;resize:vertical;min-height:48px;box-sizing:border-box" maxlength="500"></textarea>';
  var input = document.getElementById('agent-desc-input');
  input.value = current;
  input.focus();
  input.select();
  var saved = false;
  var commit = function() {
    if (saved) return;
    saved = true;
    saveAgentDescription(agentId, input.value);
  };
  var cancel = function() {
    if (saved) return;
    saved = true;
    renderAgentDescription(agentId, current);
  };
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

function renderAgentDescription(agentId, descText) {
  var view = document.getElementById('agent-desc-view');
  if (!view) return;
  view.dataset.editing = '';
  view.dataset.raw = descText || '';
  view.innerHTML = descText
    ? escapeHtml(descText)
    : '<span style="color:#4b5563;font-style:italic">Click to add description...</span>';
  // Keep cached list in sync so card reflects change without full reload
  var cached = missionAgentsList.find(function(a) { return a.id === agentId; });
  if (cached) cached.description = descText || '';
}

async function saveAgentDescription(agentId, raw) {
  var status = document.getElementById('agent-desc-status');
  var trimmed = (raw || '').trim();
  var view = document.getElementById('agent-desc-view');
  var previous = view ? (view.dataset.raw || '') : '';
  if (!trimmed) {
    if (status) status.innerHTML = '<span style="color:#f87171">Description cannot be empty</span>';
    renderAgentDescription(agentId, previous);
    return;
  }
  if (trimmed === previous) { renderAgentDescription(agentId, previous); return; }
  if (status) status.innerHTML = '<span style="color:#fbbf24">Saving...</span>';
  try {
    var res = await fetch(BASE + '/api/agents/' + agentId + '/description?token=' + TOKEN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: trimmed }),
    });
    var data = await res.json();
    if (res.ok && data.ok) {
      renderAgentDescription(agentId, trimmed);
      if (status) status.innerHTML = '<span style="color:#6ee7b7">Saved</span>';
      setTimeout(function() { if (status) status.innerHTML = ''; }, 1500);
      // Refresh card list so the new description shows on the card immediately
      loadAgents();
    } else {
      if (status) status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Save failed') + '</span>';
      renderAgentDescription(agentId, previous);
    }
  } catch(e) {
    if (status) status.innerHTML = '<span style="color:#f87171">Network error</span>';
    renderAgentDescription(agentId, previous);
  }
}

async function agentModalAction(agentId, action) {
  var status = document.getElementById('agent-action-status');
  if (!status) return;

  if (action === 'delete') {
    if (!confirm('Delete agent "' + agentId + '"? This removes all config, the service, and the bot token from .env.')) return;
    status.innerHTML = '<span style="color:#fbbf24">Deleting...</span>';
    try {
      var res = await fetch(BASE + '/api/agents/' + agentId + '/full?token=' + TOKEN, { method: 'DELETE' });
      var data = await res.json();
      if (data.ok) {
        status.innerHTML = '<span style="color:#6ee7b7">Deleted</span>';
        setTimeout(function() { closeAgentModal(); loadAgents(); loadMissionControl(); }, 800);
      } else {
        status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Delete failed') + '</span>';
      }
    } catch(e) { status.innerHTML = '<span style="color:#f87171">Network error</span>'; }
    return;
  }

  if (action === 'stop') {
    status.innerHTML = '<span style="color:#fbbf24">Stopping...</span>';
    try {
      await fetch(BASE + '/api/agents/' + agentId + '/deactivate?token=' + TOKEN, { method: 'POST' });
      status.innerHTML = '<span style="color:#6ee7b7">Stopped</span>';
      setTimeout(function() { closeAgentModal(); loadAgents(); }, 800);
    } catch(e) { status.innerHTML = '<span style="color:#f87171">Failed</span>'; }
    return;
  }

  if (action === 'start') {
    status.innerHTML = '<span style="color:#fbbf24">Starting...</span>';
    try {
      var res = await fetch(BASE + '/api/agents/' + agentId + '/activate?token=' + TOKEN, { method: 'POST' });
      var data = await res.json();
      if (data.ok) {
        status.innerHTML = '<span style="color:#6ee7b7">Started' + (data.pid ? ' (PID ' + data.pid + ')' : '') + '</span>';
        setTimeout(function() { closeAgentModal(); loadAgents(); }, 800);
      } else {
        status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Start failed') + '</span>';
      }
    } catch(e) { status.innerHTML = '<span style="color:#f87171">Network error</span>'; }
  }

  if (action === 'restart') {
    status.innerHTML = '<span style="color:#fbbf24">Restarting...</span>';
    try {
      var res = await fetch(BASE + '/api/agents/' + agentId + '/restart?token=' + TOKEN, { method: 'POST' });
      var data = await res.json();
      if (data.ok) {
        status.innerHTML = '<span style="color:#6ee7b7">Restarted</span>';
        setTimeout(function() { closeAgentModal(); loadAgents(); }, 800);
      } else {
        status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Restart failed') + '</span>';
      }
    } catch(e) { status.innerHTML = '<span style="color:#f87171">Network error</span>'; }
  }
}

function closeAgentModal() {
  var overlay = document.getElementById('agent-modal-overlay');
  var modal = document.getElementById('agent-modal');
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  modal.style.opacity = '0';
  modal.style.pointerEvents = 'none';
  modal.style.transform = 'translate(-50%,-50%) scale(0.95)';
}
document.getElementById('agent-modal-overlay').addEventListener('click', closeAgentModal);

// ── Create Agent Wizard ──────────────────────────────────────────────

let cawStep = 1;
let cawIdValid = false;
let cawTokenValid = false;
let cawBotInfo = null;
let cawCreatedId = null;
let cawIdDebounce = null;
let cawTokenDebounce = null;
let cawNameManuallyEdited = false;

function openCreateAgentWizard() {
  cawStep = 1;
  cawIdValid = false;
  cawTokenValid = false;
  cawBotInfo = null;
  cawCreatedId = null;
  cawNameManuallyEdited = false;
  document.getElementById('caw-id').value = '';
  document.getElementById('caw-name').value = '';
  document.getElementById('caw-desc').value = '';
  document.getElementById('caw-model').value = 'claude-sonnet-4-6';
  document.getElementById('caw-token').value = '';
  document.getElementById('caw-id-status').innerHTML = '';
  document.getElementById('caw-token-status').innerHTML = '';
  document.getElementById('caw-token-info').innerHTML = '';
  document.getElementById('caw-step1-error').style.display = 'none';
  document.getElementById('caw-step2-error').style.display = 'none';
  cawShowStep(1);
  loadCawTemplates();
  var o = document.getElementById('create-agent-overlay');
  var m = document.getElementById('create-agent-modal');
  o.style.opacity = '1'; o.style.pointerEvents = 'auto';
  m.style.opacity = '1'; m.style.pointerEvents = 'auto';
  m.style.transform = 'translate(-50%,-50%) scale(1)';
  setTimeout(function() { document.getElementById('caw-id').focus(); }, 200);
}

function closeCreateAgentWizard() {
  var o = document.getElementById('create-agent-overlay');
  var m = document.getElementById('create-agent-modal');
  o.style.opacity = '0'; o.style.pointerEvents = 'none';
  m.style.opacity = '0'; m.style.pointerEvents = 'none';
  m.style.transform = 'translate(-50%,-50%) scale(0.95)';
}
document.getElementById('create-agent-overlay').addEventListener('click', closeCreateAgentWizard);

function cawShowStep(n) {
  cawStep = n;
  document.getElementById('caw-step-1').style.display = n === 1 ? '' : 'none';
  document.getElementById('caw-step-2').style.display = n === 2 ? '' : 'none';
  document.getElementById('caw-step-3').style.display = n === 3 ? '' : 'none';
  for (var i = 1; i <= 3; i++) {
    document.getElementById('caw-step-' + i + '-dot').style.background = i <= n ? '#4f46e5' : '#2a2a2a';
  }
  var titles = { 1: 'New Agent', 2: 'Connect Telegram', 3: 'Agent Created' };
  document.getElementById('create-agent-title').textContent = titles[n] || 'New Agent';
}

async function loadCawTemplates() {
  try {
    var data = await api('/api/agents/templates');
    var sel = document.getElementById('caw-template');
    sel.innerHTML = '';
    (data.templates || []).forEach(function(t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + (t.id === '_template' ? '' : ' - ' + t.description.slice(0, 40));
      sel.appendChild(opt);
    });
  } catch(e) { console.error('Templates load error:', e); }
}

function cawIdChanged() {
  var id = document.getElementById('caw-id').value.trim().toLowerCase();
  document.getElementById('caw-id').value = id;
  var status = document.getElementById('caw-id-status');
  cawIdValid = false;

  if (!id) { status.innerHTML = ''; return; }

  // Auto-fill name from ID unless user has manually typed a name
  if (!cawNameManuallyEdited) {
    var nameInput = document.getElementById('caw-name');
    nameInput.value = id.replace(/[-_]/g, ' ').replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
  }

  clearTimeout(cawIdDebounce);
  status.innerHTML = '<span style="color:#6b7280">Checking...</span>';
  cawIdDebounce = setTimeout(async function() {
    try {
      var data = await api('/api/agents/validate-id?id=' + encodeURIComponent(id));
      if (data.ok) {
        cawIdValid = true;
        status.innerHTML = '<span style="color:#6ee7b7">Available</span>';
      } else {
        status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error) + '</span>';
      }
    } catch(e) {
      status.innerHTML = '<span style="color:#f87171">Validation error</span>';
    }
  }, 400);
}

function cawGoStep1() { cawShowStep(1); }

function cawGoStep2() {
  var id = document.getElementById('caw-id').value.trim();
  var name = document.getElementById('caw-name').value.trim();
  var desc = document.getElementById('caw-desc').value.trim();
  var errEl = document.getElementById('caw-step1-error');

  if (!id) { errEl.textContent = 'Agent ID is required'; errEl.style.display = ''; return; }
  if (!cawIdValid) { errEl.textContent = 'Agent ID is not valid or already taken'; errEl.style.display = ''; return; }
  if (!name) { errEl.textContent = 'Display name is required'; errEl.style.display = ''; return; }
  if (!desc) { errEl.textContent = 'Description is required'; errEl.style.display = ''; return; }

  errEl.style.display = 'none';

  // Set suggested bot names
  var label = id.replace(/[-_]/g, ' ').replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
  document.getElementById('caw-suggested-name').textContent = 'ClaudeClaw ' + label;
  document.getElementById('caw-suggested-username').textContent = 'claudeclaw_' + id.replace(/-/g, '_') + '_bot';

  // Reset token state
  cawTokenValid = false;
  cawBotInfo = null;
  document.getElementById('caw-token').value = '';
  document.getElementById('caw-token-status').innerHTML = '';
  document.getElementById('caw-token-info').innerHTML = '';
  var btn = document.getElementById('caw-create-btn');
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';

  cawShowStep(2);
  setTimeout(function() { document.getElementById('caw-token').focus(); }, 200);
}

function cawTokenChanged() {
  var token = document.getElementById('caw-token').value.trim();
  var status = document.getElementById('caw-token-status');
  var info = document.getElementById('caw-token-info');
  var btn = document.getElementById('caw-create-btn');
  cawTokenValid = false;
  cawBotInfo = null;
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';

  if (!token || !token.includes(':')) {
    status.innerHTML = '';
    info.innerHTML = '';
    return;
  }

  clearTimeout(cawTokenDebounce);
  status.innerHTML = '<span style="color:#fbbf24">...</span>';
  info.innerHTML = '';

  cawTokenDebounce = setTimeout(async function() {
    try {
      var data = await fetch(BASE + '/api/agents/validate-token?token=' + TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token }),
      }).then(function(r) { return r.json(); });

      if (data.ok && data.botInfo) {
        cawTokenValid = true;
        cawBotInfo = data.botInfo;
        status.innerHTML = '<span style="color:#6ee7b7">&#10003;</span>';
        info.innerHTML = '<span style="color:#6ee7b7">Verified: @' + escapeHtml(data.botInfo.username) + '</span>';
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      } else {
        status.innerHTML = '<span style="color:#f87171">&#10007;</span>';
        info.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Invalid token') + '</span>';
      }
    } catch(e) {
      status.innerHTML = '<span style="color:#f87171">!</span>';
      info.innerHTML = '<span style="color:#f87171">Could not validate</span>';
    }
  }, 600);
}

async function cawCreate() {
  if (!cawTokenValid) return;

  var btn = document.getElementById('caw-create-btn');
  var errEl = document.getElementById('caw-step2-error');
  btn.textContent = 'Creating...';
  btn.style.pointerEvents = 'none';
  errEl.style.display = 'none';

  try {
    var res = await fetch(BASE + '/api/agents/create?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: document.getElementById('caw-id').value.trim(),
        name: document.getElementById('caw-name').value.trim(),
        description: document.getElementById('caw-desc').value.trim(),
        model: document.getElementById('caw-model').value,
        template: document.getElementById('caw-template').value,
        botToken: document.getElementById('caw-token').value.trim(),
      }),
    });
    var data = await res.json();
    if (!res.ok || data.error) {
      errEl.textContent = data.error || 'Failed to create agent';
      errEl.style.display = '';
      btn.textContent = 'Create Agent';
      btn.style.pointerEvents = 'auto';
      return;
    }

    cawCreatedId = data.agentId;

    // Build summary
    var summary = '<div style="margin-bottom:6px"><span style="color:#6b7280">Agent ID:</span> <span class="text-white">' + escapeHtml(data.agentId) + '</span></div>' +
      '<div style="margin-bottom:6px"><span style="color:#6b7280">Bot:</span> <span style="color:#6ee7b7">@' + escapeHtml(data.botInfo.username) + '</span></div>' +
      '<div style="margin-bottom:6px"><span style="color:#6b7280">Directory:</span> <span style="color:#9ca3af;font-size:11px">' + escapeHtml(data.agentDir) + '</span></div>' +
      '<div><span style="color:#6b7280">Token stored as:</span> <span style="color:#9ca3af">' + escapeHtml(data.envKey) + '</span></div>';
    document.getElementById('caw-summary').innerHTML = summary;

    // Reset activate section
    var actBtn = document.getElementById('caw-activate-btn');
    actBtn.textContent = 'Activate (install service + start)';
    actBtn.style.opacity = '1';
    actBtn.style.pointerEvents = 'auto';
    actBtn.style.background = '#064e3b';
    actBtn.style.color = '#6ee7b7';
    actBtn.style.borderColor = '#065f46';
    document.getElementById('caw-activate-status').innerHTML = '';

    cawShowStep(3);
  } catch(e) {
    errEl.textContent = 'Network error';
    errEl.style.display = '';
    btn.textContent = 'Create Agent';
    btn.style.pointerEvents = 'auto';
  }
}

async function cawActivate() {
  if (!cawCreatedId) return;
  var btn = document.getElementById('caw-activate-btn');
  var status = document.getElementById('caw-activate-status');
  btn.textContent = 'Starting...';
  btn.style.pointerEvents = 'none';
  status.innerHTML = '<span style="color:#fbbf24">Installing service and starting agent...</span>';

  try {
    var res = await fetch(BASE + '/api/agents/' + cawCreatedId + '/activate?token=' + TOKEN, { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      btn.textContent = 'Running';
      btn.style.background = '#064e3b';
      btn.style.color = '#6ee7b7';
      status.innerHTML = '<span style="color:#6ee7b7">Agent is live' + (data.pid ? ' (PID ' + data.pid + ')' : '') + '. Send it a message in Telegram!</span>';
    } else {
      btn.textContent = 'Retry Activation';
      btn.style.pointerEvents = 'auto';
      status.innerHTML = '<span style="color:#f87171">' + escapeHtml(data.error || 'Activation failed') + '</span>';
    }
  } catch(e) {
    btn.textContent = 'Retry Activation';
    btn.style.pointerEvents = 'auto';
    status.innerHTML = '<span style="color:#f87171">Network error</span>';
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    // Brief visual feedback
    var el = event.target;
    var orig = el.style.color;
    el.style.color = '#6ee7b7';
    setTimeout(function() { el.style.color = orig; }, 800);
  }).catch(function() {});
}

async function loadHiveMind() {
  try {
    const data = await api('/api/hive-mind?limit=15');
    const section = document.getElementById('hive-section');
    const container = document.getElementById('hive-container');
    if (!data.entries || data.entries.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    const blurState = JSON.parse(localStorage.getItem('privacyBlur_hive') || '{}');
    const allRevealed = localStorage.getItem('privacyBlur_hive_all') === 'revealed';
    const rows = data.entries.map((e, i) => {
      const time = new Date(e.created_at * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const color = AGENT_COLORS[e.agent_id] || '#6b7280';
      const isBlurred = allRevealed ? false : (blurState[i] !== false);
      const blurClass = isBlurred ? 'privacy-blur' : '';
      return '<tr>' +
        '<td class="col-time">' + time + '</td>' +
        '<td class="col-agent" style="color:' + color + '">' + resolveAgentName(e.agent_id) + '</td>' +
        '<td class="col-action">' + escapeHtml(e.action) + '</td>' +
        '<td><div class="col-summary ' + blurClass + '" data-section="hive" data-idx="' + i + '" onclick="toggleItemBlur(this)">' + escapeHtml(e.summary) + '</div></td>' +
      '</tr>';
    }).join('');
    container.innerHTML = '<table class="hive-table"><thead><tr><th class="col-time">Time</th><th class="col-agent">Agent</th><th class="col-action">Action</th><th>Summary</th></tr></thead><tbody>' + rows + '</tbody></table>';
  } catch {}
}

// ── Privacy Blur ──────────────────────────────────────────────────────
function toggleItemBlur(el) {
  const section = el.dataset.section;
  const idx = el.dataset.idx;
  const key = 'privacyBlur_' + section;
  const state = JSON.parse(localStorage.getItem(key) || '{}');
  const isCurrentlyBlurred = el.classList.contains('privacy-blur');
  if (isCurrentlyBlurred) {
    el.classList.remove('privacy-blur');
    state[idx] = false;
  } else {
    el.classList.add('privacy-blur');
    delete state[idx];
  }
  localStorage.setItem(key, JSON.stringify(state));
  // Clear the "all" override when individual items are toggled
  localStorage.removeItem('privacyBlur_' + section + '_all');
}

function toggleSectionBlur(section) {
  const selector = section === 'hive' ? '#hive-container .col-summary' : '#tasks-container .task-prompt';
  const items = document.querySelectorAll(selector);
  if (items.length === 0) return;
  // Check if majority are blurred to decide direction
  let blurredCount = 0;
  items.forEach(el => { if (el.classList.contains('privacy-blur')) blurredCount++; });
  const shouldReveal = blurredCount > 0;
  const key = 'privacyBlur_' + section;
  const state = {};
  items.forEach(el => {
    if (shouldReveal) {
      el.classList.remove('privacy-blur');
      state[el.dataset.idx] = false;
    } else {
      el.classList.add('privacy-blur');
    }
  });
  localStorage.setItem(key, JSON.stringify(shouldReveal ? state : {}));
  localStorage.setItem('privacyBlur_' + section + '_all', shouldReveal ? 'revealed' : 'blurred');
}

async function loadSummary() {
  try {
    const [tokens, agents, mems] = await Promise.all([
      api('/api/tokens?chatId=' + CHAT_ID),
      api('/api/agents'),
      api('/api/memories?chatId=' + CHAT_ID),
    ]);
    const bar = document.getElementById('summary-bar');
    bar.style.display = '';
    document.getElementById('sum-messages').textContent = tokens.stats.todayTurns || '0';
    const activeCount = agents.agents ? agents.agents.filter(a => a.running).length : 0;
    document.getElementById('sum-agents').textContent = activeCount + '/' + (agents.agents ? agents.agents.length : 0);
    var totalTokens = (tokens.stats.todayInput || 0) + (tokens.stats.todayOutput || 0);
    document.getElementById('sum-cost').textContent = totalTokens > 1000 ? Math.round(totalTokens / 1000) + 'k' : totalTokens.toString();
    document.getElementById('sum-memories').textContent = mems.stats.total || '0';
  } catch {}
}

// ── Mission Control ──────────────────────────────────────────────────

let missionAgentsList = [];

// Global lookup cache: agent_id -> display name (populated by loadAgents / loadMissionControl)
var agentNameMap = {};
function resolveAgentName(id) {
  if (agentNameMap[id]) return agentNameMap[id];
  var a = missionAgentsList.find(function(x){ return x.id === id; });
  if (a && a.name) { agentNameMap[id] = a.name; return a.name; }
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function loadMissionControl() {
  try {
    const [taskData, agentData] = await Promise.all([
      api('/api/mission/tasks'),
      api('/api/agents'),
    ]);
    const tasks = taskData.tasks || [];
    missionAgentsList = agentData.agents || [];

    // Split: unassigned go to inbox, assigned go to agent columns
    const unassigned = tasks.filter(t => !t.assigned_agent && t.status === 'queued');
    // Only show completed tasks for 30 minutes, then they move to history only
    const now = Math.floor(Date.now() / 1000);
    const DONE_VISIBLE_SECS = 30 * 60;
    const assigned = tasks.filter(t => {
      if (!t.assigned_agent) return false;
      if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
        return t.completed_at && (now - t.completed_at) < DONE_VISIBLE_SECS;
      }
      return true;
    });

    // Tasks Inbox
    const inboxSection = document.getElementById('tasks-inbox-section');
    const inboxEl = document.getElementById('tasks-inbox');
    const autoAllBtn = document.getElementById('auto-assign-all-btn');
    inboxSection.style.display = '';
    autoAllBtn.style.display = unassigned.length > 0 ? '' : 'none';
    if (unassigned.length > 0) {
      inboxEl.innerHTML = unassigned.map(renderInboxCard).join('');
    } else {
      inboxEl.innerHTML = '<div class="text-xs text-gray-600 py-2">No unassigned tasks. Click + New to create one.</div>';
    }

    // Mission Control agent columns
    if (assigned.length === 0 && missionAgentsList.length <= 1) {
      document.getElementById('mission-section').style.display = 'none';
    } else {
      document.getElementById('mission-section').style.display = '';
      const board = document.getElementById('mission-board');
      const agentIds = missionAgentsList.map(a => a.id);
      const cols = {};
      agentIds.forEach(id => { cols[id] = []; });

      assigned.forEach(t => {
        if (cols[t.assigned_agent]) cols[t.assigned_agent].push(t);
      });

      let html = '';
      agentIds.forEach(id => {
        const agent = missionAgentsList.find(a => a.id === id);
        const color = AGENT_COLORS[id] || '#6b7280';
        const dot = agent && agent.running
          ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-right:4px"></span>'
          : '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;border:1px solid #555;margin-right:4px"></span>';
        const agentTasks = cols[id] || [];
        html += '<div class="flex-shrink-0" style="min-width:220px;scroll-snap-align:start;">' +
          '<div class="text-xs font-semibold mb-1 uppercase" style="color:' + color + '">' + dot + (agent ? agent.name : id) + '</div>' +
          '<div data-drop-agent="' + id + '" ondragover="missionDragOver(event)" ondragleave="missionDragLeave(event)" ondrop="missionDrop(event)" style="border:1px solid #2a2a2a;border-radius:10px;padding:8px;min-height:120px;background:#141414;transition:border-color 0.2s,background 0.2s">' +
          (agentTasks.length ? agentTasks.map(renderMissionCard).join('') : '<div class="text-xs text-gray-600 text-center py-4">No tasks</div>') +
          '</div></div>';
      });

      board.innerHTML = html;
    }
  } catch(e) {
    console.error('Mission load error:', e);
  }
}

function renderInboxCard(t) {
  const priorityDot = t.priority >= 8 ? '#ef4444' : t.priority >= 4 ? '#fbbf24' : '#6b7280';
  const timeAgo = elapsed(t.created_at);
  return '<div data-mid="' + t.id + '" draggable="true" ondragstart="missionDragStart(event)" ondragend="missionDragEnd(event)" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:12px;min-width:200px;max-width:280px;cursor:grab;transition:opacity 0.15s">' +
    '<div class="flex items-center justify-between mb-2">' +
      '<span class="text-sm font-semibold text-white" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(t.title) + '</span>' +
      '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + priorityDot + ';margin-left:6px;flex-shrink:0"></span>' +
    '</div>' +
    '<div class="text-xs text-gray-500 mb-2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(t.prompt.slice(0, 60)) + '</div>' +
    '<div class="flex items-center justify-between">' +
      '<button data-mid="' + t.id + '" onclick="autoAssignOne(this.dataset.mid)" style="background:#1e1b4b;color:#a78bfa;border:1px solid #312e81;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer">Auto-assign</button>' +
      '<div class="flex items-center gap-1">' +
        '<button data-mid="' + t.id + '" data-mact="cancel" onclick="missionAction(this.dataset.mid,this.dataset.mact)" title="Remove" style="background:none;border:none;cursor:pointer;color:#6b7280;font-size:12px">&times;</button>' +
        '<span class="text-xs text-gray-600">' + timeAgo + '</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderMissionCard(t) {
  const color = AGENT_COLORS[t.assigned_agent] || '#6b7280';
  const priorityDot = t.priority >= 8 ? '#ef4444' : t.priority >= 4 ? '#fbbf24' : '#6b7280';
  const statusMap = {
    queued: '<span class="pill pill-paused">queued</span>',
    running: '<span class="pill pill-running">running</span>',
    completed: '<span class="pill pill-active">done</span>',
    failed: '<span class="pill" style="background:#7f1d1d;color:#f87171">failed</span>',
    cancelled: '<span class="pill" style="background:#374151;color:#9ca3af">cancelled</span>',
  };
  const statusPill = statusMap[t.status] || '<span class="pill">' + t.status + '</span>';
  const agentBadge = t.status === 'queued' ? '<span class="text-xs" style="color:' + color + '">@' + t.assigned_agent + '</span>' : '';
  const timeAgo = elapsed(t.created_at);
  let durationStr = '';
  if (t.completed_at && t.started_at) {
    const dur = t.completed_at - t.started_at;
    durationStr = dur < 60 ? ' in ' + dur + 's' : ' in ' + Math.floor(dur/60) + 'm ' + (dur%60) + 's';
  }

  let resultHtml = '';
  if (t.status === 'completed' && t.result) {
    resultHtml = '<details class="mt-2"><summary class="text-xs text-gray-500 cursor-pointer">View result' + durationStr + '</summary><div class="code-block-wrap"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre class="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words" style="max-height:200px;overflow-y:auto"><code>' + escapeHtml(t.result.slice(0, 2000)) + (t.result.length > 2000 ? '...' : '') + '</code></pre></div></details>';
  } else if (t.status === 'failed' && t.error) {
    resultHtml = '<div class="text-xs text-red-400 mt-1">' + escapeHtml(t.error.slice(0, 200)) + '</div>';
  }

  const cancelBtn = (t.status === 'queued' || t.status === 'running')
    ? '<button data-mid="' + t.id + '" data-mact="cancel" onclick="missionAction(this.dataset.mid,this.dataset.mact)" title="Cancel" style="background:none;border:none;cursor:pointer;color:#f87171;font-size:12px;padding:1px 3px">&times;</button>'
    : '';
  const deleteBtn = (t.status === 'completed' || t.status === 'cancelled' || t.status === 'failed')
    ? '<button data-mid="' + t.id + '" data-mact="delete" onclick="missionAction(this.dataset.mid,this.dataset.mact)" title="Remove" style="background:none;border:none;cursor:pointer;color:#6b7280;font-size:12px;padding:1px 3px">&times;</button>'
    : '';

  const draggable = t.status === 'queued' ? ' draggable="true" ondragstart="missionDragStart(event)" ondragend="missionDragEnd(event)"' : '';
  const grabStyle = t.status === 'queued' ? 'cursor:grab;' : '';
  const titleInner = escapeHtml(t.title);
  const titleHtml = t.status === 'running'
    ? '<span class="task-title-wrap text-xs font-semibold text-white" data-task-id="' + t.id + '" data-task-started="' + (t.started_at || '') + '" data-task-timeout="' + (t.timeout_ms || '') + '" onmouseenter="showTaskPopup(this)" onmouseleave="hideTaskPopup()" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + titleInner + '</span>'
    : '<span class="text-xs font-semibold text-white" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + titleInner + '</span>';
  return '<div data-mid="' + t.id + '"' + draggable + ' style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:10px;margin-bottom:8px;' + grabStyle + 'transition:opacity 0.15s">' +
    '<div class="flex items-center justify-between mb-1">' +
      titleHtml +
      '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:' + priorityDot + ';margin-left:6px;flex-shrink:0" title="Priority: ' + t.priority + '"></span>' +
    '</div>' +
    '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2">' + statusPill + agentBadge + '</div>' +
      '<div class="flex items-center gap-1">' + cancelBtn + deleteBtn + '<span class="text-xs text-gray-600">' + timeAgo + '</span></div>' +
    '</div>' +
    resultHtml +
  '</div>';
}

async function missionAction(id, action) {
  try {
    if (action === 'cancel') {
      await fetch(BASE + '/api/mission/tasks/' + id + '/cancel?token=' + TOKEN, { method: 'POST' });
    } else if (action === 'delete') {
      await fetch(BASE + '/api/mission/tasks/' + id + '?token=' + TOKEN, { method: 'DELETE' });
    }
    await loadMissionControl();
  } catch(e) { console.error('Mission action failed:', e); }
}

// ── Drag & Drop ──────────────────────────────────────────────────────

var missionDragId = null;

var agentDragId = null;
function agentDragStart(e) {
  e.stopPropagation();
  agentDragId = e.currentTarget.dataset.agent;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', agentDragId); } catch(_) {}
}
function agentDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  agentDragId = null;
}
function agentDragOver(e) {
  if (!agentDragId) return;
  var target = e.currentTarget;
  if (!target || target.dataset.agent === 'main' || target.dataset.agent === agentDragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var container = document.getElementById('agents-container');
  var dragged = container && container.querySelector('[data-agent="' + agentDragId + '"]');
  if (!dragged || dragged === target) return;
  var rect = target.getBoundingClientRect();
  var before = (e.clientX - rect.left) < rect.width / 2;
  if (before) {
    if (target.previousSibling !== dragged) container.insertBefore(dragged, target);
  } else {
    if (target.nextSibling !== dragged) container.insertBefore(dragged, target.nextSibling);
  }
}
async function agentDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!agentDragId) return;
  var container = document.getElementById('agents-container');
  if (!container) return;
  var order = Array.prototype.map.call(container.children, function(el) { return el.dataset && el.dataset.agent; })
    .filter(function(id) { return id && id !== 'main'; });
  try {
    await fetch(BASE + '/api/agents/order?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: order }),
    });
  } catch(err) { console.error('Agent reorder save failed:', err); }
}

function missionDragStart(e) {
  missionDragId = e.currentTarget.dataset.mid;
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}

function missionDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  missionDragId = null;
  document.querySelectorAll('[data-drop-agent]').forEach(function(el) {
    el.style.borderColor = '#2a2a2a';
    el.style.background = '#141414';
  });
}

function missionDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  var col = e.currentTarget.closest('[data-drop-agent]');
  if (col) {
    col.style.borderColor = '#4f46e5';
    col.style.background = 'rgba(79,70,229,0.08)';
  }
}

function missionDragLeave(e) {
  var col = e.currentTarget.closest('[data-drop-agent]');
  if (col && !col.contains(e.relatedTarget)) {
    col.style.borderColor = '#2a2a2a';
    col.style.background = '#141414';
  }
}

async function missionDrop(e) {
  e.preventDefault();
  var col = e.currentTarget.closest('[data-drop-agent]');
  if (col) {
    col.style.borderColor = '#2a2a2a';
    col.style.background = '#141414';
  }
  if (!missionDragId || !col) return;
  var newAgent = col.dataset.dropAgent;
  try {
    await fetch(BASE + '/api/mission/tasks/' + missionDragId + '?token=' + TOKEN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_agent: newAgent }),
    });
    await loadMissionControl();
  } catch(err) { console.error('Reassign failed:', err); }
  missionDragId = null;
}

async function autoAssignOne(id) {
  try {
    const res = await fetch(BASE + '/api/mission/tasks/' + id + '/auto-assign?token=' + TOKEN, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      await loadMissionControl();
    } else {
      console.error('Auto-assign failed:', data.error);
    }
  } catch(e) { console.error('Auto-assign error:', e); }
}

async function autoAssignAll() {
  var btn = document.getElementById('auto-assign-all-btn');
  btn.textContent = 'Assigning...';
  btn.disabled = true;
  try {
    const res = await fetch(BASE + '/api/mission/tasks/auto-assign-all?token=' + TOKEN, { method: 'POST' });
    const data = await res.json();
    await loadMissionControl();
  } catch(e) { console.error('Auto-assign all error:', e); }
  btn.textContent = 'Auto-assign All';
  btn.disabled = false;
}

function openMissionModal() {
  document.getElementById('mission-error').style.display = 'none';
  document.getElementById('mission-overlay').style.opacity = '1';
  document.getElementById('mission-overlay').style.pointerEvents = 'auto';
  var m = document.getElementById('mission-modal');
  m.style.opacity = '1';
  m.style.pointerEvents = 'auto';
  m.style.transform = 'translate(-50%,-50%) scale(1)';
  setTimeout(function() { document.getElementById('mission-title').focus(); }, 200);
}

function closeMissionModal() {
  document.getElementById('mission-overlay').style.opacity = '0';
  document.getElementById('mission-overlay').style.pointerEvents = 'none';
  var m = document.getElementById('mission-modal');
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
  m.style.transform = 'translate(-50%,-50%) scale(0.95)';
  document.getElementById('mission-title').value = '';
  document.getElementById('mission-prompt').value = '';
  document.getElementById('mission-priority').value = '5';
  document.getElementById('mission-timeout').value = '900000';
  document.getElementById('mission-error').style.display = 'none';
}
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('mission-overlay').addEventListener('click', closeMissionModal);
});

async function createMissionTask() {
  const title = document.getElementById('mission-title').value.trim();
  const prompt = document.getElementById('mission-prompt').value.trim();
  const priority = parseInt(document.getElementById('mission-priority').value, 10);
  const timeoutVal = document.getElementById('mission-timeout').value;
  const timeout_ms = timeoutVal ? parseInt(timeoutVal, 10) : null;
  const errEl = document.getElementById('mission-error');

  if (!title) { errEl.textContent = 'Title is required'; errEl.style.display = ''; return; }
  if (!prompt) { errEl.textContent = 'Prompt is required'; errEl.style.display = ''; return; }

  var payload = { title: title, prompt: prompt, priority: priority };
  if (timeout_ms) payload.timeout_ms = timeout_ms;

  try {
    const res = await fetch(BASE + '/api/mission/tasks?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      errEl.textContent = data.error || 'Failed to create task';
      errEl.style.display = '';
      return;
    }
    closeMissionModal();
    await loadMissionControl();
  } catch(e) {
    errEl.textContent = 'Network error';
    errEl.style.display = '';
  }
}

// ── Task Timeout Popup ───────────────────────────────────────────────

function fmtMs(ms) {
  if (ms >= 3600000) return Math.round(ms / 3600000) + 'h';
  if (ms >= 60000) return Math.round(ms / 60000) + 'm';
  return Math.round(ms / 1000) + 's';
}

var popupHideTimer = null;
function showTaskPopup(el) {
  clearTimeout(popupHideTimer);
  var popup = document.getElementById('task-popup-float');
  var taskId = el.dataset.taskId;
  var startedAt = parseInt(el.dataset.taskStarted || '0', 10);
  var timeoutMs = parseInt(el.dataset.taskTimeout || '0', 10) || 900000;
  var nowSec = Math.floor(Date.now() / 1000);
  var elapsedMs = startedAt ? (nowSec - startedAt) * 1000 : 0;
  var pct = Math.min(100, Math.round((elapsedMs / timeoutMs) * 100));
  var barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#fbbf24' : '#60a5fa';

  popup.innerHTML =
    '<div class="timer-row">' +
      '<span class="text-xs text-gray-400">' + fmtMs(elapsedMs) + ' / ' + fmtMs(timeoutMs) + '</span>' +
    '</div>' +
    '<div class="timer-bar"><div class="timer-bar-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
    '<div class="flex gap-2 mt-2">' +
      '<button class="timer-adj" onclick="adjustTimeout(\\''+taskId+'\\', ' + timeoutMs + ' + 300000)">+5m</button>' +
      '<button class="timer-adj" onclick="adjustTimeout(\\''+taskId+'\\', ' + timeoutMs + ' + 600000)">+10m</button>' +
      '<button class="timer-adj" onclick="adjustTimeout(\\''+taskId+'\\', ' + timeoutMs + ' + 1800000)">+30m</button>' +
    '</div>' +
    '<div class="text-[10px] text-gray-500 mt-2 leading-tight">Applies to the next run. The current attempt keeps its original timeout.</div>';

  var rect = el.getBoundingClientRect();
  popup.style.top = (rect.bottom + 8) + 'px';
  popup.style.left = rect.left + 'px';
  popup.style.display = 'block';
}

function hideTaskPopup(delay) {
  popupHideTimer = setTimeout(function() {
    document.getElementById('task-popup-float').style.display = 'none';
  }, delay || 300);
}

document.addEventListener('DOMContentLoaded', function() {
  var popup = document.getElementById('task-popup-float');
  if (popup) {
    popup.addEventListener('mouseenter', function() { clearTimeout(popupHideTimer); });
    popup.addEventListener('mouseleave', function() { hideTaskPopup(); });
  }
});

async function adjustTimeout(taskId, newMs) {
  try {
    await fetch(BASE + '/api/mission/tasks/' + taskId + '?token=' + TOKEN, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout_ms: newMs }),
    });
    document.getElementById('task-popup-float').style.display = 'none';
    await loadMissionControl();
  } catch(e) { console.error('adjustTimeout failed:', e); }
}

// ── Task History Drawer ──────────────────────────────────────────────

var historyOffset = 0;
var historyTotal = 0;
var HISTORY_PAGE = 20;

async function openTaskHistory() {
  historyOffset = 0;
  document.getElementById('history-body').innerHTML = '<div class="text-gray-500 text-sm text-center py-8">Loading...</div>';
  document.getElementById('history-overlay').classList.add('open');
  document.getElementById('history-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  await loadHistoryPage();
}

async function loadHistoryPage() {
  var data = await api('/api/mission/history?limit=' + HISTORY_PAGE + '&offset=' + historyOffset);
  historyTotal = data.total;
  document.getElementById('history-count').textContent = historyTotal + ' completed task' + (historyTotal === 1 ? '' : 's');
  var body = document.getElementById('history-body');
  if (historyOffset === 0) body.innerHTML = '';
  if (data.tasks.length === 0 && historyOffset === 0) {
    body.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">No task history yet.</div>';
  } else {
    body.innerHTML += data.tasks.map(function(t) {
      var color = AGENT_COLORS[t.assigned_agent] || '#6b7280';
      var statusCls = t.status === 'completed' ? 'pill-active' : t.status === 'failed' ? '' : '';
      var statusStyle = t.status === 'failed' ? 'background:#7f1d1d;color:#f87171' : t.status === 'cancelled' ? 'background:#374151;color:#9ca3af' : '';
      var dur = '';
      if (t.completed_at && t.started_at) {
        var d = t.completed_at - t.started_at;
        dur = d < 60 ? d + 's' : Math.floor(d/60) + 'm ' + (d%60) + 's';
      }
      var date = new Date(t.completed_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var time = new Date(t.completed_at * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      var resultHtml = t.result ? '<details class="mt-2"><summary class="text-xs text-gray-500 cursor-pointer">View result</summary><div class="code-block-wrap"><button class="copy-btn" onclick="copyCode(this)">Copy</button><pre class="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words" style="max-height:200px;overflow-y:auto"><code>' + escapeHtml(t.result.slice(0, 2000)) + '</code></pre></div></details>' : '';
      var errorHtml = t.error ? '<div class="text-xs text-red-400 mt-1">' + escapeHtml(t.error.slice(0, 200)) + '</div>' : '';
      return '<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:12px;margin-bottom:8px">' +
        '<div class="flex items-center justify-between mb-1">' +
          '<span class="text-sm font-semibold text-white">' + escapeHtml(t.title) + '</span>' +
          '<span class="pill ' + statusCls + '" style="' + statusStyle + '">' + t.status + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-2 text-xs text-gray-500">' +
          '<span style="color:' + color + '">@' + (t.assigned_agent || 'unassigned') + '</span>' +
          '<span>' + date + ' ' + time + '</span>' +
          (dur ? '<span>' + dur + '</span>' : '') +
        '</div>' +
        resultHtml + errorHtml +
      '</div>';
    }).join('');
  }
  historyOffset += data.tasks.length;
  var btn = document.getElementById('history-load-more');
  if (historyOffset < historyTotal) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}

async function loadMoreHistory() { await loadHistoryPage(); }

function closeTaskHistory() {
  document.getElementById('history-overlay').classList.remove('open');
  document.getElementById('history-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// Poll mission tasks more frequently (every 15s) for responsiveness
setInterval(loadMissionControl, 15000);

async function refreshAll() {
  const btn = document.getElementById('refresh-btn').querySelector('svg');
  btn.classList.add('refresh-spin');
  await Promise.all([loadInfo(), loadTasks(), loadMemories(), loadHealth(), loadTokens(), loadAgents(), loadHiveMind(), loadSummary(), loadMissionControl()]);
  btn.classList.remove('refresh-spin');
  document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();
}

// Live countdown tickers
setInterval(() => {
  document.querySelectorAll('.countdown').forEach(el => {
    const ts = parseInt(el.dataset.ts);
    if (ts) el.textContent = countdown(ts);
  });
}, 1000);

// Auto-refresh every 60s
setInterval(refreshAll, 60000);

// Initial load
refreshAll();

// \u2500\u2500 Chat \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let chatOpen = false;
let chatSSE = null;
let chatHistoryLoaded = false;
let unreadCount = 0;
let chatAgents = [];
let activeAgentTab = 'all';
// Per-agent "in flight" set. processing:true adds, processing:false removes.
// Drives the typing indicator on tab switch so work you can't see is still
// rendered when you return.
const busyAgents = new Set();
// Per-agent unread set. Populated when an assistant_message lands on a tab
// that isn't currently active.
const unreadAgents = new Set();

function openChat() {
  chatOpen = true;
  unreadCount = 0;
  updateFabBadge();
  document.getElementById('chat-overlay').classList.add('open');
  if (!chatHistoryLoaded) loadChatHistory();
  loadAgentTabs();
  loadSessionInfo();
  connectChatSSE();
  setTimeout(() => document.getElementById('chat-input').focus(), 350);
}

function closeChat() {
  chatOpen = false;
  document.getElementById('chat-overlay').classList.remove('open');
}

function updateFabBadge() {
  const badge = document.getElementById('chat-fab-badge');
  if (unreadCount > 0) {
    badge.style.display = 'flex';
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
  } else {
    badge.style.display = 'none';
  }
}

// Agent Tabs
async function loadAgentTabs() {
  try {
    const data = await api('/api/agents');
    chatAgents = data.agents || [];
    const container = document.getElementById('chat-agent-tabs');
    container.innerHTML = '';
    const allTab = document.createElement('button');
    allTab.className = 'chat-agent-tab' + (activeAgentTab === 'all' ? ' active' : '');
    allTab.textContent = 'All';
    allTab.onclick = function() { switchAgentTab('all', this); };
    container.appendChild(allTab);
    chatAgents.forEach(function(a) {
      const tab = document.createElement('button');
      tab.className = 'chat-agent-tab' + (activeAgentTab === a.id ? ' active' : '');
      tab.dataset.agent = a.id;
      const dot = document.createElement('span');
      dot.className = 'agent-dot ' + (a.running ? 'live' : 'dead');
      tab.appendChild(dot);
      tab.appendChild(document.createTextNode(a.name || (a.id.charAt(0).toUpperCase() + a.id.slice(1))));
      // Busy spinner (thinking) — separate from the green unread dot.
      const busyMark = document.createElement('span');
      busyMark.className = 'tab-busy';
      busyMark.textContent = '…';
      busyMark.style.cssText = 'display:none;margin-left:6px;color:#f59e0b;font-weight:bold';
      tab.appendChild(busyMark);
      const unreadDot = document.createElement('span');
      unreadDot.className = 'tab-unread';
      unreadDot.style.cssText = 'display:none;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-left:6px;vertical-align:middle';
      tab.appendChild(unreadDot);
      tab.onclick = function() { switchAgentTab(a.id, this); };
      container.appendChild(tab);
    });
    refreshUnreadBadges();
    refreshBusyBadges();
  } catch(e) { console.error('Agent tabs error', e); }
}

// Tab filter: "all" passes everything; an agent tab only renders events
// whose agentId matches. Older events without agentId are treated as "main"
// for backward compatibility.
function eventBelongsToActiveTab(ev) {
  if (activeAgentTab === 'all') return true;
  const eventAgent = ev && ev.agentId ? ev.agentId : 'main';
  return eventAgent === activeAgentTab;
}

function refreshUnreadBadges() {
  document.querySelectorAll('.chat-agent-tab').forEach(function(tab) {
    const agent = tab.dataset.agent;
    const badge = tab.querySelector('.tab-unread');
    if (!badge) return;
    badge.style.display = (agent && unreadAgents.has(agent)) ? 'inline-block' : 'none';
  });
}

function refreshBusyBadges() {
  document.querySelectorAll('.chat-agent-tab').forEach(function(tab) {
    const agent = tab.dataset.agent;
    const busy = tab.querySelector('.tab-busy');
    if (!busy) return;
    busy.style.display = (agent && busyAgents.has(agent)) ? 'inline-block' : 'none';
  });
}

function switchAgentTab(agentId, el) {
  activeAgentTab = agentId;
  document.querySelectorAll('.chat-agent-tab').forEach(function(t) { t.classList.remove('active'); });
  if (el) el.classList.add('active');
  chatHistoryLoaded = false;
  // Reconcile the shared typing/progress bar against the set of busy agents.
  const hasBusy = activeAgentTab === 'all'
    ? busyAgents.size > 0
    : busyAgents.has(activeAgentTab);
  if (hasBusy) showTyping(); else hideTyping();
  // Clear unread for the newly-active agent.
  if (agentId !== 'all') unreadAgents.delete(agentId);
  else unreadAgents.clear();
  refreshUnreadBadges();
  loadChatHistory();
  loadSessionInfo();
}

// Session Info
async function loadSessionInfo() {
  try {
    const agentId = activeAgentTab === 'all' ? 'main' : activeAgentTab;
    const [health, tokens] = await Promise.all([
      api('/api/health?chatId=' + CHAT_ID),
      api('/api/agents/' + agentId + '/tokens'),
    ]);
    document.getElementById('sess-ctx').textContent = (health.contextPct || 0) + '%';
    document.getElementById('sess-turns').textContent = health.turns || tokens.todayTurns || '0';
    var sessTokens = (tokens.todayInput || 0) + (tokens.todayOutput || 0);
    document.getElementById('sess-cost').textContent = sessTokens > 1000 ? Math.round(sessTokens / 1000) + 'k' : sessTokens.toString();
    document.getElementById('sess-model').textContent = health.model || agentId;
  } catch(e) { console.error('Session info error', e); }
}

// Quick Actions
function sendQuickAction(cmd) {
  var input = document.getElementById('chat-input');
  input.value = cmd;
  sendChatMessage();
}

async function loadChatHistory() {
  if (!CHAT_ID) return;
  try {
    var url = '/api/chat/history?chatId=' + CHAT_ID + '&limit=40';
    if (activeAgentTab !== 'all') {
      url = '/api/agents/' + activeAgentTab + '/conversation?chatId=' + CHAT_ID + '&limit=40';
    }
    const data = await api(url);
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    if (data.turns && data.turns.length > 0) {
      // Reverse: API returns newest first, we want oldest first
      const turns = data.turns.slice().reverse();
      turns.forEach(t => appendChatBubble(t.role, t.content, t.source, false));
    }
    chatHistoryLoaded = true;
    scrollChatBottom();
  } catch(e) {
    console.error('Chat history load error', e);
  }
}

function connectChatSSE() {
  if (chatSSE) { chatSSE.close(); chatSSE = null; }
  const url = BASE + '/api/chat/stream?token=' + TOKEN;
  chatSSE = new EventSource(url);

  chatSSE.addEventListener('user_message', function(e) {
    const ev = JSON.parse(e.data);
    if (!eventBelongsToActiveTab(ev)) return;
    appendChatBubble('user', ev.content, ev.source, true);
    if (!chatOpen) { unreadCount++; updateFabBadge(); }
  });

  chatSSE.addEventListener('assistant_message', function(e) {
    const ev = JSON.parse(e.data);
    const evAgent = (ev && ev.agentId) ? ev.agentId : 'main';
    if (!eventBelongsToActiveTab(ev)) {
      // Reply landed on a tab the user isn't looking at — flag it.
      unreadAgents.add(evAgent);
      refreshUnreadBadges();
      if (!chatOpen) { unreadCount++; updateFabBadge(); }
      return;
    }
    appendChatBubble('assistant', ev.content, ev.source, true);
    hideTyping();
    if (!chatOpen) { unreadCount++; updateFabBadge(); }
    if (chatOpen) loadSessionInfo();
  });

  chatSSE.addEventListener('processing', function(e) {
    const ev = JSON.parse(e.data);
    const evAgent = (ev && ev.agentId) ? ev.agentId : 'main';
    if (ev.processing) busyAgents.add(evAgent); else busyAgents.delete(evAgent);
    refreshBusyBadges();
    if (!eventBelongsToActiveTab(ev)) return;
    if (ev.processing) showTyping(); else hideTyping();
  });

  chatSSE.addEventListener('progress', function(e) {
    const ev = JSON.parse(e.data);
    if (!eventBelongsToActiveTab(ev)) return;
    showProgress(ev.description);
  });

  // Mission task completion/timeout — refresh the task list. Not routed
  // through showProgress because the event carries no description.
  chatSSE.addEventListener('mission_update', function(e) {
    try {
      const ev = JSON.parse(e.data);
      if (typeof loadMissionControl === 'function') loadMissionControl();
      // If this is a chat-type mission completion, make sure the typing
      // indicator is cleared — the per-agent processing event will arrive
      // via the bot.ts poller, but clearing here first avoids flicker.
      if (ev.content) {
        try {
          const payload = JSON.parse(ev.content);
          if (payload.type === 'chat') hideTyping();
        } catch { /* non-JSON content, ignore */ }
      }
    } catch { /* malformed event, ignore */ }
  });

  chatSSE.addEventListener('error', function(e) {
    // SSE error event
    try {
      const ev = JSON.parse(e.data);
      appendChatBubble('assistant', ev.content || 'Error', 'system', true);
    } catch {}
    hideTyping();
  });

  chatSSE.addEventListener('ping', function() { /* keepalive */ });

  chatSSE.onerror = function() {
    // Auto-reconnect handled by EventSource
    updateChatStatus(false);
    setTimeout(() => updateChatStatus(true), 3000);
  };

  chatSSE.onopen = function() { updateChatStatus(true); };
}

function updateChatStatus(connected) {
  const dot = document.getElementById('chat-status-dot');
  dot.style.background = connected ? '#22c55e' : '#ef4444';
}

function appendChatBubble(role, content, source, scroll) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant');
  bubble.innerHTML = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);
  if (source && source !== 'telegram' && source !== 'dashboard') {
    const srcBadge = document.createElement('div');
    srcBadge.className = 'chat-bubble-source';
    srcBadge.textContent = source.charAt(0).toUpperCase() + source.slice(1);
    bubble.appendChild(srcBadge);
  }
  container.appendChild(bubble);
  if (scroll) scrollChatBottom();
}

function showTyping() {
  const bar = document.getElementById('chat-progress-bar');
  const label = document.getElementById('chat-progress-label');
  if (bar) { bar.classList.add('active'); }
  if (label) { label.textContent = 'Thinking...'; }
  scrollChatBottom();
}

function hideTyping() {
  const bar = document.getElementById('chat-progress-bar');
  if (bar) { bar.classList.remove('active'); }
}

function showProgress(desc) {
  const bar = document.getElementById('chat-progress-bar');
  const label = document.getElementById('chat-progress-label');
  if (bar) { bar.classList.add('active'); }
  if (label) { label.textContent = desc; }
  scrollChatBottom();
}

function scrollChatBottom() {
  const container = document.getElementById('chat-messages');
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

function renderMarkdown(text) {
  if (!text) return '';
  var preserved = [];
  function preserve(html) { preserved.push(html); return '%%BLOCK' + (preserved.length - 1) + '%%'; }

  var s = text;

  // Code blocks: ` + '```' + `...` + '```' + `
  s = s.replace(/` + '`' + '`' + '`' + `(?:\\w*\\n)?([\\s\\S]*?)` + '`' + '`' + '`' + `/g, function(_, code) {
    return preserve('<div class="code-block-wrap"><button class="copy-btn" onclick="copyCode(this)">Copy<\\/button><pre><code>' + escapeHtml(code.trim()) + '<\\/code><\\/pre><\\/div>');
  });

  // Tables: consecutive lines starting and ending with |
  var lines = s.split('\\n');
  var result = [];
  var tableLines = [];

  function flushTable() {
    if (tableLines.length < 2) {
      result.push.apply(result, tableLines);
      tableLines = [];
      return;
    }
    var html = '<table>';
    var headerDone = false;
    tableLines.forEach(function(row) {
      var trimmed = row.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) { result.push(row); return; }
      // Skip separator rows
      if (/^[\\|\\s\\-:]+$/.test(trimmed)) { headerDone = true; return; }
      var cells = trimmed.split('|').slice(1, -1);
      var tag = !headerDone ? 'th' : 'td';
      html += '<tr>';
      cells.forEach(function(c) { html += '<' + tag + '>' + escapeHtml(c.trim()) + '<\\/' + tag + '>'; });
      html += '<\\/tr>';
      if (!headerDone) headerDone = true;
    });
    html += '<\\/table>';
    result.push(preserve(html));
    tableLines = [];
  }

  lines.forEach(function(line) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      tableLines.push(line);
    } else {
      if (tableLines.length > 0) flushTable();
      result.push(line);
    }
  });
  if (tableLines.length > 0) flushTable();

  s = result.join('\\n');

  // Inline code (preserve before escaping)
  var codeBlocks = [];
  s = s.replace(/` + '`' + `([^` + '`' + `]+?)` + '`' + `/g, function(_, code) {
    codeBlocks.push('<code>' + escapeHtml(code) + '<\\/code>');
    return '%%CODE' + (codeBlocks.length - 1) + '%%';
  });
  // Bold (preserve before escaping)
  var bolds = [];
  s = s.replace(/\\*\\*([^*]+)\\*\\*/g, function(_, t) {
    bolds.push('<b>' + escapeHtml(t) + '<\\/b>');
    return '%%BOLD' + (bolds.length - 1) + '%%';
  });
  // Italic
  var italics = [];
  s = s.replace(/\\*([^*]+)\\*/g, function(_, t) {
    italics.push('<i>' + escapeHtml(t) + '<\\/i>');
    return '%%ITAL' + (italics.length - 1) + '%%';
  });
  // Escape remaining HTML
  s = escapeHtml(s);
  // Restore formatting
  s = s.replace(/%%CODE(\\d+)%%/g, function(_, i) { return codeBlocks[parseInt(i)]; });
  s = s.replace(/%%BOLD(\\d+)%%/g, function(_, i) { return bolds[parseInt(i)]; });
  s = s.replace(/%%ITAL(\\d+)%%/g, function(_, i) { return italics[parseInt(i)]; });
  // Line breaks
  s = s.replace(/\\n/g, '<br>');
  // Restore preserved blocks
  s = s.replace(/%%BLOCK(\\d+)%%/g, function(_, i) { return preserved[parseInt(i)]; });
  return s;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  autoResizeInput();
  // Disable send while processing
  document.getElementById('chat-send-btn').disabled = true;
  // Route to the selected agent tab. "All" falls back to main so the
  // default send still hits the hosting process, matching historical
  // behavior.
  const targetAgent = activeAgentTab === 'all' ? 'main' : activeAgentTab;
  try {
    await fetch(BASE + '/api/chat/send?token=' + TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, agent_id: targetAgent }),
    });
  } catch(e) {
    console.error('Send error', e);
  }
  // Re-enable after a short delay (SSE will deliver the actual messages)
  setTimeout(() => { document.getElementById('chat-send-btn').disabled = false; }, 1000);
}

function autoResizeInput() {
  const el = document.getElementById('chat-input');
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function abortProcessing() {
  try {
    await fetch(BASE + '/api/chat/abort?token=' + TOKEN, { method: 'POST' });
  } catch(e) { console.error('Abort error', e); }
}
</script>

<!-- Chat FAB -->
<button class="chat-fab" id="chat-fab" onclick="openChat()">
  <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
  <span class="chat-fab-badge" id="chat-fab-badge"></span>
</button>

<!-- Chat slide-over panel -->
<div class="chat-overlay" id="chat-overlay">
  <div class="chat-header">
    <div class="chat-header-left">
      <span class="chat-header-title">Chat</span>
      <span class="chat-status-dot" id="chat-status-dot" style="background:#6b7280"></span>
    </div>
    <button onclick="closeChat()" class="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
  </div>
  <div class="chat-agent-tabs" id="chat-agent-tabs"></div>
  <div class="chat-session-bar" id="chat-session-bar">
    <span class="session-stat"><span class="session-stat-val" id="sess-ctx">-</span> ctx</span>
    <span class="session-stat"><span class="session-stat-val" id="sess-turns">-</span> turns</span>
    <span class="session-stat"><span class="session-stat-val" id="sess-cost">-</span> tokens</span>
    <span class="session-model" id="sess-model">-</span>
  </div>
  <div class="chat-quick-actions">
    <button class="chat-quick-btn" onclick="sendQuickAction('/todo')">Todo</button>
    <button class="chat-quick-btn" onclick="sendQuickAction('/gmail')">Gmail</button>
    <button class="chat-quick-btn" onclick="sendQuickAction('/model opus')">Opus</button>
    <button class="chat-quick-btn" onclick="sendQuickAction('/model sonnet')">Sonnet</button>
    <button class="chat-quick-btn" onclick="sendQuickAction('/respin')">Respin</button>
    <button class="chat-quick-btn destructive" onclick="sendQuickAction('/newchat')">New Chat</button>
  </div>
  <div class="chat-messages" id="chat-messages"></div>
  <div class="chat-progress-bar" id="chat-progress-bar">
    <div class="chat-progress-pulse"></div>
    <span class="chat-progress-label" id="chat-progress-label">Thinking...</span>
    <button class="chat-stop-btn" id="chat-stop-btn" onclick="abortProcessing()" title="Stop">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect width="14" height="14" rx="2"/></svg>
    </button>
    <div class="chat-progress-shimmer"></div>
  </div>
  <div class="chat-input-area">
    <textarea class="chat-textarea" id="chat-input" rows="1" placeholder="Send a message..." oninput="autoResizeInput()" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage()}"></textarea>
    <button class="chat-send-btn" id="chat-send-btn" onclick="sendChatMessage()">Send</button>
  </div>
</div>

</body>
</html>`;
}
