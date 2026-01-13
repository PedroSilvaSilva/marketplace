import emailService from '@utils/email';
import logger from '@config/logger';
import { config } from '@config/index';
import prisma from '@config/database';

/**
 * Context types for error logging
 */
export type ErrorContext = 
  | 'articles'
  | 'warehouse'
  | 'orders'
  | 'discountGroup'
  | 'discountSubGroup'
  | 'customers'
  | 'customerDiscountGroup'
  | 'customerWarehouse';

/**
 * Error notification payload (legacy format - for backward compatibility)
 */
export interface ErrorNotificationData {
  context: ErrorContext;
  method: string;
  error: Error | unknown;
  additionalInfo?: Record<string, any>;
  
  // Context-specific identifiers
  internalPartNumber?: string;  // articles, warehouse
  orderNumber?: string;          // orders
  articleDiscountGroupCode?: string;  // discountGroup
  discountSubGroupCode?: string;      // discountSubGroup
  customerId?: string;           // customers
}

/**
 * New error notification payload (used by newer services)
 */
export interface NewErrorNotificationData {
  context: string;
  organizationId: string;
  errorMessage: string;
  errorDetails?: Record<string, any>;
  stackTrace?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Service for sending error notifications via email
 */
export class ErrorNotificationService {
  /**
   * Send error notification email and save log to database (NEW FORMAT)
   */
  static async sendErrorNotification(data: NewErrorNotificationData): Promise<string>;
  /**
   * Send error notification email and save log to database (LEGACY FORMAT)
   */
  static async sendErrorNotification(data: ErrorNotificationData): Promise<string>;
  /**
   * Implementation
   */
  static async sendErrorNotification(data: NewErrorNotificationData | ErrorNotificationData): Promise<string> {
    // Check if it's new format or legacy format
    const isNewFormat = 'errorMessage' in data && 'organizationId' in data;
    
    if (isNewFormat) {
      return this.sendNewFormatNotification(data as NewErrorNotificationData);
    } else {
      return this.sendLegacyFormatNotification(data as ErrorNotificationData);
    }
  }

