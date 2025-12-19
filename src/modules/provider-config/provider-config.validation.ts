import { z } from 'zod';

// Auth types
export const authTypeEnum = z.enum(['API_KEY', 'OAUTH2', 'BASIC', 'BEARER', 'CUSTOM']);

// Create provider config schema
export const createProviderConfigSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  
  // API Configuration
  apiUrl: z.string().url('Invalid API URL'),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  
  // Authentication
  authType: authTypeEnum.optional(),
  authEndpoint: z.string().url().optional().or(z.literal('')),
  tokenEndpoint: z.string().url().optional().or(z.literal('')),
  refreshToken: z.string().optional(),
  
  // Webhooks
  webhookUrl: z.string().url().optional().or(z.literal('')),
  webhookSecret: z.string().optional(),
  webhookEvents: z.array(z.string()).optional().default([]),
  
  // Rate Limiting
  rateLimit: z.number().int().positive().optional().default(60),
  rateLimitWindow: z.number().int().positive().optional().default(60),
  
  // Retry Configuration
  maxRetries: z.number().int().min(0).max(10).optional().default(3),
  retryDelay: z.number().int().positive().optional().default(1000),
  
  // Mappings and Settings
  fieldMappings: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  
  // Status
  isActive: z.boolean().optional().default(true),
});

// Update provider config schema
export const updateProviderConfigSchema = z.object({
  // API Configuration
  apiUrl: z.string().url('Invalid API URL').optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  
  // Authentication
  authType: authTypeEnum.optional(),
  authEndpoint: z.string().url().optional().or(z.literal('')),
  tokenEndpoint: z.string().url().optional().or(z.literal('')),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  
  // Webhooks
  webhookUrl: z.string().url().optional().or(z.literal('')),
  webhookSecret: z.string().optional(),
  webhookEvents: z.array(z.string()).optional(),
  
  // Rate Limiting
  rateLimit: z.number().int().positive().optional(),
  rateLimitWindow: z.number().int().positive().optional(),
  
  // Retry Configuration
  maxRetries: z.number().int().min(0).max(10).optional(),
  retryDelay: z.number().int().positive().optional(),
  
  // Mappings and Settings
  fieldMappings: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  
  // Status
  isActive: z.boolean().optional(),
});

// Test connection schema
export const testConnectionSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  endpoint: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional().default('GET'),
  testData: z.record(z.any()).optional(),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
});

export type CreateProviderConfigInput = z.infer<typeof createProviderConfigSchema>;
export type UpdateProviderConfigInput = z.infer<typeof updateProviderConfigSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
