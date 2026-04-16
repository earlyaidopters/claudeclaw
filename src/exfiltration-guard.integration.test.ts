/**
 * Integration tests for exfiltration-guard in the specific context of
 * this fork's 8-agent setup. Ensures the guard doesn't false-positive
 * on legitimate French business data (IBAN, SIRET, SIREN) that the
 * qonto and comms agents handle daily.
 */

import { describe, it, expect } from 'vitest';
import { scanForSecrets } from './exfiltration-guard.js';

describe('exfiltration-guard — integration with qonto/comms flows', () => {
  describe('must NOT flag French business identifiers', () => {
    it('does not flag a Qonto IBAN in a balance message', () => {
      const msg =
        'Solde Qonto RorWorld : 12 345,67 €\n' +
        'IBAN : FR76 1234 5678 9012 3456 7890 123\n' +
        'BIC : QNTOFRP1XXX';
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });

    it('does not flag a standalone SIRET (14 digits)', () => {
      const msg = 'SIRET RorWorld SARL : 89012345600017';
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });

    it('does not flag a SIREN (9 digits)', () => {
      const msg = 'Entreprise 360SmartConnect - SIREN 890123456';
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });

    it('does not flag a French phone number', () => {
      const msg = 'Rolland MELET - 06 12 34 56 78';
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });

    it('does not flag a git commit SHA (40 hex chars)', () => {
      const msg = 'See commit 267910dc85ab4cd2ef00a1b2c3d4e5f6789a0b1c';
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });
  });

  describe('MUST flag credentials even in French context', () => {
    it('flags an Anthropic key pasted in a French sentence', () => {
      const msg =
        'J\'ai mis ma clé API dans le .env : sk-ant-api03-ABC123XYZ456DEF789GHI012JKL345MNO678';
      const matches = scanForSecrets(msg);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some((m) => m.type === 'anthropic_key')).toBe(true);
    });

    it('flags a GitHub token in a mixed message', () => {
      const msg =
        'Voici le token pour déployer : ghp_abcdefghijklmnopqrstuvwxyz1234567890 — ne pas partager';
      const matches = scanForSecrets(msg);
      expect(matches.some((m) => m.type === 'github_token')).toBe(true);
    });

    it('flags a long hex key (> 40 chars)', () => {
      const msg =
        'DB_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      const matches = scanForSecrets(msg);
      expect(matches.some((m) => m.type === 'hex_key')).toBe(true);
    });

    it('flags an AWS access key in a Qonto export mention', () => {
      const msg =
        'Export S3 config : AKIAIOSFODNN7EXAMPLE (clé rotation prévue)';
      const matches = scanForSecrets(msg);
      expect(matches.some((m) => m.type === 'aws_key')).toBe(true);
    });
  });

  describe('mixed content (realistic agent output)', () => {
    it('passes a Qonto transaction list unchanged', () => {
      const msg = `
        Dernières transactions RorWorld SARL :
        - 2026-04-10 : Virement entrant 5 000 € (client Varielec, IBAN FR14 2004 1010 0505 0001 3M02 606)
        - 2026-04-09 : Prélèvement OVH 23,88 €
        - 2026-04-08 : Frais bancaires 5,00 €
        Solde courant : 18 234,56 €
      `;
      const matches = scanForSecrets(msg);
      expect(matches).toEqual([]);
    });

    it('flags only the credential, not the IBAN, in a mixed message', () => {
      const msg = `
        Solde IBAN FR76 1234 5678 9012 3456 7890 123 : 15 000 €.
        Debug : clé Anthropic utilisée = sk-ant-api03-LEAKED_KEY_ABCDEFGHIJKLMNOP.
      `;
      const matches = scanForSecrets(msg);
      expect(matches.length).toBe(1);
      expect(matches[0].type).toBe('anthropic_key');
    });
  });
});
