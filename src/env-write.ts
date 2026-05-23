import fs from 'fs';
import crypto from 'crypto';

/**
 * Atomically write `contents` to `envPath` via temp-file + rename. Mode
 * 0o600 because the file holds bot tokens. fsync before rename so the
 * data hits disk before the swap.
 *
 * Concurrent readers (kill-switches re-reads .env every 1.5s) never see
 * a torn file with this approach: rename(2) is atomic on the same
 * filesystem.
 */
export function atomicEnvWrite(envPath: string, contents: string): void {
  const tmp = `${envPath}.tmp.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  const fd = fs.openSync(tmp, 'w', 0o600);
  try {
    fs.writeSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, envPath);
}

/**
 * Set or replace a single key in the .env file. If the key already
 * exists, its line is replaced in place. Otherwise the new line is
 * appended. Comments and other lines are preserved.
 */
export function setEnvKey(envPath: string, key: string, value: string): void {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf-8');
  } catch { /* file may not exist */ }

  const lines = content.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(key + '=')) {
      lines[i] = key + '=' + value;
      found = true;
      break;
    }
  }
  if (!found) {
    if (content.length > 0 && !content.endsWith('\n')) lines.push('');
    lines.push(key + '=' + value);
  }
  atomicEnvWrite(envPath, lines.join('\n'));
}
