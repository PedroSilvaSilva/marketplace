import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';

export class CustomerWarehouseSyncService {
  /**
   * Generate customer warehouses CSV from SQL Server view
   * Format: CustomerID;WarehouseCode;AssignedPrice;Tag;ReservedForFutureUse
   */
  static async generateCustomerWarehousesCsv(
    organizationId: string,
    options?: {
      limit?: number;
      customerId?: string;
    }
  ): Promise<{
    csv: string;
    count: number;
  }> {
    logger.info('Generating customer warehouses CSV...', { organizationId, options });

    // Fetch customer warehouses from SQL Server
    const result = await SQLService.getCustomerWarehouses(organizationId, {
      limit: options?.limit,
      customerId: options?.customerId
    });

    if (!result || !result.data || result.data.length === 0) {
      logger.info('No customer warehouses found');
      return {
        csv: '',
        count: 0
      };
    }

    logger.info(`Fetched ${result.data.length} customer warehouses from SQL Server`, {
      total: result.pagination.total,
      page: result.pagination.page
    });

    // Build CSV with semicolon separator (no header, no quotes)
    // Format: CustomerID;WarehouseCode;AssignedPrice;Tag;ReservedForFutureUse
    const csvRows: string[] = [];

    for (const warehouse of result.data) {
      const row = [
        warehouse.CustomerID || '',
        warehouse.WarehouseCode || '',
        warehouse.AssignedPrice?.toString() || '0',
        warehouse.Tag || '',
        warehouse.ReservedForFutureUse || ''
      ];

      // Join with semicolon and trim whitespace
      const csvLine = row.map(field => 
        String(field).replace(/[\r\n\t]/g, ' ').trim()
      ).join(';');

      csvRows.push(csvLine);
    }

    const csv = csvRows.join('\n');

    logger.info('Customer warehouses CSV generated successfully', {
      rowCount: csvRows.length,
      sampleRow: csvRows[0]
    });

    return {
      csv,
      count: csvRows.length
    };
  }

  /**
   * Send customer warehouses from SQL Server to TypsForYou
   */
  static async sendCustomerWarehousesToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      customerId?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    try {
      logger.info('Starting customer warehouses sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // Generate CSV
      const csvResult = await this.generateCustomerWarehousesCsv(organizationId, options);

      if (csvResult.count === 0) {
        logger.info('No customer warehouses to send');
        return {
          success: true,
          sent: 0,
          loadedRecords: 0,
          apiResponse: null
        };
      }

      logger.info(`Generated CSV with ${csvResult.count} customer warehouses`);

      // Send to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadCustomerWarehousesCsv(csvResult.csv);

      // Parse response
      const loadedRecords = response.LoadedRecords || 0;
      const exitCode = response.ExitCode;
      const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;

      if (exitCode === '200' && !hasErrors) {
        logger.info('Customer warehouses sent successfully to TypsForYou', {
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
          `Failed to upload customer warehouses: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to send customer warehouses to TypsForYou:', error);
      throw error;
    }
  }
}
