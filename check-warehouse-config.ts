import prisma from './src/config/database';

async function checkWarehouseConfig() {
  try {
    console.log('🔍 Checking ARTICLE_WAREHOUSE sync configuration...\n');

    const configs = await prisma.syncConfiguration.findMany({
      where: {
        syncType: 'ARTICLE_WAREHOUSE'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        providerConfig: {
          select: {
            id: true,
            provider: true
          }
        }
      }
    });

    console.log(`Found ${configs.length} ARTICLE_WAREHOUSE configurations\n`);

    for (const config of configs) {
      console.log('📋 Configuration:', {
        id: config.id,
        organization: config.organization.name,
        syncType: config.syncType,
        isActive: config.isActive,
        schedule: config.schedule,
        options: config.options
      });

      if (!config.isActive) {
        console.log('⚠️  This configuration is INACTIVE!\n');
      } else {
        console.log('✅ This configuration is ACTIVE\n');
      }
    }

    // Check if there are any active ones
    const activeCount = configs.filter(c => c.isActive).length;
    console.log(`\n📊 Summary: ${activeCount} active, ${configs.length - activeCount} inactive`);

    if (activeCount === 0) {
      console.log('\n⚠️  No active ARTICLE_WAREHOUSE schedulers found!');
      console.log('You need to create/activate one in sync_configurations table.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWarehouseConfig();
