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
   * Insert order header into DataDrive_CAB
   */
  private static async insertOrderHeader(
    organizationId: string,
    order: TypsForYouOrder,
    stampCab: string,
    data: string,
    hora: string
  ): Promise<void> {
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
        '${detail.InternalPartNumber || detail.PartNumber}',
        '${detail.PartNumber}',
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
   */
  static async processOrder(
    organizationId: string,
    order: TypsForYouOrder
  ): Promise<{
    success: boolean;
    stampCab: string;
    linesInserted: number;
  }> {
    logger.info('Processing order', {
      orderId: order.OrderID,
      uniqueOrderId: order.UniqueOrderID,
      detailsCount: order.Details.length
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

      logger.info('Order processed successfully', {
        stampCab,
        orderId: order.OrderID,
        linesInserted
      });

      return {
        success: true,
        stampCab,
        linesInserted
      };
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
   */
  static async processOrders(
    organizationId: string,
    ordersResponse: OrdersResponse
  ): Promise<{
    success: boolean;
    ordersProcessed: number;
    totalLines: number;
    errors: Array<{ orderId: string; error: string }>;
  }> {
    const orders = ordersResponse.Orders_Table;
    logger.info('Processing orders batch', { ordersCount: orders.length });

    let ordersProcessed = 0;
    let totalLines = 0;
    const errors: Array<{ orderId: string; error: string }> = [];

    for (const order of orders) {
      try {
        const result = await this.processOrder(organizationId, order);
        ordersProcessed++;
        totalLines += result.linesInserted;
      } catch (error) {
        errors.push({
          orderId: order.OrderID,
          error: error instanceof Error ? error.message : String(error)
        });
        logger.error('Failed to process order', {
          orderId: order.OrderID,
          error
        });
      }
    }

    logger.info('Orders batch processing completed', {
      total: orders.length,
      processed: ordersProcessed,
      totalLines,
      errors: errors.length
    });

    return {
      success: errors.length === 0,
      ordersProcessed,
      totalLines,
      errors
    };
  }
}
