import emailService from '@utils/email';
import logger from '@config/logger';
import { config } from '@config/index';
import prisma from '@config/database';

/**
 * Service for daily success reports
 * Sends summary of successful operations at end of day
 */
export class DailyReportService {
  /**
   * Generate and send daily success report
   */
  static async sendDailySuccessReport(date?: Date): Promise<void> {
    try {
      const reportDate = date || new Date();
      const startOfDay = new Date(reportDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(reportDate);
      endOfDay.setHours(23, 59, 59, 999);

      logger.info('Generating daily success report...', {
        startOfDay,
        endOfDay
      });

      // Get statistics from sync execution logs (successes only)
      const [
        totalSuccessful,
        totalFailed,
        totalPartial,
        byType,
        topOrganizations,
        errorsByContext,
        recentErrors
      ] = await Promise.all([
        // Total successful syncs
        prisma.syncExecutionLog.count({
          where: {
            status: 'SUCCESS',
            startedAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        
        // Total failed syncs
        prisma.syncExecutionLog.count({
          where: {
            status: 'FAILED',
            startedAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        
        // Total partial syncs
        prisma.syncExecutionLog.count({
          where: {
            status: 'PARTIAL',
            startedAt: { gte: startOfDay, lte: endOfDay }
          }
        }),
        
        // By sync type
        prisma.syncExecutionLog.groupBy({
          by: ['syncType', 'status'],
          where: {
            startedAt: { gte: startOfDay, lte: endOfDay }
          },
          _count: true,
          _sum: {
            totalProcessed: true,
            duration: true
          }
        }),
        
        // Top organizations
        prisma.syncExecutionLog.groupBy({
          by: ['organizationId'],
          where: {
            status: 'SUCCESS',
            startedAt: { gte: startOfDay, lte: endOfDay }
          },
          _count: true,
          _sum: {
            totalProcessed: true
          },
          orderBy: {
            _count: {
              organizationId: 'desc'
            }
          },
          take: 10
        }),
        
        // Errors by context from ErrorNotificationLog
        prisma.errorNotificationLog.groupBy({
          by: ['context'],
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          },
          _count: true
        }),
        
        // Recent detailed errors
        prisma.errorNotificationLog.findMany({
          where: {
            createdAt: { gte: startOfDay, lte: endOfDay }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10,
          select: {
            context: true,
            errorMessage: true,
            errorDetails: true,
            createdAt: true
          }
        })
      ]);

      // If no operations at all, don't send report
      const totalOperations = totalSuccessful + totalFailed + totalPartial;
      if (totalOperations === 0) {
        logger.info('No operations today, skipping report');
        return;
      }

      // Format statistics by type and status
      const typeStatsMap = new Map<string, { success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>();
      
      byType.forEach(item => {
        const key = item.syncType;
        if (!typeStatsMap.has(key)) {
          typeStatsMap.set(key, { success: 0, failed: 0, partial: 0, totalProcessed: 0, avgDuration: 0 });
        }
        
        const stats = typeStatsMap.get(key)!;
        const count = item._count;
        const processed = item._sum.totalProcessed || 0;
        const duration = item._sum.duration || 0;
        
        if (item.status === 'SUCCESS') {
          stats.success = count;
          stats.totalProcessed += processed;
          stats.avgDuration = count > 0 ? Math.round(duration / count) : 0;
        } else if (item.status === 'FAILED') {
          stats.failed = count;
        } else if (item.status === 'PARTIAL') {
          stats.partial = count;
          stats.totalProcessed += processed;
        }
      });
      
      const typeStats = Array.from(typeStatsMap.entries()).map(([type, stats]) => ({
        type,
        ...stats
      }));
      
      // Separate customer-related syncs for special section
      const customerTypes = ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES'];
      const customerStats = typeStats.filter(s => customerTypes.includes(s.type));
      const otherStats = typeStats.filter(s => !customerTypes.includes(s.type));
      
      // Format error statistics by context
      const errorStats = errorsByContext.map(item => ({
        context: item.context,
        count: item._count
      }));
      
      // Format recent errors with details
      const recentErrorsFormatted = recentErrors.map(err => ({
        context: err.context,
        message: err.errorMessage,
        timestamp: err.createdAt,
        details: err.errorDetails as any
      }));

      // Get organization names
      const orgIds = topOrganizations.map(o => o.organizationId);
      const organizations = await prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true }
      });

      const orgMap = new Map(organizations.map(o => [o.id, o.name]));

      const orgStats = topOrganizations.map(item => ({
        organizationId: item.organizationId,
        organizationName: orgMap.get(item.organizationId) || 'Unknown',
        count: item._count,
        totalProcessed: item._sum.totalProcessed || 0
      }));

      // Build HTML report
      const htmlReport = this.buildHtmlReport(reportDate, totalSuccessful, totalFailed, totalPartial, otherStats, customerStats, orgStats, errorStats, recentErrorsFormatted);
      const textReport = this.buildTextReport(reportDate, totalSuccessful, totalFailed, totalPartial, otherStats, customerStats, orgStats, errorStats, recentErrorsFormatted);

      // Get notification emails
      const notificationEmails = config.email.orderNotificationEmails.length > 0
        ? config.email.orderNotificationEmails
        : [config.email.from];

      // Send email
      const totalOperationsForSubject = totalSuccessful + totalFailed + totalPartial;
      const statusEmoji = totalFailed > 0 ? '⚠️' : '✅';
      
      await emailService.sendEmail({
        to: notificationEmails,
        subject: `${statusEmoji} Relatório Diário - ${reportDate.toLocaleDateString('pt-PT')} - ${totalOperationsForSubject} Operações (${totalSuccessful} ✅ ${totalFailed > 0 ? `${totalFailed} ❌` : ''})`,
        html: htmlReport,
        text: textReport
      });

      logger.info('Daily success report sent successfully', {
        date: reportDate,
        totalSuccessful,
        recipients: notificationEmails
      });

    } catch (error) {
      logger.error('Failed to send daily success report:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Build HTML report
   */
  private static buildHtmlReport(
    date: Date,
    totalSuccess: number,
    totalFailed: number,
    totalPartial: number,
    byType: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>,
    customerStats: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>,
    byOrg: Array<{ organizationId: string; organizationName: string; count: number; totalProcessed: number }>,
    errors: Array<{ context: string; count: number }>,
    recentErrors: Array<{ context: string; message: string; timestamp: Date; details: any }>
  ): string {
    const dateStr = date.toLocaleDateString('pt-PT', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const totalOperations = totalSuccess + totalFailed + totalPartial;
    const successRate = totalOperations > 0 ? ((totalSuccess / totalOperations) * 100).toFixed(1) : '0';
    const headerColor = totalFailed > 0 ? '#ffc107' : '#28a745';

    // Build type rows
    const typeRows = byType.map(item => {
      const total = item.success + item.failed + item.partial;
      const statusIcons = [
        item.success > 0 ? `✅ ${item.success}` : '',
        item.partial > 0 ? `⚠️ ${item.partial}` : '',
        item.failed > 0 ? `❌ ${item.failed}` : ''
      ].filter(Boolean).join(' ');
      
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.type}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${total}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${statusIcons}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.totalProcessed.toLocaleString('pt-PT')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.avgDuration}ms</td>
      </tr>
    `;
    }).join('');

    // Build org rows
    const orgRows = byOrg.slice(0, 5).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.organizationName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.count}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.totalProcessed.toLocaleString('pt-PT')}</td>
      </tr>
    `).join('');
    
    // Build error rows
    const errorRows = errors.length > 0 ? errors.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.context}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; color: #dc3545; font-weight: bold;">${item.count}</td>
      </tr>
    `).join('') : '<tr><td colspan="2" style="padding: 8px; text-align: center; color: #28a745;">✅ Sem erros registados</td></tr>';
    
    // Build customer sync rows
    const customerRows = customerStats.length > 0 ? customerStats.map(item => {
      const total = item.success + item.failed + item.partial;
      const statusIcons = [
        item.success > 0 ? `✅ ${item.success}` : '',
        item.partial > 0 ? `⚠️ ${item.partial}` : '',
        item.failed > 0 ? `❌ ${item.failed}` : ''
      ].filter(Boolean).join(' ');
      
      const typeLabel = item.type === 'CUSTOMERS' ? '👤 Customers' 
                      : item.type === 'CUSTOMER_DISCOUNT_GROUPS' ? '💰 Customer Discount Groups'
                      : item.type === 'CUSTOMER_WAREHOUSES' ? '🏪 Customer Warehouses'
                      : item.type;
      
      return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${typeLabel}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${total}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${statusIcons}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.totalProcessed.toLocaleString('pt-PT')}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.avgDuration}ms</td>
      </tr>
    `;
    }).join('') : '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #6c757d;">Nenhuma sincronização de customers hoje</td></tr>';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <div style="background-color: ${headerColor}; color: white; padding: 20px; border-radius: 4px 4px 0 0;">
          <h1 style="margin: 0;">${totalFailed > 0 ? '⚠️' : '✅'} Relatório Diário</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${dateStr}</p>
        </div>
        
        <div style="padding: 20px; background-color: #fff; border: 1px solid #ddd; border-top: none;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background-color: #d4edda; padding: 15px; border-radius: 4px; border-left: 4px solid #28a745;">
              <h3 style="margin: 0 0 5px 0; color: #155724; font-size: 14px;">✅ Bem-Sucedidas</h3>
              <p style="font-size: 32px; font-weight: bold; margin: 0; color: #28a745;">${totalSuccess}</p>
            </div>
            <div style="background-color: ${totalPartial > 0 ? '#fff3cd' : '#f8f9fa'}; padding: 15px; border-radius: 4px; border-left: 4px solid ${totalPartial > 0 ? '#ffc107' : '#6c757d'};">
              <h3 style="margin: 0 0 5px 0; color: ${totalPartial > 0 ? '#856404' : '#6c757d'}; font-size: 14px;">⚠️ Parciais</h3>
              <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${totalPartial > 0 ? '#ffc107' : '#6c757d'};">${totalPartial}</p>
            </div>
            <div style="background-color: ${totalFailed > 0 ? '#f8d7da' : '#f8f9fa'}; padding: 15px; border-radius: 4px; border-left: 4px solid ${totalFailed > 0 ? '#dc3545' : '#6c757d'};">
              <h3 style="margin: 0 0 5px 0; color: ${totalFailed > 0 ? '#721c24' : '#6c757d'}; font-size: 14px;">❌ Falhadas</h3>
              <p style="font-size: 32px; font-weight: bold; margin: 0; color: ${totalFailed > 0 ? '#dc3545' : '#6c757d'};">${totalFailed}</p>
            </div>
          </div>
          
          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 4px; border-left: 4px solid #007bff; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #004085;">Taxa de Sucesso: <strong style="font-size: 24px; color: #007bff;">${successRate}%</strong> (${totalSuccess} de ${totalOperations} operações)</p>
          </div>

          ${customerStats.length > 0 ? `
          <h3 style="color: #007bff;">👥 Sincronização de Customers</h3>
          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #cce5ff;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #99ccff;">Tipo</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #99ccff;">Total</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #99ccff;">Estado</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #99ccff;">Registos</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #99ccff;">Duração</th>
                </tr>
              </thead>
              <tbody>
                ${customerRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          <h3>📊 Outras Sincronizações</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Tipo</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Total</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Estado</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Registos</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Duração Média</th>
              </tr>
            </thead>
            <tbody>
              ${typeRows}
            </tbody>
          </table>
          
          ${errors.length > 0 ? `
          <h3>❌ Erros por Contexto</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f8d7da;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #f5c6cb;">Contexto</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #f5c6cb;">Total de Erros</th>
              </tr>
            </thead>
            <tbody>
              ${errorRows}
            </tbody>
          </table>
          ` : ''}
          
          ${recentErrors.length > 0 ? `
          <h3>🔍 Últimos Erros Detalhados</h3>
          <div style="margin-bottom: 30px;">
            ${recentErrors.map(err => {
              const details = err.details || {};
              const identifiers = details.failedCustomerIds || details.failedCodes || details.failedOrderIDs || details.failedIdentifiers || [];
              const time = new Date(err.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
              
              return `
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong style="color: #856404;">📍 ${err.context.toUpperCase()}</strong>
                  <span style="color: #856404; font-size: 12px;">${time}</span>
                </div>
                <p style="margin: 5px 0; color: #856404;">${err.message}</p>
                ${identifiers.length > 0 ? `
                  <div style="margin-top: 8px; padding: 8px; background-color: #fff; border-radius: 3px;">
                    <small style="color: #666;">❌ Identificadores falhados (${identifiers.length}):</small>
                    <div style="margin-top: 5px; font-family: monospace; font-size: 11px; color: #333;">
                      ${identifiers.slice(0, 10).join(', ')}${identifiers.length > 10 ? ` ... +${identifiers.length - 10} mais` : ''}
                    </div>
                  </div>
                ` : ''}
                ${details.sent ? `
                  <div style="margin-top: 8px; font-size: 12px; color: #666;">
                    📊 Enviados: ${details.sent} | ✅ Sucesso: ${details.loaded || 0} | ❌ Falhados: ${details.failed || 0}
                  </div>
                ` : ''}
              </div>
              `;
            }).join('')}
          </div>
          ` : ''}

          <h3>🏢 Top Organizações</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Organização</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Operações</th>
                <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Registos Processados</th>
              </tr>
            </thead>
            <tbody>
              ${orgRows}
            </tbody>
          </table>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 4px 4px; color: #6c757d; font-size: 12px;">
          <p style="margin: 0;">CSW Markets Integrator - Relatório Automático</p>
          <p style="margin: 5px 0 0 0;">Este relatório é enviado diariamente às 23:00</p>
        </div>
      </div>
    `;
  }

  /**
   * Build text report
   */
  private static buildTextReport(
    date: Date,
    totalSuccess: number,
    totalFailed: number,
    totalPartial: number,
    byType: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>,
    customerStats: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>,
    byOrg: Array<{ organizationId: string; organizationName: string; count: number; totalProcessed: number }>,
    errors: Array<{ context: string; count: number }>,
    recentErrors: Array<{ context: string; message: string; timestamp: Date; details: any }>
  ): string {
    const dateStr = date.toLocaleDateString('pt-PT');
    const totalOperations = totalSuccess + totalFailed + totalPartial;
    const successRate = totalOperations > 0 ? ((totalSuccess / totalOperations) * 100).toFixed(1) : '0';

    let text = `
RELATÓRIO DIÁRIO ${totalFailed > 0 ? '⚠️' : '✅'}
${dateStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESUMO GERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Bem-Sucedidas: ${totalSuccess}
⚠️ Parciais: ${totalPartial}
❌ Falhadas: ${totalFailed}
📊 Taxa de Sucesso: ${successRate}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    if (customerStats.length > 0) {
      text += `
👥 SINCRONIZAÇÃO DE CUSTOMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      customerStats.forEach(item => {
        const total = item.success + item.failed + item.partial;
        const typeLabel = item.type === 'CUSTOMERS' ? '👤 Customers' 
                        : item.type === 'CUSTOMER_DISCOUNT_GROUPS' ? '💰 Customer Discount Groups'
                        : item.type === 'CUSTOMER_WAREHOUSES' ? '🏪 Customer Warehouses'
                        : item.type;
        text += `
${typeLabel}
  • Total: ${total} operações
  • ✅ Sucesso: ${item.success}${item.partial > 0 ? ` | ⚠️ Parcial: ${item.partial}` : ''}${item.failed > 0 ? ` | ❌ Falha: ${item.failed}` : ''}
  • Registos: ${item.totalProcessed.toLocaleString('pt-PT')}
  • Duração Média: ${item.avgDuration}ms
`;
      });
    }

    text += `
📊 OUTRAS SINCRONIZAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    byType.forEach(item => {
      const total = item.success + item.failed + item.partial;
      text += `
${item.type}
  • Total: ${total} operações
  • ✅ Sucesso: ${item.success}${item.partial > 0 ? ` | ⚠️ Parcial: ${item.partial}` : ''}${item.failed > 0 ? ` | ❌ Falha: ${item.failed}` : ''}
  • Registos: ${item.totalProcessed.toLocaleString('pt-PT')}
  • Duração Média: ${item.avgDuration}ms
`;
    });

    if (errors.length > 0) {
      text += `
❌ ERROS POR CONTEXTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      errors.forEach(item => {
        text += `
${item.context}: ${item.count} erro(s)
`;
      });
    }
    
    if (recentErrors.length > 0) {
      text += `
🔍 ÚLTIMOS ERROS DETALHADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
      recentErrors.forEach(err => {
        const details = err.details || {};
        const identifiers = details.failedCustomerIds || details.failedCodes || details.failedOrderIDs || details.failedIdentifiers || [];
        const time = new Date(err.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        
        text += `
[${time}] ${err.context.toUpperCase()}
  • ${err.message}`;
        
        if (identifiers.length > 0) {
          text += `
  • Identificadores falhados (${identifiers.length}): ${identifiers.slice(0, 5).join(', ')}${identifiers.length > 5 ? ` ... +${identifiers.length - 5} mais` : ''}`;
        }
        
        if (details.sent) {
          text += `
  • Enviados: ${details.sent} | Sucesso: ${details.loaded || 0} | Falhados: ${details.failed || 0}`;
        }
        
        text += '\n';
      });
    }

    text += `
🏢 TOP ORGANIZAÇÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    byOrg.slice(0, 5).forEach(item => {
      text += `
${item.organizationName}
  • Operações: ${item.count}
  • Registos: ${item.totalProcessed.toLocaleString('pt-PT')}
`;
    });

    text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CSW Markets Integrator - Relatório Automático
`;

    return text;
  }

  /**
   * Get report preview (without sending email)
   */
  static async getReportPreview(date?: Date): Promise<{
    date: Date;
    totalSuccessful: number;
    totalFailed: number;
    totalPartial: number;
    byType: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>;
    customerStats: Array<{ type: string; success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>;
    byOrg: Array<{ organizationId: string; organizationName: string; count: number; totalProcessed: number }>;
    errorsByContext: Array<{ context: string; count: number }>;
  }> {
    const reportDate = date || new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [totalSuccessful, totalFailed, totalPartial, byType, topOrganizations, errorsByContext] = await Promise.all([
      prisma.syncExecutionLog.count({
        where: {
          status: 'SUCCESS',
          startedAt: { gte: startOfDay, lte: endOfDay }
        }
      }),
      
      prisma.syncExecutionLog.count({
        where: {
          status: 'FAILED',
          startedAt: { gte: startOfDay, lte: endOfDay }
        }
      }),
      
      prisma.syncExecutionLog.count({
        where: {
          status: 'PARTIAL',
          startedAt: { gte: startOfDay, lte: endOfDay }
        }
      }),
      
      prisma.syncExecutionLog.groupBy({
        by: ['syncType', 'status'],
        where: {
          startedAt: { gte: startOfDay, lte: endOfDay }
        },
        _count: true,
        _sum: {
          totalProcessed: true,
          duration: true
        }
      }),
      
      prisma.syncExecutionLog.groupBy({
        by: ['organizationId'],
        where: {
          status: 'SUCCESS',
          startedAt: { gte: startOfDay, lte: endOfDay }
        },
        _count: true,
        _sum: {
          totalProcessed: true
        },
        orderBy: {
          _count: {
            organizationId: 'desc'
          }
        },
        take: 10
      }),
      
      prisma.errorNotificationLog.groupBy({
        by: ['context'],
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay }
        },
        _count: true
      })
    ]);

    const typeStatsMap = new Map<string, { success: number; failed: number; partial: number; totalProcessed: number; avgDuration: number }>();
    
    byType.forEach(item => {
      const key = item.syncType;
      if (!typeStatsMap.has(key)) {
        typeStatsMap.set(key, { success: 0, failed: 0, partial: 0, totalProcessed: 0, avgDuration: 0 });
      }
      
      const stats = typeStatsMap.get(key)!;
      const count = item._count;
      const processed = item._sum.totalProcessed || 0;
      const duration = item._sum.duration || 0;
      
      if (item.status === 'SUCCESS') {
        stats.success = count;
        stats.totalProcessed += processed;
        stats.avgDuration = count > 0 ? Math.round(duration / count) : 0;
      } else if (item.status === 'FAILED') {
        stats.failed = count;
      } else if (item.status === 'PARTIAL') {
        stats.partial = count;
        stats.totalProcessed += processed;
      }
    });
    
    const typeStats = Array.from(typeStatsMap.entries()).map(([type, stats]) => ({
      type,
      ...stats
    }));
    
    // Separate customer-related syncs for special section
    const customerTypes = ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES'];
    const customerStats = typeStats.filter(s => customerTypes.includes(s.type));
    const otherStats = typeStats.filter(s => !customerTypes.includes(s.type));

    const orgIds = topOrganizations.map(o => o.organizationId);
    const organizations = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true }
    });

    const orgMap = new Map(organizations.map(o => [o.id, o.name]));

    const orgStats = topOrganizations.map(item => ({
      organizationId: item.organizationId,
      organizationName: orgMap.get(item.organizationId) || 'Unknown',
      count: item._count,
      totalProcessed: item._sum.totalProcessed || 0
    }));
    
    const errorStats = errorsByContext.map(item => ({
      context: item.context,
      count: item._count
    }));

    return {
      date: reportDate,
      totalSuccessful,
      totalFailed,
      totalPartial,
      byType: otherStats,
      customerStats,
      byOrg: orgStats,
      errorsByContext: errorStats
    };
  }
}
