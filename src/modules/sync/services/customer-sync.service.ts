import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';
import { ErrorNotificationService } from '@services/error-notification.service';
import prisma from '@config/database';

export class CustomerSyncService {
  /**
   * Generate customers CSV from SQL Server view
   * Format: DiscountGroupCode;CustomerID;Name;Address;City;Zip;Country;Email;Phone;Contact;VatId;Login;Password;Active;Currency;WebSiteUrl;Tag;ReservedForFutureUse
   * EXACTLY 18 columns required by TypsForYou API
   */
  static async generateCustomersCsv(
    organizationId: string,
    options?: {
      customerId?: string;
      lastSyncDate?: Date;
    }
  ): Promise<{
    csv: string;
    count: number;
  }> {
    logger.info('Generating customers CSV...', { organizationId, options });

    // Fetch customers from SQL Server (incremental if lastSyncDate provided)
    const customers = await SQLService.getCustomers(
      organizationId, 
      options?.customerId,
      options?.lastSyncDate
    );

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
      
      // Clean email - take only first email if multiple are present, remove spaces and semicolons
      let email = String(customer.Email || '').trim();
      if (email.includes(';') || email.includes(',')) {
        // Take first email and clean it
        email = email.split(/[;,]/)[0].trim();
      }
      email = email.replace(/\s+/g, ''); // Remove all spaces
      
      // Clean DiscountGroupCode - TypsForYou only accepts EXCELENCIA
      // Convert any variation of N/A to EXCELENCIA
      let discountGroupCode = String(customer.DiscountGroupCode || '').trim();
      
      // If empty, .N/A, N/A or any variation, use EXCELENCIA
      if (!discountGroupCode || 
          discountGroupCode === '.N/A' || 
          discountGroupCode === 'N/A' ||
          discountGroupCode.toUpperCase().includes('N/A')) {
        discountGroupCode = 'EXCELENCIA';
      }
      
      // Clean Login - take first email if using email field
      let login = customer.Login || email || customer.CustomerID || '';
      if (login.includes(';') || login.includes(',')) {
        login = login.split(/[;,]/)[0].trim();
      }
      login = String(login).replace(/\s+/g, '');
      
      // TypsForYou API requires EXACTLY 18 columns:
      // DiscountGroupCode;CustomerID;Name;Address;City;Zip;Country;Email;Phone;Contact;VatId;Login;Password;Active;Currency;WebShopId;Tag;ReservedForFutureUse
      const row = [
        discountGroupCode,           // 1
        customer.CustomerID || '',   // 2
        customer.Name || customer.CustomerName || customer.Contact || customer.ContactName || 'Cliente', // 3
        customer.Address || '',      // 4
        city,                        // 5
        zip,                         // 6
        country,                     // 7
        email,                       // 8
        String(customer.Phone || customer.Telephone || '').trim(), // 9
        customer.Contact || customer.ContactName || '', // 10
        vatId,                       // 11
        login,                       // 12
        customer.Password || '123456', // 13
        customer.Active === 0 || customer.Active === false ? '0' : '1', // 14
        customer.Currency || 'EUR',  // 15
        customer.CustomerID || '',   // 16 - Force WebShopId to match CustomerID as requested
        customer.Tag || '',          // 17
        customer.ReservedForFutureUse || '' // 18
      ];

      // Log first customer row fields for debugging
      if (csvRows.length === 0) {
        logger.info('First customer row fields (18 columns):', {
          '1_discountGroupCode': discountGroupCode,
          '2_customerID': customer.CustomerID,
          '3_name': customer.Name,
          '4_address': customer.Address,
          '5_city': city,
          '6_zip': zip,
          '7_country': country,
          '8_email': email,
          '9_phone': customer.Phone,
          '10_contact': customer.Contact,
          '11_vatId': vatId,
          '12_login': login,
          '13_password': '***',
          '14_active': customer.Active,
          '15_currency': customer.Currency,
          '16_webShopId': customer.CustomerID,
          '17_tag': customer.Tag,
          '18_reserved': customer.ReservedForFutureUse,
          totalFields: row.length,
          rowArray: row
        });
      }

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
      syncConfigurationId?: string;
      lastSyncDate?: Date;
    }
  ): Promise<{
    success: boolean;
    sent: number;
    loadedRecords: number;
    apiResponse: unknown;
  }> {
    const startTime = Date.now();
    let logId: string | undefined;
    
    try {
      // Get last successful sync date for incremental sync
      let lastSyncDate = options?.lastSyncDate;
      if (!lastSyncDate && options?.syncConfigurationId) {
        const lastSuccessfulLog = await prisma.syncExecutionLog.findFirst({
          where: {
            syncConfigurationId: options.syncConfigurationId,
            status: 'SUCCESS'
          },
          orderBy: { completedAt: 'desc' }
        });
        lastSyncDate = lastSuccessfulLog?.completedAt || undefined;
      }

      logger.info('Starting customers sync to TypsForYou...', {
        organizationId,
        providerConfigId,
        options,
        mode: lastSyncDate ? 'incremental' : 'full',
        lastSyncDate: lastSyncDate?.toISOString()
      });

      // Create execution log entry
      const executionLog = await prisma.syncExecutionLog.create({
        data: {
          syncConfigurationId: options?.syncConfigurationId,
          organizationId,
          providerConfigId,
          syncType: 'CUSTOMERS',
          status: 'RUNNING',
          startedAt: new Date(),
          metadata: {
            mode: lastSyncDate ? 'incremental' : 'full',
            lastSyncDate: lastSyncDate?.toISOString()
          }
        }
      });
      logId = executionLog.id;

      // Generate CSV (incremental if lastSyncDate available)
      const csvResult = await this.generateCustomersCsv(organizationId, {
        ...options,
        lastSyncDate
      });

      if (csvResult.count === 0) {
        logger.info('No customers to send');
        
        // Update log as success with no items
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

        // Update log with success results
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            duration: Date.now() - startTime,
            totalFetched: csvResult.count,
            totalProcessed: csvResult.count,
            totalSucceeded: loadedRecords,
            totalFailed: csvResult.count - loadedRecords
          }
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

        // Extract failed CustomerIDs from errors
        const errors = response.DataErrorsFound || [];
        const failedCustomerIds = errors
          .map((err: any) => {
            const match = err.Error_Message?.match(/CustomerID[:\s]+([A-Z0-9-]+)/i);
            return match ? match[1] : null;
          })
          .filter((id: any): id is string => id !== null)
          .slice(0, 20);

        // Send error notification
        await ErrorNotificationService.sendErrorNotification({
          context: 'customers',
          organizationId,
          errorMessage: `Customers sync failed: ${response.ExitMesssage || 'Unknown error'}`,
          errorDetails: {
            sent: csvResult.count,
            loaded: loadedRecords,
            failed: csvResult.count - loadedRecords,
            exitCode,
            errors: errors.slice(0, 10),
            failedCustomerIds
          },
          stackTrace: null,
          metadata: {
            providerConfigId,
            executionLogId: logId
          }
        });
        
        // Update log as partial/failed
        const executionStatus = loadedRecords > 0 ? 'PARTIAL' : 'FAILED';
        await prisma.syncExecutionLog.update({
          where: { id: logId },
          data: {
            status: executionStatus,
            completedAt: new Date(),
            duration: Date.now() - startTime,
            totalFetched: csvResult.count,
            totalProcessed: csvResult.count,
            totalSucceeded: loadedRecords,
            totalFailed: csvResult.count - loadedRecords,
            errorMessage: response.ExitMesssage || 'Unknown error'
          }
        });

        throw new AppError(
          `Failed to upload customers: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('Failed to send customers to TypsForYou:', error);

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
      if (error instanceof Error && !error.message.includes('Failed to upload customers')) {
        await ErrorNotificationService.sendErrorNotification({
          context: 'customers',
          organizationId,
          errorMessage: `Sincronização de clientes falhou: ${error.message}`,
          errorDetails: {
            errorType: error.name,
            providerConfigId
          },
          stackTrace: error.stack,
          metadata: {
            providerConfigId
          }
        });
      }

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

        // Extract failed CustomerIDs from errors
        const errors = response.DataErrorsFound || [];
        const failedCustomerIds = errors
          .map((err: any) => {
            const match = err.Error_Message?.match(/CustomerID[:\s]+([A-Z0-9-]+)/i);
            return match ? match[1] : null;
          })
          .filter((id: any): id is string => id !== null)
          .slice(0, 20);

        // Send error notification
        await ErrorNotificationService.sendErrorNotification({
          context: 'customers',
          organizationId,
          errorMessage: `Customers update failed: ${response.ExitMesssage || 'Unknown error'}`,
          errorDetails: {
            sent: csvResult.count,
            loaded: loadedRecords,
            failed: csvResult.count - loadedRecords,
            exitCode,
            errors: errors.slice(0, 10),
            failedCustomerIds
          },
          stackTrace: null,
          metadata: {
            providerConfigId
          }
        });

        throw new AppError(
          `Failed to update customers: ${response.ExitMesssage || 'Unknown error'}. Errors: ${JSON.stringify(response.DataErrorsFound)}`,
          400
        );
      }

    } catch (error: unknown) {
      logger.error('Failed to update customers in TypsForYou:', error);

      // Send critical error notification
      if (error instanceof Error && !error.message.includes('Failed to update customers')) {
        await ErrorNotificationService.sendErrorNotification({
          context: 'customers',
          organizationId,
          errorMessage: `Customers update failed critically: ${error.message}`,
          errorDetails: {
            errorType: error.name,
            providerConfigId
          },
          stackTrace: error.stack,
          metadata: {
            providerConfigId
          }
        });
      }

      throw error;
    }
  }
}
