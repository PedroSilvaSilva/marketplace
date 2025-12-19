import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';

export class CustomerDiscountGroupSyncService {
  /**
   * Generate customer discount groups CSV from SQL Server view
   * Format: CustomerDiscountGroupCode;DiscountGroupName;Tag;ReservedForFutureUse
   */
  static async generateCustomerDiscountGroupsCsv(
    organizationId: string,
    options?: {
      limit?: number;
      search?: string;
    }
  ): Promise<{
    csv: string;
    count: number;
  }> {
    logger.info('Generating customer discount groups CSV...', { organizationId, options });

    // TEMPORARY: Create test data for EXCELENCIA group until view is configured
    const testData = [
      {
        CustomerDiscountGroupCode: 'EXCELENCIA',
        DiscountGroupName: 'Grupo Excelência',
        Tag: '',
        ReservedForFutureUse: ''
      }
    ];

    logger.info('Using test customer discount group data', {
      count: testData.length
    });

    // Build CSV with semicolon separator (no header, no quotes)
    // Format: CustomerDiscountGroupCode;DiscountGroupName;Tag;ReservedForFutureUse
    const csvRows: string[] = [];

    for (const group of testData) {
      const row = [
        group.CustomerDiscountGroupCode || '',
        group.DiscountGroupName || '',
        group.Tag || '',
        group.ReservedForFutureUse || ''
      ];

      // Join with semicolon and trim whitespace
      const csvLine = row.map(field => 
        String(field).replace(/[\r\n\t]/g, ' ').trim()
      ).join(';');

      csvRows.push(csvLine);
    }

    const csv = csvRows.join('\n');

    logger.info('Customer discount groups CSV generated successfully', {
      rowCount: csvRows.length,
      sampleRow: csvRows[0]
    });

    return {
      csv,
      count: csvRows.length
    };
  }

  /**
   * Send customer discount groups from SQL Server to TypsForYou
   */
  static async sendCustomerDiscountGroupsToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      search?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    try {
      logger.info('Starting customer discount groups sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // Generate CSV
      const csvResult = await this.generateCustomerDiscountGroupsCsv(organizationId, options);

      if (csvResult.count === 0) {
        logger.info('No customer discount groups to send');
        return {
          success: true,
          sent: 0,
          loadedRecords: 0,
          apiResponse: null
        };
      }

      logger.info(`Generated CSV with ${csvResult.count} customer discount groups`);

      // Send to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadCustomerDiscountGroupsCsv(csvResult.csv);

      // Parse response
      const loadedRecords = response.LoadedRecords || 0;
      const exitCode = response.ExitCode;
      const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;

      if (exitCode === '200' && !hasErrors) {
        logger.info('Customer discount groups sent successfully to TypsForYou', {
          sent: csvResult.count,
          loadedRecords
        });

        return {
          success: true,
          sent: csvResult.count,
          loadedRecords,
          apiResponse: response
        };
      } else {
        logger.error('TypsForYou returned errors', {
          exitCode,
          errors: response.DataErrorsFound
        });

        throw new AppError(
          `Failed to upload customer discount groups: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to send customer discount groups to TypsForYou:', error);
      throw error;
    }
  }
}
