import pino from 'pino';

// Always write logs to stderr so stdout stays clean for JSON output
// (agent-voice-bridge writes JSON to stdout for Python to parse)
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, destination: 2 } }
        : undefined,
  },
  process.env.NODE_ENV !== 'production' ? undefined : process.stderr,
);
