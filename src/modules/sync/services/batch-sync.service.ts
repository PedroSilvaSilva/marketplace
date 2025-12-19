import prisma from '@config/database';
import logger from '@config/logger';
import { SyncJobType, SyncJobStatus } from '@prisma/client';
import { ArticleWarehouseSyncService } from './article-warehouse-sync.service';
import { ArticleSyncService } from './article-sync.service';
import { CsvChunker } from '../utils/csv-chunker';

export class BatchSyncService {
  /**
   * Create a new sync job
   */
  static async createSyncJob(
    organizationId: string,
    providerConfigId: string,
    type: SyncJobType,
    filters?: {
      brandId?: string;
      warehouseCode?: string;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    batchSize: number = 1000
  ) {
    logger.info('Creating sync job...', { organizationId, providerConfigId, type, filters, batchSize });

    // Create job
    const job = await prisma.syncJob.create({
      data: {
        organizationId,
        providerConfigId,
        type,
        status: SyncJobStatus.PENDING,
        batchSize,
        filters: filters || null,
      }
    });

    logger.info('Sync job created', { jobId: job.id });

    // Start processing in background
    this.processSyncJob(job.id).catch(error => {
      logger.error('Error processing sync job:', error);
    });

    return job;
  }

  /**
   * Process a sync job in batches
   */
  static async processSyncJob(jobId: string) {
    const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    try {
      // Update status to PROCESSING
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { 
          status: SyncJobStatus.PROCESSING,
          startedAt: new Date()
        }
      });

      logger.info('Processing sync job...', { jobId, type: job.type });

      // Get total records count first
      const totalRecords = await this.getTotalRecords(job);
      await prisma.syncJob.update({
        where: { id: jobId },
        data: { totalRecords }
      });

      logger.info(`Total records to sync: ${totalRecords}`, { jobId });

      // Process in batches
      let currentBatch = 0;
      let processedRecords = 0;
      let successRecords = 0;
      let errorRecords = 0;

      while (processedRecords < totalRecords) {
        const batchStartTime = Date.now();
        
        try {
          // Process batch based on job type
          const result = await this.processBatch(job, currentBatch);
          
          processedRecords += result.processed;
          successRecords += result.success;
          errorRecords += result.errors;
          currentBatch++;

          // Calculate progress
          const progress = (processedRecords / totalRecords) * 100;
          
          // Estimate time remaining
          const elapsedTime = Date.now() - batchStartTime;
          const remainingRecords = totalRecords - processedRecords;
          const estimatedTimeRemaining = Math.ceil((remainingRecords / job.batchSize) * elapsedTime / 1000);

          // Update job progress
          await prisma.syncJob.update({
            where: { id: jobId },
            data: {
              currentBatch,
              processedRecords,
              successRecords,
              errorRecords,
              progress,
              estimatedTimeRemaining
            }
          });

          logger.info('Batch processed', {
            jobId,
            batch: currentBatch,
            processed: processedRecords,
            total: totalRecords,
            progress: `${progress.toFixed(2)}%`,
            estimatedTimeRemaining: `${estimatedTimeRemaining}s`
          });

          // Small delay between batches to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          logger.error('Error processing batch', { jobId, batch: currentBatch, error });
          errorRecords += job.batchSize;
          processedRecords += job.batchSize; // Count as processed even if failed
          currentBatch++;
        }
      }

      // Mark job as completed
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncJobStatus.COMPLETED,
          completedAt: new Date(),
          progress: 100
        }
      });

      logger.info('Sync job completed', {
        jobId,
        totalRecords,
        successRecords,
        errorRecords
      });

    } catch (error: any) {
      logger.error('Fatal error processing sync job', { jobId, error });
      
      // Mark job as failed
      await prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: SyncJobStatus.FAILED,
          errorMessage: error.message,
          errorDetails: { stack: error.stack },
          completedAt: new Date()
        }
      });

      throw error;
    }
  }

  /**
   * Get total records count for a job
   */
  private static async getTotalRecords(job: any): Promise<number> {
    const filters = job.filters as any;

    switch (job.type) {
      case 'ARTICLE_WAREHOUSE':
        return await ArticleWarehouseSyncService.getTotalRecords(
          job.organizationId,
          filters
        );
      
      case 'ARTICLES':
        return await ArticleSyncService.getTotalRecords(
          job.organizationId,
          filters
        );
      
      default:
        return 0;
    }
  }

  /**
   * Process a single batch
   */
  private static async processBatch(job: any, batchNumber: number): Promise<{
    processed: number;
    success: number;
    errors: number;
  }> {
    const filters = job.filters as any;
    const offset = batchNumber * job.batchSize;

    logger.info('Processing batch', { 
      jobId: job.id, 
      type: job.type, 
      batch: batchNumber, 
      offset, 
      limit: job.batchSize 
    });

    switch (job.type) {
      case 'ARTICLE_WAREHOUSE':
        return await this.processBatchArticleWarehouse(
          job.organizationId,
          job.providerConfigId,
          offset,
          job.batchSize,
          filters
        );
      
      case 'ARTICLES':
        return await this.processBatchArticles(
          job.organizationId,
          job.providerConfigId,
          offset,
          job.batchSize,
          filters
        );
      
      default:
        return { processed: 0, success: 0, errors: 0 };
    }
  }

  /**
   * Process batch of article warehouse records
   */
  private static async processBatchArticleWarehouse(
    organizationId: string,
    providerConfigId: string,
    offset: number,
    limit: number,
    filters: any
  ): Promise<{ processed: number; success: number; errors: number }> {
    try {
      const result = await ArticleWarehouseSyncService.sendArticleWarehouseToTypsForYou(
        organizationId,
        providerConfigId,
        {
          page: Math.floor(offset / limit) + 1,
          limit,
          brandId: filters?.brandId,
          warehouseCode: filters?.warehouseCode,
          search: filters?.search
        }
      );

      return {
        processed: result.sent || 0,
        success: result.loadedRecords || 0,
        errors: result.sent - (result.loadedRecords || 0)
      };
    } catch (error: any) {
      logger.error('Error processing article warehouse batch', { error });
      return {
        processed: limit,
        success: 0,
        errors: limit
      };
    }
  }

  /**
   * Process batch of articles
   */
  private static async processBatchArticles(
    organizationId: string,
    providerConfigId: string,
    offset: number,
    limit: number,
    filters: any
  ): Promise<{ processed: number; success: number; errors: number }> {
    try {
      const result = await ArticleSyncService.sendArticlesToTypsForYou(
        organizationId,
        providerConfigId,
        {
          page: Math.floor(offset / limit) + 1,
          limit,
          brandId: filters?.brandId,
          search: filters?.search
        }
      );

      return {
        processed: result.sent || 0,
        success: result.loadedRecords || 0,
        errors: result.sent - (result.loadedRecords || 0)
      };
    } catch (error: any) {
      logger.error('Error processing articles batch', { error });
      return {
        processed: limit,
        success: 0,
        errors: limit
      };
    }
  }

  /**
   * Get sync job status
   */
  static async getJobStatus(jobId: string) {
    return await prisma.syncJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        type: true,
        status: true,
        totalRecords: true,
        processedRecords: true,
        successRecords: true,
        errorRecords: true,
        currentBatch: true,
        progress: true,
        estimatedTimeRemaining: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        createdAt: true
      }
    });
  }

  /**
   * List sync jobs for an organization
   */
  static async listJobs(organizationId: string, filters?: {
    type?: SyncJobType;
    status?: SyncJobStatus;
    limit?: number;
  }) {
    return await prisma.syncJob.findMany({
      where: {
        organizationId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.status && { status: filters.status })
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      select: {
        id: true,
        type: true,
        status: true,
        totalRecords: true,
        processedRecords: true,
        successRecords: true,
        errorRecords: true,
        progress: true,
        estimatedTimeRemaining: true,
        startedAt: true,
        completedAt: true,
        createdAt: true
      }
    });
  }

  /**
   * Cancel a sync job
   */
  static async cancelJob(jobId: string) {
    return await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncJobStatus.CANCELLED,
        completedAt: new Date()
      }
    });
  }
}
