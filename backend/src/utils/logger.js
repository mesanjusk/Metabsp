const pino = require('pino');
const util = require('util');

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

// Adapts loosely-typed console.log(...)-style call sites (mixed strings,
// objects, Errors) onto pino's (mergingObject, msg) API without dropping any
// of the original arguments, so existing call sites can be swapped over
// mechanically instead of being hand-rewritten one by one.
function adapt(args) {
  const err = args.find((a) => a instanceof Error);
  const rest = args.filter((a) => a !== err);
  const msg = rest.length ? util.format(...rest) : '';
  return err ? [{ err }, msg] : [msg];
}

module.exports = {
  raw: pinoLogger,
  info: (...args) => pinoLogger.info(...adapt(args)),
  warn: (...args) => pinoLogger.warn(...adapt(args)),
  error: (...args) => pinoLogger.error(...adapt(args)),
  debug: (...args) => pinoLogger.debug(...adapt(args)),
};
