#!/usr/bin/env node

/**
 * End-of-Day Report (claudeclaw edition)
 *
 * Pulls today's GHL activity and compares against configurable daily goals.
 * Tracks call streak across days.
 *
 * Config via env vars (all optional — defaults shown):
 *   EOD_GOAL_CALLS=5
 *   EOD_GOAL_LEADS=3
 *   EOD_GOAL_MEETINGS=1
 *   GOHIGHLEVEL_API_TOKEN   (required — loaded from ~/.clawdbot/secrets/.env if not set)
 *   GHL_LOCATION_ID=exVdjkmN3K2h9dJATJb6
 *
 * Retired: Maricela metrics block (old agent, no longer used).
 *
 * Created: 2026-04-19 (replaces /clawd/scripts/eod-report.mjs)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// Load ~/.clawdbot/secrets/.env as fallback for GHL token
const envFallbackFile = path.join(homedir(), '.clawdbot/secrets/.env');
if (fs.existsSync(envFallbackFile)) {
  const content = fs.readFileSync(envFallbackFile, 'utf-8');
  content.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const match = line.match(/^([A-Z_]+)="?([^"\n]+?)"?$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const STATE_FILE = path.join(PROJECT_ROOT, 'store', 'eod-state.json');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'store', 'eod-reports');

const GHL_TOKEN = process.env.GOHIGHLEVEL_API_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID || 'exVdjkmN3K2h9dJATJb6';
const CALENDAR_IDS = (process.env.EOD_CALENDAR_IDS ||
  'EZUY3BwlJqim4l0ByvIf,EvEOsMVjbvZv2SQtZrUA' // Kai, Aditya
).split(',').map(s => s.trim()).filter(Boolean);

const GOALS = {
  calls: parseInt(process.env.EOD_GOAL_CALLS || '5', 10),
  leads: parseInt(process.env.EOD_GOAL_LEADS || '3', 10),
  meetings: parseInt(process.env.EOD_GOAL_MEETINGS || '1', 10),
};

// ---------- state ----------
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  }
  return { streak: 0, lastStreakDate: null };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------- ghl ----------
async function fetchJSON(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: '2021-07-28',
      },
    });
    if (!res.ok) {
      console.error(`GHL ${res.status}: ${url}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`GHL fetch failed: ${e.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getTodayActivity() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const convData = await fetchJSON(
    `https://services.leadconnectorhq.com/conversations/search?locationId=${LOCATION_ID}&limit=100`
  );
  const conversations = convData?.conversations || [];

  let calls = 0, sms = 0, emails = 0;
  for (const conv of conversations) {
    if (!conv.lastMessageDate) continue;
    if (new Date(conv.lastMessageDate) < today) continue;
    const type = conv.lastMessageType || conv.type;
    if (type === 'TYPE_CALL') calls++;
    else if (type === 'TYPE_SMS') sms++;
    else if (type === 'TYPE_EMAIL') emails++;
  }

  // Meetings = calendar events booked today across configured calendars
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startMs = today.getTime();
  const endMs = tomorrow.getTime();

  let meetings = 0;
  for (const calId of CALENDAR_IDS) {
    const eventsData = await fetchJSON(
      `https://services.leadconnectorhq.com/calendars/events?locationId=${LOCATION_ID}&calendarId=${calId}&startTime=${startMs}&endTime=${endMs}`
    );
    meetings += (eventsData?.events || []).length;
  }

  return { calls, sms, emails, meetings };
}

// ---------- report ----------
async function generateReport() {
  if (!GHL_TOKEN) {
    console.error('GOHIGHLEVEL_API_TOKEN not set — aborting.');
    process.exit(1);
  }

  const state = loadState();
  const activity = await getTodayActivity();
  const leadsResponded = activity.sms + activity.emails;

  const hits = [
    activity.calls >= GOALS.calls,
    leadsResponded >= GOALS.leads,
    activity.meetings >= GOALS.meetings,
  ];
  const goalsMetCount = hits.filter(Boolean).length;
  const allGoalsMet = goalsMetCount === hits.length;

  // streak
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (activity.calls >= GOALS.calls) {
    if (state.lastStreakDate === yesterdayStr) state.streak++;
    else if (state.lastStreakDate !== todayStr) state.streak = 1;
    state.lastStreakDate = todayStr;
  } else if (state.lastStreakDate !== todayStr) {
    if (state.streak > 0) console.log(`⚠️ Streak broken at ${state.streak} days`);
    state.streak = 0;
    state.lastStreakDate = null;
  }
  saveState(state);

  const check = (ok) => (ok ? '✅' : '❌');
  const dateHeader = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const lines = [
    '📊 END-OF-DAY REPORT',
    dateHeader,
    '',
    'TODAY\'S ACTIVITY:',
    `📞 Calls: ${activity.calls}/${GOALS.calls} ${check(hits[0])}`,
    `💬 Leads Responded: ${leadsResponded}/${GOALS.leads} ${check(hits[1])} (${activity.sms} SMS + ${activity.emails} email)`,
    `📅 Meetings Booked: ${activity.meetings}/${GOALS.meetings} ${check(hits[2])}`,
    '',
    `🔥 Call Streak: ${state.streak} days`,
    '',
  ];

  if (allGoalsMet) {
    lines.push('🎉 All goals met. Good day.');
  } else if (goalsMetCount >= 2) {
    lines.push('👍 Partial hit. What can move tomorrow?');
  } else {
    lines.push('⚠️ Goals missed. What got in the way?');
  }

  const message = lines.join('\n');
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, `${todayStr}.txt`), message);
  console.log(message);

  return { message, activity, goals: GOALS, goalsMetCount, allGoalsMet, streak: state.streak };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

export { generateReport };
