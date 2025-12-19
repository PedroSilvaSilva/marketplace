import { z } from 'zod';

export const dataSourceTypeEnum = z.enum([
  'SQL_SERVER',
  'MYSQL',
  'POSTGRESQL',
  'ORACLE',
  'REST_API',
  'GRAPHQL',
  'FILE_STORAGE'
]);

export const createDataSourceConfigSchema = z.object({
  organizationId: z.string().uuid(),
  sourceType: dataSourceTypeEnum.default('SQL_SERVER'),
  
  // SQL Server Configuration
  sqlHost: z.string().optional(),
  sqlInstance: z.string().optional(),
  sqlPort: z.number().int().min(1).max(65535).optional(),
  sqlDatabase: z.string().optional(),
  sqlUser: z.string().optional(),
  sqlPassword: z.string().optional(),
  
  // Connection Options
  connectionTimeout: z.number().int().min(1000).max(60000).default(15000),
  requestTimeout: z.number().int().min(1000).max(120000).default(30000),
  poolMax: z.number().int().min(1).max(100).default(10),
  poolMin: z.number().int().min(0).max(50).default(0),
  
  // Table/View Mappings
  productView: z.string().optional(),
  stockView: z.string().optional(),
  customerView: z.string().optional(),
  orderView: z.string().optional(),
  discountGroupView: z.string().optional(),
  discountSubGroupView: z.string().optional(),
  
  // Field Mappings
  fieldMappings: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  
  isActive: z.boolean().default(true)
});

export const updateDataSourceConfigSchema = z.object({
  sourceType: dataSourceTypeEnum.optional(),
  sqlHost: z.string().optional(),
  sqlInstance: z.string().optional(),
  sqlPort: z.number().int().min(1).max(65535).optional(),
  sqlDatabase: z.string().optional(),
  sqlUser: z.string().optional(),
  sqlPassword: z.string().optional(),
  connectionTimeout: z.number().int().min(1000).max(60000).optional(),
  requestTimeout: z.number().int().min(1000).max(120000).optional(),
  poolMax: z.number().int().min(1).max(100).optional(),
  poolMin: z.number().int().min(0).max(50).optional(),
  productView: z.string().optional(),
  stockView: z.string().optional(),
  customerView: z.string().optional(),
  orderView: z.string().optional(),
  discountGroupView: z.string().optional(),
  discountSubGroupView: z.string().optional(),
  fieldMappings: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
});

export const testConnectionSchema = z.object({
  organizationId: z.string().uuid()
});

export type CreateDataSourceConfigInput = z.infer<typeof createDataSourceConfigSchema>;
export type UpdateDataSourceConfigInput = z.infer<typeof updateDataSourceConfigSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
