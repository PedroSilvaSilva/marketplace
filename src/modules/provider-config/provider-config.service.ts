import prisma from '@config/database';
import { CryptoService } from '@utils/crypto';
import { NotFoundError, ForbiddenError, BadRequestError } from '@utils/errors';
import { AuditAction } from '@prisma/client';
import { CreateProviderConfigInput, UpdateProviderConfigInput } from './provider-config.validation';

export class ProviderConfigService {
  
  /**
   * Create provider configuration
   */
  async create(data: CreateProviderConfigInput, userId: string) {
    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Check if user has permission (OWNER or ADMIN)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: data.organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have permission to configure this organization');
    }

    // Check if config already exists
    const existing = await prisma.providerConfig.findUnique({
      where: { organizationId: data.organizationId },
    });

    if (existing) {
      throw new BadRequestError('Provider configuration already exists for this organization');
    }

    // Encrypt sensitive fields
    const encryptedData = {
      ...data,
      apiKey: data.apiKey ? CryptoService.encrypt(data.apiKey) : null,
      apiSecret: data.apiSecret ? CryptoService.encrypt(data.apiSecret) : null,
      clientSecret: data.clientSecret ? CryptoService.encrypt(data.clientSecret) : null,
      refreshToken: data.refreshToken ? CryptoService.encrypt(data.refreshToken) : null,
      webhookSecret: data.webhookSecret ? CryptoService.encrypt(data.webhookSecret) : null,
    };

    // Create config
    const config = await prisma.providerConfig.create({
      data: encryptedData as any,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.CREATE,
        entity: 'ProviderConfig',
        entityId: config.id,
        description: `Provider configuration created for ${organization.name}`,
        metadata: {
          organizationId: data.organizationId,
          organizationName: organization.name,
        },
      },
    });

    return this.sanitizeConfig(config);
  }

  /**
   * Get provider config by organization ID
   */
  async getByOrganizationId(organizationId: string, userId: string, decrypt: boolean = false) {
    const config = await prisma.providerConfig.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundError('Provider configuration not found');
    }

    // Check permission
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have access to this organization');
    }

    // Decrypt if requested and user has permission
    if (decrypt && ['OWNER', 'ADMIN'].includes(member.role)) {
      return this.decryptConfig(config);
    }

    return this.sanitizeConfig(config);
  }

  /**
   * Update provider config
   */
  async update(
    organizationId: string,
    data: UpdateProviderConfigInput,
    userId: string
  ) {
    const config = await prisma.providerConfig.findUnique({
      where: { organizationId },
    });

    if (!config) {
      throw new NotFoundError('Provider configuration not found');
    }

    // Check permission
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have permission to update this configuration');
    }

    // Encrypt sensitive fields if provided
    const updateData: any = { ...data };
    
    if (data.apiKey !== undefined) {
      updateData.apiKey = data.apiKey ? CryptoService.encrypt(data.apiKey) : null;
    }
    if (data.apiSecret !== undefined) {
      updateData.apiSecret = data.apiSecret ? CryptoService.encrypt(data.apiSecret) : null;
    }
    if (data.clientSecret !== undefined) {
      updateData.clientSecret = data.clientSecret ? CryptoService.encrypt(data.clientSecret) : null;
    }
    if (data.refreshToken !== undefined) {
      updateData.refreshToken = data.refreshToken ? CryptoService.encrypt(data.refreshToken) : null;
    }
    if (data.webhookSecret !== undefined) {
      updateData.webhookSecret = data.webhookSecret ? CryptoService.encrypt(data.webhookSecret) : null;
    }

    const updated = await prisma.providerConfig.update({
      where: { organizationId },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.UPDATE,
        entity: 'ProviderConfig',
        entityId: updated.id,
        description: `Provider configuration updated`,
        metadata: {
          organizationId,
          changes: Object.keys(data),
        },
      },
    });

    return this.sanitizeConfig(updated);
  }

  /**
   * Delete provider config
   */
  async delete(organizationId: string, userId: string) {
    const config = await prisma.providerConfig.findUnique({
      where: { organizationId },
    });

    if (!config) {
      throw new NotFoundError('Provider configuration not found');
    }

    // Check permission (OWNER only)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: 'OWNER',
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('Only organization owners can delete provider configuration');
    }

    await prisma.providerConfig.delete({
      where: { organizationId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.DELETE,
        entity: 'ProviderConfig',
        entityId: config.id,
        description: `Provider configuration deleted`,
        metadata: {
          organizationId,
        },
      },
    });

    return { success: true, message: 'Provider configuration deleted' };
  }

  /**
   * Test provider connection
   */
  async testConnection(organizationId: string, userId: string) {
    const config = await this.getByOrganizationId(organizationId, userId, true);

    // TODO: Implement actual API test based on authType
    // For now, just check if apiUrl is reachable
    try {
      const response = await fetch(config.apiUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'CSW-Markets/1.0',
        },
      });

      return {
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Connection successful' : 'Connection failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        status: 0,
        message: error.message || 'Connection failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Refresh OAuth token
   */
  async refreshOAuthToken(organizationId: string, userId: string) {
    const config = await this.getByOrganizationId(organizationId, userId, true);

    if (config.authType !== 'OAUTH2') {
      throw new BadRequestError('This configuration does not use OAuth2');
    }

    if (!config.tokenEndpoint || !config.refreshToken) {
      throw new BadRequestError('Missing token endpoint or refresh token');
    }

    // TODO: Implement OAuth token refresh logic
    // This will vary by provider (Worten, FNAC, Temu, etc.)
    
    throw new BadRequestError('OAuth token refresh not yet implemented');
  }

  /**
   * Remove sensitive data from config
   */
  private sanitizeConfig(config: any) {
    const { apiKey, apiSecret, clientSecret, refreshToken, webhookSecret, ...sanitized } = config;
    
    return {
      ...sanitized,
      // Show only if field exists (masked)
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken,
      hasWebhookSecret: !!webhookSecret,
    };
  }

  /**
   * Decrypt sensitive fields
   */
  private decryptConfig(config: any) {
    return {
      ...config,
      apiKey: config.apiKey ? CryptoService.decrypt(config.apiKey) : null,
      apiSecret: config.apiSecret ? CryptoService.decrypt(config.apiSecret) : null,
      clientSecret: config.clientSecret ? CryptoService.decrypt(config.clientSecret) : null,
      refreshToken: config.refreshToken ? CryptoService.decrypt(config.refreshToken) : null,
      webhookSecret: config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null,
    };
  }
}
