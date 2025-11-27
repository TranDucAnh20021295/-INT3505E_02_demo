// const { Middleware } = require('swagger-express-middleware');
const http = require('http');
const fs = require('fs');
const path = require('path');
const swaggerUI = require('swagger-ui-express');
const jsYaml = require('js-yaml');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const OpenApiValidator = require('express-openapi-validator');
const logger = require('./logger');
const config = require('./config');
const observability = require('./middlewares/observability');
const security = require('./middlewares/security');

class ExpressServer {
  constructor(port, openApiYaml) {
    this.port = port;
    this.app = express();
    this.openApiPath = openApiYaml;
    this.schemas = {};
    this.loadSchema(openApiYaml);
    this.setupMiddleware();
    this.setupVersionedRouters();
  }

  loadSchema(specPath) {
    if (!this.schemas[specPath]) {
      try {
        this.schemas[specPath] = jsYaml.safeLoad(fs.readFileSync(specPath));
      } catch (e) {
        logger.error('failed to load OpenAPI schema', e.message);
      }
    }
    return this.schemas[specPath];
  }

  setupMiddleware() {
    // this.setupAllowedMedia();
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));
    this.app.use(bodyParser.json({ limit: '14MB' }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use(observability.requestObserver);
    this.app.use(security.securityHeaders);
    this.app.use(security.rateLimiter);
    this.app.use(security.wafShield);
    this.app.get('/hello', (req, res) => res.send(`Hello World. path: ${this.openApiPath}`));
    this.app.use(security.auditTrail);
    this.app.get('/internal/healthz', observability.healthHandler);
    this.app.get('/internal/metrics', observability.metricsHandler);

    this.app.get('/login-redirect', (req, res) => {
      res.status(200);
      res.json(req.query);
    });
    this.app.get('/oauth2-redirect.html', (req, res) => {
      res.status(200);
      res.json(req.query);
    });
  }

  setupVersionedRouters() {
    const versioning = config.API_VERSIONING;
    if (!versioning || !versioning.versions) {
      this.app.use(
        OpenApiValidator.middleware({
          apiSpec: this.openApiPath,
          operationHandlers: path.join(__dirname),
          fileUploader: { dest: config.FILE_UPLOAD_PATH },
        }),
      );
      this.app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(this.schemas[this.openApiPath]));
      this.app.get('/openapi', (req, res) => res.sendFile(this.openApiPath));
      return;
    }

    Object.entries(versioning.versions).forEach(([version, versionConfig]) => {
      const router = express.Router();
      const specPath = versionConfig.openapi || this.openApiPath;
      const schema = this.loadSchema(specPath);
      const basePath = `/${versionConfig.basePath}`;

      router.get('/openapi', (req, res) => res.sendFile(specPath));
      router.use('/api-docs', swaggerUI.serve, swaggerUI.setup(schema));
      router.use(
        OpenApiValidator.middleware({
          apiSpec: specPath,
          operationHandlers: path.join(__dirname),
          fileUploader: { dest: config.FILE_UPLOAD_PATH },
        }),
      );

      this.app.use(basePath, router);
    });

    this.app.get('/openapi', (req, res) => res.redirect(`/${config.BASE_VERSION}/openapi`));
    this.app.get('/api-docs', (req, res) => res.redirect(`/${config.BASE_VERSION}/api-docs`));
    this.app.get('/api', (req, res) => {
      res.json({
        defaultVersion: versioning.defaultVersion,
        versions: Object.entries(versioning.versions).map(
          ([name, cfg]) => ({
            name,
            basePath: `/${cfg.basePath}`,
          }),
        ),
      });
    });
  }

  launch() {
    // eslint-disable-next-line no-unused-vars
    this.app.use((err, req, res, next) => {
      // format errors
      res.status(err.status || 500).json({
        message: err.message || err,
        errors: err.errors || '',
      });
    });

    http.createServer(this.app).listen(this.port);
    console.log(`Listening on port ${this.port}`);
  }

  async close() {
    if (this.server !== undefined) {
      await this.server.close();
      console.log(`Server on port ${this.port} shut down`);
    }
  }
}

module.exports = ExpressServer;
