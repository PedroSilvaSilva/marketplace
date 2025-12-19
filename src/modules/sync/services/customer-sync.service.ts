import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';

export class CustomerSyncService {
  /**
   * Generate customers CSV from SQL Server view
   * Format: DiscountGroupCode;CustomerID;Name;Address;City;Country;Email;Phone;Contact;VatId;Login;Password;NIF;Currency;WebSiteUrl;Tag;ReservedForFutureUse
   */
  static async generateCustomersCsv(
    organizationId: string,
    options?: {
      customerId?: string;
    }
  ): Promise<{
    csv: string;
    count: number;
  }> {
    logger.info('Generating customers CSV...', { organizationId, options });

    // Fetch customers from SQL Server
    const customers = await SQLService.getCustomers(organizationId, options?.customerId);

    if (!customers || customers.length === 0) {
      logger.info('No customers found');
      return {
        csv: '',
        count: 0
      };
    }

    logger.info(`Fetched ${customers.length} customers from SQL Server`);
    
    // Log first customer to see field names and values
    if (customers.length > 0) {
      logger.info('Sample customer fields:', Object.keys(customers[0]));
      logger.info('Sample customer ALL data:', customers[0]);
      logger.info('Sample customer VAT-related fields:', {
        VatId: customers[0].VatId,
        VAT_ID: customers[0].VAT_ID,
        NIF: customers[0].NIF,
        VAT: customers[0].VAT,
        TaxId: customers[0].TaxId,
        TaxID: customers[0].TaxID
      });
    }

    // Build CSV with semicolon separator (no header, no quotes)
    // Format: DiscountGroupCode;CustomerID;Name;Address;City;Zip;Country;Email;Phone;Contact;VatId;Login;Password;Active;Currency;WebSiteUrl;Tag;ReservedForFutureUse
    const csvRows: string[] = [];

    for (const customer of customers) {
      // Extract Zip from City field if it contains postal code (format: "2400-773 AMOR")
      const cityField = String(customer.City || '');
      const zipMatch = cityField.match(/^(\d{4}-\d{3})\s+(.+)$/);
      const zip = zipMatch ? zipMatch[1] : (customer.Zip || customer.PostalCode || customer.ZipCode || '');
      const city = zipMatch ? zipMatch[2] : cityField;
      
      // Validate Country - if it's "1" or invalid, use "PT"
      let country = String(customer.Country || '').trim();
      if (!country || country === '1' || country.length < 2) {
        country = 'PT';
      }
      
      // Get VatId - check multiple possible field names
      const vatId = customer.VatId || customer.VAT_ID || customer.NIF || customer.VAT || customer.TaxId || customer.TaxID || '';
      
      const row = [
        customer.DiscountGroupCode || '', // Usar o DiscountGroupCode do cliente
        customer.CustomerID || '',
        customer.Name || customer.CustomerName || customer.Contact || customer.ContactName || 'Cliente',
        customer.Address || '',
        city,
        zip,
        country,
        customer.Email || '',
        String(customer.Phone || customer.Telephone || '').trim(),
        customer.Contact || customer.ContactName || '',
        vatId,
        customer.Login || customer.Email || customer.CustomerID || '',
        customer.Password || '123456',
        customer.Active === 0 || customer.Active === false ? '0' : '1',
        customer.Currency || 'EUR',
        customer.WebSiteUrl || customer.Website || '',
        customer.Tag || '',
        customer.ReservedForFutureUse || ''
      ];

      // Join with semicolon and trim whitespace
      const csvLine = row.map(field => 
        String(field).replace(/[\r\n\t]/g, ' ').trim()
      ).join(';');

      csvRows.push(csvLine);
    }

    const csv = csvRows.join('\n');

    logger.info('Customers CSV generated successfully', {
      rowCount: csvRows.length,
      sampleRow: csvRows[0],
      sampleRowSplit: csvRows[0]?.split(';')
    });
    
    // Log first 3 rows for debugging
    logger.info('First 3 CSV rows:', csvRows.slice(0, 3));

    return {
      csv,
      count: csvRows.length
    };
  }

  /**
   * Send customers from SQL Server to TypsForYou
   */
  static async sendCustomersToTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      customerId?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    try {
      logger.info('Starting customers sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // Generate CSV
      const csvResult = await this.generateCustomersCsv(organizationId, options);

      if (csvResult.count === 0) {
        logger.info('No customers to send');
        return {
          success: true,
          sent: 0,
          loadedRecords: 0,
          apiResponse: null
        };
      }

      logger.info(`Generated CSV with ${csvResult.count} customers`);

      // Send to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.uploadCustomersCsv(csvResult.csv);

      // Parse response
      const loadedRecords = response.LoadedRecords || 0;
      const exitCode = response.ExitCode;
      const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;

      if (exitCode === '200' && !hasErrors) {
        logger.info('Customers sent successfully to TypsForYou', {
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
          `Failed to upload customers: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to send customers to TypsForYou:', error);
      throw error;
    }
  }

  /**
   * Update customers in TypsForYou (PUT method)
   */
  static async updateCustomersInTypsForYou(
    organizationId: string,
    providerConfigId: string,
    options?: {
      customerId?: string;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    try {
      logger.info('Starting customers update in TypsForYou...', {
        organizationId,
        providerConfigId,
        options
      });

      // Generate CSV
      const csvResult = await this.generateCustomersCsv(organizationId, options);

      if (csvResult.count === 0) {
        logger.info('No customers to update');
        return {
          success: true,
          sent: 0,
          loadedRecords: 0,
          apiResponse: null
        };
      }

      logger.info(`Generated CSV with ${csvResult.count} customers for update`);

      // Update in TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const response = await client.updateCustomersCsv(csvResult.csv);

      // Parse response
      const loadedRecords = response.LoadedRecords || 0;
      const exitCode = response.ExitCode;
      const hasErrors = response.DataErrorsFound && response.DataErrorsFound.length > 0;

      if (exitCode === '200' && !hasErrors) {
        logger.info('Customers updated successfully in TypsForYou', {
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
          `Failed to update customers: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to update customers in TypsForYou:', error);
      throw error;
    }
  }
}
