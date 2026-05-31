/**
 * War Room Pipecat Client
 * Bundles @pipecat-ai/client-js + @pipecat-ai/websocket-transport
 * for browser use. Built with esbuild.
 *
 * Usage in browser:
 *   const { PipecatClient, WebSocketTransport } = window.PipecatWarRoom;
 */
import { PipecatClient } from '@pipecat-ai/client-js';
import { WebSocketTransport } from '@pipecat-ai/websocket-transport';

window.PipecatWarRoom = { PipecatClient, WebSocketTransport };
