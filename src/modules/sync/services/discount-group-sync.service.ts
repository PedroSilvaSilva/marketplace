import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import { AppError } from '@utils/errors';
import logger from '@config/logger';

/**
 * Service for syncing discount groups from SQL Server to TypsForYou
 */
export class DiscountGroupSyncService {
  /**
   * Generate CSV from discount groups in SQL Server
   * Format: ArticleDiscountGroupCode;DiscountGroupName;Tag;ReservedForFutureUse
   */
  static async generateDiscountGroupsCsv(
    organizationId: string,
    options?: {
      limit?: number;
      search?: string;
    }
  ): Promise<{ csv: string; count: number }> {
    try {
      logger.info('Generating discount groups CSV...', { organizationId, options });

      // Fetch all discount groups from SQL Server
      const result = await SQLService.getArticleDiscountGroups(organizationId, {
        page: 1,
        limit: options?.limit || 10000, // Get all by default
        search: options?.search
      });

      if (!result.data || result.data.length === 0) {
        throw new AppError('No discount groups found', 404);
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

        // Join with semicolon and trim whitespace
        const csvLine = row.map(field => 
          String(field).replace(/[\r\n]/g, ' ').trim()
        ).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');

      logger.info('Discount groups CSV generated successfully', {
        rowCount: csvRows.length
      });

      return {
        csv,
        count: csvRows.length
      };

    } catch (error: any) {
      logger.error('Failed to generate discount groups CSV:', error.message);
      throw error;
    }
  }

  /**
   * Send discount groups to TypsForYou marketplace
   */
  static async sendDiscountGroupsToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords?: number;
    errors?: any[];
    apiResponse?: any;
  }> {
    try {
      logger.info('Starting discount groups sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // 1. Generate CSV from SQL Server
      const { csv, count } = await this.generateDiscountGroupsCsv(organizationId, options);

      logger.info(`Generated CSV with ${count} discount groups`);

      // 2. Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountGroupsCsv(csv);

      // 3. Parse response
      const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
      const loadedRecords = apiResponse.LoadedRecords || 0;
      const errors = apiResponse.DataErrorsFound || [];

      logger.info('Discount groups sync completed', {
        success,
        sent: count,
        loadedRecords,
        errorCount: errors.length,
        exitCode: apiResponse.ExitCode
      });

      return {
        success,
        sent: count,
        loadedRecords,
        errors: errors.length > 0 ? errors : undefined,
        apiResponse
      };

    } catch (error: any) {
      logger.error('Failed to send discount groups to TypsForYou:', error.message);
      throw error;
    }
  }
}
