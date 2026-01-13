import { ArticleSchedulerService } from './src/modules/sync/services/article-scheduler.service';
import logger from './src/config/logger';

async function testArticlesSync() {
  try {
    logger.info('Testing ARTICLES sync manually...');
    
    // Use the actual sync configuration ID from the database
    const syncConfigId = '5e92e0af-631b-4184-87ec-4697b6920587';
    
    const result = await ArticleSchedulerService.syncArticles(syncConfigId);
    
    logger.info('ARTICLES sync completed:', result);
  } catch (error: any) {
    logger.error('ARTICLES sync failed:', error.message);
    logger.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testArticlesSync();
