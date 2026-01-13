import prisma from './src/config/database';

async function checkErrorLogs() {
  console.log('🔍 Checking error notification logs...\n');
  
  const errors = await prisma.errorNotificationLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log(`Found ${errors.length} error logs (last 20):\n`);
  
  errors.forEach(err => {
    console.log('─────────────────────────────────────');
    console.log(`ID: ${err.id}`);
    console.log(`Context: ${err.context}`);
    console.log(`Created: ${err.createdAt}`);
    console.log(`Message: ${err.errorMessage}`);
    console.log(`Details:`, JSON.stringify(err.errorDetails, null, 2));
    console.log();
  });
}

checkErrorLogs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
