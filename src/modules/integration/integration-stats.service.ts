import prisma from '@config/database';
import { SyncJobStatus, SyncType } from '@prisma/client';

export class IntegrationStatsService {
  /**
   * Get overview statistics
   */
  static async getOverview(organizationId: string) {
    const [configs, jobs, errors] = await Promise.all([
      // Sync configurations
      prisma.syncConfiguration.findMany({
        where: { organizationId },
        select: {
          enabled: true,
          lastSuccessAt: true,
          lastSyncAt: true,
          intervalSeconds: true
        }
      }),
      // Recent jobs (last 24h)
      prisma.syncJob.findMany({
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        select: {
          status: true,
          successRecords: true,
          errorRecords: true
        }
      }),
      // Today's errors
      prisma.syncErrorLog.count({
        where: {
          organizationId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      })
    ]);

    const totalSyncs = configs.length;
    const activeSyncs = configs.filter(c => c.enabled).length;
    const inactiveSyncs = totalSyncs - activeSyncs;

    // Last successful sync
    const lastSuccessfulSync = configs
      .map(c => c.lastSuccessAt)
      .filter(d => d)
      .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];

    // Calculate next scheduled sync
    const nextScheduledSync = this.calculateNextScheduledSync(configs);

    // Success rate
    const completedJobs = jobs.filter(j => j.status === SyncJobStatus.COMPLETED);
    const failedJobs = jobs.filter(j => j.status === SyncJobStatus.FAILED);
    const overallSuccessRate = jobs.length > 0 
      ? (completedJobs.length / jobs.length) * 100 
      : 0;

    // Total records synced
    const totalRecordsSynced = completedJobs.reduce((sum, j) => sum + j.successRecords, 0);
    const totalRecordsSyncedToday = jobs
      .filter(j => j.status === SyncJobStatus.COMPLETED)
      .reduce((sum, j) => sum + j.successRecords, 0);

    return {
      totalSyncs,
      activeSyncs,
      inactiveSyncs,
      lastSuccessfulSync,
      nextScheduledSync,
      overallSuccessRate: Math.round(overallSuccessRate * 10) / 10,
      totalRecordsSynced,
      totalRecordsSyncedToday
    };
  }

