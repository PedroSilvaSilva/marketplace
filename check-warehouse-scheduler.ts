import prisma from './src/config/database';

async function checkArticleWarehouseScheduler() {
  try {
    console.log('🔍 Checking ARTICLE_WAREHOUSE scheduler configuration...\n');

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
        }
      }
    });

    console.log(`Found ${configs.length} ARTICLE_WAREHOUSE configurations:\n`);

    for (const config of configs) {
      console.log(`📋 Config ID: ${config.id}`);
      console.log(`   Organization: ${config.organization.name} (${config.organizationId})`);
      console.log(`   Enabled: ${config.enabled}`);
      console.log(`   Interval: ${config.intervalSeconds}s`);
      console.log(`   Last Sync: ${config.lastSyncAt || 'Never'}`);
      console.log(`   Last Success: ${config.lastSuccessAt || 'Never'}`);
      console.log(`   Last Error: ${config.lastErrorAt || 'Never'}`);
      if (config.lastError) {
        console.log(`   ❌ Error: ${config.lastError}`);
      }
      console.log(`   Options:`, config.options);
      console.log('');
    }

    if (configs.length === 0) {
      console.log('⚠️  No ARTICLE_WAREHOUSE scheduler found! Creating one...\n');
      
      // Get active organization and provider
      const org = await prisma.organization.findFirst({
        where: { isActive: true },
        include: {
          providerConfigs: {
            where: { isActive: true },
            take: 1
          }
        }
      });

      if (org && org.providerConfigs.length > 0) {
        const newConfig = await prisma.syncConfiguration.create({
          data: {
            organizationId: org.id,
            providerConfigId: org.providerConfigs[0].id,
            syncType: 'ARTICLE_WAREHOUSE',
            enabled: true,
            intervalSeconds: 300, // Every 5 minutes
            options: {}
          }
        });
        
        console.log('✅ Created ARTICLE_WAREHOUSE scheduler:', newConfig.id);
      } else {
        console.log('❌ No active organization or provider found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticleWarehouseScheduler();
