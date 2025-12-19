import prisma from '@config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '@utils/errors';
import { AuditAction } from '@prisma/client';
import { CreateConnectionInput, UpdateConnectionInput, UpdateSyncStatusInput } from './client-provider.validation';

export class ClientProviderService {
  
  /**
   * Create a connection between client and provider
   */
  async connect(data: CreateConnectionInput, userId: string) {
    // Verify both organizations exist
    const [clientOrg, providerOrg] = await Promise.all([
      prisma.organization.findUnique({ where: { id: data.clientOrgId } }),
      prisma.organization.findUnique({ where: { id: data.providerOrgId } }),
    ]);

    if (!clientOrg) {
      throw new NotFoundError('Client organization not found');
    }

    if (!providerOrg) {
      throw new NotFoundError('Provider organization not found');
    }

    // Verify client org is type CLIENT
    if (clientOrg.type !== 'CLIENT') {
      throw new BadRequestError('Client organization must be of type CLIENT');
    }

    // Verify provider org is type PROVIDER
    if (providerOrg.type !== 'PROVIDER') {
      throw new BadRequestError('Provider organization must be of type PROVIDER');
    }

    // Check if user has permission on client org (OWNER or ADMIN)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: data.clientOrgId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have permission to manage this client organization');
    }

    // Check if connection already exists
    const existing = await prisma.clientProviderConnection.findUnique({
      where: {
        clientOrgId_providerOrgId: {
          clientOrgId: data.clientOrgId,
          providerOrgId: data.providerOrgId,
        },
      },
    });

    if (existing) {
      throw new BadRequestError('Connection already exists between these organizations');
    }

    // Create connection
    const connection = await prisma.clientProviderConnection.create({
      data: {
        clientOrgId: data.clientOrgId,
        providerOrgId: data.providerOrgId,
        merchantId: data.merchantId,
        storeId: data.storeId,
        sellerId: data.sellerId,
        accountId: data.accountId,
        credentials: data.credentials || {},
        settings: data.settings || {},
        syncSettings: data.syncSettings || {
          syncProducts: true,
          syncOrders: true,
          syncStock: true,
          syncPrices: true,
        },
        syncFrequency: data.syncFrequency,
      },
      include: {
        clientOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        providerOrg: {
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
        entity: 'ClientProviderConnection',
        entityId: connection.id,
        description: `Connected ${clientOrg.name} to ${providerOrg.name}`,
        metadata: {
          clientOrgId: data.clientOrgId,
          providerOrgId: data.providerOrgId,
        },
      },
    });

    return connection;
  }

  /**
   * Get all connections with filters
   */
  async getAll(filters: {
    clientOrgId?: string;
    providerOrgId?: string;
    isActive?: boolean;
    isVerified?: boolean;
    page?: number;
    limit?: number;
  }, userId: string) {
    const { clientOrgId, providerOrgId, isActive, isVerified, page = 1, limit = 10 } = filters;

    // If filtering by clientOrgId, verify user has access
    if (clientOrgId) {
      const member = await prisma.organizationMember.findFirst({
        where: {
          organizationId: clientOrgId,
          userId,
          isActive: true,
        },
      });

      if (!member) {
        throw new ForbiddenError('You do not have access to this client organization');
      }
    }

    const where: any = {};
    if (clientOrgId) where.clientOrgId = clientOrgId;
    if (providerOrgId) where.providerOrgId = providerOrgId;
    if (isActive !== undefined) where.isActive = isActive;
    if (isVerified !== undefined) where.isVerified = isVerified;

    const [connections, total] = await Promise.all([
      prisma.clientProviderConnection.findMany({
        where,
        include: {
          clientOrg: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
          providerOrg: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { connectedAt: 'desc' },
      }),
      prisma.clientProviderConnection.count({ where }),
    ]);

    return {
      data: connections,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get connection by ID
   */
  async getById(id: string, userId: string) {
    const connection = await prisma.clientProviderConnection.findUnique({
      where: { id },
      include: {
        clientOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            email: true,
            phone: true,
          },
        },
        providerOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            email: true,
            phone: true,
            website: true,
          },
        },
      },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    // Verify user has access to client org
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: connection.clientOrgId,
        userId,
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have access to this connection');
    }

    return connection;
  }

  /**
   * Update connection
   */
  async update(id: string, data: UpdateConnectionInput, userId: string) {
    const connection = await prisma.clientProviderConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    // Check permission
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: connection.clientOrgId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have permission to update this connection');
    }

    const updated = await prisma.clientProviderConnection.update({
      where: { id },
      data,
      include: {
        clientOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
        providerOrg: {
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
        entity: 'ClientProviderConnection',
        entityId: id,
        description: 'Updated client-provider connection',
        metadata: {
          changes: Object.keys(data),
        },
      },
    });

    return updated;
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(id: string, data: UpdateSyncStatusInput, userId: string) {
    const connection = await this.getById(id, userId);

    const updated = await prisma.clientProviderConnection.update({
      where: { id },
      data: {
        ...data,
        lastSyncAt: new Date(),
      },
      include: {
        clientOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        providerOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Disconnect (soft delete)
   */
  async disconnect(id: string, userId: string) {
    const connection = await prisma.clientProviderConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    // Check permission (OWNER only)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: connection.clientOrgId,
        userId,
        role: 'OWNER',
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('Only client organization owners can disconnect providers');
    }

    const updated = await prisma.clientProviderConnection.update({
      where: { id },
      data: {
        isActive: false,
        disconnectedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.DELETE,
        entity: 'ClientProviderConnection',
        entityId: id,
        description: 'Disconnected client from provider',
        metadata: {
          clientOrgId: connection.clientOrgId,
          providerOrgId: connection.providerOrgId,
        },
      },
    });

    return { success: true, message: 'Connection deactivated', data: updated };
  }

  /**
   * Permanently delete connection
   */
  async delete(id: string, userId: string) {
    const connection = await prisma.clientProviderConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      throw new NotFoundError('Connection not found');
    }

    // Check permission (OWNER only)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: connection.clientOrgId,
        userId,
        role: 'OWNER',
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('Only client organization owners can delete connections');
    }

    await prisma.clientProviderConnection.delete({
      where: { id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.DELETE,
        entity: 'ClientProviderConnection',
        entityId: id,
        description: 'Permanently deleted client-provider connection',
        metadata: {
          clientOrgId: connection.clientOrgId,
          providerOrgId: connection.providerOrgId,
        },
      },
    });

    return { success: true, message: 'Connection permanently deleted' };
  }

  /**
   * Get all connections for a client (cross-provider view)
   */
  async getClientConnections(clientOrgId: string, userId: string) {
    // Verify user has access
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: clientOrgId,
        userId,
        isActive: true,
      },
    });

    if (!member) {
      throw new ForbiddenError('You do not have access to this client organization');
    }

    const connections = await prisma.clientProviderConnection.findMany({
      where: {
        clientOrgId,
        isActive: true,
      },
      include: {
        providerOrg: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            logoUrl: true,
          },
        },
      },
      orderBy: { connectedAt: 'desc' },
    });

    return connections;
  }
}
