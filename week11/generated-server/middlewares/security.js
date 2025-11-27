const crypto = require('crypto');
const logger = require('../logger');
const config = require('../config');

const rateBuckets = new Map();

const SUSPICIOUS_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3C)|<)[^\n]+((\%3E)|>)/i,
  /(union(\s)+select)/i,
  /(drop|delete|truncate)\s+(table|database)/i,
  /(javascript:)/i,
  /\b(alert|document\.cookie|onerror)\b/i,
];

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
}

function wafShield(req, res, next) {
  const normalizedPayload = JSON.stringify({
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    headers: req.headers,
  }).toLowerCase();

  const matched = SUSPICIOUS_PATTERNS.find((pattern) => pattern.test(normalizedPayload));
  if (matched) {
    logger.auditLogger.warn('waf.block', {
      pattern: matched.toString(),
      ip: req.ip,
      path: req.originalUrl,
      correlationId: req.correlationId,
    });
    return res.status(403).json({ error: 'Request blocked by WAF' });
  }
  return next();
}

function refillBucket(bucket, now) {
  if (now > bucket.resetTime) {
    bucket.count = 0;
    bucket.resetTime = now + config.SECURITY.rateLimitWindowMs;
  }
  return bucket;
}

function rateLimiter(req, res, next) {
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = refillBucket(
    rateBuckets.get(key) || { count: 0, resetTime: now + config.SECURITY.rateLimitWindowMs },
    now,
  );
  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count > config.SECURITY.rateLimitMaxRequests) {
    const retryAfter = Math.max(Math.ceil((bucket.resetTime - now) / 1000), 1);
    res.setHeader('Retry-After', retryAfter);
    logger.warn('rate_limit.hit', {
      ip: key,
      retryAfter,
      correlationId: req.correlationId,
    });
    return res.status(429).json({
      error: 'Too many requests',
      retryAfterSeconds: retryAfter,
    });
  }
  return next();
}

function auditTrail(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    return next();
  }
  const eventId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  const meta = {
    event: 'audit',
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    correlationId: req.correlationId,
    eventId,
    actor: req.headers['x-user-id'] || req.headers['x-forwarded-user'] || 'anonymous',
  };

  const snapshot = {
    headers: req.headers,
    body: req.body,
    query: req.query,
  };

  res.on('finish', () => {
    logger.auditLogger.info('write_operation', {
      ...meta,
      statusCode: res.statusCode,
      payloadDigest: crypto
        .createHash('sha256')
        .update(JSON.stringify(snapshot))
        .digest('hex'),
      timestamp: new Date().toISOString(),
    });
  });

  return next();
}

module.exports = {
  securityHeaders,
  wafShield,
  rateLimiter,
  auditTrail,
};

