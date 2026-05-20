declare module 'ws' {
  export class WebSocket extends EventTarget {
    constructor(url: string);
    readonly readyState: number;
    send(data: any): void;
    close(code?: number, reason?: string): void;
    on(event: string, listener: (...args: any[]) => void): this;
  }
  export class WebSocketServer {
    constructor(options: { noServer: boolean });
    handleUpgrade(request: any, socket: any, head: any, callback: (ws: any) => void): void;
  }
}
