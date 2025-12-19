import { z } from 'zod';

// Create connection schema
export const createConnectionSchema = z.object({
  clientOrgId: z.string().uuid('Invalid client organization ID'),
  providerOrgId: z.string().uuid('Invalid provider organization ID'),
  
  // Provider-specific identifiers
  merchantId: z.string().optional(),
  storeId: z.string().optional(),
  sellerId: z.string().optional(),
  accountId: z.string().optional(),
  
  // Credentials (provider-specific)
  credentials: z.record(z.any()).optional(),
  
  // Settings
  settings: z.record(z.any()).optional(),
  syncSettings: z.object({
    syncProducts: z.boolean().optional().default(true),
    syncOrders: z.boolean().optional().default(true),
    syncStock: z.boolean().optional().default(true),
    syncPrices: z.boolean().optional().default(true),
  }).optional(),
  
  syncFrequency: z.number().int().positive().optional().default(3600), // seconds
});

// Update connection schema
export const updateConnectionSchema = z.object({
  merchantId: z.string().optional(),
  storeId: z.string().optional(),
  sellerId: z.string().optional(),
  accountId: z.string().optional(),
  
  credentials: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  syncSettings: z.object({
    syncProducts: z.boolean().optional(),
    syncOrders: z.boolean().optional(),
    syncStock: z.boolean().optional(),
    syncPrices: z.boolean().optional(),
  }).optional(),
  
  syncFrequency: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});

// Sync status update schema
export const updateSyncStatusSchema = z.object({
  lastSyncStatus: z.enum(['SUCCESS', 'FAILED', 'PARTIAL']),
  lastSyncError: z.string().optional(),
  totalOrders: z.number().int().min(0).optional(),
  totalProducts: z.number().int().min(0).optional(),
  totalRevenue: z.number().min(0).optional(),
});

// Query filters schema
export const connectionFiltersSchema = z.object({
  clientOrgId: z.string().uuid().optional(),
  providerOrgId: z.string().uuid().optional(),
  isActive: z.string().transform(val => val === 'true').optional(),
  isVerified: z.string().transform(val => val === 'true').optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('10'),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>;
export type UpdateSyncStatusInput = z.infer<typeof updateSyncStatusSchema>;
export type ConnectionFilters = z.infer<typeof connectionFiltersSchema>;
