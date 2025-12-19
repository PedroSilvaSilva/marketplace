import prisma from '@config/database';
import { ConflictError, NotFoundError } from '@utils/errors';
import logger from '@config/logger';

interface CreateCustomerData {
  companyName: string;
  taxId: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

interface UpdateCustomerData {
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  status?: string;
}

export class CustomerService {
  async getAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where: { deletedAt: null } }),
    ]);

    return { customers, total };
  }

  async getById(id: string) {
    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    return customer;
  }

  async create(data: CreateCustomerData, userId?: string) {
    // Check if customer with same taxId already exists
    const existing = await prisma.customer.findUnique({
      where: { taxId: data.taxId },
    });

    if (existing) {
      throw new ConflictError('Customer with this Tax ID already exists');
    }

    const customer = await prisma.customer.create({
      data: {
        companyName: data.companyName,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Customer',
        entityId: customer.id,
        description: 'Customer created',
        metadata: data as any,
      },
    });

    logger.info(`Customer created: ${customer.id}`);

    return customer;
  }

  async update(id: string, data: UpdateCustomerData, userId: string) {
    await this.getById(id); // Verify exists

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        companyName: data.companyName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        status: data.status,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Customer',
        entityId: customer.id,
        description: 'Customer updated',
        changes: data as any,
      },
    });

    logger.info(`Customer updated: ${customer.id}`);

    return customer;
  }

  async delete(id: string, userId?: string) {
    await this.getById(id);

    // Soft delete
    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'Customer',
        entityId: id,
        description: 'Customer deleted',
      },
    });

    logger.info(`Customer deleted: ${id}`);
  }
}
