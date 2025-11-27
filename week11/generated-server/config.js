const path = require('path');

const config = {
  ROOT_DIR: __dirname,
  URL_PORT: 5008,
  URL_PATH: 'http://localhost',
  BASE_VERSION: '',
  CONTROLLER_DIRECTORY: path.join(__dirname, 'controllers'),
  PROJECT_DIR: __dirname,
};

const apiVersioning = {
  defaultVersion: 'v1',
  versions: {
    v1: {
      basePath: 'api/v1',
      openapi: path.join(__dirname, 'api', 'openapi.yaml'),
    },
  },
};

config.API_VERSIONING = apiVersioning;
config.BASE_VERSION = apiVersioning.versions[apiVersioning.defaultVersion].basePath;
config.OPENAPI_YAML = apiVersioning.versions[apiVersioning.defaultVersion].openapi;
config.FULL_PATH = `${config.URL_PATH}:${config.URL_PORT}/${config.BASE_VERSION}`;
config.FILE_UPLOAD_PATH = path.join(config.PROJECT_DIR, 'uploaded_files');
config.SECURITY = {
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
};
config.OBSERVABILITY = {
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  metricsRetentionMinutes: parseInt(process.env.METRICS_RETENTION_MINUTES || '15', 10),
};

module.exports = config;
