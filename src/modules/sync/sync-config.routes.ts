import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '@middlewares/auth';
import { asyncHandler } from '@utils/response';
import { AppError } from '@utils/errors';
import prisma from '@config/database';
import { SyncType } from '@prisma/client';
import { CronSchedulerService } from '../../services/cron-scheduler.service';
import logger from '@config/logger';

const router = Router();
router.use(authenticate);

/**
 * @route   GET /api/v1/sync-config/:organizationId
 * @desc    Get all sync configurations for an organization
 * @access  Private (Organization members)
 */
router.get('/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  const configs = await prisma.syncConfiguration.findMany({
    where: { organizationId },
    include: {
      providerConfig: {
        select: {
          id: true,
          apiUrl: true,
          isActive: true
        }
      }
    },
    orderBy: { syncType: 'asc' }
  });

  res.json({
    success: true,
    data: configs,
    meta: {
      timestamp: new Date().toISOString(),
      count: configs.length
    }
  });
}));

/**
 * @route   POST /api/v1/sync-config
 * @desc    Create or update sync configuration
 * @access  Private (OWNER/ADMIN only)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId, syncType, enabled, intervalSeconds, options } = req.body;

  // Validate sync type
  if (!Object.values(SyncType).includes(syncType)) {
    throw new AppError(`Invalid sync type. Must be one of: ${Object.values(SyncType).join(', ')}`, 400);
  }

  // Validate interval
  if (intervalSeconds < 1) {
    throw new AppError('Interval must be at least 1 second', 400);
  }

  // Check if configuration already exists
  const existing = await prisma.syncConfiguration.findUnique({
    where: {
      organizationId_providerConfigId_syncType: {
        organizationId,
        providerConfigId,
        syncType
      }
    }
  });

  let config;

  if (existing) {
    // Update existing
    config = await prisma.syncConfiguration.update({
      where: { id: existing.id },
      data: {
        enabled,
        intervalSeconds,
        options: options || {}
      }
    });
    logger.info(`[SyncConfig] Updated ${syncType} for org ${organizationId}`);
  } else {
    // Create new
    config = await prisma.syncConfiguration.create({
      data: {
        organizationId,
        providerConfigId,
        syncType,
        enabled: enabled ?? true,
        intervalSeconds: intervalSeconds || 300, // Default 5 minutes
        options: options || {}
      }
    });
    logger.info(`[SyncConfig] Created ${syncType} for org ${organizationId}`);
  }

  // Reload scheduler
  const scheduler = CronSchedulerService.getInstance();
  await scheduler.start();

  res.json({
    success: true,
    data: config,
    meta: {
      timestamp: new Date().toISOString(),
      message: existing ? 'Configuration updated' : 'Configuration created'
    }
  });
}));

/**
 * @route   PATCH /api/v1/sync-config/:id/interval
 * @desc    Update sync interval (in seconds)
 * @access  Private (OWNER/ADMIN only)
 */
router.patch('/:id/interval', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { intervalSeconds } = req.body;

  if (!intervalSeconds || intervalSeconds < 1) {
    throw new AppError('intervalSeconds must be at least 1 second', 400);
  }

  const config = await prisma.syncConfiguration.update({
    where: { id },
    data: { intervalSeconds }
  });

  // Reload scheduler
  const scheduler = CronSchedulerService.getInstance();
  await scheduler.start();

  logger.info(`[SyncConfig] Updated interval to ${intervalSeconds}s for ${config.syncType} (org ${config.organizationId})`);

  res.json({
    success: true,
    data: config,
    meta: {
      timestamp: new Date().toISOString(),
      message: `Interval updated to ${intervalSeconds} seconds`
    }
  });
}));

/**
 * @route   PATCH /api/v1/sync-config/:id/toggle
 * @desc    Enable or disable a sync configuration
 * @access  Private (OWNER/ADMIN only)
 */
router.patch('/:id/toggle', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    throw new AppError('enabled must be a boolean', 400);
  }

  const config = await prisma.syncConfiguration.update({
    where: { id },
    data: { enabled }
  });

  // Reload scheduler
  const scheduler = CronSchedulerService.getInstance();
  await scheduler.start();

  logger.info(`[SyncConfig] ${enabled ? 'Enabled' : 'Disabled'} ${config.syncType} for org ${config.organizationId}`);

  res.json({
    success: true,
    data: config,
    meta: {
      timestamp: new Date().toISOString(),
      message: `Sync ${enabled ? 'enabled' : 'disabled'}`
    }
  });
}));

/**
 * @route   POST /api/v1/sync-config/:id/trigger
 * @desc    Manually trigger a sync
 * @access  Private (Organization members)
 */
