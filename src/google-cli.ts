#!/usr/bin/env node
/**
 * Google Calendar & Gmail CLI for scheduled tasks.
 *
 * Usage:
 *   node dist/google-cli.js calendar today
 *   node dist/google-cli.js calendar 2026-04-28
 *   node dist/google-cli.js calendar week
 *   node dist/google-cli.js gmail unread [limit]
 *   node dist/google-cli.js gmail search "query" [limit]
 *   node dist/google-cli.js gmail thread THREAD_ID
 */

import {
  isGoogleApiConfigured,
  getCalendarEvents,
  getCalendarEventsRange,
  getRecentEmails,
  getEmailThread,
} from './google-api.js';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatTime(isoStr: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return isoStr;
  }
}

async function handleCalendar(args: string[]) {
  const subcommand = args[0] || 'today';

  if (subcommand === 'today') {
    const date = todayISO();
    const events = await getCalendarEvents(date);
    if (events.length === 0) {
      console.log(`No events for ${date}.`);
      return;
    }
    console.log(`Calendar for ${date}:\n`);
    for (const e of events) {
      const time = e.start.includes('T')
        ? `${formatTime(e.start)} - ${formatTime(e.end)}`
        : 'All day';
      console.log(`  ${time} | ${e.summary}`);
      if (e.location) console.log(`    Location: ${e.location}`);
      if (e.conferenceUrl) console.log(`    Link: ${e.conferenceUrl}`);
      if (e.attendees?.length) console.log(`    Attendees: ${e.attendees.join(', ')}`);
    }
  } else if (subcommand === 'week') {
    const start = todayISO();
    const end = addDays(start, 7);
    const events = await getCalendarEventsRange(start, end);
    if (events.length === 0) {
      console.log(`No events for the next 7 days.`);
      return;
    }
    console.log(`Calendar for ${start} to ${end}:\n`);
    let lastDate = '';
    for (const e of events) {
      const eventDate = (e.start || '').slice(0, 10);
      if (eventDate !== lastDate) {
        console.log(`\n  ${eventDate}:`);
        lastDate = eventDate;
      }
      const time = e.start.includes('T') ? formatTime(e.start) : 'All day';
      console.log(`    ${time} | ${e.summary}`);
    }
  } else {
    // Assume it's a date string
    const events = await getCalendarEvents(subcommand);
    if (events.length === 0) {
      console.log(`No events for ${subcommand}.`);
      return;
    }
    console.log(`Calendar for ${subcommand}:\n`);
    for (const e of events) {
      const time = e.start.includes('T')
        ? `${formatTime(e.start)} - ${formatTime(e.end)}`
        : 'All day';
      console.log(`  ${time} | ${e.summary}`);
      if (e.location) console.log(`    Location: ${e.location}`);
    }
  }
}

async function handleGmail(args: string[]) {
  const subcommand = args[0] || 'unread';

  if (subcommand === 'unread') {
    const limit = parseInt(args[1] || '10', 10);
    const emails = await getRecentEmails('is:unread', limit);
    if (emails.length === 0) {
      console.log('No unread emails.');
      return;
    }
    console.log(`${emails.length} unread emails:\n`);
    for (const e of emails) {
      console.log(`  From: ${e.from}`);
      console.log(`  Subject: ${e.subject}`);
      console.log(`  Snippet: ${e.snippet.slice(0, 120)}`);
      console.log(`  Thread: ${e.threadId}`);
      console.log();
    }
  } else if (subcommand === 'search') {
    const query = args[1];
    if (!query) {
      console.error('Usage: gmail search "query" [limit]');
      process.exit(1);
    }
    const limit = parseInt(args[2] || '10', 10);
    const emails = await getRecentEmails(query, limit);
    if (emails.length === 0) {
      console.log(`No emails matching: ${query}`);
      return;
    }
    console.log(`${emails.length} emails matching "${query}":\n`);
    for (const e of emails) {
      console.log(`  From: ${e.from}`);
      console.log(`  Subject: ${e.subject}`);
      console.log(`  Date: ${e.date}`);
      console.log(`  Snippet: ${e.snippet.slice(0, 120)}`);
      console.log(`  Thread: ${e.threadId}`);
      console.log();
    }
  } else if (subcommand === 'thread') {
    const threadId = args[1];
    if (!threadId) {
      console.error('Usage: gmail thread THREAD_ID');
      process.exit(1);
    }
    const messages = await getEmailThread(threadId);
    if (messages.length === 0) {
      console.log('Thread not found or empty.');
      return;
    }
    console.log(`Thread (${messages.length} messages):\n`);
    for (const m of messages) {
      console.log(`  From: ${m.from}`);
      console.log(`  Date: ${m.date}`);
      console.log(`  Subject: ${m.subject}`);
      console.log(`  Body: ${m.body.slice(0, 500)}`);
      console.log('  ---');
    }
  } else {
    console.error(`Unknown gmail subcommand: ${subcommand}`);
    console.error('Available: unread, search, thread');
    process.exit(1);
  }
}

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help') {
    console.log(`Google Calendar & Gmail CLI

Usage:
  node dist/google-cli.js calendar today          Events for today
  node dist/google-cli.js calendar 2026-04-28     Events for a date
  node dist/google-cli.js calendar week           Events for next 7 days
  node dist/google-cli.js gmail unread [limit]    Recent unread emails
  node dist/google-cli.js gmail search "q" [n]    Search emails
  node dist/google-cli.js gmail thread THREAD_ID  Full thread content
  node dist/google-cli.js status                  Check if configured`);
    process.exit(0);
  }

  if (command === 'status') {
    const configured = isGoogleApiConfigured();
    console.log(configured ? 'Google API: configured and ready' : 'Google API: not configured. Run: npx tsx scripts/google-auth.ts');
    process.exit(configured ? 0 : 1);
  }

  if (!isGoogleApiConfigured()) {
    console.error('Google API not configured. Run: npx tsx scripts/google-auth.ts');
    process.exit(1);
  }

  try {
    if (command === 'calendar') {
      await handleCalendar(args);
    } else if (command === 'gmail') {
      await handleGmail(args);
    } else {
      console.error(`Unknown command: ${command}. Use 'calendar' or 'gmail'.`);
      process.exit(1);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      console.error('Google auth expired. Run: npx tsx scripts/google-auth.ts');
    } else {
      console.error('Error:', msg);
    }
    process.exit(1);
  }
}

main();
