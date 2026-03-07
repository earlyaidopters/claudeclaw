import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';

import { expandHome, CLAUDECLAW_CONFIG, CLAUDECLAW_WORKSPACE } from './config.js';

describe('expandHome', () => {
  it('expands ~/foo to homedir/foo', () => {
    const result = expandHome('~/foo');
    expect(result).toBe(path.join(os.homedir(), 'foo'));
  });

  it('expands ~/deeply/nested/path', () => {
    const result = expandHome('~/deeply/nested/path');
    expect(result).toBe(path.join(os.homedir(), 'deeply', 'nested', 'path'));
  });

  it('returns absolute paths unchanged', () => {
    const result = expandHome('/absolute/path');
    expect(result).toBe('/absolute/path');
  });

  it('resolves relative paths against cwd', () => {
    const result = expandHome('relative/path');
    expect(result).toBe(path.resolve('relative/path'));
  });
});

describe('CLAUDECLAW_WORKSPACE', () => {
  it('is CLAUDECLAW_CONFIG + /workspace when config is set', () => {
    if (CLAUDECLAW_CONFIG) {
      expect(CLAUDECLAW_WORKSPACE).toBe(path.join(CLAUDECLAW_CONFIG, 'workspace'));
    } else {
      expect(CLAUDECLAW_WORKSPACE).toBe('');
    }
  });
});
