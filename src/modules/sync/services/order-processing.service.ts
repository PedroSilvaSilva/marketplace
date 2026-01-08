import { SQLService } from '../../../services/sql.service';
import logger from '../../../config/logger';
import { AppError } from '../../../utils/errors';

interface TypsForYouOrder {
  OrderID: string;
  UniqueOrderID: string;
  OrderDate: string; // "12/17/2025 5:18:44 PM"
  WarehouseCode: string;
  WarehouseName: string;
  CustomerID: string;
  Name: string;
  Address: string;
  City: string;
  Zip: string;
  Country: string;
  Email: string;
  Phone: string;
  Contact: string;
  VAT_ID: string;
  Currency: string;
  DispatchMode: string;
  Comment: string;
  Total: number;
  Integrated: boolean;
  LicensePlate: string | null;
  Kms: number | null;
  Tag: string | null;
  Details: TypsForYouOrderDetail[];
}

interface TypsForYouOrderDetail {
  BrandId: number;
  Name: string | null;
  PartNumber: string;
  InternalPartNumber: string | null;
  ArticleQuantity: number;
  ArticlePrice: number;
  IAM: boolean;
}

interface OrdersResponse {
  StartTime: string;
  EndTime: string;
  Duration: string;
  Orders_Table: TypsForYouOrder[];
}

