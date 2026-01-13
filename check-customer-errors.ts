import prisma from './src/config/database';

async function checkCustomerErrors() {
  try {
    console.log('🔍 Checking Customer Sync Errors...\n');

    // Get latest customer error logs
    const errors = await prisma.errorNotificationLog.findMany({
      where: {
        context: 'customers'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    if (errors.length === 0) {
      console.log('✅ No customer sync errors found!\n');
      console.log('Possible reasons why only 1 customer appears:');
      console.log('  1. The sync hasn\'t run yet (wait up to 60 minutes)');
      console.log('  2. The customer was successfully sent but TypsForYou rejected it');
      console.log('  3. The customer data has validation issues\n');
      
      // Check last sync execution
      const lastExecution = await prisma.syncExecutionLog.findFirst({
        where: {
          syncType: 'CUSTOMERS'
        },
        orderBy: {
          startedAt: 'desc'
        }
      });

      if (lastExecution) {
        console.log('📊 Last CUSTOMERS sync execution:');
        console.log(`   Status: ${lastExecution.status}`);
        console.log(`   Started: ${lastExecution.startedAt.toLocaleString('pt-PT')}`);
        console.log(`   Completed: ${lastExecution.completedAt?.toLocaleString('pt-PT') || 'N/A'}`);
        console.log(`   Total Fetched: ${lastExecution.totalFetched || 0}`);
        console.log(`   Total Processed: ${lastExecution.totalProcessed || 0}`);
        console.log(`   Total Succeeded: ${lastExecution.totalSucceeded || 0}`);
        console.log(`   Total Failed: ${lastExecution.totalFailed || 0}`);
        
        if (lastExecution.errorMessage) {
          console.log(`   ❌ Error: ${lastExecution.errorMessage}`);
        }
      } else {
        console.log('⏳ CUSTOMERS sync has not run yet. Wait for next scheduled run.');
      }

      return;
    }

    console.log(`❌ Found ${errors.length} customer error(s):\n`);

    for (const error of errors) {
      console.log(`📋 Error ID: ${error.id}`);
      console.log(`   Created: ${error.createdAt.toLocaleString('pt-PT')}`);
      console.log(`   Message: ${error.errorMessage}`);
      
      if (error.errorDetails) {
        const details = error.errorDetails as any;
        
        if (details.failedCustomerIDs) {
          console.log(`   Failed CustomerIDs: ${JSON.stringify(details.failedCustomerIDs)}`);
        }
        
        if (details.sent) {
          console.log(`   Sent: ${details.sent}, Loaded: ${details.loaded || 0}, Failed: ${details.failed || 0}`);
        }

        if (details.errors) {
          console.log(`   API Errors: ${JSON.stringify(details.errors, null, 2)}`);
        }
      }
      
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomerErrors();
