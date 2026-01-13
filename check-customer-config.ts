import prisma from './src/config/database';

async function checkCustomerSyncConfig() {
  try {
    console.log('🔍 Checking Customer Sync Configuration...\n');

    const configs = await prisma.syncConfiguration.findMany({
      where: {
        syncType: {
          in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
        }
      },
      include: {
        organization: true
      },
      orderBy: {
        syncType: 'asc'
      }
    });

    if (configs.length === 0) {
      console.log('❌ No customer sync configurations found!');
      console.log('\nYou need to create sync configurations for:');
      console.log('  - CUSTOMERS');
      console.log('  - CUSTOMER_DISCOUNT_GROUPS');
      console.log('  - CUSTOMER_WAREHOUSES');
      return;
    }

    console.log(`✅ Found ${configs.length} customer sync configuration(s):\n`);

    for (const config of configs) {
      console.log(`📋 ${config.syncType}`);
      console.log(`   ID: ${config.id}`);
      console.log(`   Organization: ${config.organization.name}`);
      console.log(`   Enabled: ${config.enabled ? '✅' : '❌'}`);
      console.log(`   Interval: ${config.interval}ms (${Math.round(config.interval / 1000 / 60)} minutes)`);
      console.log(`   Last Sync: ${config.lastSyncAt ? config.lastSyncAt.toLocaleString('pt-PT') : 'Never'}`);
      console.log(`   Last Success: ${config.lastSuccessAt ? config.lastSuccessAt.toLocaleString('pt-PT') : 'Never'}`);
      
      if (config.lastError) {
        console.log(`   ⚠️ Last Error: ${config.lastError}`);
        console.log(`   Error At: ${config.lastErrorAt?.toLocaleString('pt-PT')}`);
      }
      
      console.log('');
    }

    // Check if any are disabled
    const disabledCount = configs.filter(c => !c.enabled).length;
    if (disabledCount > 0) {
      console.log(`\n⚠️ Warning: ${disabledCount} configuration(s) are DISABLED`);
      console.log('Enable them to start syncing customers.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomerSyncConfig();
