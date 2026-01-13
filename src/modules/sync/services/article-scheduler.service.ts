import prisma from '@config/database';
import logger from '@config/logger';
import { ArticleSyncService } from './article-sync.service';
import { ErrorNotificationService } from '@services/error-notification.service';

/**
 * Article Scheduler Service
 * Handles automatic sync of articles to TypsForYou with execution logging
 * This service wraps ArticleSyncService to provide execution tracking
 */
export class ArticleSchedulerService {
  /**
   * Sync articles to TypsForYou automatically with execution logging
   * This is called by the cron scheduler
   */
  static async syncArticles(syncConfigurationId: string): Promise<{
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

      logger.info('[ArticleScheduler] Starting sync', {
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
          syncType: 'ARTICLES',
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      logId = executionLog.id;

      // Execute the sync
      const result = await ArticleSyncService.sendArticlesToTypsForYou(
        organizationId,
        providerConfigId,
        {
          ...(syncConfig.options as Record<string, any> || {}),
          syncConfigId: syncConfigurationId
        }
      );

      // Extract error details
      const errors = (result.apiResponse?.DataErrorsFound || []) as Array<{ Error_Message?: string }>;
      const invalidBrandIds = errors
        .map((err) => {
          const match = err.Error_Message?.match(/BrandID.*?(\d+)/);
          return match && match[1] ? parseInt(match[1]) : null;
        })
        .filter((id): id is number => id !== null);

      // Update execution log with success
      await prisma.syncExecutionLog.update({
        where: { id: logId },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration: Date.now() - startTime,
          totalFetched: result.sent,
          totalProcessed: result.sent,
          totalSucceeded: result.loadedRecords,
          totalFailed: result.sent - result.loadedRecords,
          totalSkipped: 0,
          metadata: {
            exitCode: result.apiResponse?.ExitCode || null,
            errors: errors,
            invalidBrandIds: invalidBrandIds,
            errorSummary: invalidBrandIds.length > 0 
              ? `${invalidBrandIds.length} BrandIDs inválidos: ${invalidBrandIds.join(', ')}`
              : null,
            completed: result.completed || false,
            checkpoint: result.lastProcessedId || null
          } as any
        }
      });

      logger.info('[ArticleScheduler] Sync completed successfully', {
        sent: result.sent,
        loadedRecords: result.loadedRecords,
        failed: result.sent - result.loadedRecords,
        invalidBrandIds: invalidBrandIds.length > 0 ? invalidBrandIds : undefined
      });

      // Log errors to error notification system if there were failures
      if (invalidBrandIds.length > 0 || errors.length > 0) {
        logger.warn('[ArticleScheduler] Articles rejected due to errors', {
          brandIds: invalidBrandIds,
          count: result.sent - result.loadedRecords,
          totalErrors: errors.length
        });

        // Extract InternalPartNumbers from error messages if available
        const failedPartNumbers = errors
          .map((err) => {
            // Try to extract part number from error message
            const match = err.Error_Message?.match(/PartNumber[:\s]+([A-Z0-9-]+)/i);
            return match ? match[1] : null;
          })
          .filter((pn): pn is string => pn !== null)
          .slice(0, 20); // Limit to 20

        // Send error notification with article details
        await ErrorNotificationService.sendErrorNotification({
          context: 'articles',
          organizationId,
          errorMessage: `Articles sync completed with ${result.sent - result.loadedRecords} failures out of ${result.sent} sent`,
          errorDetails: {
            sent: result.sent,
            loaded: result.loadedRecords,
            failed: result.sent - result.loadedRecords,
            failureRate: `${((result.sent - result.loadedRecords) / result.sent * 100).toFixed(2)}%`,
            invalidBrandIds: invalidBrandIds,
            errorSummary: errors.slice(0, 10), // First 10 errors
            failedPartNumbers: failedPartNumbers.length > 0 ? failedPartNumbers : undefined
          },
          stackTrace: null,
          metadata: {
            syncConfigurationId,
            providerConfigId,
            executionLogId: logId,
            exitCode: result.apiResponse?.ExitCode
          }
        });
      }

      return {
        success: true,
        sent: result.sent,
        loadedRecords: result.loadedRecords
      };

    } catch (error: any) {
      logger.error('[ArticleScheduler] Sync failed:', error);

      // Update execution log with failure
      if (logId) {
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            duration: Date.now() - startTime,
            errorMessage: error.message,
            errorStack: error.stack
          }
        });
      }

      // Send error notification for critical failure
      await ErrorNotificationService.sendErrorNotification({
        context: 'articles',
        organizationId: syncConfig?.organizationId || 'unknown',
        errorMessage: `Articles sync failed: ${error.message}`,
        errorDetails: {
          syncConfigurationId,
          errorType: error.name || 'Error',
          errorCode: error.code
        },
        stackTrace: error.stack,
        metadata: {
          syncConfigurationId,
          executionLogId: logId
        }
      });

      throw error;
    }
  }
}
