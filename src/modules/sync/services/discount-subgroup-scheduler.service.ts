import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import emailService from '@utils/email';
import prisma from '@config/database';
import logger from '@config/logger';
import { config } from '@config/index';
import { ErrorNotificationService } from '@services/error-notification.service';

/**
 * Discount Sub-Group Scheduler Service
 * Handles automatic sync of discount sub-groups to TypsForYou on scheduled intervals
 */
export class DiscountSubGroupSchedulerService {
  /**
   * Sync discount sub-groups to TypsForYou automatically (incremental sync)
   * This is called by the cron scheduler
   */
  static async syncDiscountSubGroups(syncConfigurationId: string) {
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

      logger.info('[DiscountSubGroupScheduler] Starting sync', {
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
          syncType: 'DISCOUNT_SUBGROUPS',
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      logId = executionLog.id;

      // Get last successful sync date for incremental sync
      const lastSyncDate = syncConfig.lastSuccessAt || undefined;

      logger.info('[DiscountSubGroupScheduler] Sync mode', {
        mode: lastSyncDate ? 'incremental' : 'full',
        lastSyncDate: lastSyncDate?.toISOString()
      });

      // Fetch discount sub-groups from SQL Server (only changed since last sync)
      const result = await SQLService.getArticleDiscountSubGroups(organizationId, {
        page: 1,
        limit: 10000,
        changedSince: lastSyncDate
      });

      // If no changes, return early
      if (!result.data || result.data.length === 0) {
        logger.info('[DiscountSubGroupScheduler] No changes detected, skipping sync');
        
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
      for (const subGroup of result.data) {
        const row = [
          subGroup.ArticleDiscountGroupCode || '',
          subGroup.DiscountSubGroupCode || '',
          subGroup.DiscountSubGroupName || '',
          subGroup.Tag || ''
        ];

        const csvLine = row.map(field => 
          String(field).replace(/[\r\n]/g, ' ').trim()
        ).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');
      const count = csvRows.length;

      logger.info('[DiscountSubGroupScheduler] Generated CSV', {
        count,
        sample: csvRows[0]
      });

      // Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountSubGroupsCsv(csv);

      // Parse response
      const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
      const loadedRecords = apiResponse.LoadedRecords || 0;
      const errors = apiResponse.DataErrorsFound || [];

      logger.info('[DiscountSubGroupScheduler] Discount sub-groups synced', {
        sent: count,
        loadedRecords,
        success,
        exitCode: apiResponse.ExitCode
      });

      // Send error notification if there were failures
      if (!success || errors.length > 0) {
        const failedCodes = errors
          .map((err: any) => {
            const match = err.Error_Message?.match(/DiscountSubGroupCode[:\s]+([A-Z0-9-]+)/i);
            return match ? match[1] : null;
          })
          .filter((code: any): code is string => code !== null)
          .slice(0, 20);

        await ErrorNotificationService.sendErrorNotification({
          context: 'discountSubGroup',
          organizationId,
          errorMessage: `Discount sub-groups sync completed with ${count - loadedRecords} failures out of ${count} sent`,
          errorDetails: {
            sent: count,
            loaded: loadedRecords,
            failed: count - loadedRecords,
            failureRate: `${((count - loadedRecords) / count * 100).toFixed(2)}%`,
            exitCode: apiResponse.ExitCode,
            errors: errors.slice(0, 10),
            failedCodes
          },
          stackTrace: null,
          metadata: {
            syncConfigurationId,
            providerConfigId,
            executionLogId: logId
          }
        });
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

      // Send email notification if discount sub-groups were synced
      if (count > 0 && success) {
        try {
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0 && notificationEmails[0]) {
            // Build data for email
            const csvData = result.data.map((subGroup) => ({
              'Discount Group Code': subGroup.ArticleDiscountGroupCode,
              'Discount Sub-Group Code': subGroup.DiscountSubGroupCode,
              'Discount Sub-Group Name': subGroup.DiscountSubGroupName,
              Tag: subGroup.Tag || ''
            }));

            await emailService.sendDiscountSubGroupsSyncedEmail(
              notificationEmails[0],
              csvData,
              lastSyncDate ? 'INCREMENTAL' : 'FULL'
            );

            logger.info('[DiscountSubGroupScheduler] Email notification sent');
          }
        } catch (emailError) {
          logger.error('[DiscountSubGroupScheduler] Failed to send email notification', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }

      return {
        success,
        sent: count,
        loadedRecords
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[DiscountSubGroupScheduler] Failed to sync discount sub-groups', {
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

      // Send critical error notification
      const syncConfig = await prisma.syncConfiguration.findUnique({
        where: { id: syncConfigurationId }
      });

      await ErrorNotificationService.sendErrorNotification({
        context: 'discountSubGroup',
        organizationId: syncConfig?.organizationId || 'unknown',
        errorMessage: `Discount sub-groups sync failed critically: ${errorMessage}`,
        errorDetails: {
          syncConfigurationId,
          errorType: error instanceof Error ? error.name : 'Unknown',
          duration: Date.now() - startTime
        },
        stackTrace: errorStack,
        metadata: {
          syncConfigurationId,
          executionLogId: logId
        }
      });

      throw error;
    }
  }
}
