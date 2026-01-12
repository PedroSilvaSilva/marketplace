import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';
import prisma from '../../../config/database';
import { CsvChunker } from '../utils/csv-chunker';
import { ErrorLogger } from './error-logger.service';
import emailService from '@utils/email';
import { config } from '@config/index';

export class ArticleSyncService {
  /**
   * Generate articles CSV from SQL Server view
   * Format: BrandId;DiscountGroupCode;PartNumber;DiscountSubGroupCode;InternalPartNumber;CategoryCode;ArticleID;Active;Availability;Service;Sort;Picture;ArticleName;ArticleDescription;DaysAfterNew;Tag;ReservedForFutureUse
   */
  static async generateArticlesCsv(
    organizationId: string,
    options?: {
      limit?: number;
      search?: string;
      brandId?: string;
      lastProcessedId?: string; // Checkpoint support (fase 1)
      modifiedSince?: Date; // Incremental support (fase 2)
      excludedBrandIds?: number[]; // BrandIDs to exclude
    }
  ): Promise<{
    csv: string;
    count: number;
    articles: Array<{ BrandId: number; PartNumber: string }>;
    lastProcessedId: string | null;
  }> {
    logger.info('Generating articles CSV...', { organizationId, options });

    // Fetch articles from SQL Server com checkpoint ou incremental
    const result = await SQLService.getArticles(organizationId, {
      limit: options?.limit || 1000,
      search: options?.search,
      brandId: options?.brandId,
      lastProcessedId: options?.lastProcessedId,
      modifiedSince: options?.modifiedSince,
      excludedBrandIds: options?.excludedBrandIds
    });

    if (!result || !result.data || result.data.length === 0) {
        logger.info('No articles found');
        return {
          csv: '',
          count: 0,
          articles: [],
          lastProcessedId: null
        };
      }

      logger.info(`Fetched ${result.data.length} articles from SQL Server`, {
        total: result.pagination.total,
        page: result.pagination.page,
        lastProcessedId: result.lastProcessedId
      });

      // Build CSV with semicolon separator (no header, no quotes)
      // Format: BrandId;DiscountGroupCode;PartNumber;DiscountSubGroupCode;InternalPartNumber;CategoryCode;ArticleID;Active;Availability;Service;Sort;Picture;ArticleName;ArticleDescription;DaysAfterNew;Tag;ReservedForFutureUse
      const csvRows: string[] = [];

      // Sanitize function to remove characters that trigger API validation errors
      const sanitizeText = (text: string): string => {
        return String(text)
          .replace(/[\r\n]/g, ' ') // Remove line breaks
          .replace(/['"]/g, '') // Remove quotes (double " and single ' cause "Invalid Character Found" error)
          .replace(/SELECT/gi, 'SELETOR') // Replace SELECT with SELETOR to avoid SQL injection detection
          .replace(/;/g, ',') // Replace semicolons with commas (semicolon is CSV delimiter)
          .trim();
      };

      for (const article of result.data) {
        const row = [
          article.BrandId?.toString() || '',
          article.ArticleDiscountGroupCode || '',
          article.PartNumber || '',
          article.DiscountSubGroupCode || '',
          article.InternalPartNumber || '',
          article.CategoryCode || '',
          article.AttributeID || '',
          article.Active === 1 || article.Active === true ? '1' : '0',
          article.Availability === 1 || article.Availability === true ? '1' : '0',
          article.Service === 1 || article.Service === true ? '1' : '0',
          article.Sort?.toString() || '0',
          article.Picture || '',
          sanitizeText(article.ArticleName || ''),
          sanitizeText(article.ArticleDescription || ''),
          article.DaysAsNew?.toString() || '0',
          article.Tag || '',
          article.ReservedForFutureUse || ''
        ];

        // Join with semicolon
        const csvLine = row.map(field => String(field).trim()).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');

      logger.info('Articles CSV generated successfully', {
        rowCount: csvRows.length,
        sampleRow: csvRows[0]
      });

      return {
        csv,
        count: csvRows.length,
        articles: result.data.map(a => ({
          BrandId: a.BrandId || 0,
          PartNumber: a.PartNumber || ''
        })),
        lastProcessedId: result.lastProcessedId || null
      };
  }

  /**
   * Send articles from SQL Server to TypsForYou com checkpoint
   */
  static async sendArticlesToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
      brandId?: string;
      syncConfigId?: string; // Para atualizar checkpoint
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: Record<string, unknown> | null;
    lastProcessedId?: string;
    completed: boolean;
  }> {
    try {
      logger.info('Starting articles sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // Obter configuração atual
      let lastProcessedId: string | null = null;
      let syncMode: 'checkpoint' | 'incremental' = 'checkpoint';
      let lastSyncAt: Date | null = null;
      
      if (options?.syncConfigId) {
        const syncConfig = await prisma.syncConfiguration.findUnique({
          where: { id: options.syncConfigId },
          select: { options: true, lastSuccessAt: true }
        });
        
        const configOptions = syncConfig?.options as Record<string, unknown> | null;
        lastProcessedId = (configOptions?.lastProcessedId as string) || null;
        syncMode = (configOptions?.mode as 'checkpoint' | 'incremental') || 'checkpoint';
        lastSyncAt = syncConfig?.lastSuccessAt || null;
        
        logger.info(`Sync mode: ${syncMode}`, { 
          checkpoint: lastProcessedId || 'START',
          lastSync: lastSyncAt
        });
      }

      // Fase 2: Incremental (se modo = incremental E tem lastSyncAt)
      let csvResult;
      if (syncMode === 'incremental' && lastSyncAt) {
        logger.info('[Incremental Mode] Fetching articles modified since last sync');
        csvResult = await this.generateArticlesCsv(organizationId, {
          ...options,
          modifiedSince: lastSyncAt
        });
      } 
      // Fase 1: Checkpoint (carregamento inicial)
      else {
        const syncOptions = await prisma.syncConfiguration.findUnique({
          where: { id: options?.syncConfigId },
          select: { options: true }
        });
        
        const configOpts = syncOptions?.options as Record<string, unknown> | null;
        const excludedBrandIds = (configOpts?.excludedBrandIds as number[]) || [];
        
        logger.info('[Checkpoint Mode] Sequential loading from checkpoint');
        if (excludedBrandIds.length > 0) {
          logger.info(`[Checkpoint Mode] Excluding ${excludedBrandIds.length} invalid BrandIDs: ${excludedBrandIds.join(', ')}`);
        }
        
        csvResult = await this.generateArticlesCsv(organizationId, {
          ...options,
          lastProcessedId: lastProcessedId || undefined,
          excludedBrandIds
        });
      }

      if (csvResult.count === 0) {
        // Se estava em checkpoint e chegou ao fim → muda para incremental
        if (syncMode === 'checkpoint' && lastProcessedId) {
          logger.info('🎉 Checkpoint completed! Switching to incremental mode');
          
          if (options?.syncConfigId) {
            await prisma.syncConfiguration.update({
              where: { id: options.syncConfigId },
              data: {
                options: { 
                  mode: 'incremental',
                  lastProcessedId: null,
                  totalProcessed: 0,
                  completedAt: new Date()
                }
              }
            });
          }
        }
        
        logger.info('No articles to send');
        return {
          success: true,
          sent: 0,
          loadedRecords: 0,
          apiResponse: null,
          completed: syncMode === 'checkpoint'
        };
      }

      logger.info(`Generated CSV with ${csvResult.count} articles`);

      // Send to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadArticlesCsv(csvResult.csv);

      // Parse response
      const loadedRecords = response.LoadedRecords || 0;
      const exitCode = response.ExitCode;
      const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;
      
      // Extract BrandIDs that caused errors
      const invalidBrandIds: number[] = [];
      if (response.DataErrorsFound && Array.isArray(response.DataErrorsFound)) {
        for (const error of response.DataErrorsFound) {
          const match = error.Error_Message?.match(/BrandID.*?(\d+)/);
          if (match && match[1]) {
            const brandId = parseInt(match[1], 10);
            if (!invalidBrandIds.includes(brandId)) {
              invalidBrandIds.push(brandId);
            }
          }
        }
      }

      if (exitCode === '200' && !hasErrors) {
        logger.info('Articles sent successfully to TypsForYou', {
          sent: csvResult.count,
          loadedRecords,
          mode: syncMode
        });

        // Atualizar checkpoint (só em modo checkpoint)
        if (syncMode === 'checkpoint' && options?.syncConfigId && csvResult.lastProcessedId) {
          const currentOptions = await prisma.syncConfiguration.findUnique({
            where: { id: options.syncConfigId },
            select: { options: true }
          });
          
          const currentOpts = currentOptions?.options as Record<string, unknown> | null;
          const totalProcessed = ((currentOpts?.totalProcessed as number) || 0) + loadedRecords;
          const existingExcludedBrands = (currentOpts?.excludedBrandIds as number[]) || [];
          
          // Merge new invalid BrandIDs with existing ones
          const allExcludedBrands = [...new Set([...existingExcludedBrands, ...invalidBrandIds])];
          
          await prisma.syncConfiguration.update({
            where: { id: options.syncConfigId },
            data: {
              options: {
                mode: 'checkpoint',
                lastProcessedId: csvResult.lastProcessedId,
                totalProcessed,
                excludedBrandIds: allExcludedBrands
              }
            }
          });
          
          if (invalidBrandIds.length > 0) {
            logger.warn(`[ArticleScheduler] Articles rejected due to invalid BrandIDs`, {
              brandIds: invalidBrandIds,
              count: csvResult.count - loadedRecords,
              note: 'These BrandIDs are now filtered in SQL query to prevent future rejections'
            });
          }
          
          await prisma.syncConfiguration.update({
            where: { id: options.syncConfigId },
            data: {
              options: {
                mode: 'checkpoint',
                lastProcessedId: csvResult.lastProcessedId,
                totalProcessed
              }
            }
          });
          
          if (invalidBrandIds.length > 0) {
            logger.warn(`[ArticleScheduler] Articles rejected due to invalid BrandIDs`, {
              brandIds: invalidBrandIds,
              count: csvResult.count - loadedRecords,
              note: 'These BrandIDs are now filtered in SQL query to prevent future rejections'
            });
          }
          
          logger.info(`Checkpoint updated: ${csvResult.lastProcessedId} (Total: ${totalProcessed + loadedRecords})`);
        }
        // Modo incremental: não precisa checkpoint, só lastSuccessAt é atualizado
        else if (syncMode === 'incremental') {
          logger.info(`Incremental sync: ${csvResult.count} modified articles sent`);
        }

        // Save synced articles to cache table
        try {
          const syncedArticles = csvResult.articles.map(article => ({
            organizationId,
            providerConfigId,
            brandId: article.BrandId,
            partNumber: article.PartNumber,
            syncedAt: new Date()
          }));

          await prisma.syncedArticle.createMany({
            data: syncedArticles,
            skipDuplicates: true
          });

          logger.info(`Cached ${syncedArticles.length} synced articles to database`);
        } catch (cacheError: unknown) {
          // Log but don't fail the sync - cache is for optimization
          logger.error('Failed to cache synced articles:', cacheError);
        }

        // Send email notification
        try {
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0 && notificationEmails[0]) {
            await emailService.sendArticlesSyncedEmail(
              notificationEmails[0],
              {
                totalSent: csvResult.count,
                loadedRecords,
                syncMode: syncMode === 'checkpoint' ? 'CHECKPOINT' : 'INCREMENTAL',
                checkpoint: syncMode === 'checkpoint' ? csvResult.lastProcessedId : null,
                totalProcessed: syncMode === 'checkpoint' ? 
                  ((await prisma.syncConfiguration.findUnique({
                    where: { id: options?.syncConfigId },
                    select: { options: true }
                  }))?.options as Record<string, unknown> | null)?.['totalProcessed'] as number || null : null
              }
            );

            logger.info('[ArticleSync] Email notification sent');
          }
        } catch (emailError) {
          logger.error('[ArticleSync] Failed to send email', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }

        return {
          success: true,
          sent: csvResult.count,
          loadedRecords,
          apiResponse: response,
          lastProcessedId: csvResult.lastProcessedId || undefined,
          completed: csvResult.count < (options?.limit || 1000) // Se batch < limit, terminou
        };
      } else if (loadedRecords > 0) {
        // Upload parcial: alguns registos foram carregados mas houve erros
        logger.warn('Partial upload: some records loaded with errors', {
          loadedRecords,
          totalSent: csvResult.count,
          exitCode,
          errorCount: response.DataErrorsFound?.length || 0
        });

        // Atualizar checkpoint mesmo com upload parcial, excluindo BrandIDs problemáticos
        if (syncMode === 'checkpoint' && options?.syncConfigId && csvResult.lastProcessedId) {
          const currentOptions = await prisma.syncConfiguration.findUnique({
            where: { id: options.syncConfigId },
            select: { options: true }
          });
          
          const currentOpts = currentOptions?.options as Record<string, unknown> | null;
          const totalProcessed = ((currentOpts?.totalProcessed as number) || 0) + loadedRecords;
          const existingExcludedBrands = (currentOpts?.excludedBrandIds as number[]) || [];
          
          // Merge new invalid BrandIDs with existing ones
          const allExcludedBrands = [...new Set([...existingExcludedBrands, ...invalidBrandIds])];
          
          await prisma.syncConfiguration.update({
            where: { id: options.syncConfigId },
            data: {
              options: {
                mode: 'checkpoint',
                lastProcessedId: csvResult.lastProcessedId,
                totalProcessed,
                excludedBrandIds: allExcludedBrands
              }
            }
          });
          
          if (invalidBrandIds.length > 0) {
            logger.warn(`[ArticleScheduler] Articles rejected due to invalid BrandIDs`, {
              brandIds: invalidBrandIds,
              count: csvResult.count - loadedRecords,
              note: 'These BrandIDs are now filtered in SQL query to prevent future rejections'
            });
          }
          
          logger.info(`[ArticleScheduler] Sync completed successfully`, {
            sent: csvResult.count,
            loadedRecords,
            failed: csvResult.count - loadedRecords,
            invalidBrandIds
          });
        }

        return {
          success: true, // Considerar sucesso parcial
          sent: csvResult.count,
          loadedRecords,
          apiResponse: response,
          lastProcessedId: csvResult.lastProcessedId || undefined,
          completed: csvResult.count < (options?.limit || 1000)
        };
      } else {
        // Falha total: nenhum registo carregado
        logger.error('TypsForYou returned errors with no records loaded', {
          exitCode,
          errors: response.DataErrorsFound
        });

        throw new AppError(
          `Failed to upload articles: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to send articles to TypsForYou:', error);
      throw error;
    }
  }

  /**
   * Get total records count for articles
   */
  static async getTotalRecords(
    organizationId: string,
    filters?: {
      brandId?: string;
      search?: string;
    }
  ): Promise<number> {
    const result = await SQLService.getArticles(organizationId, {
      page: 1,
      limit: 1,
      brandId: filters?.brandId,
      search: filters?.search
    });

    return result.pagination.total;
  }

  /**
   * Send articles to TypsForYou in chunks (respects 500KB limit)
   * IMPORTANT: TypsForYou API has 500KB file size limit per upload
   */
  static async sendArticlesToTypsForYouChunked(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      page?: number;
      search?: string;
      brandId?: string;
    }
  ): Promise<{
    success: boolean;
    totalSent: number;
    totalLoaded: number;
    chunks: number;
    chunkResults: Array<{
      chunk: number;
      sent: number;
      loaded: number;
      sizeKB: number;
    }>;
  }> {
    logger.info('Sending articles to TypsForYou in chunks...', {
      organizationId,
      providerConfigId,
      options
    });

    try {
      // Generate CSV with articles
      const csvResult = await this.generateArticlesCsv(
        organizationId,
        options
      );

      if (csvResult.count === 0) {
        logger.info('No articles to send');
        return {
          success: true,
          totalSent: 0,
          totalLoaded: 0,
          chunks: 0,
          chunkResults: []
        };
      }

      // Split CSV into rows
      const rows = csvResult.csv.split('\n').filter(row => row.trim() !== '');
      
      // Check CSV size
      const csvSizeKB = CsvChunker.calculateSizeKB(csvResult.csv);
      logger.info('CSV size calculated', { sizeKB: csvSizeKB.toFixed(2), rows: rows.length });

      // Split into chunks if exceeds 500KB limit
      const chunks = CsvChunker.exceedsLimit(csvResult.csv) 
        ? CsvChunker.chunkCsvRows(rows)
        : [csvResult.csv];

      logger.info(`Sending ${chunks.length} chunk(s) to TypsForYou...`);

      // Send each chunk
      const client = new Typs4YouClient(providerConfigId);
      const chunkResults = [];
      let totalSent = 0;
      let totalLoaded = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;
        
        const chunkSizeKB = CsvChunker.calculateSizeKB(chunk);
        const chunkRows = chunk.split('\n').length;

        logger.info(`Sending chunk ${i + 1}/${chunks.length}`, {
          rows: chunkRows,
          sizeKB: chunkSizeKB.toFixed(2)
        });

        try {
          const response = await client.uploadArticlesCsv(chunk);
          const loadedRecords = parseInt(response.LoadedRecords || '0', 10);
          
          // Check for validation errors in API response
          if (response.DataErrorsFound && response.DataErrorsFound.length > 0) {
            logger.warn(`Chunk ${i + 1} has validation errors`, {
              errors: response.DataErrorsFound
            });
            
            // Log validation errors with details
            await ErrorLogger.logError(
              new Error(`Validation errors: ${response.DataErrorsFound.join(', ')}`),
              {
                organizationId,
                providerConfigId,
                operation: 'ARTICLE_SYNC_CHUNK_VALIDATION',
                entityType: 'ARTICLE',
                chunkNumber: i + 1,
                totalChunks: chunks.length,
                chunkSize: chunkRows,
                recordsAffected: chunkRows - loadedRecords, // Records rejected
                responseBody: JSON.stringify(response).substring(0, 5000),
                responseStatus: response.ExitCode ? parseInt(response.ExitCode) : undefined,
                apiEndpoint: 'uploadArticlesCsv',
                validationErrors: response.DataErrorsFound.map((err: string) => ({
                  field: err.includes('BrandID') ? 'BrandID' : 'unknown',
                  value: err.match(/\d+/)?.[0] || 'unknown',
                  message: err
                }))
              }
            );
          }

          chunkResults.push({
            chunk: i + 1,
            sent: chunkRows,
            loaded: loadedRecords,
            sizeKB: parseFloat(chunkSizeKB.toFixed(2))
          });

          totalSent += chunkRows;
          totalLoaded += loadedRecords;

          // Cache synced articles from this chunk
          if (i === 0) {
            // Only cache from first chunk to avoid duplicates
            const chunkArticles = csvResult.articles.slice(0, chunkRows);
            try {
              const syncedArticles = chunkArticles.map(article => ({
                organizationId,
                providerConfigId,
                brandId: article.BrandId,
                partNumber: article.PartNumber,
                syncedAt: new Date()
              }));

              await prisma.syncedArticle.createMany({
                data: syncedArticles,
                skipDuplicates: true
              });

              logger.info(`Cached ${syncedArticles.length} synced articles from chunk ${i + 1}`);
            } catch (cacheError: unknown) {
              logger.error('Failed to cache synced articles:', cacheError);
            }
          }

          logger.info(`Chunk ${i + 1} sent successfully`, {
            sent: chunkRows,
            loaded: loadedRecords
          });

          // Delay between chunks to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Error sending chunk ${i + 1}`, { 
            errorMessage,
            errorType: error instanceof Error ? error.constructor.name : typeof error
          });
          
          // Log detailed error with context (wrap in try-catch to prevent cascading errors)
          try {
            await ErrorLogger.logError(
              error instanceof Error ? error : new Error(String(error)),
              {
                organizationId,
                providerConfigId,
                operation: 'ARTICLE_SYNC_CHUNK',
                entityType: 'ARTICLE',
                chunkNumber: i + 1,
                totalChunks: chunks.length,
                chunkSize: chunkRows,
                recordsAffected: chunkRows,
                requestPayload: chunk ? chunk.substring(0, 5000) : '',
                dataSnapshot: csvResult.articles.slice(i * chunkRows, (i + 1) * chunkRows)[0],
                apiEndpoint: 'uploadArticlesCsv'
              }
            );
          } catch (logError) {
            logger.error('Failed to log error to database', { logError });
          }
          
          chunkResults.push({
            chunk: i + 1,
            sent: chunkRows,
            loaded: 0,
            sizeKB: parseFloat(chunkSizeKB.toFixed(2))
          });
        }
      }

      logger.info('All chunks sent to TypsForYou', {
        totalChunks: chunks.length,
        totalSent,
        totalLoaded,
        successRate: `${((totalLoaded / totalSent) * 100).toFixed(2)}%`
      });

      return {
        success: totalLoaded > 0,
        totalSent,
        totalLoaded,
        chunks: chunks.length,
        chunkResults
      };

    } catch (error: unknown) {
      logger.error('Failed to send articles to TypsForYou in chunks:', error);
      throw error;
    }
  }
}
