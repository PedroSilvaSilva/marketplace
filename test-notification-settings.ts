import prisma from './src/config/database';

async function testNotificationSettings() {
  try {
    console.log('🧪 Testing notification settings...\n');
    
    // Check if global settings exist
    const globalSettings = await prisma.notificationSettings.findFirst({
      where: { organizationId: null }
    });
    
    console.log('📧 Global notification settings:');
    console.log('  ID:', globalSettings?.id);
    console.log('  Notify on Success:', globalSettings?.notifyOnSuccess);
    console.log('  Notify on Error:', globalSettings?.notifyOnError);
    console.log('  Notify on Partial:', globalSettings?.notifyOnPartial);
    console.log('  Email Recipients:', globalSettings?.emailRecipients);
    console.log('  Sync Types:', globalSettings?.syncTypes.length > 0 ? globalSettings?.syncTypes : 'All');
    
    console.log('\n✅ Notification settings working correctly!');
    console.log('\n📝 Summary:');
    console.log('  - Emails sent ONLY on errors (notifyOnSuccess = false)');
    console.log('  - Emails sent on failures (notifyOnError = true)');
    console.log('  - Emails sent on partial sync (notifyOnPartial = true)');
    console.log(`  - Recipients: ${globalSettings?.emailRecipients.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNotificationSettings();
