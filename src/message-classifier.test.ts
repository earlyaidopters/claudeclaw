import { describe, it, expect } from 'vitest';
import { classifyMessageComplexity } from './message-classifier.js';

describe('classifyMessageComplexity', () => {
  // ── Simple messages ────────────────────────────────────────────────

  it('classifies "thanks" as simple', () => {
    expect(classifyMessageComplexity('thanks')).toBe('simple');
  });

  it('classifies "ok got it" as simple', () => {
    expect(classifyMessageComplexity('ok got it')).toBe('simple');
  });

  it('classifies "yes" as simple', () => {
    expect(classifyMessageComplexity('yes')).toBe('simple');
  });

  it('classifies "sounds good" as simple', () => {
    expect(classifyMessageComplexity('sounds good')).toBe('simple');
  });

  it('classifies "lgtm" as simple', () => {
    expect(classifyMessageComplexity('lgtm')).toBe('simple');
  });

  it('classifies "k" as simple', () => {
    expect(classifyMessageComplexity('k')).toBe('simple');
  });

  it('classifies empty string as simple', () => {
    expect(classifyMessageComplexity('')).toBe('simple');
  });

  it('classifies "thanks!" (with punctuation) as simple', () => {
    expect(classifyMessageComplexity('thanks!')).toBe('simple');
  });

  it('is case-insensitive ("THANKS" -> simple)', () => {
    expect(classifyMessageComplexity('THANKS')).toBe('simple');
  });

  // ── Complex messages ───────────────────────────────────────────────

  it('classifies a refactoring request as complex', () => {
    expect(
      classifyMessageComplexity(
        'Can you refactor the authentication module to use JWT?',
      ),
    ).toBe('complex');
  });

  it('classifies messages with URLs as complex', () => {
    expect(
      classifyMessageComplexity('check this https://example.com'),
    ).toBe('complex');
  });

  it('classifies messages with code fences as complex', () => {
    expect(
      classifyMessageComplexity('here is code ```const x = 1```'),
    ).toBe('complex');
  });

  it('classifies messages longer than 120 chars as complex', () => {
    const long = 'a'.repeat(121);
    expect(classifyMessageComplexity(long)).toBe('complex');
  });

  it('classifies messages with question marks as complex', () => {
    expect(
      classifyMessageComplexity('what time is it?'),
    ).toBe('complex');
  });

  it('classifies messages with file paths as complex', () => {
    expect(
      classifyMessageComplexity('/Users/foo/bar.ts'),
    ).toBe('complex');
  });

  it('classifies "hey" as complex (not in ack list)', () => {
    expect(classifyMessageComplexity('hey')).toBe('complex');
  });
});
