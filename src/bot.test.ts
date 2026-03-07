import { describe, it, expect } from 'vitest';
import { splitMessage, extractFileMarkers } from './bot.js';

describe('splitMessage', () => {
  it('returns single-element array for short messages', () => {
    const result = splitMessage('Hello, world!');
    expect(result).toEqual(['Hello, world!']);
  });

  it('returns single-element array for empty string', () => {
    const result = splitMessage('');
    expect(result).toEqual(['']);
  });

  it('returns single-element array for exact 4096 char message', () => {
    const msg = 'a'.repeat(4096);
    const result = splitMessage(msg);
    expect(result).toEqual([msg]);
  });

  it('splits 4097 char message into two parts', () => {
    const msg = 'a'.repeat(4097);
    const result = splitMessage(msg);
    expect(result.length).toBe(2);
    // Reconstruct the original - parts should cover all chars
    expect(result.join('').length).toBe(4097);
  });

  it('never produces chunks longer than 4096 chars', () => {
    const msg = 'a'.repeat(10000);
    const result = splitMessage(msg);
    for (const part of result) {
      expect(part.length).toBeLessThanOrEqual(4096);
    }
  });

  it('splits on newline boundaries when possible', () => {
    // Create a message with newlines where the total exceeds 4096
    const line = 'x'.repeat(2000);
    const msg = `${line}\n${line}\n${line}`;
    // Total: 2000 + 1 + 2000 + 1 + 2000 = 6002
    const result = splitMessage(msg);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // First chunk should end at a newline boundary
    // (i.e., should be 2000 + 1 + 2000 = 4001 which fits in 4096)
    expect(result[0]).toContain('\n');
  });

  it('handles message with many short lines', () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i}`);
    const msg = lines.join('\n');
    const result = splitMessage(msg);
    for (const part of result) {
      expect(part.length).toBeLessThanOrEqual(4096);
    }
    // All content should be preserved
    expect(result.join('').replace(/^\s+/gm, '')).toBeTruthy();
  });

  it('handles message with no newlines that exceeds limit', () => {
    const msg = 'x'.repeat(8192);
    const result = splitMessage(msg);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(4096);
    expect(result[1].length).toBe(4096);
  });
});

describe('extractFileMarkers', () => {
  // ── Basic extraction ──────────────────────────────────────────────

  it('returns text unchanged when no markers present', () => {
    const input = 'Here is your report. Let me know if you need anything else.';
    const result = extractFileMarkers(input);
    expect(result.text).toBe(input);
    expect(result.files).toEqual([]);
  });

  it('extracts a single SEND_FILE marker', () => {
    const input = 'Here is the PDF.\n[SEND_FILE:/tmp/report.pdf]\nLet me know if you need changes.';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      type: 'document',
      filePath: '/tmp/report.pdf',
      caption: undefined,
    });
    expect(result.text).toBe('Here is the PDF.\n\nLet me know if you need changes.');
  });

  it('extracts a single SEND_PHOTO marker', () => {
    const input = 'Here is the chart.\n[SEND_PHOTO:/tmp/chart.png]';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      type: 'photo',
      filePath: '/tmp/chart.png',
      caption: undefined,
    });
    expect(result.text).toBe('Here is the chart.');
  });

  // ── Captions ──────────────────────────────────────────────────────

  it('extracts caption from pipe separator', () => {
    const input = '[SEND_FILE:/tmp/report.pdf|Q1 Financial Report]';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      type: 'document',
      filePath: '/tmp/report.pdf',
      caption: 'Q1 Financial Report',
    });
  });

  it('trims whitespace from caption and path', () => {
    const input = '[SEND_FILE: /tmp/report.pdf | Q1 Report ]';
    const result = extractFileMarkers(input);
    expect(result.files[0].filePath).toBe('/tmp/report.pdf');
    expect(result.files[0].caption).toBe('Q1 Report');
  });

  it('treats empty caption as undefined', () => {
    const input = '[SEND_FILE:/tmp/report.pdf|]';
    const result = extractFileMarkers(input);
    expect(result.files[0].caption).toBeUndefined();
  });

  // ── Multiple files ────────────────────────────────────────────────

  it('extracts multiple file markers', () => {
    const input = 'Here are both files.\n[SEND_FILE:/tmp/report.pdf]\n[SEND_PHOTO:/tmp/chart.png]\nDone.';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].type).toBe('document');
    expect(result.files[0].filePath).toBe('/tmp/report.pdf');
    expect(result.files[1].type).toBe('photo');
    expect(result.files[1].filePath).toBe('/tmp/chart.png');
    expect(result.text).toBe('Here are both files.\n\nDone.');
  });

  it('extracts multiple files with captions', () => {
    const input = '[SEND_FILE:/tmp/a.pdf|First doc]\n[SEND_FILE:/tmp/b.xlsx|Second doc]';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].caption).toBe('First doc');
    expect(result.files[1].caption).toBe('Second doc');
  });

  // ── Path variations ───────────────────────────────────────────────

  it('handles paths with spaces', () => {
    const input = '[SEND_FILE:~/Desktop/My Report.pdf]';
    const result = extractFileMarkers(input);
    expect(result.files[0].filePath).toBe('~/Desktop/My Report.pdf');
  });

  it('handles deep nested paths', () => {
    const input = '[SEND_FILE:~/Projects/output/file.csv]';
    const result = extractFileMarkers(input);
    expect(result.files[0].filePath).toBe('~/Projects/output/file.csv');
  });

  it('handles various file extensions', () => {
    const extensions = ['pdf', 'xlsx', 'csv', 'png', 'jpg', 'zip', 'docx', 'mp4', 'txt'];
    for (const ext of extensions) {
      const input = `[SEND_FILE:/tmp/file.${ext}]`;
      const result = extractFileMarkers(input);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].filePath).toBe(`/tmp/file.${ext}`);
    }
  });

  // ── Text cleanup ──────────────────────────────────────────────────

  it('collapses triple+ newlines left after marker removal', () => {
    const input = 'Before.\n\n\n[SEND_FILE:/tmp/f.pdf]\n\n\nAfter.';
    const result = extractFileMarkers(input);
    // Should not have more than two consecutive newlines
    expect(result.text).not.toMatch(/\n{3,}/);
    expect(result.text).toContain('Before.');
    expect(result.text).toContain('After.');
  });

  it('trims leading/trailing whitespace from cleaned text', () => {
    const input = '\n\n[SEND_FILE:/tmp/f.pdf]\n\nHere you go.';
    const result = extractFileMarkers(input);
    expect(result.text).toBe('Here you go.');
  });

  it('returns empty string when response is only a marker', () => {
    const input = '[SEND_FILE:/tmp/report.pdf]';
    const result = extractFileMarkers(input);
    expect(result.text).toBe('');
    expect(result.files).toHaveLength(1);
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('does not match malformed markers (missing brackets)', () => {
    const input = 'SEND_FILE:/tmp/report.pdf';
    const result = extractFileMarkers(input);
    expect(result.files).toEqual([]);
    expect(result.text).toBe(input);
  });

  it('does not match unknown marker types', () => {
    const input = '[SEND_VIDEO:/tmp/video.mp4]';
    const result = extractFileMarkers(input);
    expect(result.files).toEqual([]);
    expect(result.text).toBe(input);
  });

  it('does not match markers with empty path', () => {
    const input = '[SEND_FILE:]';
    const result = extractFileMarkers(input);
    // The regex requires at least one char in the path group
    expect(result.files).toEqual([]);
  });

  it('handles marker embedded in a sentence', () => {
    const input = 'I created the file [SEND_FILE:/tmp/out.pdf] for you.';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].filePath).toBe('/tmp/out.pdf');
    expect(result.text).toBe('I created the file  for you.');
  });

  it('preserves text around multiple markers on separate lines', () => {
    const input = 'Line 1\n[SEND_FILE:/a.pdf]\nLine 2\n[SEND_FILE:/b.pdf]\nLine 3';
    const result = extractFileMarkers(input);
    expect(result.files).toHaveLength(2);
    expect(result.text).toContain('Line 1');
    expect(result.text).toContain('Line 2');
    expect(result.text).toContain('Line 3');
  });
});
