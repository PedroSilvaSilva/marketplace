import prisma from '../src/config/database';
import { CryptoService } from '../src/utils/crypto';
import logger from '../src/config/logger';

async function main() {
  logger.info('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await CryptoService.hashPassword('Admin@123456');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cswmarkets.com' },
    update: {},
    create: {
      email: 'admin@cswmarkets.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  logger.info(`✅ Admin user created: ${admin.email}`);

  // Create manager user
  const managerPassword = await CryptoService.hashPassword('Manager@123456');
  const manager = await prisma.user.upsert({
    where: { email: 'manager@cswmarkets.com' },
    update: {},
    create: {
      email: 'manager@cswmarkets.com',
      password: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  logger.info(`✅ Manager user created: ${manager.email}`);

  // Create regular user
  const userPassword = await CryptoService.hashPassword('User@123456');
  const user = await prisma.user.upsert({
    where: { email: 'user@cswmarkets.com' },
    update: {},
    create: {
      email: 'user@cswmarkets.com',
      password: userPassword,
      firstName: 'Regular',
      lastName: 'User',
      role: 'USER',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  logger.info(`✅ Regular user created: ${user.email}`);

  // Create sample customers
  const customers = [
    {
      companyName: 'Acme Corporation',
      taxId: '123456789',
      email: 'contact@acme.com',
      phone: '+1-555-0100',
      address: '123 Main Street',
      city: 'New York',
      country: 'USA',
    },
    {
      companyName: 'Tech Solutions Ltd',
      taxId: '987654321',
      email: 'info@techsolutions.com',
      phone: '+44-20-7946-0958',
      address: '456 Tech Park',
      city: 'London',
      country: 'UK',
    },
    {
      companyName: 'Global Trading Co',
      taxId: '555666777',
      email: 'sales@globaltrading.com',
      phone: '+49-30-12345678',
      address: '789 Commerce Ave',
      city: 'Berlin',
      country: 'Germany',
    },
  ];

  for (const customerData of customers) {
    const customer = await prisma.customer.upsert({
      where: { taxId: customerData.taxId },
      update: {},
      create: customerData,
    });
    logger.info(`✅ Customer created: ${customer.companyName}`);
  }

  // Create sample integrations
  const integrations = [
    {
      name: 'Stripe Payment Gateway',
      type: 'payment',
      config: {
        apiVersion: 'v1',
        webhookUrl: 'https://api.cswmarkets.com/webhooks/stripe',
      },
      apiKey: CryptoService.generateRandomToken(32),
      isActive: true,
    },
    {
      name: 'SendGrid Email Service',
      type: 'email',
      config: {
        apiVersion: 'v3',
        fromEmail: 'noreply@cswmarkets.com',
      },
      apiKey: CryptoService.generateRandomToken(32),
      isActive: true,
    },
    {
      name: 'Salesforce CRM',
      type: 'crm',
      config: {
        instanceUrl: 'https://example.salesforce.com',
        apiVersion: 'v52.0',
      },
      apiKey: CryptoService.generateRandomToken(32),
      isActive: false,
    },
  ];

  for (const integrationData of integrations) {
    const integration = await prisma.integration.create({
      data: integrationData,
    });
    logger.info(`✅ Integration created: ${integration.name}`);
  }

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'DATABASE_SEEDED',
      entity: 'System',
      entityId: 'seed',
      newValue: {
        users: 3,
        customers: customers.length,
        integrations: integrations.length,
      },
    },
  });

  logger.info('🎉 Database seed completed successfully!');
  logger.info('');
  logger.info('📝 Test credentials:');
  logger.info('Admin: admin@cswmarkets.com / Admin@123456');
  logger.info('Manager: manager@cswmarkets.com / Manager@123456');
  logger.info('User: user@cswmarkets.com / User@123456');
}

main()
  .catch((e) => {
    logger.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
