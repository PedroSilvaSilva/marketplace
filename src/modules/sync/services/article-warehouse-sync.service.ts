import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';
import { CsvChunker } from '../utils/csv-chunker';
import { ErrorLogger } from './error-logger.service';

export class ArticleWarehouseSyncService {
  /**
   * Generate article warehouse CSV from SQL Server view
   * Format: BrandId;PartNumber;WareHouseCode;ArticleQuantity;ArticlePrice1;ArticlePrice2;ArticlePrice3;ArticlePrice4;ArticlePrice5;ArticleEcoTax;ArticleCurrency;Tag;ReservedForFutureUse
   */
  static async generateArticleWarehouseCsv(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
      brandId?: string;
      warehouseCode?: string;
    }
  ): Promise<{
    csv: string;
    count: number;
  }> {
    logger.info('Generating article warehouse CSV...', { organizationId, providerConfigId, options });

    // Fetch article warehouse data from SQL Server (filtered by synced articles cache)
    const result = await SQLService.getArticleWarehouse(organizationId, {
      limit: options?.limit,
      search: options?.search,
      brandId: options?.brandId,
      warehouseCode: options?.warehouseCode,
      providerConfigId
    });

    if (!result || !result.data || result.data.length === 0) {
      logger.info('No article warehouse data found');
      return {
        csv: '',
        count: 0
      };
    }

    logger.info(`Fetched ${result.data.length} article warehouse records from SQL Server`, {
      total: result.pagination.total,
      page: result.pagination.page
    });

    // Build CSV with semicolon separator (no header, no quotes)
    // Format: BrandId;PartNumber;WareHouseCode;ArticleQuantity;ArticlePrice1;ArticlePrice2;ArticlePrice3;ArticlePrice4;ArticlePrice5;ArticleEcoTax;ArticleCurrency;Tag;ReservedForFutureUse
    const csvRows: string[] = [];

    for (const warehouse of result.data) {
      const row = [
        warehouse.BrandId?.toString() || '',
        warehouse.PartNumber || '',
        warehouse.WareHouseCode || '',
        warehouse.ArticleQuantity?.toString() || '0',
        warehouse.ArticlePrice1?.toString() || '0',
        warehouse.ArticlePrice2?.toString() || '0',
        warehouse.ArticlePrice3?.toString() || '0',
        warehouse.ArticlePrice4?.toString() || '0',
        warehouse.ArticlePrice5?.toString() || '0',
        warehouse.ArticleEcoTax?.toString() || '0',
        warehouse.ArticleCurrency || 'EUR',
        warehouse.Tag || '',
        warehouse.ReservedForFutureUse || ''
      ];

      // Join with semicolon and trim whitespace (remove any invisible characters)
      const csvLine = row.map(field => 
        String(field).replace(/[\r\n\t]/g, ' ').trim()
      ).join(';');

      csvRows.push(csvLine);
    }

    const csv = csvRows.join('\n');

    logger.info('Article warehouse CSV generated successfully', {
      rowCount: csvRows.length,
      sampleRow: csvRows[0]
    });

    return {
      csv,
      count: csvRows.length
    };
  }

  /**
   * Send article warehouse data from SQL Server to TypsForYou
   * Uses SQL EXISTS subquery to filter warehouse data for valid articles only
   */
  static async sendArticleWarehouseToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
      brandId?: string;
      warehouseCode?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    logger.info('Starting article warehouse sync to TypsForYou...', {
      organizationId,
      providerConfigId,
      options
    });

    // STEP 1: Fetch warehouse data from SQL Server (already filtered by synced articles cache)
    const result = await SQLService.getArticleWarehouse(organizationId, {
      limit: options?.limit,
      search: options?.search,
      brandId: options?.brandId,
      warehouseCode: options?.warehouseCode,
      providerConfigId
    });

    if (!result || !result.data || result.data.length === 0) {
      logger.info('No article warehouse data found in SQL Server or no synced articles in cache');
      return {
        success: true,
        sent: 0,
        loadedRecords: 0,
        apiResponse: null
      };
    }

    logger.info(`Fetched ${result.data.length} warehouse records from SQL Server (filtered by synced articles cache)`, {
      total: result.pagination.total,
      samplePartNumbers: result.data.slice(0, 5).map(w => `${w.BrandId}-${w.PartNumber}`)
    });

    // STEP 2: Build CSV from warehouse data (already filtered by cache)
    const csvRows: string[] = [];

    for (const warehouse of result.data) {
      const row = [
        warehouse.BrandId?.toString() || '',
        warehouse.PartNumber || '',
        warehouse.WareHouseCode || '',
        warehouse.ArticleQuantity?.toString() || '0',
        warehouse.ArticlePrice1?.toString() || '0',
        warehouse.ArticlePrice2?.toString() || '0',
        warehouse.ArticlePrice3?.toString() || '0',
        warehouse.ArticlePrice4?.toString() || '0',
        warehouse.ArticlePrice5?.toString() || '0',
        warehouse.ArticleEcoTax?.toString() || '0',
        warehouse.ArticleCurrency || 'EUR',
        warehouse.Tag || '',
        warehouse.ReservedForFutureUse || ''
      ];

      const csvLine = row.map(field => 
        String(field).replace(/[\r\n\t]/g, ' ').trim()
      ).join(';');

      csvRows.push(csvLine);
    }

    const csv = csvRows.join('\n');

    logger.info(`Generated CSV with ${csvRows.length} warehouse records`);

    // STEP 3: Send to TypsForYou
    const client = new Typs4YouClient(providerConfigId);
    const response = await client.uploadArticleWarehouseCsv(csv);

    // Parse response
    const loadedRecords = response.LoadedRecords || 0;
    const exitCode = response.ExitCode;
    const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;

    if (exitCode === '200' && !hasErrors) {
      logger.info('Article warehouse data sent successfully to TypsForYou', {
        sent: csvRows.length,
        loadedRecords
      });

      return {
        success: true,
        sent: csvRows.length,
        loadedRecords,
        apiResponse: response
      };
    } else {
      logger.error('TypsForYou returned errors', {
        exitCode,
        errors: response.DataErrorsFound
      });

      throw new AppError(
        `Failed to upload article warehouse: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
        400
      );
    }
  }

  /**
   * Get total records count for article warehouse
   */
  static async getTotalRecords(
    organizationId: string,
    filters?: {
      brandId?: string;
      warehouseCode?: string;
      search?: string;
    }
  ): Promise<number> {
    const result = await SQLService.getArticleWarehouse(organizationId, {
      page: 1,
      limit: 1,
      brandId: filters?.brandId,
      warehouseCode: filters?.warehouseCode,
      search: filters?.search
    });

    return result.pagination.total;
  }

  /**
   * Send article warehouse data to TypsForYou in chunks (respects 500KB limit)
   * IMPORTANT: TypsForYou API has 500KB file size limit per upload
   */
  static async sendArticleWarehouseToTypsForYouChunked(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
      brandId?: string;
      warehouseCode?: string;
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
    logger.info('Sending article warehouse data to TypsForYou in chunks...', {
      organizationId,
      providerConfigId,
      options
    });

    // Generate CSV
    const csvResult = await this.generateArticleWarehouseCsv(
      organizationId,
      providerConfigId,
      options
    );

    if (csvResult.count === 0) {
      logger.info('No article warehouse data to send');
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
        const response = await client.uploadArticleWarehouseCsv(chunk);
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
              operation: 'ARTICLE_WAREHOUSE_SYNC_CHUNK_VALIDATION',
              entityType: 'ARTICLE_WAREHOUSE',
              chunkNumber: i + 1,
              totalChunks: chunks.length,
              chunkSize: chunkRows,
              recordsAffected: chunkRows - loadedRecords, // Records rejected
              responseBody: JSON.stringify(response).substring(0, 5000),
              responseStatus: response.ExitCode ? parseInt(response.ExitCode) : undefined,
              apiEndpoint: 'uploadArticleWarehouseCsv',
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
              operation: 'ARTICLE_WAREHOUSE_SYNC_CHUNK',
              entityType: 'ARTICLE_WAREHOUSE',
              chunkNumber: i + 1,
              totalChunks: chunks.length,
              chunkSize: chunkRows,
              recordsAffected: chunkRows,
              requestPayload: chunk ? chunk.substring(0, 5000) : '',
              apiEndpoint: 'uploadArticleWarehouseCsv'
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
  }
}
