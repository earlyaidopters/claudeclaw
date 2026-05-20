import net from 'net';
import { EventEmitter } from 'events';

import { logger } from './logger.js';

// signal-cli's JSON-RPC daemon speaks newline-delimited JSON over a TCP
// socket. Each line is either a JSON-RPC request, response, or a server-
// pushed notification (most importantly `receive`, which fires for every
// incoming Signal message). Protocol docs:
// https://github.com/AsamK/signal-cli/wiki/JSON-RPC-service

export interface SignalIncomingMessage {
  /** Sender's phone number in E.164 form (e.g. "+4915125233709"). */
  sourceNumber: string;
  /** Sender's display name, if provided. */
  sourceName?: string;
  /** Unix ms when Signal received the message. */
  timestamp: number;
  /** Plain-text body. Empty string if the message is media-only. */
  text: string;
  /** Attachment descriptors (if any). */
  attachments: SignalAttachment[];
  /**
   * True if the envelope came in as a syncMessage rather than a direct
   * dataMessage. Sync messages fire when the same account sends a message
   * from any of its linked devices — Signal then mirrors that outbound
   * message to every other linked device so the conversation view stays
   * consistent. For a "Note to Self" on the phone, the Mac-side daemon
   * receives it as a sync with `destinationNumber` = own number.
   */
  isSync: boolean;
  /**
   * For sync messages, the recipient of the original outbound message.
   * Useful to distinguish a Note-to-Self (= our own number) from a sync
   * of a message Q sent to someone else. Undefined for direct messages.
   */
  destinationNumber?: string;
  /** Raw envelope for debugging / advanced use. */
  raw: unknown;
}

export interface SignalAttachment {
  id: string;
  contentType?: string;
  filename?: string;
  size?: number;
  /**
   * Local file path where signal-cli has stored the downloaded attachment
   * blob (typically under `~/.local/share/signal-cli/attachments/` or a
   * platform-appropriate equivalent). Present on inbound attachments.
   */
  path?: string;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const DEFAULT_CALL_TIMEOUT_MS = 30_000;

export interface SignalRpcOptions {
  host: string;
  port: number;
  /** The daemon's bound account — passed implicitly; not needed per call. */
  account?: string;
  /** Timeout for a single JSON-RPC call. */
  callTimeoutMs?: number;
}

export class SignalRpcClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<number, PendingCall>();
  private stopped = false;
  private reconnectDelayMs = 500;

  constructor(private readonly opts: SignalRpcOptions) {
    super();
  }

  /** Connect and keep the socket alive. Auto-reconnects with exponential backoff. */
  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sock = new net.Socket();
      sock.setNoDelay(true);
      sock.setKeepAlive(true, 30_000);

      const onError = (err: Error) => {
        sock.removeAllListeners();
        reject(err);
      };

