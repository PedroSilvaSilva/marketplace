import nodemailer, { Transporter } from 'nodemailer';
import { config } from '@config/index';
import logger from '@config/logger';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: config.email.auth,
    });

    // Verify connection
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const mailOptions = {
        from: options.from || config.email.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('Email sent successfully:', {
        messageId: info.messageId,
        to: options.to,
        subject: options.subject,
      });
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${config.app.isProduction ? 'https' : 'http'}://your-domain.com/verify-email?token=${token}`;
    
    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification</h2>
          <p>Thank you for registering with CSW Markets Integrator.</p>
          <p>Please click the button below to verify your email address:</p>
          <a href="${verificationUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007bff; 
                    color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            If you didn't create an account, please ignore this email.
          </p>
        </div>
      `,
      text: `Please verify your email by visiting: ${verificationUrl}`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${config.app.isProduction ? 'https' : 'http'}://your-domain.com/reset-password?token=${token}`;
    
    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>You requested to reset your password for CSW Markets Integrator.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background-color: #dc3545; 
                    color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            If you didn't request a password reset, please ignore this email or contact support.
          </p>
        </div>
      `,
      text: `Reset your password by visiting: ${resetUrl}`,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome to CSW Markets Integrator',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${name}!</h2>
          <p>Your account has been successfully created.</p>
          <p>You can now access all the features of our integration platform.</p>
          <p>If you have any questions, please don't hesitate to contact our support team.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            CSW Markets Integrator - Enterprise Integration Platform
          </p>
        </div>
      `,
      text: `Welcome, ${name}! Your account has been successfully created.`,
    });
  }

  /**
   * Send notification email about orders integrated into SQL PHC
   */
  async sendOrdersIntegratedEmail(
    recipientEmails: string | string[],
    ordersSummary: {
      totalOrders: number;
      newOrders: number;
      duplicateOrders: number;
      totalLines: number;
      notifiedToTypsForYou: number;
      organizationName?: string;
      orders: Array<{
        orderID: string;
        customerName: string;
        total: number;
        linesCount: number;
        orderDate: string;
      }>;
    }
  ): Promise<void> {
    const {
      totalOrders,
      newOrders,
      duplicateOrders,
      totalLines,
      notifiedToTypsForYou,
      organizationName = 'PHC',
      orders
    } = ordersSummary;

    // Build orders table HTML
    const ordersTableRows = orders.map(order => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px;">${order.orderID}</td>
        <td style="padding: 12px 8px;">${order.customerName}</td>
        <td style="padding: 12px 8px; text-align: center;">${order.linesCount}</td>
        <td style="padding: 12px 8px; text-align: right;">${order.total.toFixed(2)} €</td>
        <td style="padding: 12px 8px; text-align: center;">${order.orderDate}</td>
      </tr>
    `).join('');

    await this.sendEmail({
      to: recipientEmails,
      subject: `✅ ${newOrders} Nova(s) Encomenda(s) Integrada(s) no SQL PHC`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #28a745; margin: 0;">✅ Encomendas Integradas</h1>
              <p style="color: #666; margin-top: 10px;">Sistema de Integração TypsForYou → ${organizationName}</p>
            </div>

            <div style="background-color: #f0f8f5; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <h2 style="margin-top: 0; color: #155724;">📊 Resumo da Integração</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>🆕 Novas Encomendas Inseridas:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #28a745; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${newOrders}</span></td>
                </tr>
                ${duplicateOrders > 0 ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>⏭️ Encomendas Já Existentes:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #ffc107; color: #333; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${duplicateOrders}</span></td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>📦 Total de Linhas:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${totalLines}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>🔔 Notificadas TypsForYou:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${notifiedToTypsForYou}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 Data/Hora:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('pt-PT')}</td>
                </tr>
              </table>
            </div>

            ${newOrders > 0 ? `
            <div style="margin-bottom: 30px;">
              <h2 style="color: #333;">📋 Detalhes das Encomendas</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; background-color: white; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #007bff; color: white;">
                      <th style="padding: 12px 8px; text-align: left;">Nº Encomenda</th>
                      <th style="padding: 12px 8px; text-align: left;">Cliente</th>
                      <th style="padding: 12px 8px; text-align: center;">Linhas</th>
                      <th style="padding: 12px 8px; text-align: right;">Total</th>
                      <th style="padding: 12px 8px; text-align: center;">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ordersTableRows}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}

            <div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; border-radius: 4px; margin-top: 30px;">
              <p style="margin: 0; color: #004085;">
                <strong>ℹ️ Próximos Passos:</strong><br>
                As encomendas foram inseridas nas tabelas <code>DataDrive_CAB</code> e <code>DataDrive_LIN</code> 
                e estão prontas para serem processadas pelo sistema PHC.
              </p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              CSW Markets Integrator - Notificação Automática de Encomendas<br>
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </div>
      `,
      text: `
        ✅ ENCOMENDAS INTEGRADAS NO SQL PHC
        
        Resumo:
        - Novas encomendas inseridas: ${newOrders}
        ${duplicateOrders > 0 ? `- Encomendas já existentes: ${duplicateOrders}` : ''}
        - Total de linhas: ${totalLines}
        - Notificadas TypsForYou: ${notifiedToTypsForYou}
        - Data/Hora: ${new Date().toLocaleString('pt-PT')}
        
        ${newOrders > 0 ? `
        Detalhes das Encomendas:
        ${orders.map(o => `- ${o.orderID} | ${o.customerName} | ${o.linesCount} linhas | ${o.total.toFixed(2)} € | ${o.orderDate}`).join('\n')}
        ` : ''}
        
        As encomendas estão prontas para serem processadas pelo sistema PHC.
      `
    });
  }

  /**
   * Send email notification when discount subgroups are synced to TypsForYou
   */
  async sendDiscountSubGroupsSyncedEmail(
    recipientEmail: string,
    subGroups: Array<{
      'Discount Group Code': string;
      'Discount Sub-Group Code': string;
      'Discount Sub-Group Name': string;
      Tag: string;
    }>,
    syncMode: 'INCREMENTAL' | 'FULL'
  ): Promise<void> {
    const syncModeText = syncMode === 'INCREMENTAL' ? '🔄 Sincronização Incremental' : '📦 Sincronização Completa';
    const syncModeColor = syncMode === 'INCREMENTAL' ? '#007bff' : '#28a745';

    // Build subgroups table HTML (show first 50)
    const subGroupsToShow = subGroups.slice(0, 50);
    const subGroupsTableRows = subGroupsToShow.map(sg => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; font-family: monospace; font-size: 12px;">${sg['Discount Group Code']}</td>
        <td style="padding: 12px 8px; font-family: monospace; font-size: 12px;">${sg['Discount Sub-Group Code']}</td>
        <td style="padding: 12px 8px; font-size: 13px;">${sg['Discount Sub-Group Name']}</td>
        <td style="padding: 12px 8px; text-align: center; font-size: 11px;">${sg.Tag || '-'}</td>
      </tr>
    `).join('');

    await this.sendEmail({
      to: recipientEmail,
      subject: `✅ ${subGroups.length} Sub-Grupo(s) de Desconto Sincronizado(s) - TypsForYou`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #28a745; margin: 0;">✅ Sub-Grupos de Desconto Sincronizados</h1>
              <p style="color: #666; margin-top: 10px;">Sistema de Integração CSW → TypsForYou</p>
            </div>

            <div style="background-color: ${syncMode === 'INCREMENTAL' ? '#e7f3ff' : '#f0f8f5'}; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <div style="display: inline-block; background-color: ${syncModeColor}; color: white; padding: 6px 16px; border-radius: 20px; margin-bottom: 15px; font-weight: bold;">
                ${syncModeText}
              </div>
              <h2 style="margin-top: 0; color: #155724;">📊 Resumo da Sincronização</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>📤 Sub-Grupos Enviados:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #007bff; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${subGroups.length}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>🕐 Data/Hora:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('pt-PT')}</td>
                </tr>
              </table>
            </div>

            ${subGroups.length > 0 ? `
            <div style="margin-bottom: 30px;">
              <h2 style="color: #155724; border-bottom: 2px solid #28a745; padding-bottom: 10px;">📋 Sub-Grupos Sincronizados ${subGroups.length > 50 ? `(mostrando ${subGroupsToShow.length} de ${subGroups.length})` : ''}</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #f8f9fa; border-bottom: 2px solid #28a745;">
                      <th style="padding: 12px 8px; text-align: left; font-weight: bold;">Código Grupo</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: bold;">Código Sub-Grupo</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: bold;">Nome</th>
                      <th style="padding: 12px 8px; text-align: center; font-weight: bold;">Tag</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${subGroupsTableRows}
                  </tbody>
                </table>
              </div>
            </div>
            ` : ''}

            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 6px; border-left: 4px solid #28a745;">
              <p style="margin: 0; color: #155724;"><strong>✅ Sincronização Concluída</strong></p>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Os sub-grupos de desconto foram enviados com sucesso para a TypsForYou e estão disponíveis no marketplace.</p>
            </div>

            <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
              <p>Esta é uma notificação automática do sistema CSW Markets</p>
            </div>
          </div>
        </div>
      `,
      text: `
        ✅ SUB-GRUPOS DE DESCONTO SINCRONIZADOS - TYPSFOR YOU
        
        ${syncModeText}
        
        Resumo:
        - Sub-Grupos Enviados: ${subGroups.length}
        - Data/Hora: ${new Date().toLocaleString('pt-PT')}
        
        ${subGroups.length > 0 ? `
        Detalhes dos Sub-Grupos:
        ${subGroups.slice(0, 50).map(sg => `- [${sg['Discount Group Code']}] ${sg['Discount Sub-Group Code']} | ${sg['Discount Sub-Group Name']} | Tag: ${sg.Tag || '-'}`).join('\n')}
        ${subGroups.length > 50 ? `\n... e mais ${subGroups.length - 50} sub-grupos` : ''}
        ` : ''}
        
        Os sub-grupos de desconto foram enviados com sucesso para a TypsForYou.
      `
    });
  }

  /**
   * Send email notification when article warehouse is synced to TypsForYou
   */
  async sendArticleWarehouseSyncedEmail(
    recipientEmail: string,
    summary: {
      totalRecords: number;
      changedRecords: number;
      loadedRecords: number;
      warehouseCode: string;
      syncMode: 'INCREMENTAL' | 'FULL';
    }
  ): Promise<void> {
    const { totalRecords, changedRecords, loadedRecords, warehouseCode, syncMode } = summary;
    
    const syncModeText = syncMode === 'INCREMENTAL' ? '🔄 Sincronização Incremental' : '📦 Sincronização Completa';
    const syncModeColor = syncMode === 'INCREMENTAL' ? '#007bff' : '#28a745';
    const efficiency = totalRecords > 0 ? ((1 - changedRecords / totalRecords) * 100).toFixed(1) : '0';

    await this.sendEmail({
      to: recipientEmail,
      subject: `✅ ${changedRecords} Artigo(s) Armazém Sincronizado(s) - TypsForYou`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #28a745; margin: 0;">✅ Artigos Armazém Sincronizados</h1>
              <p style="color: #666; margin-top: 10px;">Sistema de Integração CSW → TypsForYou</p>
            </div>

            <div style="background-color: ${syncMode === 'INCREMENTAL' ? '#e7f3ff' : '#f0f8f5'}; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <div style="display: inline-block; background-color: ${syncModeColor}; color: white; padding: 6px 16px; border-radius: 20px; margin-bottom: 15px; font-weight: bold;">
                ${syncModeText}
              </div>
              <h2 style="margin-top: 0; color: #155724;">📊 Resumo da Sincronização</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>🏬 Armazém:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #6c757d; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${warehouseCode}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📦 Total Artigos (cache):</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #17a2b8; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${totalRecords}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>🔄 Artigos Alterados:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #007bff; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${changedRecords}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>✅ Carregados na API:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #28a745; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${loadedRecords}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>⚡ Eficiência (cache):</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #ffc107; color: #000; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${efficiency}%</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 Data/Hora:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('pt-PT')}</td>
                </tr>
              </table>
            </div>

            ${changedRecords === 0 ? `
            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 6px; border-left: 4px solid #17a2b8; margin-bottom: 20px;">
              <p style="margin: 0; color: #0c5460;"><strong>ℹ️ Nenhuma Alteração Detectada</strong></p>
              <p style="margin: 10px 0 0 0; color: #0c5460; font-size: 14px;">Todos os ${totalRecords} artigos já estavam sincronizados. Nenhum envio foi necessário.</p>
            </div>
            ` : `
            <div style="background-color: #d4edda; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 20px;">
              <p style="margin: 0; color: #155724;"><strong>✅ Sincronização Concluída com Sucesso</strong></p>
              <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">
                ${changedRecords} artigos foram sincronizados (${((changedRecords / totalRecords) * 100).toFixed(1)}% do total).
                ${totalRecords - changedRecords} artigos já estavam atualizados (poupança de ${efficiency}% de tráfego).
              </p>
            </div>
            `}

            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px; margin-top: 20px;">
              <p style="margin: 0; color: #856404;">
                <strong>💡 Como Funciona:</strong><br>
                O sistema compara o hash MD5 de cada artigo com a cache local. Apenas artigos novos ou com alterações (preços, stock, etc.) são enviados para a TypsForYou, otimizando recursos e tempo de sincronização.
              </p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              CSW Markets Integrator - Notificação Automática de Sincronização<br>
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </div>
      `,
      text: `
        ✅ ARTIGOS ARMAZÉM SINCRONIZADOS - TYPSFORYOU
        
        ${syncModeText}
        
        Resumo:
        - Armazém: ${warehouseCode}
        - Total artigos (cache): ${totalRecords}
        - Artigos alterados: ${changedRecords}
        - Carregados na API: ${loadedRecords}
        - Eficiência: ${efficiency}%
        - Data/Hora: ${new Date().toLocaleString('pt-PT')}
        
        ${changedRecords === 0 
          ? 'Nenhuma alteração detectada. Todos os artigos já estavam sincronizados.'
          : `${changedRecords} artigos sincronizados (${((changedRecords / totalRecords) * 100).toFixed(1)}% do total).`
        }
        
        O sistema usa hash MD5 para detectar mudanças e só envia o que foi alterado.
      `
    });
  }

  /**
   * Send email notification when discount groups are synced to TypsForYou
   */
  async sendDiscountGroupsSyncedEmail(
    recipientEmails: string | string[],
    groupsSummary: {
      totalGroups: number;
      loadedGroups: number;
      failedGroups: number;
      syncMode: 'incremental' | 'full';
      organizationName?: string;
      groups: Array<{
        code: string;
        name: string;
        tag: string;
        created: string;
        modified: string;
      }>;
      duration: number;
    }
  ): Promise<void> {
    const {
      totalGroups,
      loadedGroups,
      failedGroups,
      syncMode,
      organizationName = 'CSW Markets',
      groups,
      duration
    } = groupsSummary;

    const syncModeText = syncMode === 'incremental' ? '🔄 Sincronização Incremental' : '📦 Sincronização Completa';
    const syncModeColor = syncMode === 'incremental' ? '#007bff' : '#28a745';

    // Build groups table HTML
    const groupsTableRows = groups.map(group => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; font-family: monospace;">${group.code}</td>
        <td style="padding: 12px 8px;">${group.name}</td>
        <td style="padding: 12px 8px; text-align: center;">${group.tag}</td>
        <td style="padding: 12px 8px; text-align: center; font-size: 11px;">${group.modified}</td>
      </tr>
    `).join('');

    await this.sendEmail({
      to: recipientEmails,
      subject: `✅ ${totalGroups} Grupo(s) de Desconto Sincronizado(s) - TypsForYou`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #28a745; margin: 0;">✅ Grupos de Desconto Sincronizados</h1>
              <p style="color: #666; margin-top: 10px;">Sistema de Integração ${organizationName} → TypsForYou</p>
            </div>

            <div style="background-color: ${syncMode === 'incremental' ? '#e7f3ff' : '#f0f8f5'}; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <div style="display: inline-block; background-color: ${syncModeColor}; color: white; padding: 6px 16px; border-radius: 20px; margin-bottom: 15px; font-weight: bold;">
                ${syncModeText}
              </div>
              <h2 style="margin-top: 0; color: #155724;">📊 Resumo da Sincronização</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>📤 Grupos Enviados:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #007bff; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${totalGroups}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>✅ Grupos Carregados na API:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #28a745; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${loadedGroups}</span></td>
                </tr>
                ${failedGroups > 0 ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>❌ Grupos com Erro:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #dc3545; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${failedGroups}</span></td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>⏱️ Duração:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${duration}s</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 Data/Hora:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('pt-PT')}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 30px;">
              <h2 style="color: #333;">📋 Grupos Sincronizados (primeiros 10)</h2>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; background-color: white; font-size: 14px;">
                  <thead>
                    <tr style="background-color: #007bff; color: white;">
                      <th style="padding: 12px 8px; text-align: left;">Código</th>
                      <th style="padding: 12px 8px; text-align: left;">Nome do Grupo</th>
                      <th style="padding: 12px 8px; text-align: center;">Tag</th>
                      <th style="padding: 12px 8px; text-align: center;">Última Alteração</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${groupsTableRows}
                  </tbody>
                </table>
              </div>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px; margin-top: 30px;">
              <p style="margin: 0; color: #856404;">
                <strong>ℹ️ Informação:</strong><br>
                ${syncMode === 'incremental' 
                  ? 'Esta foi uma sincronização incremental - apenas grupos criados ou alterados desde a última sincronização foram enviados.' 
                  : 'Esta foi uma sincronização completa - todos os grupos de desconto foram enviados.'}
              </p>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              CSW Markets Integrator - Notificação Automática de Sincronização<br>
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </div>
      `,
      text: `
        ✅ GRUPOS DE DESCONTO SINCRONIZADOS - TYPSFORYOU
        
        Modo: ${syncMode === 'incremental' ? 'Sincronização Incremental' : 'Sincronização Completa'}
        
        Resumo:
        - Grupos enviados: ${totalGroups}
        - Grupos carregados: ${loadedGroups}
        ${failedGroups > 0 ? `- Grupos com erro: ${failedGroups}` : ''}
        - Duração: ${duration}s
        - Data/Hora: ${new Date().toLocaleString('pt-PT')}
        
        Grupos Sincronizados (primeiros 10):
        ${groups.map(g => `- ${g.code} | ${g.name} | Tag: ${g.tag} | Alterado: ${g.modified}`).join('\n')}
        
        ${syncMode === 'incremental' 
          ? 'Sincronização incremental: apenas grupos alterados foram enviados.' 
          : 'Sincronização completa: todos os grupos foram enviados.'}
      `
    });
  }

  async sendArticlesSyncedEmail(
    recipientEmail: string,
    summary: {
      totalSent: number;
      loadedRecords: number;
      syncMode: 'CHECKPOINT' | 'INCREMENTAL';
      checkpoint?: string | null;
      totalProcessed?: number | null;
    }
  ): Promise<void> {
    const { totalSent, loadedRecords, syncMode, checkpoint, totalProcessed } = summary;
    
    const syncModeText = syncMode === 'CHECKPOINT' ? '🔄 Carga Sequencial (Checkpoint)' : '⚡ Sincronização Incremental';
    const syncModeColor = syncMode === 'CHECKPOINT' ? '#007bff' : '#28a745';

    await this.sendEmail({
      to: recipientEmail,
      subject: `✅ ${totalSent} Artigo(s) Sincronizado(s) - TypsForYou`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #28a745; margin: 0;">✅ Artigos Sincronizados</h1>
              <p style="color: #666; margin-top: 10px;">Sistema de Integração CSW → TypsForYou</p>
            </div>

            <div style="background-color: ${syncMode === 'CHECKPOINT' ? '#e7f3ff' : '#f0f8f5'}; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <div style="display: inline-block; background-color: ${syncModeColor}; color: white; padding: 6px 16px; border-radius: 20px; margin-bottom: 15px; font-weight: bold;">
                ${syncModeText}
              </div>
              <h2 style="margin-top: 0; color: #155724;">📊 Resumo da Sincronização</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;"><strong>📤 Artigos Enviados:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #007bff; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${totalSent}</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>✅ Carregados na API:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #28a745; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${loadedRecords}</span></td>
                </tr>
                ${syncMode === 'CHECKPOINT' && totalProcessed ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>📊 Total Processado:</strong></td>
                  <td style="padding: 8px 0; text-align: right;"><span style="background-color: #6c757d; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">${totalProcessed.toLocaleString('pt-PT')}</span></td>
                </tr>
                ` : ''}
                ${syncMode === 'CHECKPOINT' && checkpoint ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>🔖 Checkpoint:</strong></td>
                  <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${checkpoint}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>📅 Data/Hora:</strong></td>
                  <td style="padding: 8px 0; text-align: right;">${new Date().toLocaleString('pt-PT')}</td>
                </tr>
              </table>
            </div>

            ${syncMode === 'CHECKPOINT' ? `
            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 6px; border-left: 4px solid #17a2b8; margin-bottom: 20px;">
              <p style="margin: 0; color: #0c5460;"><strong>ℹ️ Modo Checkpoint Ativo</strong></p>
              <p style="margin: 10px 0 0 0; color: #0c5460; font-size: 14px;">Sincronização sequencial em progresso. Processando 1000 artigos por batch.</p>
            </div>
            ` : `
            <div style="background-color: #d4edda; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745; margin-bottom: 20px;">
              <p style="margin: 0; color: #155724;"><strong>✨ Modo Incremental Ativo</strong></p>
              <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">Apenas artigos modificados foram enviados.</p>
            </div>
            `}

            <div style="text-align: center; padding: 20px 0; color: #666; font-size: 14px;">
              <p style="margin: 0;">Este email foi gerado automaticamente pelo sistema de integração</p>
              <p style="margin: 5px 0 0 0;">CSW Markets Integrator</p>
            </div>
          </div>
        </div>
      `
    });
  }
}

export default new EmailService();
