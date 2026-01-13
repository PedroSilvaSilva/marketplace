import prisma from './src/config/database';

async function checkWarehouseSync() {
  try {
    console.log('📊 Verificando sincronização ARTICLE_WAREHOUSE...\n');

    // Check cache size
    const cacheCount = await prisma.articleWarehouseSyncCache.count();
    console.log(`✅ Registros na cache: ${cacheCount.toLocaleString()}`);

    // Get unique warehouses in cache
    const warehouses = await prisma.articleWarehouseSyncCache.groupBy({
      by: ['warehouseCode'],
      _count: true
    });

    console.log('\n📦 Por warehouse:');
    for (const wh of warehouses) {
      console.log(`   ${wh.warehouseCode}: ${wh._count.toLocaleString()} registros`);
    }

    // Check last execution
    const lastExec = await prisma.syncExecutionLog.findFirst({
      where: { syncType: 'ARTICLE_WAREHOUSE' },
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        startedAt: true,
        totalFetched: true,
        totalProcessed: true,
        totalSucceeded: true,
        totalFailed: true,
        duration: true
      }
    });

    if (lastExec) {
      console.log('\n📋 Última execução:');
      console.log(`   Status: ${lastExec.status}`);
      console.log(`   Hora: ${lastExec.startedAt}`);
      console.log(`   Fetched da SQL: ${lastExec.totalFetched?.toLocaleString() || 0}`);
      console.log(`   Processados: ${lastExec.totalProcessed?.toLocaleString() || 0}`);
      console.log(`   Sucesso: ${lastExec.totalSucceeded?.toLocaleString() || 0}`);
      console.log(`   Falhas: ${lastExec.totalFailed?.toLocaleString() || 0}`);
      console.log(`   Duração: ${lastExec.duration}ms`);
    }

    const remaining = 106840 - cacheCount;
    console.log(`\n⏳ Registros faltando: ${remaining.toLocaleString()}`);
    console.log(`⏱️  Tempo estimado: ~${Math.ceil(remaining / 1000) * 2} segundos em ${Math.ceil(remaining / 1000)} batches`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWarehouseSync();
