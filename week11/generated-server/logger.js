const { transports, createLogger, format } = require('winston');

const baseFormat = format.combine(
  format.timestamp(),
  format.json(),
);

const logger = createLogger({
  level: 'info',
  format: baseFormat,
  defaultMeta: { service: 'library-api' },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error', timestamp: true }),
    new transports.File({ filename: 'combined.log', timestamp: true }),
  ],
});

const auditLogger = createLogger({
  level: 'info',
  format: baseFormat,
  defaultMeta: { stream: 'audit' },
  transports: [
    new transports.File({ filename: 'audit.log', timestamp: true }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({ format: format.simple() }));
  auditLogger.add(new transports.Console({ format: format.simple() }));
}

logger.auditLogger = auditLogger;

module.exports = logger;
module.exports.auditLogger = auditLogger;
