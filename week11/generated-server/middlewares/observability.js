const crypto = require('crypto');
const { performance } = require('perf_hooks');
const logger = require('../logger');
const config = require('../config');

const metricsState = {
  startedAt: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  inflight: 0,
  perRoute: new Map(),
  recentDurations: [],
};

function getRouteKey(req) {
  const path = req.route && req.route.path ? req.route.path : req.originalUrl.split('?')[0];
  return `${req.method.toUpperCase()} ${path}`;
}

function trimDurations() {
  const retentionMs = (config.OBSERVABILITY.metricsRetentionMinutes || 15) * 60 * 1000;
  const now = Date.now();
  metricsState.recentDurations = metricsState.recentDurations.filter(
    (sample) => now - sample.timestamp <= retentionMs,
  );
}

function recordMetrics(routeKey, statusCode, durationMs) {
  metricsState.totalRequests += 1;
  if (statusCode >= 500) {
    metricsState.totalErrors += 1;
  }
  metricsState.inflight = Math.max(metricsState.inflight - 1, 0);
  trimDurations();
  metricsState.recentDurations.push({ durationMs, timestamp: Date.now() });

  if (!metricsState.perRoute.has(routeKey)) {
    metricsState.perRoute.set(routeKey, {
      count: 0,
      avgDurationMs: 0,
      errors: 0,
    });
  }
  const routeMetric = metricsState.perRoute.get(routeKey);
  routeMetric.count += 1;
  routeMetric.avgDurationMs = parseFloat(
    ((routeMetric.avgDurationMs * (routeMetric.count - 1) + durationMs) / routeMetric.count).toFixed(2),
  );
  if (statusCode >= 400) {
    routeMetric.errors += 1;
  }
  metricsState.perRoute.set(routeKey, routeMetric);
}

function correlationId(req) {
  return req.headers['x-correlation-id'] || crypto.randomBytes(16).toString('hex');
}

function requestObserver(req, res, next) {
  const start = performance.now();
  const corrId = correlationId(req);
  req.correlationId = corrId;
  res.setHeader('X-Correlation-Id', corrId);
  metricsState.inflight += 1;

  res.on('finish', () => {
    const durationMs = parseFloat((performance.now() - start).toFixed(2));
    const routeKey = getRouteKey(req);
    recordMetrics(routeKey, res.statusCode, durationMs);
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger.log(level, 'http_request_completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      correlationId: corrId,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}

function metricsSnapshot() {
  const durations = metricsState.recentDurations.map((sample) => sample.durationMs);
  const avgDuration =
    durations.length > 0
      ? parseFloat((durations.reduce((acc, cur) => acc + cur, 0) / durations.length).toFixed(2))
      : 0;
  const p95 = (() => {
    if (!durations.length) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95) - 1;
    return sorted[Math.max(idx, 0)];
  })();

  const perRoute = {};
  metricsState.perRoute.forEach((value, key) => {
    perRoute[key] = value;
  });

  return {
    uptimeSeconds: Math.round((Date.now() - metricsState.startedAt) / 1000),
    totalRequests: metricsState.totalRequests,
    totalErrors: metricsState.totalErrors,
    inflightRequests: metricsState.inflight,
    averageDurationMs: avgDuration,
    p95DurationMs: p95,
    perRoute,
  };
}

function metricsHandler(req, res) {
  if (!config.OBSERVABILITY.enableMetrics) {
    return res.status(503).json({ error: 'Metrics collection disabled' });
  }
  return res.json(metricsSnapshot());
}

function healthHandler(req, res) {
  const snapshot = metricsSnapshot();
  const unhealthy = snapshot.totalErrors > snapshot.totalRequests * 0.25;
  const status = unhealthy ? 503 : 200;
  return res.status(status).json({
    status: unhealthy ? 'degraded' : 'ok',
    uptimeSeconds: snapshot.uptimeSeconds,
    inflightRequests: snapshot.inflightRequests,
    totalErrors: snapshot.totalErrors,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  requestObserver,
  metricsHandler,
  healthHandler,
};

