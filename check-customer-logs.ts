import prisma from './src/config/database';

async function checkCustomerSyncLogs() {
  try {
    console.log('🔍 Checking Customer Sync Execution Logs...\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check all sync execution logs for customers today
    const logs = await prisma.syncExecutionLog.findMany({
      where: {
        syncType: {
          in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
        },
        startedAt: {
          gte: today
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 20
    });

    if (logs.length === 0) {
      console.log('❌ No customer sync execution logs found for today!');
      console.log('\nPossible reasons:');
      console.log('  1. Customer syncs have not run yet');
      console.log('  2. Server was not running');
      console.log('  3. Sync configurations are disabled\n');
      
      // Check configurations
      const configs = await prisma.syncConfiguration.findMany({
        where: {
          syncType: {
            in: ['CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']
          }
        }
      });
      
      console.log('Customer Sync Configurations:');
      configs.forEach(c => {
        console.log(`  ${c.syncType}: ${c.enabled ? '✅ ENABLED' : '❌ DISABLED'} (interval: ${c.intervalSeconds}s)`);
        console.log(`    Last sync: ${c.lastSyncAt ? c.lastSyncAt.toLocaleString('pt-PT') : 'Never'}`);
      });
      
      return;
    }

    console.log(`✅ Found ${logs.length} customer sync execution log(s):\n`);

    for (const log of logs) {
      console.log(`📋 ${log.syncType}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   Started: ${log.startedAt.toLocaleString('pt-PT')}`);
      console.log(`   Completed: ${log.completedAt?.toLocaleString('pt-PT') || 'Not completed'}`);
      console.log(`   Duration: ${log.duration || 0}ms`);
      console.log(`   Fetched: ${log.totalFetched || 0}`);
      console.log(`   Processed: ${log.totalProcessed || 0}`);
      console.log(`   Succeeded: ${log.totalSucceeded || 0}`);
      console.log(`   Failed: ${log.totalFailed || 0}`);
      
      if (log.errorMessage) {
        console.log(`   ❌ Error: ${log.errorMessage.substring(0, 100)}...`);
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomerSyncLogs();
