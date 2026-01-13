import { SQLService } from '@/services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import FormData from 'form-data';
import logger from '@/config/logger';
import { ErrorNotificationService } from '@services/error-notification.service';

interface OrderIntegrationRecord {
  NumExterno: string;
  integra: number;
  obs: string;
}

interface OrderIntegrationResponse {
  StartTime: string;
  EndTime: string;
  Duration: string;
  LoadedRecords: number;
  ExitCode: number;
  ExitMessage: string;
  DataErrorsFound?: Array<{
    line: number;
    error: string;
  }>;
}

/**
 * Service to notify TypsForYou about integrated orders
 * Reads from DataDrive_CAB where integra = 1 (already integrated by PHC)
 * PHC updates integra=1, we only notify TypsForYou
 */
export class OrderIntegrationService {
  /**
   * Get integrated orders from DataDrive_CAB (integra = 1)
   * These orders were already integrated by PHC
   */
  private static async getIntegratedOrders(
    organizationId: string
  ): Promise<OrderIntegrationRecord[]> {
    const query = `
      SELECT 
        NumExterno,
        integra,
        obs
      FROM [samiparts].[dbo].[DataDrive_CAB]
      WHERE integra = 1
      ORDER BY data DESC, hora DESC
    `;

    return await SQLService.query<OrderIntegrationRecord>(organizationId, query);
  }

  /**
   * Generate CSV content for order integration
   * Format: OrderID;Integrated;Tag (3 columns, no trailing semicolon)
   */
  private static generateIntegrationCSV(orders: OrderIntegrationRecord[]): string {
    const lines = orders.map((order) => {
      const orderId = order.NumExterno;
      const integrated = 1; // Mark as integrated
      const tag = order.obs || ''; // Tag can be empty
      return `${orderId};${integrated};${tag}`;
    });

    return lines.join('\n');
  }

  /**
   * Send integration CSV to TypsForYou API
   */
  private static async sendToTypsForYou(
    subscriptionKey: string,
    token: string,
    csvContent: string
  ): Promise<OrderIntegrationResponse> {
    // Process CSV: remove trailing whitespace and use Windows line endings
    let csvString = csvContent;
    
    // Remove any trailing whitespace from each line BEFORE converting line endings
    csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
    
    // Replace LF with CRLF for proper CSV format
    csvString = csvString.replace(/\n/g, '\r\n');
    
    const csvBuffer = Buffer.from(csvString, 'utf8');
    
    const formData = new FormData();
    formData.append('File', csvBuffer, {
      filename: `orders_integration_${Date.now()}.csv`,
      contentType: 'text/csv; charset=utf-8'
    });

    const response = await Typs4YouClient.uploadFile('/orders', subscriptionKey, token, formData);
    return response as OrderIntegrationResponse;
  }

