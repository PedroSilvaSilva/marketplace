import { Router } from 'express';
import { asyncHandler } from '@utils/response';
import prisma from '@config/database';
import { AppError } from '@utils/errors';

const router = Router({ mergeParams: true });

/**
 * GET /api/v1/sync-logs/:organizationId
 * Get sync execution logs for an organization
 */
router.get(
  '/:organizationId',
  asyncHandler(async (req, res) => {
    const { organizationId } = req.params;
    const { 
      syncType, 
      status, 
      limit = '50', 
      offset = '0',
      startDate,
      endDate 
    } = req.query;

    // Build filters
    const where: any = { organizationId };

    if (syncType) {
      where.syncType = syncType;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) {
        where.startedAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.startedAt.lte = new Date(endDate as string);
      }
    }

    // Query logs with pagination
    const [logs, total] = await Promise.all([
      prisma.syncExecutionLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          providerConfig: {
            select: {
              id: true,
              apiUrl: true
            }
          }
        }
      }),
      prisma.syncExecutionLog.count({ where })
    ]);

    res.json({
      success: true,
      message: 'Sync execution logs retrieved',
      data: {
        logs,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + logs.length < total
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * GET /api/v1/sync-logs/:organizationId/stats
 * Get sync execution statistics
 */
router.get(
  '/:organizationId/stats',
  asyncHandler(async (req, res) => {
    const { organizationId } = req.params;
    const { syncType, days = '7' } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    // Build filters
    const where: any = {
      organizationId,
      startedAt: {
        gte: daysAgo
      }
    };

    if (syncType) {
      where.syncType = syncType;
    }

    // Get statistics
    const [logs, statusCounts] = await Promise.all([
      prisma.syncExecutionLog.findMany({
        where,
        select: {
          id: true,
          syncType: true,
          status: true,
          duration: true,
          totalFetched: true,
          totalProcessed: true,
          totalSucceeded: true,
          totalFailed: true,
          totalSkipped: true,
          startedAt: true
        }
      }),
      prisma.syncExecutionLog.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true
        }
      })
    ]);

    // Calculate aggregates
    const totalExecutions = logs.length;
    const successRate = totalExecutions > 0 
      ? ((logs.filter((l: typeof logs[0]) => l.status === 'SUCCESS').length / totalExecutions) * 100).toFixed(2)
      : '0.00';
    
    const avgDuration = logs.length > 0
      ? Math.round(logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.duration || 0), 0) / logs.length)
      : 0;

    const totalItems = {
      fetched: logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.totalFetched || 0), 0),
      processed: logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.totalProcessed || 0), 0),
      succeeded: logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.totalSucceeded || 0), 0),
      failed: logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.totalFailed || 0), 0),
      skipped: logs.reduce((sum: number, l: typeof logs[0]) => sum + (l.totalSkipped || 0), 0)
    };

    res.json({
      success: true,
      message: 'Sync execution statistics retrieved',
      data: {
        period: {
          days: parseInt(days as string),
          from: daysAgo.toISOString(),
          to: new Date().toISOString()
        },
        summary: {
          totalExecutions,
          successRate: `${successRate}%`,
          avgDuration: `${avgDuration}ms`,
          totalItems
        },
        byStatus: statusCounts.reduce((acc: Record<string, number>, item: typeof statusCounts[0]) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * GET /api/v1/sync-logs/:organizationId/:logId
 * Get a specific sync execution log
 */
router.get(
  '/:organizationId/:logId',
  asyncHandler(async (req, res) => {
    const { organizationId, logId } = req.params;

    const log = await prisma.syncExecutionLog.findFirst({
      where: {
        id: logId,
        organizationId
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        providerConfig: {
          select: {
            id: true,
            apiUrl: true
          }
        }
      }
    });

    if (!log) {
      throw new AppError('Sync execution log not found', 404);
    }

    res.json({
      success: true,
      message: 'Sync execution log retrieved',
      data: log,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  })
);

export default router;
