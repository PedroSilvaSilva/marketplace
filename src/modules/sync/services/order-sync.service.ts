import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '@config/logger';
import { AppError } from '@utils/errors';

/**
 * Order Sync Service
 * Handles fetching orders from TypsForYou API
 */
export class OrderSyncService {
  /**
   * Get orders from TypsForYou
   */
  static async getOrdersFromTypsForYou(
    organizationId: string,
    providerConfigId: string,
    orderId?: string
  ) {
    try {
      logger.info('Starting orders fetch from TypsForYou', {
        organizationId,
        providerConfigId,
        orderId
      });

      // Initialize TypsForYou client
      const client = new Typs4YouClient(providerConfigId);

      // Build filters
      const filters: { orderId?: string } = {};
      if (orderId) {
        filters.orderId = orderId;
      }

      // Fetch orders from TypsForYou API
      const response = await client.getOrders(filters);
      
      // Extract orders from response.Orders_Table (TypsForYou format)
      const ordersData = response as { Orders_Table?: any[] };
      const orders = ordersData.Orders_Table || [];

      logger.info('Successfully fetched orders from TypsForYou', {
        organizationId,
        providerConfigId,
        ordersCount: orders.length
      });

      return {
        success: true,
        orders: {
          Orders_Table: orders  // Format expected by processOrders
        },
        count: orders.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch orders from TypsForYou:', {
        organizationId,
        providerConfigId,
        orderId,
        error: errorMessage
      });
      throw new AppError(`Failed to fetch orders: ${errorMessage}`, 500);
    }
  }
}