export class OrderProcessingService {
  /**
   * Parse OrderDate from TypsForYou format to Portuguese date and time
   * Input: "12/17/2025 5:18:44 PM"
   * Output: { data: "2025-12-17", hora: "17:18:44" }
   */
  private static parseOrderDate(orderDate: string): { data: string; hora: string } {
    try {
      // Parse: "12/17/2025 5:18:44 PM"
      const dateObj = new Date(orderDate);
      
      if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date format: ${orderDate}`);
      }

      // Format date as YYYY-MM-DD
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const data = `${year}-${month}-${day}`;

      // Format time as HH:MM:SS (24h format)
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      const hora = `${hours}:${minutes}:${seconds}`;

      return { data, hora };
    } catch (error) {
      logger.error('Failed to parse order date', { orderDate, error });
      throw new AppError(`Invalid order date format: ${orderDate}`, 400);
    }
  }

  /**
   * Generate unique stamp for CAB (header)
   * Format: Last 12 digits of timestamp + 3 random = 15 chars total
   */
  private static generateStampCab(): string {
    const timestamp = Date.now().toString().slice(-12);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp}${random}`;
  }

  /**
   * Generate unique stamp for LIN (line)
   * Format: {stampCab}_{lineNum} = max 20 chars (15+1+4)
   */
  private static generateStampLin(stampCab: string, lineIndex: number): string {
    const lineNum = String(lineIndex + 1).padStart(4, '0');
    return `${stampCab}_${lineNum}`;
  }

  /**
   * Check if order already exists in DataDrive_CAB by NumExterno (OrderID)
   */
  private static async orderExists(
    organizationId: string,
    orderID: string
  ): Promise<boolean> {
    const query = `
      SELECT TOP 1 NumExterno
      FROM [samiparts].[dbo].[DataDrive_CAB]
      WHERE NumExterno = '${orderID}'
    `;

    const result = await SQLService.query(organizationId, query);
    return result.length > 0;
  }

  /**
   * Insert order header into DataDrive_CAB
   * Validates that NumExterno (OrderID) is unique before inserting
   */
  private static async insertOrderHeader(
    organizationId: string,
    order: TypsForYouOrder,
    stampCab: string,
    data: string,
    hora: string
  ): Promise<void> {
    // Validate that order doesn't already exist
    const exists = await this.orderExists(organizationId, order.OrderID);
    if (exists) {
      throw new AppError(
        `Order with NumExterno '${order.OrderID}' already exists in database`,
        409 // Conflict
      );
    }

    const query = `
      INSERT INTO [samiparts].[dbo].[DataDrive_CAB] (
        [stampCab],
        [stampCabArm],
        [NumExterno],
        [Armazem],
        [ArmazemNome],
        [no],
        [nome],
        [Morada],
        [Local],
        [codpost],
        [Pais],
        [email],
        [telefone],
        [Contacto],
        [ncont],
        [moeda],
        [expedicao],
        [obs],
        [total],
        [integra],
        [matricula],
        [kms],
        [data],
        [hora]
      ) VALUES (
        '${stampCab}',
        '${order.UniqueOrderID}',
        '${order.OrderID}',
        '${order.WarehouseCode}',
        '${order.WarehouseName}',
        '${order.CustomerID}',
        '${order.Name.replace(/'/g, "''")}',
        '${order.Address.replace(/'/g, "''")}',
        '${order.City.replace(/'/g, "''")}',
        '${order.Zip}',
        '${order.Country}',
        '${order.Email}',
        '${order.Phone}',
        '${order.Contact.replace(/'/g, "''")}',
        '${order.VAT_ID}',
        '${order.Currency}',
        '${order.DispatchMode || ''}',
        '${(order.Comment || '').replace(/'/g, "''")}',
        ${order.Total},
        ${order.Integrated ? 1 : 0},
        ${order.LicensePlate ? `'${order.LicensePlate}'` : 'NULL'},
        ${order.Kms !== null ? order.Kms : 'NULL'},
        '${data}',
        '${hora}'
      )
    `;

    await SQLService.query(organizationId, query);
  }

  /**
   * Insert order line into DataDrive_LIN
   */
  private static async insertOrderLine(
    organizationId: string,
    detail: TypsForYouOrderDetail,
    stampLin: string,
    stampCab: string,
    data: string,
    hora: string
  ): Promise<void> {
    const query = `
      INSERT INTO [samiparts].[dbo].[DataDrive_LIN] (
        [stampLin],
        [stampCab],
        [cod_marca],
        [marca],
        [tecdoc],
        [ref],
        [qtt],
        [preco],
        [data],
        [hora]
      ) VALUES (
        '${stampLin}',
        '${stampCab}',
        '${detail.BrandId}',
        '${(detail.Name || '').replace(/'/g, "''")}',
        '${detail.PartNumber}',
        '${detail.InternalPartNumber || detail.PartNumber}',
        ${detail.ArticleQuantity},
        ${detail.ArticlePrice},
        '${data}',
        '${hora}'
      )
    `;

    await SQLService.query(organizationId, query);
  }

  /**
   * Process and insert a single order into SQL Server
   * Optionally notifies TypsForYou about integration if credentials provided
   */
  static async processOrder(
    organizationId: string,
    order: TypsForYouOrder,
    options?: {
      notifyTypsForYou?: boolean;
      subscriptionKey?: string;
      token?: string;
    }
  ): Promise<{
    success: boolean;
    stampCab: string;
    linesInserted: number;
    notified?: boolean;
    notificationError?: string;
  }> {
    logger.info('Processing order', {
      orderId: order.OrderID,
      uniqueOrderId: order.UniqueOrderID,
      detailsCount: order.Details.length,
      willNotifyTypsForYou: options?.notifyTypsForYou || false
    });

    try {
      // Parse date and time
      const { data, hora } = this.parseOrderDate(order.OrderDate);

      // Generate unique stamp for header
      const stampCab = this.generateStampCab();

      // Insert header
      await this.insertOrderHeader(organizationId, order, stampCab, data, hora);
      logger.info('Order header inserted', { stampCab, orderId: order.OrderID });

      // Insert lines
      let linesInserted = 0;
      for (let i = 0; i < order.Details.length; i++) {
        const detail = order.Details[i];
        
        if (!detail) {
          logger.warn('Skipping undefined order detail', { 
            orderId: order.OrderID, 
            lineIndex: i 
          });
          continue;
        }

        const stampLin = this.generateStampLin(stampCab, i);

        await this.insertOrderLine(
          organizationId,
          detail,
          stampLin,
          stampCab,
          data,
          hora
        );

        linesInserted++;
      }

      logger.info('Order processed successfully in SQL Server', {
        stampCab,
        orderId: order.OrderID,
        linesInserted
      });

      const result: {
        success: boolean;
        stampCab: string;
        linesInserted: number;
        notified?: boolean;
        notificationError?: string;
      } = {
        success: true,
        stampCab,
        linesInserted
      };

      // Notify TypsForYou if credentials provided
      if (options?.notifyTypsForYou && options?.subscriptionKey && options?.token) {
        try {
          const { OrderIntegrationService } = await import('./order-integration.service');
          
          await OrderIntegrationService.notifySingleOrder(
            organizationId,
            order.OrderID,
            options.subscriptionKey,
            options.token,
            order.Comment || undefined
          );

          logger.info('TypsForYou notified about order integration', {
            orderId: order.OrderID
          });

          result.notified = true;
        } catch (notifyError) {
          const errorMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
          logger.warn('Failed to notify TypsForYou (order still inserted in SQL)', {
            orderId: order.OrderID,
            error: errorMsg
          });
          
          result.notified = false;
          result.notificationError = errorMsg;
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to process order', {
        orderId: order.OrderID,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Process multiple orders from TypsForYou response
   * Optionally notifies TypsForYou about each successful integration
   */
  static async processOrders(
    organizationId: string,
    ordersResponse: OrdersResponse,
    options?: {
      notifyTypsForYou?: boolean;
      subscriptionKey?: string;
      token?: string;
    }
  ): Promise<{
    success: boolean;
    ordersProcessed: number;
    ordersSkipped: number;
    ordersNotified: number;
    totalLines: number;
    errors: Array<{ orderId: string; error: string; type: 'duplicate' | 'error' }>;
    notificationErrors: Array<{ orderId: string; error: string }>;
  }> {
    const orders = ordersResponse.Orders_Table;
    logger.info('Processing orders batch', { 
      ordersCount: orders.length,
      willNotifyTypsForYou: options?.notifyTypsForYou || false
    });

    let ordersProcessed = 0;
    let ordersSkipped = 0;
    let ordersNotified = 0;
    let totalLines = 0;
    const errors: Array<{ orderId: string; error: string; type: 'duplicate' | 'error' }> = [];
    const notificationErrors: Array<{ orderId: string; error: string }> = [];

    for (const order of orders) {
      try {
        const result = await this.processOrder(organizationId, order, options);
        ordersProcessed++;
        totalLines += result.linesInserted;
        
        // Track notification status
        if (result.notified) {
          ordersNotified++;
        } else if (result.notificationError) {
          notificationErrors.push({
            orderId: order.OrderID,
            error: result.notificationError
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isDuplicate = error instanceof AppError && error.statusCode === 409;
        
        if (isDuplicate) {
          ordersSkipped++;
          logger.warn('Order already exists (skipped from SQL insertion)', {
            orderId: order.OrderID,
            error: errorMessage
          });

          // Even if duplicate in SQL, still notify TypsForYou if credentials provided
          // This handles orders inserted before notification logic was implemented
          if (options?.notifyTypsForYou && options?.subscriptionKey && options?.token) {
            try {
              const { OrderIntegrationService } = await import('./order-integration.service');
              
              await OrderIntegrationService.notifySingleOrder(
                organizationId,
                order.OrderID,
                options.subscriptionKey,
                options.token,
                order.Comment || undefined
              );

              logger.info('TypsForYou notified about existing order', {
                orderId: order.OrderID
              });

              ordersNotified++;
            } catch (notifyError) {
              const notifyErrorMsg = notifyError instanceof Error ? notifyError.message : String(notifyError);
              logger.warn('Failed to notify TypsForYou about existing order', {
                orderId: order.OrderID,
                error: notifyErrorMsg
              });
              
              notificationErrors.push({
                orderId: order.OrderID,
                error: notifyErrorMsg
              });
            }
          }
        } else {
          logger.error('Failed to process order', {
            orderId: order.OrderID,
            error
          });
        }

        errors.push({
          orderId: order.OrderID,
          error: errorMessage,
          type: isDuplicate ? 'duplicate' : 'error'
        });
      }
    }

    logger.info('Orders batch processing completed', {
      total: orders.length,
      processed: ordersProcessed,
      skipped: ordersSkipped,
      notified: ordersNotified,
      totalLines,
      errors: errors.length,
      notificationErrors: notificationErrors.length
    });

    return {
      success: errors.filter(e => e.type === 'error').length === 0,
      ordersProcessed,
      ordersSkipped,
      ordersNotified,
      totalLines,
      errors,
      notificationErrors
    };
  }
}
