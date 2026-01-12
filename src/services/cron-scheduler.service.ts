import cron from 'node-cron';
import prisma from '@config/database';
import logger from '@config/logger';
import { DiscountGroupSyncService } from '@modules/sync/services/discount-group-sync.service';
import { DiscountGroupSchedulerService } from '@modules/sync/services/discount-group-scheduler.service';
import { DiscountSubGroupSyncService } from '@modules/sync/services/discount-subgroup-sync.service';
import { DiscountSubGroupSchedulerService } from '@modules/sync/services/discount-subgroup-scheduler.service';
import { ArticleSyncService } from '@modules/sync/services/article-sync.service';
import { ArticleSchedulerService } from '@modules/sync/services/article-scheduler.service';
import { ArticleWarehouseSyncService } from '@modules/sync/services/article-warehouse-sync.service';
import { ArticleWarehouseSchedulerService } from '@modules/sync/services/article-warehouse-scheduler.service';
import { CustomerSyncService } from '@modules/sync/services/customer-sync.service';
import { CustomerDiscountGroupSyncService } from '@modules/sync/services/customer-discount-group-sync.service';
import { CustomerWarehouseSyncService } from '@modules/sync/services/customer-warehouse-sync.service';
import { OrderIntegrationService } from '@modules/sync/services/order-integration.service';
import { OrderSchedulerService } from '@modules/sync/services/order-scheduler.service';
import { SyncType } from '@prisma/client';

/**
 * Cron Scheduler Service
 * Manages all scheduled sync tasks based on SyncConfiguration
 */
export class CronSchedulerService {
  private static instance: CronSchedulerService;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  private constructor() {}

  static getInstance(): CronSchedulerService {
    if (!CronSchedulerService.instance) {
      CronSchedulerService.instance = new CronSchedulerService();
    }
    return CronSchedulerService.instance;
  }

  /**
   * Initialize and start the cron scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[CronScheduler] Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[CronScheduler] Starting...');

    // Load all sync configurations and schedule them
    await this.loadAndScheduleAll();

    // Check for configuration changes every minute
    // DISABLED: This was causing cron tasks to be cancelled and rescheduled every minute
    // which prevented longer-interval tasks (like ARTICLES) from executing
    // this.scheduleConfigRefresh();

    logger.info('[CronScheduler] Started successfully');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    logger.info('[CronScheduler] Stopping all scheduled tasks...');
    
    this.scheduledTasks.forEach((task, key) => {
      task.stop();
      logger.info(`[CronScheduler] Stopped task: ${key}`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;
    
    logger.info('[CronScheduler] Stopped');
  }

  /**
   * Load all sync configurations from database and schedule them
   */
  private async loadAndScheduleAll(): Promise<void> {
    try {
      const configs = await prisma.syncConfiguration.findMany({
        where: { enabled: true },
        include: {
          organization: true,
          providerConfig: true
        }
      });

      logger.info(`[CronScheduler] Found ${configs.length} enabled sync configurations`);

      for (const config of configs) {
        this.scheduleSync(config);
      }
    } catch (error: any) {
      logger.error('[CronScheduler] Failed to load configurations:', error.message);
    }
  }

  /**
   * Schedule a specific sync configuration
   */
  private scheduleSync(config: any): void {
    const taskKey = `${config.organizationId}-${config.providerConfigId}-${config.syncType}`;

    // Stop existing task if any
    if (this.scheduledTasks.has(taskKey)) {
      this.scheduledTasks.get(taskKey)?.stop();
      this.scheduledTasks.delete(taskKey);
    }

    // Convert intervalSeconds to cron expression
    const cronExpression = this.intervalToCron(config.intervalSeconds);

    logger.info(`[CronScheduler] Scheduling ${taskKey} with interval ${config.intervalSeconds}s (${cronExpression})`);

    // Schedule the task
    const task = cron.schedule(cronExpression, async () => {
      await this.executeSyncTask(config);
    });

    this.scheduledTasks.set(taskKey, task);
  }

