import prisma from './src/config/database';

async function createCustomerSyncConfigs() {
  try {
    console.log('🔧 Creating Customer Sync Configurations...\n');

    // Get organization and provider config
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      console.error('❌ No organization found!');
      return;
    }

    const providerConfig = await prisma.providerConfig.findFirst({
      where: { organizationId: organization.id }
    });
    if (!providerConfig) {
      console.error('❌ No provider config found!');
      return;
    }

    console.log(`📋 Organization: ${organization.name}`);
    console.log(`🔌 Provider: ${providerConfig.provider}\n`);

    // Check if configs already exist
    const existing = await prisma.syncConfiguration.findMany({
      where: {
        organizationId: organization.id,
        syncType: {
          in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
        }
      }
    });

    if (existing.length > 0) {
      console.log('⚠️ Customer sync configurations already exist:');
      existing.forEach(c => console.log(`   - ${c.syncType}`));
      console.log('\nSkipping creation.');
      return;
    }

    // Create CUSTOMERS sync config
    const customersConfig = await prisma.syncConfiguration.create({
      data: {
        organizationId: organization.id,
        providerConfigId: providerConfig.id,
        syncType: 'CUSTOMERS',
        enabled: true,
        intervalSeconds: 3600, // 60 minutes
        options: {}
      }
    });
    console.log(`✅ Created CUSTOMERS sync config (every 60 minutes)`);

    // Create CUSTOMER_DISCOUNT_GROUPS sync config
    const discountGroupsConfig = await prisma.syncConfiguration.create({
      data: {
        organizationId: organization.id,
        providerConfigId: providerConfig.id,
        syncType: 'CUSTOMER_DISCOUNT_GROUPS',
        enabled: true,
        intervalSeconds: 3600, // 60 minutes
        options: {}
      }
    });
    console.log(`✅ Created CUSTOMER_DISCOUNT_GROUPS sync config (every 60 minutes)`);

    // Create CUSTOMER_WAREHOUSES sync config
    const warehousesConfig = await prisma.syncConfiguration.create({
      data: {
        organizationId: organization.id,
        providerConfigId: providerConfig.id,
        syncType: 'CUSTOMER_WAREHOUSES',
        enabled: true,
        intervalSeconds: 3600, // 60 minutes
        options: {}
      }
    });
    console.log(`✅ Created CUSTOMER_WAREHOUSES sync config (every 60 minutes)`);

    console.log('\n🎉 All customer sync configurations created successfully!');
    console.log('\n⚠️ IMPORTANT: Restart your server (pnpm dev) to load the new configurations.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCustomerSyncConfigs();
