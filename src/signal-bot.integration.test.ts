import { describe, it, expect } from 'vitest';
import net from 'net';

import { SignalRpcClient } from './signal-rpc.js';

// Integration test that talks to the real signal-cli JSON-RPC daemon.
// Auto-skips unless both are set:
//   SIGNAL_PHONE_NUMBER   — linked account, e.g. +4915125233709
//   SIGNAL_RPC_HOST       — defaults to 127.0.0.1
//   SIGNAL_RPC_PORT       — defaults to 7583
//
// The test only verifies that the socket is reachable and the daemon
// accepts a `version`-style probe — it deliberately does NOT send a
// message, so it can run safely in CI and on Niko's machine without
// spamming Signal.

const SKIP = !process.env.SIGNAL_PHONE_NUMBER;
const HOST = process.env.SIGNAL_RPC_HOST || '127.0.0.1';
const PORT = parseInt(process.env.SIGNAL_RPC_PORT || '7583', 10);

async function probeTcp(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 500);
    sock.once('error', () => { clearTimeout(timer); resolve(false); });
    sock.connect(port, host, () => {
      clearTimeout(timer);
      sock.end();
      resolve(true);
    });
  });
}

describe.skipIf(SKIP)('signal-cli integration', () => {
  it('connects to the signal-cli daemon', async () => {
    const reachable = await probeTcp(HOST, PORT);
    if (!reachable) {
      throw new Error(
        `signal-cli daemon not reachable on ${HOST}:${PORT}. ` +
        `Start it with: launchctl load ~/Library/LaunchAgents/com.mindfield.signal-cli.plist`,
      );
    }

    const client = new SignalRpcClient({ host: HOST, port: PORT, callTimeoutMs: 3000 });
    await client.connect();

    // The daemon exposes a `version` RPC that returns { version: "0.14.x", ... }.
    // If this rejects, something's wrong with framing or the daemon.
    const version = await client.call<{ version: string }>('version', {});
    expect(version).toHaveProperty('version');
    expect(typeof version.version).toBe('string');

    client.stop();
  });
});
