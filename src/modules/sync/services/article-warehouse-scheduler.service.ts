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

      logger.info('[ArticleWarehouseScheduler] Starting sync', {
        syncConfigurationId,
        organizationId,
        providerConfigId
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

      // Fetch article warehouse data from SQL Server (all warehouses, we'll filter by hash)
      const result = await SQLService.getArticleWarehouse(organizationId, {
        page: 1,
        limit: 50000 // Large limit to get all
        // No warehouseCode filter - get ALL warehouses
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

      // Process in batches of 1000 records (API limit)
      const BATCH_SIZE = 1000;
      let totalSent = 0;
      let totalLoaded = 0;
      const client = new Typs4YouClient(providerConfigId);

      logger.info('[ArticleWarehouseScheduler] Processing in batches', {
        totalRecords: recordsToSync.length,
        batchSize: BATCH_SIZE,
        batches: Math.ceil(recordsToSync.length / BATCH_SIZE)
      });

      for (let i = 0; i < recordsToSync.length; i += BATCH_SIZE) {
        const batch = recordsToSync.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(recordsToSync.length / BATCH_SIZE);

        logger.info(`[ArticleWarehouseScheduler] Processing batch ${batchNumber}/${totalBatches}`, {
          records: batch.length
        });

        try {
          // Build CSV with semicolon separator
          const csvRows: string[] = [];
          for (const record of batch) {
            // Sanitize PartNumber: remove extra spaces and trim
            const sanitizedPartNumber = String(record.PartNumber || '')
              .replace(/\s+/g, ' ') // Replace multiple spaces with single space
              .trim();

            const row = [
              record.BrandId || '',
              sanitizedPartNumber,
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

          // Upload batch to TypsForYou
          const apiResponse = await client.uploadArticleWarehouseCsv(csv);
          const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
          const loadedRecords = apiResponse.LoadedRecords || 0;

          totalSent += batch.length;
          totalLoaded += loadedRecords;

          logger.info(`[ArticleWarehouseScheduler] Batch ${batchNumber}/${totalBatches} completed`, {
            sent: batch.length,
            loaded: loadedRecords,
            success,
            exitCode: apiResponse.ExitCode
          });

          if (!success) {
            const errors = apiResponse.DataErrorsFound || [];
            logger.error(`[ArticleWarehouseScheduler] Batch ${batchNumber} had errors`, {
              exitCode: apiResponse.ExitCode,
              loaded: loadedRecords,
              errors: errors.slice(0, 3)
            });
            // Continue processing next batch instead of stopping
          }
        } catch (batchError) {
          logger.error(`[ArticleWarehouseScheduler] Batch ${batchNumber} failed`, {
            error: batchError instanceof Error ? batchError.message : String(batchError)
          });
          // Continue processing next batch
        }
      }

      // Update cache for all processed records (regardless of API success)
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

      // Update sync configuration
      await prisma.syncConfiguration.update({
        where: { id: syncConfigurationId },
        data: { lastSuccessAt: new Date() }
      });

      // Update execution log
      const executionStatus = totalLoaded > 0 ? 'SUCCESS' : 'PARTIAL';

      await prisma.syncExecutionLog.update({
        where: { id: logId },
        data: {
          status: executionStatus,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          totalFetched: result.data.length,
          totalProcessed: totalSent,
          totalSucceeded: totalLoaded,
          totalFailed: totalSent - totalLoaded,
          metadata: {
            incrementalSync: true,
            cacheSize: cacheMap.size,
            changedRecords: recordsToSync.length,
            batchesProcessed: Math.ceil(recordsToSync.length / BATCH_SIZE),
            totalSent,
            totalLoaded
          }
        }
      });

      // Send email notification
      if (totalSent > 0 && totalLoaded > 0) {
        try {
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0 && notificationEmails[0]) {
            await emailService.sendArticleWarehouseSyncedEmail(
              notificationEmails[0],
              {
                totalRecords: result.data.length,
                changedRecords: totalSent,
                loadedRecords: totalLoaded,
                warehouseCode: 'ALL',
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

      return { success: true, sent: totalSent, loadedRecords: totalLoaded };

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
