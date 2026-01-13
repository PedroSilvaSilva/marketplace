import prisma from './src/config/database';

async function updateCustomerSyncInterval() {
  try {
    console.log('⏱️  Updating Customer Sync Intervals to 1 minute...\n');

    // Update all customer sync configurations to 1 minute (60 seconds)
    const result = await prisma.syncConfiguration.updateMany({
      where: {
        syncType: {
          in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
        }
      },
      data: {
        intervalSeconds: 60 // 1 minute
      }
    });

    console.log(`✅ Updated ${result.count} customer sync configuration(s)`);
    console.log('   New interval: 60 seconds (1 minute)\n');

    // Show updated configs
    const configs = await prisma.syncConfiguration.findMany({
      where: {
        syncType: {
          in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
        }
      },
      select: {
        syncType: true,
        enabled: true,
        intervalSeconds: true
      }
    });

    console.log('📋 Updated configurations:');
    configs.forEach(c => {
      console.log(`   ${c.syncType}: ${c.intervalSeconds}s (${c.enabled ? 'ENABLED' : 'DISABLED'})`);
    });

    console.log('\n⚠️ IMPORTANT: Restart your server (pnpm dev) to apply the new interval!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCustomerSyncInterval();
