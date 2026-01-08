import { DiscountGroupSyncService } from './discount-group-sync.service';
import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import { AppError } from '@utils/errors';
import emailService from '@utils/email';
import { config } from '@config/index';
import prisma from '@config/database';
import logger from '@config/logger';

/**
 * Discount Group Scheduler Service
 * Handles automatic sync of discount groups to TypsForYou on scheduled intervals
 */
export class DiscountGroupSchedulerService {
  /**
   * Sync discount groups to TypsForYou automatically (incremental sync)
   * This is called by the cron scheduler
   */
  static async syncDiscountGroups(syncConfigurationId: string): Promise<{
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

      logger.info('[DiscountGroupScheduler] Starting automatic discount groups sync', {
        syncConfigurationId,
        organizationId,
        providerConfigId
      });

      // Create execution log entry
      const executionLog = await prisma.syncExecutionLog.create({
        data: {
          syncConfigurationId,
          organizationId,
          providerConfigId,
          syncType: 'DISCOUNT_GROUPS',
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      logId = executionLog.id;

      // Get last successful sync date for incremental sync
      const lastSyncDate = syncConfig.lastSuccessAt || undefined;

      logger.info('[DiscountGroupScheduler] Sync mode', {
        mode: lastSyncDate ? 'incremental' : 'full',
        lastSyncDate: lastSyncDate?.toISOString()
      });

      // Fetch discount groups from SQL Server (only changed since last sync)
      const result = await SQLService.getArticleDiscountGroups(organizationId, {
        page: 1,
        limit: 10000,
        changedSince: lastSyncDate // Incremental sync: only get changed records
      });

      // If no changes, return early
      if (!result.data || result.data.length === 0) {
        logger.info('[DiscountGroupScheduler] No changes detected, skipping sync');
        
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

        return {
          success: true,
          sent: 0,
          loadedRecords: 0
        };
      }

      // Build CSV with semicolon separator (no header, no quotes)
      const csvRows: string[] = [];
      for (const group of result.data) {
        const row = [
          group.ArticleDiscountGroupCode || '',
          group.DiscountGroupName || '',
          group.Tag || '',
          group.ReservedForFutureUse || ''
        ];

        const csvLine = row.map(field => 
          String(field).replace(/[\r\n]/g, ' ').trim()
        ).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');
      const count = csvRows.length;

      logger.info('[DiscountGroupScheduler] Generated CSV', {
        count,
        sample: csvRows[0]
      });

      // Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountGroupsCsv(csv);

      // Parse response
      const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
      const loadedRecords = apiResponse.LoadedRecords || 0;
      const errors = apiResponse.DataErrorsFound || [];

      logger.info('[DiscountGroupScheduler] Discount groups synced', {
        sent: count,
        loadedRecords,
        success,
        exitCode: apiResponse.ExitCode
      });

      // Update log with success results
      const executionStatus = success ? 'SUCCESS' : 'FAILED';

      await prisma.syncExecutionLog.update({
        where: { id: logId },
        data: {
          status: executionStatus,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          totalFetched: count,
          totalProcessed: count,
          totalSucceeded: loadedRecords,
          totalFailed: count - loadedRecords,
          metadata: {
            apiResponse,
            errors,
            incrementalSync: !!lastSyncDate,
            lastSyncDate: lastSyncDate?.toISOString()
          }
        }
      });

      // Send email notification if discount groups were synced
      if (count > 0 && success) {
        try {
          const notificationEmails = config.email.orderNotificationEmails; // Reusa o mesmo config
          
          if (notificationEmails && notificationEmails.length > 0) {
            // Get sample of synced groups (first 10)
            const groupsDetails = result.data.slice(0, 10).map((group: any) => ({
              code: group.ArticleDiscountGroupCode,
              name: group.DiscountGroupName,
              tag: group.Tag || 'N/A',
              created: group.DataCriacao ? new Date(group.DataCriacao).toLocaleDateString('pt-PT') : 'N/A',
              modified: group.DataAlteracao ? new Date(group.DataAlteracao).toLocaleDateString('pt-PT') : 'N/A'
            }));

            await emailService.sendDiscountGroupsSyncedEmail(notificationEmails, {
              totalGroups: count,
              loadedGroups: loadedRecords,
              failedGroups: count - loadedRecords,
              syncMode: lastSyncDate ? 'incremental' : 'full',
              organizationName: 'CSW Markets',
              groups: groupsDetails,
              duration: Math.round((Date.now() - startTime) / 1000)
            });

            logger.info('[DiscountGroupScheduler] Email notification sent');
          }
        } catch (emailError) {
          logger.error('[DiscountGroupScheduler] Failed to send email notification', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }

      // Update sync configuration with last success
      if (success) {
        await prisma.syncConfiguration.update({
          where: { id: syncConfigurationId },
          data: {
            lastSuccessAt: new Date()
          }
        });
      }

      return {
        success,
        sent: count,
        loadedRecords
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[DiscountGroupScheduler] Failed to sync discount groups', {
        syncConfigurationId,
        error: errorMessage
      });

      // Update log as failed
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