  /**
   * Notify single order integration to TypsForYou immediately after SQL insertion
   * Used for real-time integration notification
   */
  static async notifySingleOrder(
    organizationId: string,
    orderID: string,
    subscriptionKey: string,
    token: string,
    tag?: string
  ): Promise<{
    success: boolean;
    response: OrderIntegrationResponse;
  }> {
    try {
      logger.info('Notifying single order integration to TypsForYou', {
        organizationId,
        orderID
      });

      // Generate CSV for single order: OrderID;Integrated;Tag
      const integrated = 1; // Mark as integrated
      const csvContent = `${orderID};${integrated};${tag || ''}`;

      logger.info('Generated integration CSV', { csvContent });

      // Send to TypsForYou
      const apiResponse = await this.sendToTypsForYou(subscriptionKey, token, csvContent);

      logger.info('TypsForYou integration notification sent', {
        orderID,
        exitCode: apiResponse.ExitCode,
        exitMessage: apiResponse.ExitMessage
      });

      const success = apiResponse.ExitCode === 0;

      // Send error notification if failed
      if (!success) {
        await ErrorNotificationService.sendErrorNotification({
          context: 'orders',
          organizationId,
          errorMessage: `Order ${orderID} integration notification failed: ${apiResponse.ExitMessage}`,
          errorDetails: {
            orderID,
            exitCode: apiResponse.ExitCode,
            exitMessage: apiResponse.ExitMessage,
            errors: apiResponse.DataErrorsFound
          },
          stackTrace: null,
          metadata: {
            subscriptionKey
          }
        });
      }

      return {
        success,
        response: apiResponse
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      logger.error('Failed to notify single order integration', {
        orderID,
        error: errorMessage
      });

      // Send critical error notification
      await ErrorNotificationService.sendErrorNotification({
        context: 'orders',
        organizationId,
        errorMessage: `Order ${orderID} integration notification threw exception: ${errorMessage}`,
        errorDetails: {
          orderID,
          errorType: error?.name || 'Unknown'
        },
        stackTrace: error?.stack,
        metadata: {
          subscriptionKey
        }
      });

      throw new Error(`Failed to notify order integration: ${errorMessage}`);
    }
  }

  /**
   * Main integration notification process
   * 1. Get integrated orders from SQL Server (integra = 1)
   * 2. Generate CSV
   * 3. Send notification to TypsForYou
   * Note: We don't update SQL Server - PHC does that
   */
  static async notifyIntegratedOrders(
    organizationId: string,
    subscriptionKey: string,
    token: string
  ): Promise<{
    success: boolean;
    totalOrders: number;
    notifiedOrders: number;
    response: OrderIntegrationResponse;
    errors?: string[];
  }> {
    console.log('[OrderIntegration] Method called with:', { organizationId, hasSubscriptionKey: !!subscriptionKey });
    
    try {
      console.log('[OrderIntegration] Inside try block');
      logger.info(`[OrderIntegration] Starting notification for organization ${organizationId}`);

      // 1. Get integrated orders (integra = 1)
      console.log('[OrderIntegration] About to call getIntegratedOrders');
      const integratedOrders = await this.getIntegratedOrders(organizationId);
      console.log('[OrderIntegration] getIntegratedOrders returned:', integratedOrders.length);
      
      if (integratedOrders.length === 0) {
        logger.info('[OrderIntegration] No integrated orders found');
        return {
          success: true,
          totalOrders: 0,
          notifiedOrders: 0,
          response: {
            StartTime: new Date().toISOString(),
            EndTime: new Date().toISOString(),
            Duration: '0ms',
            LoadedRecords: 0,
            ExitCode: 0,
            ExitMessage: 'No integrated orders to notify'
          }
        };
      }

      logger.info(`[OrderIntegration] Found ${integratedOrders.length} integrated orders`);

      // 2. Generate CSV
      const csvContent = this.generateIntegrationCSV(integratedOrders);
      logger.info(`[OrderIntegration] Generated CSV with ${integratedOrders.length} lines`);
      logger.info(`[OrderIntegration] CSV preview: ${csvContent.substring(0, 200)}`);

      // 3. Send to TypsForYou
      const apiResponse = await this.sendToTypsForYou(subscriptionKey, token, csvContent);
      logger.info(`[OrderIntegration] API Response type: ${typeof apiResponse}`);
      logger.info(`[OrderIntegration] API Response: ${JSON.stringify(apiResponse)}`);

      // Validate response structure
      if (!apiResponse || typeof apiResponse !== 'object') {
        logger.error('[OrderIntegration] Invalid API response format');
        throw new Error('Invalid API response format');
      }

      const errors = [];
      if (apiResponse.DataErrorsFound && Array.isArray(apiResponse.DataErrorsFound)) {
        for (const e of apiResponse.DataErrorsFound) {
          errors.push(`Line ${e?.line || 'unknown'}: ${e?.error || e?.message || 'Unknown error'}`);
        }
      }

      const result = {
        success: apiResponse.ExitCode === 0,
        totalOrders: integratedOrders.length,
        notifiedOrders: apiResponse.LoadedRecords || 0,
        response: apiResponse,
        errors
      };

      logger.info('[OrderIntegration] Service completed successfully');
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      logger.error('[OrderIntegration] Error:', errorMessage);
      throw new Error(`Order integration notification failed: ${errorMessage}`);
    }
  }

  /**
   * Get integration statistics
   */
  static async getIntegrationStats(organizationId: string): Promise<{
    totalOrders: number;
    integratedOrders: number;
    pendingOrders: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN integra = 1 THEN 1 ELSE 0 END) as integrated,
        SUM(CASE WHEN integra = 0 THEN 1 ELSE 0 END) as pending
      FROM [samiparts].[dbo].[DataDrive_CAB]
    `;

    const result = await SQLService.query<any>(organizationId, query);
    
    return {
      totalOrders: result[0]?.total || 0,
      integratedOrders: result[0]?.integrated || 0,
      pendingOrders: result[0]?.pending || 0
    };
  }
}
