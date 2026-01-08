import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import emailService from '@utils/email';
import prisma from '@config/database';
import logger from '@config/logger';
import { config } from '@config/index';
import crypto from 'crypto';

/**
 * Article Warehouse Scheduler Service
 * Handles automatic sync of article warehouse data to TypsForYou with hash-based change detection
 */
export class ArticleWarehouseSchedulerService {
  /**
   * Calculate MD5 hash of article warehouse record for change detection
   */
  private static calculateHash(record: Record<string, any>): string {
    const data = `${record.BrandId}|${record.PartNumber}|${record.WareHouseCode}|${record.ArticleQuantity}|${record.ArticlePrice1}|${record.ArticlePrice2}|${record.ArticlePrice3}|${record.ArticlePrice4}|${record.ArticlePrice5}|${record.ArticleEcoTax}|${record.ArticleCurrency}|${record.Tag}|${record.ReservedForFutureUse}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Sync article warehouse to TypsForYou automatically (incremental sync with hash comparison)
   * This is called by the cron scheduler
   */
  static async syncArticleWarehouse(syncConfigurationId: string): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
  }> {
    const startTime = Date.now();
    let logId: string | undefined;

    try {
      // Get sync configuration
      const syncConfig = await prisma.syncConfiguration.findUnique({
        where: { id: syncConfigurationId },
        include: {
          organization: true,
          providerConfig: true
        }
      });

      if (!syncConfig) {
        throw new Error(`Sync configuration not found: ${syncConfigurationId}`);
      }

      const organizationId = syncConfig.organizationId;
      const providerConfigId = syncConfig.providerConfigId;
      const warehouseCode = (syncConfig.options as Record<string, any>)?.warehouseCode || '1';

      logger.info('[ArticleWarehouseScheduler] Starting sync', {
        syncConfigurationId,
        organizationId,
        providerConfigId,
        warehouseCode
      });

      // Create execution log
      const executionLog = await prisma.syncExecutionLog.create({
        data: {
          syncConfigurationId,
          organizationId,
          providerConfigId,
          syncType: 'ARTICLE_WAREHOUSE',
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      logId = executionLog.id;

      // Fetch article warehouse data from SQL Server (all records, we'll filter by hash)
      const result = await SQLService.getArticleWarehouse(organizationId, {
        page: 1,
        limit: 50000, // Large limit to get all
        warehouseCode
      });

      if (!result.data || result.data.length === 0) {
        logger.info('[ArticleWarehouseScheduler] No records found');
        
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            duration: Date.now() - startTime,
            totalFetched: 0,
            totalProcessed: 0,
            totalSucceeded: 0,
            totalFailed: 0
          }
        });

        return { success: true, sent: 0, loadedRecords: 0 };
      }

      logger.info('[ArticleWarehouseScheduler] Fetched records from SQL', { count: result.data.length });

      // Get existing cache for this organization
      const existingCache = await prisma.articleWarehouseSyncCache.findMany({
        where: { organizationId },
        select: {
          brandId: true,
          partNumber: true,
          warehouseCode: true,
          dataHash: true
        }
      });

      // Build cache map for quick lookup
      const cacheMap = new Map<string, string>();
      existingCache.forEach(item => {
        const key = `${item.brandId}|${item.partNumber}|${item.warehouseCode}`;
        cacheMap.set(key, item.dataHash);
      });

      logger.info('[ArticleWarehouseScheduler] Loaded cache', { cacheSize: cacheMap.size });

      // Filter records that have changed or are new
      const recordsToSync: Record<string, any>[] = [];
      const cacheUpdates: Array<{
        organizationId: string;
        brandId: string;
        partNumber: string;
        warehouseCode: string;
        dataHash: string;
        lastSyncedAt: Date;
      }> = [];

      for (const record of result.data) {
        const key = `${record.BrandId}|${record.PartNumber}|${record.WareHouseCode}`;
        const currentHash = this.calculateHash(record);
        const cachedHash = cacheMap.get(key);

        if (cachedHash !== currentHash) {
          // Record is new or changed
          recordsToSync.push(record);
          cacheUpdates.push({
            organizationId,
            brandId: record.BrandId,
            partNumber: record.PartNumber,
            warehouseCode: record.WareHouseCode,
            dataHash: currentHash,
            lastSyncedAt: new Date()
          });
        }
      }

      logger.info('[ArticleWarehouseScheduler] Detected changes', {
        total: result.data.length,
        changed: recordsToSync.length,
        percentage: ((recordsToSync.length / result.data.length) * 100).toFixed(2) + '%'
      });

      // If no changes, skip sync
      if (recordsToSync.length === 0) {
        logger.info('[ArticleWarehouseScheduler] No changes detected, skipping sync');
        
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            duration: Date.now() - startTime,
            totalFetched: result.data.length,
            totalProcessed: 0,
            totalSucceeded: 0,
            totalFailed: 0,
            metadata: {
              cached: result.data.length,
              incrementalSync: true
            }
          }
        });

        return { success: true, sent: 0, loadedRecords: 0 };
      }

      // Build CSV with semicolon separator
      const csvRows: string[] = [];
      for (const record of recordsToSync) {
        const row = [
          record.BrandId || '',
          record.PartNumber || '',
          record.WareHouseCode || '',
          record.ArticleQuantity || '0',
          record.ArticlePrice1 || '0',
          record.ArticlePrice2 || '0',
          record.ArticlePrice3 || '0',
          record.ArticlePrice4 || '0',
          record.ArticlePrice5 || '0',
          record.ArticleEcoTax || '0',
          record.ArticleCurrency || 'EUR',
          record.Tag || '',
          record.ReservedForFutureUse || ''
        ];

        const csvLine = row.map(field => 
          String(field).replace(/[\r\n]/g, ' ').trim()
        ).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');
      const count = csvRows.length;

      logger.info('[ArticleWarehouseScheduler] Generated CSV', { count, sample: csvRows[0] });

      // Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadArticleWarehouseCsv(csv);

      const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
      const loadedRecords = apiResponse.LoadedRecords || 0;
      const errors = apiResponse.DataErrorsFound || [];

      logger.info('[ArticleWarehouseScheduler] Upload completed', {
        sent: count,
        loadedRecords,
        success,
        exitCode: apiResponse.ExitCode
      });

      // Update cache for successfully synced records
      if (success && cacheUpdates.length > 0) {
        logger.info('[ArticleWarehouseScheduler] Updating cache', { updates: cacheUpdates.length });
        
        for (const update of cacheUpdates) {
          await prisma.articleWarehouseSyncCache.upsert({
            where: {
              organizationId_brandId_partNumber_warehouseCode: {
                organizationId: update.organizationId,
                brandId: update.brandId,
                partNumber: update.partNumber,
                warehouseCode: update.warehouseCode
              }
            },
            update: {
              dataHash: update.dataHash,
              lastSyncedAt: update.lastSyncedAt
            },
            create: update
          });
        }
      }

      // Update sync configuration
      if (success) {
        await prisma.syncConfiguration.update({
          where: { id: syncConfigurationId },
          data: { lastSuccessAt: new Date() }
        });
      }

      // Update execution log
      const executionStatus = success ? 'SUCCESS' : 'FAILED';

      await prisma.syncExecutionLog.update({
        where: { id: logId },
        data: {
          status: executionStatus,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          totalFetched: result.data.length,
          totalProcessed: count,
          totalSucceeded: loadedRecords,
          totalFailed: count - loadedRecords,
          metadata: {
            apiResponse,
            errors,
            incrementalSync: true,
            cacheSize: cacheMap.size,
            changedRecords: count
          }
        }
      });

      // Send email notification
      if (count > 0 && success) {
        try {
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0 && notificationEmails[0]) {
            await emailService.sendArticleWarehouseSyncedEmail(
              notificationEmails[0],
              {
                totalRecords: result.data.length,
                changedRecords: count,
                loadedRecords,
                warehouseCode,
                syncMode: 'INCREMENTAL'
              }
            );

            logger.info('[ArticleWarehouseScheduler] Email notification sent');
          }
        } catch (emailError) {
          logger.error('[ArticleWarehouseScheduler] Failed to send email', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }

      return { success, sent: count, loadedRecords };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[ArticleWarehouseScheduler] Sync failed', {
        syncConfigurationId,
        error: errorMessage
      });

      if (logId) {
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration: Date.now() - startTime,
            errorMessage,
            errorStack
          }
        });
      }

      throw error;
    }
  }
}
