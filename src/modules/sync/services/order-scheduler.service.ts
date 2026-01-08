import { OrderSyncService } from './order-sync.service';
import { OrderProcessingService } from './order-processing.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import { CryptoService } from '@utils/crypto';
import emailService from '@utils/email';
import { config } from '@config/index';
import prisma from '@config/database';
import logger from '@config/logger';

/**
 * Order Scheduler Service
 * Handles automatic fetching of orders from TypsForYou on scheduled intervals
 */
export class OrderSchedulerService {
  /**
   * Fetch orders from TypsForYou and automatically process them
   * This is called by the cron scheduler
   */
  static async fetchAndProcessOrders(
    organizationId: string,
    providerConfigId: string,
    options?: {
      orderId?: string;
      syncConfigurationId?: string;
    }
  ): Promise<{
    success: boolean;
    totalFetched: number;
    ordersProcessed: number;
    ordersSkipped: number;
    ordersNotified: number;
    totalLines: number;
  }> {
    const startTime = Date.now();
    let logId: string | undefined;

    try {
      logger.info('[OrderScheduler] Starting automatic order fetch', {
        organizationId,
        providerConfigId
      });

      // Create execution log entry
      const executionLog = await prisma.syncExecutionLog.create({
        data: {
          syncConfigurationId: options?.syncConfigurationId,
          organizationId,
          providerConfigId,
          syncType: 'ORDER_FETCH',
          status: 'RUNNING',
          startedAt: new Date()
        }
      });
      logId = executionLog.id;

      // 1. Fetch orders from TypsForYou
      const fetchResult = await OrderSyncService.getOrdersFromTypsForYou(
        organizationId,
        providerConfigId,
        options?.orderId
      );

      logger.info('[OrderScheduler] Orders fetched', {
        count: fetchResult.count
      });

      // If no orders, return early
      if (!fetchResult.orders || fetchResult.count === 0) {
        logger.info('[OrderScheduler] No orders to process');
        
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
            totalFailed: 0,
            totalSkipped: 0
          }
        });

        return {
          success: true,
          totalFetched: 0,
          ordersProcessed: 0,
          ordersSkipped: 0,
          ordersNotified: 0,
          totalLines: 0
        };
      }

      // 2. Get provider config for TypsForYou notification
      const providerConfig = await prisma.providerConfig.findUnique({
        where: { id: providerConfigId }
      });

      if (!providerConfig) {
        throw new Error('Provider configuration not found');
      }

      // Decrypt credentials
      const subscriptionKey = providerConfig.webhookSecret 
        ? CryptoService.decrypt(providerConfig.webhookSecret) 
        : undefined;

      // Get authentication token
      const client = new Typs4YouClient(providerConfigId);
      const token = await client.authenticate();

      // 3. Process orders and notify TypsForYou
      const processResult = await OrderProcessingService.processOrders(
        organizationId,
        fetchResult.orders as any,
        {
          notifyTypsForYou: true,
          subscriptionKey,
          token
        }
      );

      logger.info('[OrderScheduler] Orders processed', {
        processed: processResult.ordersProcessed,
        skipped: processResult.ordersSkipped,
        notified: processResult.ordersNotified
      });

      // Update log with success results
      const executionStatus = 
        processResult.ordersProcessed > 0 && processResult.ordersSkipped === 0 
          ? 'SUCCESS' 
          : processResult.ordersProcessed > 0 && processResult.ordersSkipped > 0
          ? 'PARTIAL'
          : 'SUCCESS';

      await prisma.syncExecutionLog.update({
        where: { id: logId },
        data: {
          status: executionStatus,
          completedAt: new Date(),
          duration: Date.now() - startTime,
          totalFetched: fetchResult.count,
          totalProcessed: processResult.ordersProcessed + processResult.ordersSkipped,
          totalSucceeded: processResult.ordersProcessed,
          totalFailed: 0,
          totalSkipped: processResult.ordersSkipped,
          metadata: {
            ordersNotified: processResult.ordersNotified,
            totalLines: processResult.totalLines
          }
        }
      });

      // 4. Send email notification if orders were processed
      if (processResult.ordersProcessed > 0 || processResult.ordersNotified > 0) {
        try {
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0) {
            const ordersResponse = fetchResult.orders as any;
            const ordersTable = ordersResponse?.Orders_Table || [];
            
            const ordersDetails = ordersTable.slice(0, 10).map((order: any) => ({
              orderID: order.OrderID,
              customerName: order.Name,
              total: order.Total,
              linesCount: order.Details?.length || 0,
              orderDate: new Date(order.OrderDate).toLocaleDateString('pt-PT')
            }));

            await emailService.sendOrdersIntegratedEmail(notificationEmails, {
              totalOrders: fetchResult.count,
              newOrders: processResult.ordersProcessed,
              duplicateOrders: processResult.ordersSkipped,
              totalLines: processResult.totalLines,
              notifiedToTypsForYou: processResult.ordersNotified,
              organizationName: 'PHC SQL Server',
              orders: ordersDetails
            });

            logger.info('[OrderScheduler] Email notification sent');
          }
        } catch (emailError) {
          logger.error('[OrderScheduler] Failed to send email notification', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }

      return {
        success: processResult.success,
        totalFetched: fetchResult.count,
        ordersProcessed: processResult.ordersProcessed,
        ordersSkipped: processResult.ordersSkipped,
        ordersNotified: processResult.ordersNotified,
        totalLines: processResult.totalLines
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[OrderScheduler] Failed to fetch and process orders', {
        organizationId,
        providerConfigId,
        error: errorMessage
      });

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

      throw error;
    }
  }
}
