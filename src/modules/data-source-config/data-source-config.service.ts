import prisma from '@config/database';
import { CryptoService } from '@utils/crypto';
import { 
  CreateDataSourceConfigInput, 
  UpdateDataSourceConfigInput 
} from './data-source-config.validation';
import { AppError } from '@utils/errors';

export class DataSourceConfigService {
  
  /**
   * Create a new data source configuration
   */
  static async create(data: CreateDataSourceConfigInput, userId: string) {
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
      include: { members: true }
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if user is OWNER or ADMIN
    const member = organization.members.find(m => m.userId === userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      throw new AppError('Only organization OWNER or ADMIN can create data source config', 403);
    }

    // Check if config already exists
    const existing = await prisma.dataSourceConfig.findUnique({
      where: { organizationId: data.organizationId }
    });

    if (existing) {
      throw new AppError('Data source config already exists for this organization', 400);
    }

    // Encrypt sensitive data
    const encryptedData = {
      ...data,
      sqlPassword: data.sqlPassword ? CryptoService.encrypt(data.sqlPassword) : null
    };

    // Create config
    const config = await prisma.dataSourceConfig.create({
      data: encryptedData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true
          }
        }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'DataSourceConfig',
        entityId: config.id,
        description: `Data source configuration created for ${organization.name}`
      }
    });

    return this.sanitizeConfig(config);
  }

  /**
   * Get config by organization ID
   */
  static async getByOrganizationId(organizationId: string, userId: string, decrypt = false) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            members: {
              where: { userId },
              select: { role: true }
            }
          }
        }
      }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    // Check access
    const member = config.organization.members[0];
    if (!member) {
      throw new AppError('You do not have access to this organization', 403);
    }

    // Only OWNER/ADMIN can see decrypted credentials
    if (decrypt && ['OWNER', 'ADMIN'].includes(member.role)) {
      return this.decryptConfig(config);
    }

    return this.sanitizeConfig(config);
  }

  /**
   * Update data source config
   */
  static async update(
    organizationId: string, 
    data: UpdateDataSourceConfigInput, 
    userId: string
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      include: {
        organization: {
          include: { members: true }
        }
      }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    // Check permission
    const member = config.organization.members.find(m => m.userId === userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      throw new AppError('Only organization OWNER or ADMIN can update data source config', 403);
    }

    // Encrypt password if provided
    const updateData = {
      ...data,
      sqlPassword: data.sqlPassword ? CryptoService.encrypt(data.sqlPassword) : undefined
    };

    const updated = await prisma.dataSourceConfig.update({
      where: { organizationId },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true
          }
        }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'DataSourceConfig',
        entityId: updated.id,
        description: 'Data source configuration updated'
      }
    });

    return this.sanitizeConfig(updated);
  }

  /**
   * Delete data source config
   */
  static async delete(organizationId: string, userId: string) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      include: {
        organization: {
          include: { members: true }
        }
      }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    // Only OWNER can delete
    const member = config.organization.members.find(m => m.userId === userId);
    if (!member || member.role !== 'OWNER') {
      throw new AppError('Only organization OWNER can delete data source config', 403);
    }

    await prisma.dataSourceConfig.delete({
      where: { organizationId }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'DataSourceConfig',
        entityId: config.id,
        description: 'Data source configuration deleted'
      }
    });

    return { message: 'Data source config deleted successfully' };
  }

  /**
   * Test connection to data source
   */
  static async testConnection(organizationId: string, userId: string) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      include: {
        organization: {
          include: { members: true }
        }
      }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    // Check permission
    const member = config.organization.members.find(m => m.userId === userId);
    if (!member) {
      throw new AppError('You do not have access to this organization', 403);
    }

    try {
      // Import SQL service dynamically
      const { SQLService } = await import('@/services/sql.service');
      
      // Test connection
      const result = await SQLService.testConnection(organizationId);

      // Update test status
      await prisma.dataSourceConfig.update({
        where: { organizationId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'SUCCESS',
          lastTestError: null
        }
      });

      return {
        success: true,
        message: 'Connection test successful',
        details: result
      };
    } catch (error: any) {
      // Update test status with error
      await prisma.dataSourceConfig.update({
        where: { organizationId },
        data: {
          lastTestAt: new Date(),
          lastTestStatus: 'FAILED',
          lastTestError: error.message
        }
      });

      throw new AppError(`Connection test failed: ${error.message}`, 400);
    }
  }

  /**
   * Sanitize config (hide sensitive data)
   */
  private static sanitizeConfig(config: any) {
    return {
      ...config,
      sqlPassword: config.sqlPassword ? '********' : null,
      hasSqlPassword: !!config.sqlPassword
    };
  }

  /**
   * Decrypt config (internal use)
   */
  private static decryptConfig(config: any) {
    return {
      ...config,
      sqlPassword: config.sqlPassword ? CryptoService.decrypt(config.sqlPassword) : null
    };
  }
}