  /**
   * Execute a sync task
   */
  private async executeSyncTask(config: any): Promise<void> {
    const { id, organizationId, providerConfigId, syncType } = config;

    logger.info(`[CronScheduler] Executing ${syncType} for org ${organizationId}`);

    try {
      // Update lastSyncAt
      await prisma.syncConfiguration.update({
        where: { id },
        data: { lastSyncAt: new Date() }
      });

      let result: any;

      // Execute the appropriate sync service
      switch (syncType) {
        case SyncType.DISCOUNT_GROUPS:
          result = await DiscountGroupSchedulerService.syncDiscountGroups(id);
          break;

        case SyncType.DISCOUNT_SUBGROUPS:
          result = await DiscountSubGroupSchedulerService.syncDiscountSubGroups(id);
          break;

        case SyncType.ARTICLE_WAREHOUSE:
          result = await ArticleWarehouseSchedulerService.syncArticleWarehouse(id);
          break;

        case SyncType.ARTICLES:
          result = await ArticleSchedulerService.syncArticles(id);
          break;

        case SyncType.CUSTOMERS:
          result = await CustomerSyncService.sendCustomersToTypsForYou(
            organizationId,
            providerConfigId,
            config.options || {}
          );
          break;

        case SyncType.CUSTOMER_DISCOUNT_GROUPS:
          result = await CustomerDiscountGroupSyncService.sendCustomerDiscountGroupsToTypsForYou(
            organizationId,
            providerConfigId,
            config.options || {}
          );
          break;

        case SyncType.CUSTOMER_WAREHOUSES:
          result = await CustomerWarehouseSyncService.sendCustomerWarehousesToTypsForYou(
            organizationId,
            providerConfigId,
            config.options || {}
          );
          break;

        case SyncType.ORDERS:
          result = await OrderIntegrationService.sendIntegratedOrdersToTypsForYou(
            organizationId,
            providerConfigId
          );
          break;

        case 'ORDER_FETCH' as any: // New sync type for fetching orders from TypsForYou
          result = await OrderSchedulerService.fetchAndProcessOrders(
            organizationId,
            providerConfigId,
            {
              ...(config.options || {}),
              syncConfigurationId: id
            }
          );
          break;

        default:
          logger.warn(`[CronScheduler] Unknown sync type: ${syncType}`);
          return;
      }

      // Update success status
      await prisma.syncConfiguration.update({
        where: { id },
        data: {
          lastSuccessAt: new Date(),
          lastError: null,
          lastErrorAt: null
        }
      });

      logger.info(`[CronScheduler] ${syncType} completed successfully`, {
        organizationId,
        sent: result.sent || result.loadedRecords
      });

    } catch (error: any) {
      logger.error(`[CronScheduler] ${syncType} failed:`, error.message);

      // Update error status
      await prisma.syncConfiguration.update({
        where: { id },
        data: {
          lastError: error.message,
          lastErrorAt: new Date()
        }
      });
    }
  }

  /**
   * Convert interval in seconds to cron expression
   */
  private intervalToCron(intervalSeconds: number): string {
    // Every X seconds (1-59) - 6 fields with seconds
    if (intervalSeconds < 60) {
      return `*/${intervalSeconds} * * * * *`;
    }

    // Every X minutes - MUST use 6 fields (node-cron requires seconds field)
    if (intervalSeconds < 3600) {
      const minutes = Math.floor(intervalSeconds / 60);
      return `0 */${minutes} * * * *`; // Start at second 0 of every X minutes
    }

    // Every X hours - MUST use 6 fields
    if (intervalSeconds < 86400) {
      const hours = Math.floor(intervalSeconds / 3600);
      return `0 0 */${hours} * * *`; // At second 0, minute 0, of every X hours
    }

    // Daily - 6 fields
    return '0 0 0 * * *'; // At midnight (second 0, minute 0, hour 0)
  }

  /**
   * Schedule periodic refresh of configurations (every minute)
   */
  private scheduleConfigRefresh(): void {
    cron.schedule('*/1 * * * *', async () => {
      logger.debug('[CronScheduler] Checking for configuration updates...');
      await this.loadAndScheduleAll();
    });
  }

  /**
   * Manually trigger a sync
   */
  async triggerSync(organizationId: string, providerConfigId: string, syncType: SyncType): Promise<void> {
    const config = await prisma.syncConfiguration.findUnique({
      where: {
        organizationId_providerConfigId_syncType: {
          organizationId,
          providerConfigId,
          syncType
        }
      }
    });

    if (!config) {
      throw new Error('Sync configuration not found');
    }

    logger.info(`[CronScheduler] Manual trigger for ${syncType}`);
    await this.executeSyncTask(config);
  }
}
