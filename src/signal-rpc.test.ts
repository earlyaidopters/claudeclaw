import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'net';

import { SignalRpcClient, SignalIncomingMessage } from './signal-rpc.js';

// ── Local TCP mock daemon ─────────────────────────────────────────────
// Each test spins up a real TCP server on an ephemeral port so the
// SignalRpcClient can exercise its full framing logic against actual
// socket traffic — no monkey-patching of `net`.

interface MockDaemon {
  port: number;
  socket: net.Socket | null;
  server: net.Server;
  lastRequest: Record<string, unknown> | null;
  requests: Record<string, unknown>[];
  /** Push a JSON-RPC response for the most recent request. */
  reply(result: unknown): void;
  /** Push a server-initiated notification (e.g. an incoming `receive`). */
  notify(method: string, params: unknown): void;
  stop(): Promise<void>;
}

async function startMockDaemon(): Promise<MockDaemon> {
  return new Promise((resolve) => {
    const requests: Record<string, unknown>[] = [];
    let currentSocket: net.Socket | null = null;
    let buffer = '';

    const server = net.createServer((sock) => {
      currentSocket = sock;
      buffer = '';
      sock.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            requests.push(JSON.parse(line));
          } catch {
            // malformed — ignore
          }
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      const daemon: MockDaemon = {
        port,
        get socket() { return currentSocket; },
        server,
        get lastRequest() { return requests[requests.length - 1] ?? null; },
        requests,
        reply(result) {
          if (!currentSocket) throw new Error('no client connected');
          const last = requests[requests.length - 1];
          const id = last?.id ?? null;
          currentSocket.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
        },
        notify(method, params) {
          if (!currentSocket) throw new Error('no client connected');
          currentSocket.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
        },
        async stop(): Promise<void> {
          return new Promise((res) => {
            try { currentSocket?.destroy(); } catch { /* ok */ }
            server.close(() => res());
          });
        },
      };
      resolve(daemon);
    });
  });
}

/** Wait for a predicate to become true, polling every 10ms. */
async function waitFor(pred: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('SignalRpcClient', () => {
  let daemon: MockDaemon;
  let client: SignalRpcClient;

  beforeEach(async () => {
    daemon = await startMockDaemon();
    client = new SignalRpcClient({
      host: '127.0.0.1',
      port: daemon.port,
      callTimeoutMs: 500,
    });
    await client.connect();
    // Wait until the server observed the new connection.
    await waitFor(() => daemon.socket !== null);
  });

  afterEach(async () => {
    client.stop();
    await daemon.stop();
  });

  it('sends a send RPC with the correct envelope', async () => {
    const sent = client.send('+4915125233709', 'hello');
    await waitFor(() => daemon.lastRequest !== null);
    daemon.reply({ timestamp: 123 });
    await sent;

    expect(daemon.lastRequest).toMatchObject({
      jsonrpc: '2.0',
      method: 'send',
      params: { recipient: ['+4915125233709'], message: 'hello' },
    });
    expect(typeof daemon.lastRequest!.id).toBe('number');
  });

  it('passes attachment paths through to the send RPC', async () => {
    const sent = client.sendWithAttachments('+4915125233709', 'look at this', ['/tmp/foo.png']);
    await waitFor(() => daemon.lastRequest !== null);
    daemon.reply({ timestamp: 123 });
    await sent;

    expect(daemon.lastRequest).toMatchObject({
      method: 'send',
      params: {
        recipient: ['+4915125233709'],
        message: 'look at this',
        attachment: ['/tmp/foo.png'],
      },
    });
  });

  it('swallows "method not found" from sendTyping (best-effort)', async () => {
    // Deliberately not replying with a result — emit a method-not-found error
    // to verify sendTyping silently swallows it.
    const sent = client.sendTyping('+4915125233709');
    await waitFor(() => daemon.lastRequest !== null);
    const id = daemon.lastRequest!.id;
    daemon.socket!.write(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' },
    }) + '\n');

    await expect(sent).resolves.toBeUndefined();
  });

  it('emits message events for incoming receive notifications', async () => {
    const received: SignalIncomingMessage[] = [];
    client.on('message', (msg) => received.push(msg));

    daemon.notify('receive', {
      envelope: {
        source: '+4915125233709',
        sourceNumber: '+4915125233709',
        sourceName: 'Niko',
        timestamp: 1776843000000,
        dataMessage: {
          message: 'hi from phone',
          attachments: [],
        },
      },
    });

    await waitFor(() => received.length > 0);
    expect(received[0]).toMatchObject({
      sourceNumber: '+4915125233709',
      sourceName: 'Niko',
      text: 'hi from phone',
      attachments: [],
      isSync: false,
    });
  });

  it('marks sync messages so the bot can ignore its own echoes', async () => {
    const received: SignalIncomingMessage[] = [];
    client.on('message', (msg) => received.push(msg));

    daemon.notify('receive', {
      envelope: {
        sourceNumber: '+4915125233709',
        timestamp: 1776843000000,
        syncMessage: {
          sentMessage: { message: 'self-echo' },
        },
      },
    });

    await waitFor(() => received.length > 0);
    expect(received[0].isSync).toBe(true);
    expect(received[0].text).toBe('self-echo');
  });

  it('drops receipt-only envelopes (no text, no attachments)', async () => {
    const received: SignalIncomingMessage[] = [];
    client.on('message', (msg) => received.push(msg));

    daemon.notify('receive', {
      envelope: {
        sourceNumber: '+4915125233709',
        timestamp: 1776843000000,
        receiptMessage: { type: 'READ' },
      },
    });

    // Give the event loop a tick to process.
    await new Promise((r) => setTimeout(r, 30));
    expect(received).toHaveLength(0);
  });

  it('times out a call when the daemon never replies', async () => {
    const call = client.send('+4915125233709', 'stuck');
    await expect(call).rejects.toThrow(/timed out/i);
  });

  it('handles framing across packet boundaries', async () => {
    const received: SignalIncomingMessage[] = [];
    client.on('message', (msg) => received.push(msg));

    // Push two events as a single write, separated by \n — forces the
    // client to parse two complete JSON objects out of one buffer.
    const env1 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'receive',
      params: {
        envelope: {
          sourceNumber: '+1',
          timestamp: 1,
          dataMessage: { message: 'first' },
        },
      },
    });
    const env2 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'receive',
      params: {
        envelope: {
          sourceNumber: '+2',
          timestamp: 2,
          dataMessage: { message: 'second' },
        },
      },
    });
    daemon.socket!.write(env1 + '\n' + env2 + '\n');

    await waitFor(() => received.length === 2);
    expect(received.map((m) => m.text)).toEqual(['first', 'second']);
  });
});
