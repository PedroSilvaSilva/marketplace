import { SQLService } from './src/services/sql.service';
import prisma from './src/config/database';

async function testStockView() {
  try {
    console.log('🔍 Testing ARTICLE_WAREHOUSE view...\n');

    const configs = await prisma.dataSourceConfig.findMany({
      where: { isActive: true },
      select: {
        id: true,
        organizationId: true,
        sqlHost: true,
        sqlDatabase: true,
        stockView: true
      }
    });

    for (const config of configs) {
      console.log(`\n📋 Testing Organization: ${config.organizationId}`);
      console.log(`   SQL Server: ${config.sqlHost}\\${config.sqlDatabase}`);
      console.log(`   Stock View: ${config.stockView}\n`);

      // Test 1: Get all warehouses without filter
      try {
        console.log('   Test 1: Fetching ALL records (no warehouse filter)...');
        const allResult = await SQLService.getArticleWarehouse(config.organizationId, {
          page: 1,
          limit: 10
        });
        console.log(`   ✅ Found ${allResult.pagination.total} total records`);
        
        if (allResult.data.length > 0) {
          console.log(`   📦 Sample warehouses:`, 
            [...new Set(allResult.data.map(r => r.WareHouseCode))].slice(0, 5)
          );
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }

      // Test 2: Try with warehouse '1'
      try {
        console.log('\n   Test 2: Fetching with warehouseCode = "1"...');
        const wh1Result = await SQLService.getArticleWarehouse(config.organizationId, {
          page: 1,
          limit: 10,
          warehouseCode: '1'
        });
        console.log(`   ✅ Found ${wh1Result.pagination.total} records for warehouse "1"`);
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }

      // Test 3: Try with warehouse 'ARM'
      try {
        console.log('\n   Test 3: Fetching with warehouseCode = "ARM"...');
        const armResult = await SQLService.getArticleWarehouse(config.organizationId, {
          page: 1,
          limit: 10,
          warehouseCode: 'ARM'
        });
        console.log(`   ✅ Found ${armResult.pagination.total} records for warehouse "ARM"`);
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testStockView();
