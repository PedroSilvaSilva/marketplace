import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { config } from './index';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'CSW Markets Integrator API',
    version: '1.0.0',
    description: 'Enterprise API integrator for multiple business areas with zero trust security',
    contact: {
      name: 'API Support',
      email: 'support@cswmarkets.com',
    },
    license: {
      name: 'ISC',
      url: 'https://opensource.org/licenses/ISC',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.app.port}${config.app.apiPrefix}`,
      description: 'Development server',
    },
    {
      url: `https://api.cswmarkets.com${config.app.apiPrefix}`,
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
              },
              code: {
                type: 'string',
              },
              details: {
                type: 'object',
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          firstName: {
            type: 'string',
          },
          lastName: {
            type: 'string',
          },
          role: {
            type: 'string',
            enum: ['ADMIN', 'USER', 'MANAGER', 'GUEST'],
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'],
          },
          emailVerified: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          companyName: {
            type: 'string',
          },
          taxId: {
            type: 'string',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          phone: {
            type: 'string',
          },
          address: {
            type: 'string',
          },
          city: {
            type: 'string',
          },
          country: {
            type: 'string',
          },
          status: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Auth',
      description: 'Authentication and authorization endpoints',
    },
    {
      name: 'Organizations',
      description: 'Organization management endpoints',
    },
    {
      name: 'Customers',
      description: 'Customer management endpoints',
    },
    {
      name: 'Integrations',
      description: 'Integration management endpoints',
    },
    {
      name: 'Provider Config',
      description: 'Provider configuration endpoints',
    },
    {
      name: 'Data Source Config',
      description: 'Data source configuration endpoints',
    },
    {
      name: 'Sync',
      description: 'Article synchronization endpoints - Sync articles from SQL Server to marketplaces',
    },
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.routes.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };
