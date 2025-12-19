import prisma from '@config/database';
import { NotFoundError } from '@utils/errors';
import logger from '@config/logger';

interface CreateIntegrationData {
  name: string;
  type: string;
  config: any;
  apiKey?: string;
}

interface UpdateIntegrationData {
  name?: string;
  type?: string;
  config?: any;
  apiKey?: string;
  isActive?: boolean;
}

interface GetAllFilters {
  type?: string;
  isActive?: boolean;
}

export class IntegrationService {
  async getAll(filters: GetAllFilters) {
    const where: any = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const integrations = await prisma.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return integrations;
  }

  async getById(id: string) {
    const integration = await prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    return integration;
  }

  async create(data: CreateIntegrationData, userId?: string) {
    const integration = await prisma.integration.create({
      data: {
        name: data.name,
        type: data.type,
        config: data.config,
        apiKey: data.apiKey,
        isActive: false, // Default to inactive for security
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Integration',
        entityId: integration.id,
        description: 'Integration created', metadata: { name: data.name, type: data.type } as any,
      },
    });

    logger.info(`Integration created: ${integration.id} - ${integration.name}`);

    return integration;
  }

  async update(id: string, data: UpdateIntegrationData, userId?: string) {
    const existing = await this.getById(id);

    const integration = await prisma.integration.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        config: data.config,
        apiKey: data.apiKey,
        isActive: data.isActive,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Integration',
        entityId: integration.id,
        oldValue: existing,
        newValue: data,
      },
    });

    logger.info(`Integration updated: ${integration.id} - ${integration.name}`);

    return integration;
  }

  async delete(id: string, userId?: string) {
    await this.getById(id);

    await prisma.integration.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'Integration',
        entityId: id,
      },
    });

    logger.info(`Integration deleted: ${id}`);
  }

  async syncIntegration(id: string, userId?: string) {
    const integration = await this.getById(id);

    if (!integration.isActive) {
      throw new Error('Integration is not active');
    }

    // Update last sync time
    await prisma.integration.update({
      where: { id },
      data: { lastSync: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Integration',
        entityId: id,
      },
    });

    logger.info(`Integration synced: ${id} - ${integration.name}`);

    // Here you would implement the actual sync logic based on integration type
    return {
      message: 'Sync completed successfully',
      integrationId: id,
      syncedAt: new Date(),
    };
  }
}
