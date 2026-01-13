import { SQLService } from './services/sql.service';
import logger from './config/logger';

/**
 * Test SQL Server connection for ARTICLES sync
 * Run: npx ts-node test-sql-connection.ts
 */
async function testConnection() {
  const organizationId = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
  
  try {
    logger.info('Testing SQL Server connection for ARTICLES...');
    
    // Test fetching 10 articles
    const result = await SQLService.getArticles(organizationId, {
      limit: 10,
      page: 1
    });
    
    logger.info('✅ Connection successful!', {
      articlesFound: result.data.length,
      total: result.pagination.total,
      sampleArticle: result.data[0]
    });
    
  } catch (error: any) {
    logger.error('❌ Connection failed:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
  
  process.exit(0);
}

testConnection();
