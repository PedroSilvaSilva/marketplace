import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from '@config/index';
import { errorHandler, notFoundHandler } from '@middlewares/errorHandler';
import { rateLimiter, sanitizeInput } from '@middlewares/security';
import { swaggerUi, swaggerSpec } from '@config/swagger';
import { morganStream } from '@config/logger';
import logger from '@config/logger';

// Import routes
import authRoutes from '@modules/auth/auth.routes';
import customerRoutes from '@modules/customer/customer.routes';
import integrationRoutes from '@modules/integration/integration.routes';
import organizationRoutes from '@modules/organization/organization.routes';
import providerConfigRoutes from '@modules/provider-config/provider-config.routes';
import clientProviderRoutes from '@modules/client-provider/client-provider.routes';
import dataSourceConfigRoutes from '@modules/data-source-config/data-source-config.routes';
import syncRoutes from '@modules/sync/sync.routes';
import sqlDataRoutes from '@modules/sync/sql-data.routes';
import syncConfigRoutes from '@modules/sync/sync-config.routes';
import syncLogsRoutes from '@modules/sync/routes/sync-logs.routes';
import integrationStatsRoutes from '@modules/integration/integration-stats.routes';
import errorNotificationsRoutes from '@modules/error-notifications/error-notifications.routes';
import dailyReportsRoutes from '@modules/daily-reports/daily-reports.routes';
// import notificationSettingsRoutes from '@routes/notification-settings.routes';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    this.app.use(cookieParser(config.security.sessionSecret));

    // Compression
    this.app.use(compression());

    // Rate limiting
    this.app.use(rateLimiter);

    // Input sanitization
    this.app.use(sanitizeInput);

    // Request logging
    if (config.app.isDevelopment) {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', { stream: morganStream }));
    }

    // Trust proxy
    this.app.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    const apiPrefix = config.app.apiPrefix;

    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.app.env,
        },
      });
    });

    // Root endpoint
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        success: true,
        data: {
          message: 'CSW Markets Integrator API',
          version: '1.0.0',
          documentation: `${apiPrefix}/docs`,
        },
      });
    });

    // Swagger documentation
    if (config.swagger.enabled) {
      this.app.use(
        `${apiPrefix}/docs`,
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'CSW Markets API Docs',
        })
      );
      
      // Swagger JSON
      this.app.get(`${apiPrefix}/docs.json`, (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
      });
      
      logger.info(`📚 Swagger docs available at: ${apiPrefix}/docs`);
    }

    // API routes
    this.app.use(`${apiPrefix}/auth`, authRoutes);
    this.app.use(`${apiPrefix}/customers`, customerRoutes);
    this.app.use(`${apiPrefix}/integrations`, integrationRoutes);
    this.app.use(`${apiPrefix}/organizations`, organizationRoutes);
    this.app.use(`${apiPrefix}/provider-configs`, providerConfigRoutes);
    this.app.use(`${apiPrefix}/client-provider-connections`, clientProviderRoutes);
    this.app.use(`${apiPrefix}/data-source-configs`, dataSourceConfigRoutes);
    this.app.use(`${apiPrefix}/sync`, syncRoutes);
    this.app.use(`${apiPrefix}/sync/sql`, sqlDataRoutes);
    this.app.use(`${apiPrefix}/sync-config`, syncConfigRoutes);
    this.app.use(`${apiPrefix}/sync-logs`, syncLogsRoutes);
    this.app.use(`${apiPrefix}/integration/stats`, integrationStatsRoutes);
    this.app.use(`${apiPrefix}/error-notifications`, errorNotificationsRoutes);
    this.app.use(`${apiPrefix}/daily-reports`, dailyReportsRoutes);
    // this.app.use(`${apiPrefix}/notification-settings`, notificationSettingsRoutes);

    logger.info('✅ Routes initialized successfully');
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.app.listen(config.app.port, () => {
      logger.info('=================================');
      logger.info(`🚀 Server running on port ${config.app.port}`);
      logger.info(`📦 Environment: ${config.app.env}`);
      logger.info(`🔗 API URL: http://localhost:${config.app.port}${config.app.apiPrefix}`);
      if (config.swagger.enabled) {
        logger.info(`📚 Docs: http://localhost:${config.app.port}${config.app.apiPrefix}/docs`);
      }
      logger.info('=================================');
    });
  }
}

export default App;
