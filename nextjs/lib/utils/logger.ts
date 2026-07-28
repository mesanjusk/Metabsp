import pino from 'pino';
import util from 'util';

// Ported unchanged from backend/src/utils/logger.js.
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const pinoLogger = pino({
  level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.accessToken',
      '*.accessTokenEncrypted',
      '*.password',
      '*.token',
      '*.otp',
    ],
    censor: '[redacted]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

function adapt(args: unknown[]): [unknown, string?] | [string] {
  const err = args.find((a) => a instanceof Error) as Error | undefined;
  const rest = args.filter((a) => a !== err);
  const msg = rest.length ? util.format(...(rest as any[])) : '';
  return err ? [{ err }, msg] : [msg];
}

const logger = {
  raw: pinoLogger,
  info: (...args: unknown[]) => (pinoLogger.info as any)(...adapt(args)),
  warn: (...args: unknown[]) => (pinoLogger.warn as any)(...adapt(args)),
  error: (...args: unknown[]) => (pinoLogger.error as any)(...adapt(args)),
  debug: (...args: unknown[]) => (pinoLogger.debug as any)(...adapt(args)),
};

export default logger;
