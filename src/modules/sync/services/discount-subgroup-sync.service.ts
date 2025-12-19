import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import { AppError } from '@utils/errors';
import logger from '@config/logger';

/**
 * Service for syncing discount sub-groups from SQL Server to TypsForYou
 */
export class DiscountSubGroupSyncService {
  /**
   * Generate CSV from discount sub-groups in SQL Server
   * Format: DiscountGroupCode;DiscountSubGroupCode;DiscountSubGroupName;Tag
   */
  static async generateDiscountSubGroupsCsv(
    organizationId: string,
    options?: {
      limit?: number;
      search?: string;
      groupCode?: string;
    }
  ): Promise<{ csv: string; count: number }> {
    try {
      logger.info('Generating discount sub-groups CSV...', { organizationId, options });

      // Fetch all discount sub-groups from SQL Server
      const result = await SQLService.getArticleDiscountSubGroups(organizationId, {
        page: 1,
        limit: options?.limit || 10000, // Get all by default
        search: options?.search,
        groupCode: options?.groupCode
      });

      if (!result.data || result.data.length === 0) {
        throw new AppError('No discount sub-groups found', 404);
      }

      // Build CSV with semicolon separator (no header, no quotes)
      // Format: DiscountGroupCode;DiscountSubGroupCode;DiscountSubGroupName;Tag
      const csvRows: string[] = [];

      for (const subGroup of result.data) {
        // Note: ArticleDiscountGroupCode from SQL becomes DiscountGroupCode in CSV
        const row = [
          subGroup.ArticleDiscountGroupCode || '', // Maps to DiscountGroupCode
          subGroup.DiscountSubGroupCode || '',
          subGroup.DiscountSubGroupName || '',
          subGroup.Tag || ''
        ];

        // Join with semicolon and trim whitespace
        const csvLine = row.map(field => 
          String(field).replace(/[\r\n]/g, ' ').trim()
        ).join(';');

        csvRows.push(csvLine);
      }

      const csv = csvRows.join('\n');

      logger.info('Discount sub-groups CSV generated successfully', {
        rowCount: csvRows.length,
        sampleRow: csvRows[0]
      });

      return {
        csv,
        count: csvRows.length
      };

    } catch (error: any) {
      logger.error('Failed to generate discount sub-groups CSV:', error.message);
      throw error;
    }
  }

  /**
   * Send discount sub-groups to TypsForYou marketplace
   */
  static async sendDiscountSubGroupsToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
      groupCode?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords?: number;
    errors?: any[];
    apiResponse?: any;
  }> {
    try {
      logger.info('Starting discount sub-groups sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // 1. Generate CSV from SQL Server
      const { csv, count } = await this.generateDiscountSubGroupsCsv(organizationId, options);

      logger.info(`Generated CSV with ${count} discount sub-groups`);

      // 2. Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const apiResponse = await client.uploadDiscountSubGroupsCsv(csv);

      // 3. Parse response
      const success = apiResponse.ExitCode === '200' || apiResponse.ExitCode === '0';
      const loadedRecords = apiResponse.LoadedRecords || 0;
      const errors = apiResponse.DataErrorsFound || [];

      logger.info('Discount sub-groups sync completed', {
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
      logger.error('Failed to send discount sub-groups to TypsForYou:', error.message);
      throw error;
    }
  }
}
