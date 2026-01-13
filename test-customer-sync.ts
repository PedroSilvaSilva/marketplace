import { CustomerSyncService } from './src/modules/sync/services/customer-sync.service';
import prisma from './src/config/database';

async function testCustomerSync() {
  try {
    console.log('🧪 Testing customer sync...\n');
    
    // Get a customer sync configuration
    const config = await prisma.syncConfiguration.findFirst({
      where: {
        syncType: 'CUSTOMERS',
        enabled: true
      }
    });
    
    if (!config) {
      console.log('❌ No customer sync configuration found');
      return;
    }
    
    console.log('📋 Config found:', {
      id: config.id,
      organizationId: config.organizationId,
      providerConfigId: config.providerConfigId,
      enabled: config.enabled
    });
    
    console.log('\n🚀 Starting customer sync...\n');
    
    const result = await CustomerSyncService.sendCustomersToTypsForYou(
      config.organizationId,
      config.providerConfigId,
      {
        syncConfigurationId: config.id,
        ...(config.options as any)
      }
    );
    
    console.log('\n✅ Sync completed:', result);
    
  } catch (error) {
    console.error('\n❌ Sync failed:');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testCustomerSync();
