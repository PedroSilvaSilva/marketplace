import prisma from './src/config/database';

async function fixStockViewConfig() {
  try {
    console.log('🔍 Checking current configuration...\n');

    const configs = await prisma.dataSourceConfig.findMany({
      select: {
        id: true,
        organizationId: true,
        isActive: true,
        sqlHost: true,
        sqlDatabase: true,
        productView: true,
        stockView: true
      }
    });

    console.log('Found configurations:', configs.length);
    
    for (const config of configs) {
      console.log('\n📋 Config:', {
        id: config.id,
        organizationId: config.organizationId,
        isActive: config.isActive,
        sqlHost: config.sqlHost,
        sqlDatabase: config.sqlDatabase,
        productView: config.productView,
        stockView: config.stockView
      });

      if (config.isActive && !config.stockView) {
        console.log('\n⚠️  stockView is NULL! Updating...');
        
        // Update with the stock view name
        const updated = await prisma.dataSourceConfig.update({
          where: { id: config.id },
          data: {
            stockView: '[samiparts].[dbo].[u_csw_tips4y_ArticleWarehouse]'
          }
        });

        console.log('✅ Updated stockView to:', updated.stockView);
      } else if (config.stockView) {
        console.log('✅ stockView already configured:', config.stockView);
      }
    }

    console.log('\n✅ Configuration check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStockViewConfig();