  /**
   * Handle new format notifications (used by customer-sync and newer services)
   */
  private static async sendNewFormatNotification(data: NewErrorNotificationData): Promise<string> {
    const { context, organizationId, errorMessage, errorDetails, stackTrace, metadata } = data;

    let emailSent = false;
    let emailSentAt: Date | undefined;
    let emailRecipients: string[] = [];
    let emailError: string | undefined;

    try {
      // Extract failed identifiers from errorDetails
      let identifierInfo = '';
      if (errorDetails) {
        if (errorDetails.failedCustomerIds && errorDetails.failedCustomerIds.length > 0) {
          identifierInfo += `\n<strong>Failed Customer IDs:</strong> ${errorDetails.failedCustomerIds.slice(0, 10).join(', ')}`;
          if (errorDetails.failedCustomerIds.length > 10) {
            identifierInfo += ` ... +${errorDetails.failedCustomerIds.length - 10} more`;
          }
        }
        if (errorDetails.failedOrderIDs && errorDetails.failedOrderIDs.length > 0) {
          identifierInfo += `\n<strong>Failed Order IDs:</strong> ${errorDetails.failedOrderIDs.slice(0, 10).join(', ')}`;
        }
        if (errorDetails.failedCodes && errorDetails.failedCodes.length > 0) {
          identifierInfo += `\n<strong>Failed Codes:</strong> ${errorDetails.failedCodes.slice(0, 10).join(', ')}`;
        }
      }

      // Build stats section
      let statsHtml = '';
      if (errorDetails && (errorDetails.sent || errorDetails.loaded || errorDetails.failed)) {
        statsHtml = `
          <h3>Statistics</h3>
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p><strong>Sent:</strong> ${errorDetails.sent || 0}</p>
            <p><strong>Loaded:</strong> ${errorDetails.loaded || 0}</p>
            <p><strong>Failed:</strong> ${errorDetails.failed || 0}</p>
          </div>
        `;
      }

      // Build additional info section
      let additionalInfoHtml = '';
      if (errorDetails && Object.keys(errorDetails).length > 0) {
        additionalInfoHtml = '<h3>Error Details</h3><ul>';
        for (const [key, value] of Object.entries(errorDetails)) {
          if (!['failedCustomerIds', 'failedOrderIDs', 'failedCodes', 'sent', 'loaded', 'failed'].includes(key)) {
            additionalInfoHtml += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
          }
        }
        additionalInfoHtml += '</ul>';
      }

      // Build stack trace section
      const stackTraceHtml = stackTrace 
        ? `<h3>Stack Trace</h3><pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${stackTrace}</pre>`
        : '';

      // Get notification emails
      const notificationEmails = config.email.orderNotificationEmails.length > 0
        ? config.email.orderNotificationEmails
        : [config.email.from];

      emailRecipients = notificationEmails;

      // Send email
      await emailService.sendEmail({
        to: notificationEmails,
        subject: `❌ Erro em ${context.toUpperCase()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 4px 4px 0 0;">
              <h1 style="margin: 0;">❌ Erro no Sistema CSW Markets</h1>
            </div>
            
            <div style="padding: 20px; background-color: #fff; border: 1px solid #ddd; border-top: none;">
              <h2>Detalhes do Erro</h2>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                <p><strong>Contexto:</strong> ${context}</p>
                <p><strong>Organização:</strong> ${organizationId}</p>
                <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-PT')}</p>${identifierInfo}
              </div>

              <h3>Mensagem de Erro</h3>
              <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                <p style="margin: 0; color: #856404;"><strong>${errorMessage}</strong></p>
              </div>

              ${statsHtml}
              ${additionalInfoHtml}
              ${stackTraceHtml}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 4px 4px; color: #6c757d; font-size: 12px;">
              <p style="margin: 0;">CSW Markets Integrator - Sistema de Notificação de Erros</p>
            </div>
          </div>
        `,
        text: `
Erro no Sistema CSW Markets

Contexto: ${context}
Organização: ${organizationId}
Data/Hora: ${new Date().toLocaleString('pt-PT')}
${identifierInfo.replace(/<[^>]*>/g, '')}

Mensagem de Erro:
${errorMessage}

${stackTrace ? `Stack Trace:\n${stackTrace}` : ''}

${errorDetails ? `\nDetalhes:\n${JSON.stringify(errorDetails, null, 2)}` : ''}
        `
      });

      emailSent = true;
      emailSentAt = new Date();

      logger.info('Error notification email sent successfully', {
        context,
        recipients: notificationEmails
      });

    } catch (emailSendError) {
      emailError = emailSendError instanceof Error ? emailSendError.message : String(emailSendError);
      
      logger.error('Failed to send error notification email:', {
        originalError: errorMessage,
        emailError
      });
    }

    // Save log to database (always save, even if email failed)
    try {
      const logEntry = await prisma.errorNotificationLog.create({
        data: {
          context: context as any,
          method: metadata?.method || 'sync',
          errorMessage,
          errorStack: stackTrace || undefined,
          additionalInfo: {
            ...errorDetails,
            ...metadata,
            organizationId
          },
          emailSent,
          emailSentAt,
          emailRecipients,
          emailError
        }
      });

      logger.info('Error log saved to database', { logId: logEntry.id });

      return logEntry.id;

    } catch (dbError) {
      logger.error('Failed to save error log to database:', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        context,
        errorMessage
      });
      
      return 'db-save-failed';
    }
  }

