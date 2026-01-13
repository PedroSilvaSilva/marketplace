import prisma from './src/config/database';

async function testStockView() {
  try {
    // Verificar todas as configs
    const configs = await prisma.dataSourceConfig.findMany({
      select: {
        organizationId: true,
        isActive: true,
        stockView: true,
        productView: true
      }
    });

    console.log('📋 Data Source Configs:');
    console.log(JSON.stringify(configs, null, 2));

    if (configs.length === 0) {
      console.log('❌ Nenhuma config encontrada');
      return;
    }

    const activeConfig = configs.find(c => c.isActive);
    if (!activeConfig) {
      console.log('❌ Nenhuma config ativa');
      return;
    }

    console.log('\n✅ Config ativa:');
    console.log('productView:', activeConfig.productView);
    console.log('stockView:', activeConfig.stockView);

    if (!activeConfig.stockView) {
      console.log('\n⚠️ stockView está NULL/vazio!');
      console.log('📝 Precisa atualizar para: samiparts.dbo.u_csw_tips4y_ArticleWarehouse');
    } else {
      console.log('\n✅ stockView configurado:', activeConfig.stockView);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testStockView();