      sock.once('error', onError);
      sock.connect(this.opts.port, this.opts.host, () => {
        sock.off('error', onError);
        this.attachSocket(sock);
        this.reconnectDelayMs = 500;
        resolve();
      });
    });
  }

  private attachSocket(sock: net.Socket): void {
    this.socket = sock;
    sock.on('data', (chunk: Buffer) => this.onData(chunk));
    sock.on('error', (err) => logger.warn({ err }, 'signal-rpc socket error'));
    sock.on('close', () => {
      this.socket = null;
      this.failAllPending(new Error('signal-cli socket closed'));
      if (!this.stopped) {
        const delay = Math.min(this.reconnectDelayMs, 30_000);
        logger.warn({ delayMs: delay }, 'signal-rpc reconnecting');
        setTimeout(() => {
          if (this.stopped) return;
          this.connect().catch((err) => logger.error({ err }, 'signal-rpc reconnect failed'));
        }, delay);
        this.reconnectDelayMs *= 2;
      }
    });
  }

  /** Graceful shutdown. Blocks in-flight calls from being retried. */
  stop(): void {
    this.stopped = true;
    this.failAllPending(new Error('signal-rpc client stopped'));
    try { this.socket?.end(); } catch { /* ok */ }
    this.socket = null;
  }

  private failAllPending(err: Error): void {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  private onData(chunk: Buffer): void {
    this.buffer += chunk.toString('utf-8');
    // Daemon sends newline-delimited JSON; consume as many complete lines as we have.
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse & { method?: string; params?: unknown };
        if (msg.method === 'receive') {
          const incoming = this.parseReceive(msg.params);
          if (incoming) this.emit('message', incoming);
        } else if (typeof msg.id === 'number') {
          const pending = this.pending.get(msg.id);
          if (!pending) continue;
          this.pending.delete(msg.id);
          clearTimeout(pending.timer);
          if (msg.error) {
            pending.reject(new Error(`signal-cli error ${msg.error.code}: ${msg.error.message}`));
          } else {
            pending.resolve(msg.result);
          }
        }
      } catch (err) {
        logger.warn({ err, line: line.slice(0, 200) }, 'signal-rpc could not parse line');
      }
    }
  }

  /** Low-level JSON-RPC call. Most callers should use `send` / `sendTyping`. */
  call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!this.socket) return Promise.reject(new Error('signal-rpc not connected'));
    const id = this.nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`signal-cli call '${method}' timed out after ${this.opts.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS}ms`));
      }, this.opts.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      this.socket!.write(body, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  /** Send a plain-text message to one recipient. */
  async send(recipient: string, text: string): Promise<void> {
    await this.call('send', { recipient: [recipient], message: text });
  }

  /** Send a message with attachments (file paths on local disk). */
  async sendWithAttachments(recipient: string, text: string, attachmentPaths: string[]): Promise<void> {
    await this.call('send', {
      recipient: [recipient],
      message: text,
      attachment: attachmentPaths,
    });
  }

  /** Send a typing indicator (appears for ~10s in the receiver's Signal UI). */
  async sendTyping(recipient: string): Promise<void> {
    // signal-cli's `sendTyping` RPC — not all daemon versions expose it;
    // silently swallow "method not found" so it stays best-effort.
    try {
      await this.call('sendTyping', { recipient: [recipient] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/method.*not.*found|-32601/i.test(msg)) throw err;
    }
  }

  /**
   * Parse a `receive` notification payload from the daemon.
   * Returns null if the payload doesn't look like a user-visible message
   * (e.g. receipt, typing indicator, empty sync-contacts message).
   */
  private parseReceive(params: unknown): SignalIncomingMessage | null {
    if (!params || typeof params !== 'object') return null;
    const p = params as Record<string, unknown>;
    const envelope = (p.envelope ?? p) as Record<string, unknown>;
    if (!envelope || typeof envelope !== 'object') return null;

    const sourceNumber =
      (envelope.sourceNumber as string | undefined) ??
      (envelope.source as string | undefined) ??
      '';
    const sourceName = envelope.sourceName as string | undefined;
    const timestamp = typeof envelope.timestamp === 'number' ? envelope.timestamp : Date.now();

    // The actual message body lives in one of: dataMessage (incoming),
    // syncMessage.sentMessage.dataMessage (sync from a linked device).
    // Signal also sends receipts, typing, etc. — we only care about ones
    // with a text body or attachments.
    let dataMessage: Record<string, unknown> | undefined;
    let isSync = false;
    let destinationNumber: string | undefined;
    if (envelope.dataMessage && typeof envelope.dataMessage === 'object') {
      dataMessage = envelope.dataMessage as Record<string, unknown>;
    } else if (envelope.syncMessage && typeof envelope.syncMessage === 'object') {
      const syncMessage = envelope.syncMessage as Record<string, unknown>;
      const sentMessage = syncMessage.sentMessage as Record<string, unknown> | undefined;
      if (sentMessage?.message !== undefined || (sentMessage?.attachments as unknown[] | undefined)?.length) {
        // Sync messages look slightly different — the text is under
        // syncMessage.sentMessage.message (no nested dataMessage).
        dataMessage = sentMessage;
        isSync = true;
        destinationNumber =
          (sentMessage?.destinationNumber as string | undefined) ??
          (sentMessage?.destination as string | undefined);
      }
    }
    if (!dataMessage) return null;

    const text =
      (dataMessage.message as string | undefined) ??
      (dataMessage.body as string | undefined) ??
      '';
    const rawAttachments = (dataMessage.attachments as unknown[] | undefined) ?? [];
    const attachments: SignalAttachment[] = rawAttachments
      .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object')
      .map((a) => ({
        id: (a.id as string | undefined) ?? (a.contentType as string | undefined) ?? String(Date.now()),
        contentType: a.contentType as string | undefined,
        filename: a.filename as string | undefined,
        size: a.size as number | undefined,
        path: (a.path as string | undefined) ?? (a.file as string | undefined),
      }));

    if (!text && attachments.length === 0) return null;

    return {
      sourceNumber,
      sourceName,
      timestamp,
      text,
      attachments,
      isSync,
      destinationNumber,
      raw: envelope,
    };
  }
}

/** Typed helper for code that only wants the message event. */
export interface SignalRpcClient {
  on(event: 'message', listener: (msg: SignalIncomingMessage) => void): this;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
}
