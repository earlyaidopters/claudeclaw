/**
 * Integration tests for message-classifier in this fork's context.
 *
 * The 8 agents (rc1, rc2, comms, content, ops, research, qonto, hcom)
 * receive a lot of French-language messages from a French-speaking user.
 * Upstream's ACK_PATTERNS set is English-only, which means common French
 * acknowledgments ("oui", "merci", "d'accord") are misclassified as
 * 'complex' and routed to the expensive model unnecessarily.
 *
 * These tests document the expected French coverage. They will fail on
 * vanilla upstream and guide the fork-local patch to ACK_PATTERNS.
 */

import { describe, it, expect } from 'vitest';
import { classifyMessageComplexity } from './message-classifier.js';

describe('message-classifier — French acknowledgments (fork-specific)', () => {
  describe('simple French yes/no', () => {
    it('classifies "oui" as simple', () => {
      expect(classifyMessageComplexity('oui')).toBe('simple');
    });

    it('classifies "non" as simple', () => {
      expect(classifyMessageComplexity('non')).toBe('simple');
    });

    it('classifies "ouais" as simple', () => {
      expect(classifyMessageComplexity('ouais')).toBe('simple');
    });

    it('classifies "nan" as simple', () => {
      expect(classifyMessageComplexity('nan')).toBe('simple');
    });
  });

  describe('simple French positive acks', () => {
    it('classifies "merci" as simple', () => {
      expect(classifyMessageComplexity('merci')).toBe('simple');
    });

    it('classifies "d\'accord" as simple (apostrophe normalized away)', () => {
      expect(classifyMessageComplexity("d'accord")).toBe('simple');
    });

    it('classifies "parfait" as simple', () => {
      expect(classifyMessageComplexity('parfait')).toBe('simple');
    });

    it('classifies "super" as simple', () => {
      expect(classifyMessageComplexity('super')).toBe('simple');
    });

    it('classifies "top" as simple', () => {
      expect(classifyMessageComplexity('top')).toBe('simple');
    });

    it('classifies "fait" as simple', () => {
      expect(classifyMessageComplexity('fait')).toBe('simple');
    });

    it('classifies "fini" as simple', () => {
      expect(classifyMessageComplexity('fini')).toBe('simple');
    });

    it('classifies "ras" (rien à signaler) as simple', () => {
      expect(classifyMessageComplexity('ras')).toBe('simple');
    });

    it('classifies "vas-y" as simple', () => {
      expect(classifyMessageComplexity('vas-y')).toBe('simple');
    });

    it('classifies "allez-y" as simple', () => {
      expect(classifyMessageComplexity('allez-y')).toBe('simple');
    });

    it('classifies "go" as simple', () => {
      expect(classifyMessageComplexity('go')).toBe('simple');
    });
  });

  describe('French complex messages stay complex', () => {
    it('keeps "peux-tu me dire où se trouve ce fichier ?" complex', () => {
      expect(classifyMessageComplexity('peux-tu me dire où se trouve ce fichier ?')).toBe(
        'complex',
      );
    });

    it('keeps a French task request complex', () => {
      expect(
        classifyMessageComplexity('envoie un email à marc pour confirmer la réunion'),
      ).toBe('complex');
    });

    it('keeps a long French message complex', () => {
      const long =
        'Bonjour, peux-tu préparer un résumé des dernières transactions Qonto ' +
        'en séparant RorWorld du sous-compte mission GS1 avant la fin de la semaine ?';
      expect(classifyMessageComplexity(long)).toBe('complex');
    });
  });

  describe('punctuation tolerance (existing behavior, French sentences)', () => {
    it('tolerates trailing exclamation on French acks', () => {
      expect(classifyMessageComplexity('merci !')).toBe('simple');
      expect(classifyMessageComplexity('parfait !')).toBe('simple');
    });
  });
});