  /**
   * Get real-time sync status
   */
  static async getRealtime(organizationId: string) {
    const runningJobs = await prisma.syncJob.findMany({
      where: {
        organizationId,
        status: { in: [SyncJobStatus.PENDING, SyncJobStatus.PROCESSING] }
      },
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        estimatedTimeRemaining: true,
        totalRecords: true,
        successRecords: true,
        errorRecords: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const syncsRunning = runningJobs.filter(j => j.status === SyncJobStatus.PROCESSING).length;
    const syncsPending = runningJobs.filter(j => j.status === SyncJobStatus.PENDING).length;

    const currentJobs = runningJobs.map(job => ({
      type: job.type,
      status: job.status,
      progress: Math.round(job.progress * 10) / 10,
      estimatedTimeRemaining: job.estimatedTimeRemaining,
      processedRecords: job.successRecords + job.errorRecords,
      totalRecords: job.totalRecords
    }));

    return {
      syncsRunning,
      syncsPending,
      currentJobs
    };
  }

  /**
   * Get statistics by sync type
   */
  static async getByType(organizationId: string) {
    const configs = await prisma.syncConfiguration.findMany({
      where: { organizationId }
    });

    const stats: any = {};

    for (const config of configs) {
      const [jobs, errorCount] = await Promise.all([
        prisma.syncJob.findMany({
          where: {
            organizationId,
            type: config.syncType as any
          },
          select: {
            status: true,
            successRecords: true,
            startedAt: true,
            completedAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        }),
        prisma.syncErrorLog.count({
          where: {
            organizationId,
            entityType: config.syncType
          }
        })
      ]);

      const completedJobs = jobs.filter(j => j.status === SyncJobStatus.COMPLETED);
      const totalJobs = jobs.length;
      const successRate = totalJobs > 0 ? (completedJobs.length / totalJobs) * 100 : 0;

      // Calculate average execution time
      const executionTimes = completedJobs
        .filter(j => j.startedAt && j.completedAt)
        .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 1000);
      
      const avgExecutionTime = executionTimes.length > 0
        ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
        : 0;

      const totalSynced = completedJobs.reduce((sum, j) => sum + j.successRecords, 0);

      // Get today's new records for CUSTOMERS
      let newToday = undefined;
      if (config.syncType === 'CUSTOMERS') {
        const todayJobs = jobs.filter(j => 
          j.completedAt && 
          j.completedAt >= new Date(new Date().setHours(0, 0, 0, 0))
        );
        newToday = todayJobs.reduce((sum, j) => sum + j.successRecords, 0);
      }

      // Get pending orders for ORDERS type
      let pending = undefined;
      if (config.syncType === 'ORDERS') {
        pending = await prisma.dataDriveIntegration.count({
          where: {
            organizationId,
            integratedAt: null
          }
        });
      }

      stats[config.syncType] = {
        totalSynced,
        lastSync: config.lastSyncAt,
        successRate: Math.round(successRate * 10) / 10,
        errors: errorCount,
        avgExecutionTime,
        ...(newToday !== undefined && { newToday }),
        ...(pending !== undefined && { pending })
      };
    }

    return stats;
  }

  /**
   * Get error statistics
   */
  static async getErrors(organizationId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [errors24h, errors7days, errors30days, allErrors] = await Promise.all([
      prisma.syncErrorLog.count({
        where: { organizationId, createdAt: { gte: last24h } }
      }),
      prisma.syncErrorLog.count({
        where: { organizationId, createdAt: { gte: last7days } }
      }),
      prisma.syncErrorLog.count({
        where: { organizationId, createdAt: { gte: last30days } }
      }),
      prisma.syncErrorLog.findMany({
        where: { organizationId },
        select: {
          operation: true,
          errorMessage: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 500
      })
    ]);

    // Group by operation
    const byOperation: any = {};
    allErrors.forEach(error => {
      byOperation[error.operation] = (byOperation[error.operation] || 0) + 1;
    });

    // Top errors by message
    const errorMessageCounts: any = {};
    allErrors.forEach(error => {
      const msg = error.errorMessage.substring(0, 100); // Truncate for grouping
      if (!errorMessageCounts[msg]) {
        errorMessageCounts[msg] = { count: 0, lastOccurred: error.createdAt };
      }
      errorMessageCounts[msg].count++;
      if (error.createdAt > errorMessageCounts[msg].lastOccurred) {
        errorMessageCounts[msg].lastOccurred = error.createdAt;
      }
    });

    const topErrors = Object.entries(errorMessageCounts)
      .map(([errorMessage, data]: [string, any]) => ({
        errorMessage,
        count: data.count,
        lastOccurred: data.lastOccurred
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      last24h: errors24h,
      last7days: errors7days,
      last30days: errors30days,
      byOperation,
      topErrors
    };
  }

  /**
   * Get performance metrics
   */
  static async getPerformance(organizationId: string) {
    const jobs = await prisma.syncJob.findMany({
      where: {
        organizationId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      select: {
        status: true,
        startedAt: true,
        completedAt: true
      }
    });

    const totalRequests = jobs.length;
    const successfulRequests = jobs.filter(j => j.status === SyncJobStatus.COMPLETED).length;
    const failedRequests = jobs.filter(j => j.status === SyncJobStatus.FAILED).length;

    // Calculate average execution time
    const executionTimes = jobs
      .filter(j => j.startedAt && j.completedAt)
      .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 1000);
    
    const avgExecutionTime = executionTimes.length > 0
      ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
      : 0;

    // Calculate uptime (percentage of successful jobs)
    const uptime = totalRequests > 0 
      ? Math.round((successfulRequests / totalRequests) * 1000) / 10 
      : 100;

    // Average response time (simulated - could be enhanced with actual API metrics)
    const avgResponseTime = Math.round(avgExecutionTime * 35); // Convert to ms

    return {
      avgResponseTime,
      uptime,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgExecutionTime
    };
  }

  /**
   * Get trends over time
   */
  static async getTrends(organizationId: string, days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [jobs, errors] = await Promise.all([
      prisma.syncJob.findMany({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        },
        select: {
          status: true,
          successRecords: true,
          createdAt: true
        }
      }),
      prisma.syncErrorLog.findMany({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        },
        select: {
          createdAt: true
        }
      })
    ]);

    // Group by day
    const syncsByDay: any = {};
    const recordsByDay: any = {};
    const errorsByDay: any = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      syncsByDay[dateStr] = { total: 0, success: 0, failed: 0 };
      recordsByDay[dateStr] = 0;
      errorsByDay[dateStr] = 0;
    }

    // Populate data
    jobs.forEach(job => {
      const dateStr = job.createdAt.toISOString().split('T')[0];
      if (syncsByDay[dateStr]) {
        syncsByDay[dateStr].total++;
        if (job.status === SyncJobStatus.COMPLETED) {
          syncsByDay[dateStr].success++;
          recordsByDay[dateStr] += job.successRecords;
        } else if (job.status === SyncJobStatus.FAILED) {
          syncsByDay[dateStr].failed++;
        }
      }
    });

    errors.forEach(error => {
      const dateStr = error.createdAt.toISOString().split('T')[0];
      if (errorsByDay[dateStr]) {
        errorsByDay[dateStr]++;
      }
    });

    return {
      syncsByDay: Object.entries(syncsByDay).map(([date, data]: [string, any]) => ({
        date,
        total: data.total,
        success: data.success,
        failed: data.failed
      })),
      recordsByDay: Object.entries(recordsByDay).map(([date, records]) => ({
        date,
        records
      })),
      errorTrend: Object.entries(errorsByDay).map(([date, errors]) => ({
        date,
        errors
      }))
    };
  }

  /**
   * Get schedule information
   */
  static async getSchedule(organizationId: string) {
    const configs = await prisma.syncConfiguration.findMany({
      where: { 
        organizationId,
        enabled: true 
      },
      select: {
        syncType: true,
        intervalSeconds: true,
        enabled: true,
        lastSyncAt: true
      },
      orderBy: { syncType: 'asc' }
    });

    const upcomingSyncs = configs.map(config => {
      const nextRun = this.calculateNextRun(config.lastSyncAt, config.intervalSeconds);
      return {
        syncType: config.syncType,
        nextRun,
        intervalSeconds: config.intervalSeconds,
        enabled: config.enabled
      };
    }).sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime());

    return { upcomingSyncs };
  }

  /**
   * Helper: Calculate next scheduled sync
   */
  private static calculateNextScheduledSync(configs: any[]): Date | null {
    const enabledConfigs = configs.filter(c => c.enabled && c.lastSyncAt);
    if (enabledConfigs.length === 0) return null;

    const nextRuns = enabledConfigs.map(config => 
      this.calculateNextRun(config.lastSyncAt, config.intervalSeconds)
    );

    return nextRuns.sort((a, b) => a.getTime() - b.getTime())[0];
  }

  /**
   * Helper: Calculate next run time
   */
  private static calculateNextRun(lastSyncAt: Date | null, intervalSeconds: number): Date {
    if (!lastSyncAt) {
      return new Date(); // Run now if never synced
    }
    return new Date(lastSyncAt.getTime() + intervalSeconds * 1000);
  }
}