  /**
   * Handle legacy format notifications (for backward compatibility)
   */
  private static async sendLegacyFormatNotification(data: ErrorNotificationData): Promise<string> {
    const errorMessage = data.error instanceof Error ? data.error.message : String(data.error);
    const errorStack = data.error instanceof Error ? data.error.stack : undefined;

    let emailSent = false;
    let emailSentAt: Date | undefined;
    let emailRecipients: string[] = [];
    let emailError: string | undefined;

    try {

      // Build context-specific identifier info
      let identifierInfo = '';
      switch (data.context) {
        case 'articles':
          identifierInfo = data.internalPartNumber 
            ? `\n<strong>InternalPartNumber:</strong> ${data.internalPartNumber}` 
            : '';
          break;
        case 'warehouse':
          identifierInfo = data.internalPartNumber 
            ? `\n<strong>InternalPartNumber:</strong> ${data.internalPartNumber}` 
            : '';
          break;
        case 'orders':
          identifierInfo = data.orderNumber 
            ? `\n<strong>Número da Encomenda:</strong> ${data.orderNumber}` 
            : '';
          break;
        case 'discountGroup':
          identifierInfo = data.articleDiscountGroupCode 
            ? `\n<strong>ArticleDiscountGroupCode:</strong> ${data.articleDiscountGroupCode}` 
            : '';
          break;
        case 'discountSubGroup':
          identifierInfo = data.discountSubGroupCode 
            ? `\n<strong>DiscountSubGroupCode:</strong> ${data.discountSubGroupCode}` 
            : '';
          break;
        case 'customers':
          identifierInfo = data.customerId 
            ? `\n<strong>CustomerID:</strong> ${data.customerId}` 
            : '';
          break;
        case 'customerDiscountGroup':
          identifierInfo = data.customerId 
            ? `\n<strong>CustomerID:</strong> ${data.customerId}` 
            : '';
          break;
        case 'customerWarehouse':
          identifierInfo = data.customerId 
            ? `\n<strong>CustomerID:</strong> ${data.customerId}` 
            : '';
          break;
      }

      // Build additional info section
      let additionalInfoHtml = '';
      if (data.additionalInfo && Object.keys(data.additionalInfo).length > 0) {
        additionalInfoHtml = '<h3>Informação Adicional</h3><ul>';
        for (const [key, value] of Object.entries(data.additionalInfo)) {
          additionalInfoHtml += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
        }
        additionalInfoHtml += '</ul>';
      }

      // Build stack trace section
      const stackTraceHtml = errorStack 
        ? `<h3>Stack Trace</h3><pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${errorStack}</pre>`
        : '';

      // Get notification emails
      const notificationEmails = config.email.orderNotificationEmails.length > 0
        ? config.email.orderNotificationEmails
        : [config.email.from];

      emailRecipients = notificationEmails;

      // Send email
      await emailService.sendEmail({
        to: notificationEmails,
        subject: `❌ Erro em ${data.context} - ${data.method}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
            <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 4px 4px 0 0;">
              <h1 style="margin: 0;">❌ Erro no Sistema CSW Markets</h1>
            </div>
            
            <div style="padding: 20px; background-color: #fff; border: 1px solid #ddd; border-top: none;">
              <h2>Detalhes do Erro</h2>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                <p><strong>Contexto:</strong> ${data.context}</p>
                <p><strong>Método:</strong> ${data.method}</p>
                <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-PT')}</p>${identifierInfo}
              </div>

              <h3>Mensagem de Erro</h3>
              <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                <p style="margin: 0; color: #856404;"><strong>${errorMessage}</strong></p>
              </div>

              ${additionalInfoHtml}
              
              ${stackTraceHtml}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 4px 4px; color: #6c757d; font-size: 12px;">
              <p style="margin: 0;">CSW Markets Integrator - Sistema de Notificação de Erros</p>
            </div>
          </div>
        `,
        text: `
Erro no Sistema CSW Markets

Contexto: ${data.context}
Método: ${data.method}
Data/Hora: ${new Date().toLocaleString('pt-PT')}
${identifierInfo.replace(/<[^>]*>/g, '')}

Mensagem de Erro:
${errorMessage}

${errorStack ? `Stack Trace:\n${errorStack}` : ''}

${data.additionalInfo ? `\nInformação Adicional:\n${JSON.stringify(data.additionalInfo, null, 2)}` : ''}
        `
      });

      emailSent = true;
      emailSentAt = new Date();

      logger.info('Error notification email sent successfully', {
        context: data.context,
        method: data.method,
        recipients: notificationEmails
      });

    } catch (emailSendError) {
      // Don't throw - just log if email fails (to avoid cascading errors)
      emailError = emailSendError instanceof Error ? emailSendError.message : String(emailSendError);
      
      logger.error('Failed to send error notification email:', {
        originalError: errorMessage,
        emailError
      });
    }

    // Save log to database (always save, even if email failed)
    try {
      const logEntry = await prisma.errorNotificationLog.create({
        data: {
          context: data.context as any,
          method: data.method,
          errorMessage,
          errorStack,
          internalPartNumber: data.internalPartNumber,
          orderNumber: data.orderNumber,
          articleDiscountGroupCode: data.articleDiscountGroupCode,
          discountSubGroupCode: data.discountSubGroupCode,
          customerId: data.customerId,
          additionalInfo: data.additionalInfo || {},
          emailSent,
          emailSentAt,
          emailRecipients,
          emailError
        }
      });

      logger.info('Error log saved to database', { logId: logEntry.id });

      return logEntry.id;

    } catch (dbError) {
      logger.error('Failed to save error log to database:', {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      
      // Return a placeholder ID if database save fails
      return 'db-save-failed';
    }
  }

  /**
   * Send test error notification
   */
  static async sendTestNotification(): Promise<void> {
    const testError = new Error('Este é um teste de notificação de erro');
    testError.stack = 'Error: Este é um teste de notificação de erro\n    at ErrorNotificationService.sendTestNotification (error-notification.service.ts:123:45)';

    await this.sendErrorNotification({
      context: 'articles',
      method: 'sendTestNotification',
      error: testError,
      internalPartNumber: 'TEST-12345',
      additionalInfo: {
        organizationId: 'test-org-id',
        providerConfigId: 'test-provider-id',
        timestamp: new Date().toISOString()
      }
    });
  }
}