router.post('/:id/trigger', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const config = await prisma.syncConfiguration.findUnique({
    where: { id }
  });

  if (!config) {
    throw new AppError('Sync configuration not found', 404);
  }

  const scheduler = CronSchedulerService.getInstance();
  
  // Trigger sync asynchronously
  scheduler.triggerSync(config.organizationId, config.providerConfigId, config.syncType)
    .catch(error => {
      logger.error(`[SyncConfig] Manual trigger failed:`, error);
    });

  res.json({
    success: true,
    message: `${config.syncType} sync triggered`,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route   DELETE /api/v1/sync-config/:id
 * @desc    Delete sync configuration
 * @access  Private (OWNER only)
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const config = await prisma.syncConfiguration.delete({
    where: { id }
  });

  // Reload scheduler
  const scheduler = CronSchedulerService.getInstance();
  await scheduler.start();

  logger.info(`[SyncConfig] Deleted ${config.syncType} for org ${config.organizationId}`);

  res.json({
    success: true,
    message: 'Sync configuration deleted',
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route   GET /api/v1/sync-config/:organizationId/status
 * @desc    Get status of all syncs for an organization
 * @access  Private (Organization members)
 */
router.get('/:organizationId/status', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  const configs = await prisma.syncConfiguration.findMany({
    where: { organizationId },
    select: {
      id: true,
      syncType: true,
      enabled: true,
      intervalSeconds: true,
      lastSyncAt: true,
      lastSuccessAt: true,
      lastErrorAt: true,
      lastError: true
    },
    orderBy: { syncType: 'asc' }
  });

  const status = configs.map(config => ({
    ...config,
    status: config.lastErrorAt && (!config.lastSuccessAt || config.lastErrorAt > config.lastSuccessAt)
      ? 'error'
      : config.lastSuccessAt
      ? 'success'
      : 'pending'
  }));

  res.json({
    success: true,
    data: status,
    meta: {
      timestamp: new Date().toISOString(),
      count: status.length
    }
  });
}));

/**
 * @route   POST /api/v1/sync-config/:organizationId/orders/scheduler
 * @desc    Configure automatic order fetching scheduler
 * @access  Private (OWNER/ADMIN only)
 */
router.post('/:organizationId/orders/scheduler', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { providerConfigId, enabled, intervalSeconds } = req.body;

  if (!providerConfigId) {
    throw new AppError('Provider Config ID is required', 400);
  }

  if (!intervalSeconds) {
    throw new AppError('Interval is required', 400);
  }

  // Validate interval (must be 1-60 seconds or multiples of 60)
  const validIntervals = [1, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];
  if (!validIntervals.includes(intervalSeconds)) {
    throw new AppError(`Invalid interval. Must be one of: ${validIntervals.join(', ')} seconds`, 400);
  }

  // Upsert configuration
  const config = await prisma.syncConfiguration.upsert({
    where: {
      organizationId_providerConfigId_syncType: {
        organizationId,
        providerConfigId,
        syncType: 'ORDER_FETCH' as any
      }
    },
    create: {
      organizationId,
      providerConfigId,
      syncType: 'ORDER_FETCH' as any,
      enabled: enabled ?? true,
      intervalSeconds,
      options: {}
    },
    update: {
      enabled: enabled ?? true,
      intervalSeconds,
      updatedAt: new Date()
    }
  });

  // Restart scheduler to apply new configuration
  const scheduler = CronSchedulerService.getInstance();
  scheduler.stop();
  await scheduler.start();

  logger.info(`[SyncConfig] Order fetch scheduler configured for org ${organizationId}`, {
    providerConfigId,
    enabled: config.enabled,
    intervalSeconds: config.intervalSeconds
  });

  res.json({
    success: true,
    message: `Order fetch scheduler ${config.enabled ? 'enabled' : 'disabled'}`,
    data: {
      id: config.id,
      syncType: config.syncType,
      enabled: config.enabled,
      intervalSeconds: config.intervalSeconds,
      intervalDescription: intervalSeconds < 60 
        ? `Every ${intervalSeconds} second${intervalSeconds > 1 ? 's' : ''}`
        : `Every ${intervalSeconds / 60} minute${intervalSeconds > 60 ? 's' : ''}`,
      nextSync: new Date(Date.now() + (intervalSeconds * 1000)).toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route   GET /api/v1/sync-config/:organizationId/orders/scheduler
 * @desc    Get order fetch scheduler configuration
 * @access  Private (Organization members)
 */
router.get('/:organizationId/orders/scheduler', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { providerConfigId } = req.query;

  if (!providerConfigId) {
    throw new AppError('Provider Config ID is required', 400);
  }

  const config = await prisma.syncConfiguration.findUnique({
    where: {
      organizationId_providerConfigId_syncType: {
        organizationId,
        providerConfigId: providerConfigId as string,
        syncType: 'ORDER_FETCH' as any
      }
    }
  });

  if (!config) {
    return res.json({
      success: true,
      data: null,
      message: 'Order fetch scheduler not configured'
    });
  }

  res.json({
    success: true,
    data: {
      id: config.id,
      syncType: config.syncType,
      enabled: config.enabled,
      intervalSeconds: config.intervalSeconds,
      intervalDescription: config.intervalSeconds < 60 
        ? `Every ${config.intervalSeconds} second${config.intervalSeconds > 1 ? 's' : ''}`
        : `Every ${config.intervalSeconds / 60} minute${config.intervalSeconds > 60 ? 's' : ''}`,
      lastSyncAt: config.lastSyncAt,
      lastSuccessAt: config.lastSuccessAt,
      lastErrorAt: config.lastErrorAt,
      lastError: config.lastError,
      nextSync: config.lastSyncAt 
        ? new Date(config.lastSyncAt.getTime() + (config.intervalSeconds * 1000)).toISOString()
        : new Date(Date.now() + (config.intervalSeconds * 1000)).toISOString()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;
