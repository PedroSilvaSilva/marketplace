import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticate } from '@middlewares/auth';
import { asyncHandler } from '@utils/response';
import { AppError } from '@utils/errors';
import { Typs4YouClient } from './clients/typs4you.client';
import { SyncService } from './services/sync.service';
import { DiscountGroupSyncService } from './services/discount-group-sync.service';
import { DiscountSubGroupSyncService } from './services/discount-subgroup-sync.service';
import { ArticleSyncService } from './services/article-sync.service';
import { ArticleWarehouseSyncService } from './services/article-warehouse-sync.service';
import { CustomerSyncService } from './services/customer-sync.service';
import { CustomerDiscountGroupSyncService } from './services/customer-discount-group-sync.service';
import { CustomerWarehouseSyncService } from './services/customer-warehouse-sync.service';
import { OrderSyncService } from './services/order-sync.service';
import { OrderProcessingService } from './services/order-processing.service';
import { OrderIntegrationService } from './services/order-integration.service';
import { BatchSyncService } from './services/batch-sync.service';
import { ErrorLogger } from './services/error-logger.service';
import { SQLService } from '../../services/sql.service';
import { CryptoService } from '@utils/crypto';
import logger from '@config/logger';
import prisma from '@config/database';
import { SyncJobType, SyncJobStatus } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * /sync/test-auth/{providerConfigId}:
 *   post:
 *     summary: Test TypsForYou API authentication (no auth required)
 *     tags: [Sync]
 *     parameters:
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider configuration ID
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       401:
 *         description: Authentication failed
 */
router.post('/test-auth/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and test authentication
  const client = new Typs4YouClient(providerConfigId);
  const result = await client.testAuth();

  res.json({
    success: true,
    message: 'TypsForYou authentication successful',
    data: result
  });
}));

/**
 * @swagger
 * /sync/force-customer-sync/{organizationId}/{providerConfigId}:
 *   post:
 *     summary: Force customer sync to TypsForYou (no auth required - for cron/manual)
 *     tags: [Sync]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider configuration ID
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Optional - sync specific customer only
 *     responses:
 *       200:
 *         description: Customers sent successfully
 */
router.post('/force-customer-sync/:organizationId/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { customerId } = req.query;

  logger.info('Force customer sync triggered', { organizationId, providerConfigId, customerId });

  const result = await CustomerSyncService.sendCustomersToTypsForYou(
    organizationId,
    providerConfigId,
    {
      customerId: customerId as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} customers, ${result.loadedRecords} loaded by API`
      : `Failed to send customers`,
    data: result
  });
}));

// Apply authentication to all routes except test-auth and force-customer-sync
router.use(authenticate);

/**
 * @swagger
 * /sync/articles/{providerConfigId}:
 *   get:
 *     summary: Get articles from TypsForYou marketplace
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider configuration ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *         description: Filter by brand ID
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Articles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/articles/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;
  const { page, limit, search, brandId, active } = req.query;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and fetch articles
  const client = new Typs4YouClient(providerConfigId);
  const articles = await client.getArticles({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    search: search as string,
    brandId: brandId as string,
    active: active ? active === 'true' : undefined
  });

  res.json({
    success: true,
    data: articles
  });
}));

/**
 * @route   GET /api/v1/sync/warehouse/:providerConfigId
 * @desc    Get article warehouse (stock) from TypsForYou
 * @access  Private
 */
router.get('/warehouse/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;
  const { page, limit, articleId, brandId, partNumber } = req.query;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and fetch warehouse data
  const client = new Typs4YouClient(providerConfigId);
  const warehouse = await client.getArticleWarehouse({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    articleId: articleId as string,
    brandId: brandId as string,
    partNumber: partNumber as string
  });

  res.json({
    success: true,
    data: warehouse
  });
}));

/**
 * @route   GET /api/v1/sync/customers-warehouses/:providerConfigId
 * @desc    Get customers warehouses from TypsForYou
 * @access  Private
 */
router.get('/customers-warehouses/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;
  const { page, limit, customerId, warehouseCode } = req.query;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and fetch customers warehouses
  const client = new Typs4YouClient(providerConfigId);
  const customersWarehouses = await client.getCustomersWarehouses({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    customerId: customerId as string,
    warehouseCode: warehouseCode as string
  });

  res.json({
    success: true,
    data: customersWarehouses
  });
}));

/**
 * @route   GET /api/v1/sync/customers/:providerConfigId
 * @desc    Get customers from TypsForYou
 * @access  Private
 */
router.get('/customers/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;
  const { page, limit, customerId, name } = req.query;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and fetch customers
  const client = new Typs4YouClient(providerConfigId);
  const customers = await client.getCustomers({
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    customerId: customerId as string,
    name: name as string
  });

  res.json({
    success: true,
    data: customers
  });
}));

/**
 * @route   POST /api/v1/sync/articles/:providerConfigId
 * @desc    Create article in TypsForYou
 * @access  Private
 */
router.post('/articles/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { providerConfigId } = req.params;
  const articleData = req.body;

  if (!providerConfigId) {
    throw new AppError('Provider config ID is required', 400);
  }

  // Create client and create article
  const client = new Typs4YouClient(providerConfigId);
  const result = await client.uploadArticlesCsv(articleData);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * @route   POST /api/v1/sync/run/:organizationId/:providerConfigId
 * @desc    Sync articles from SQL Server to TypsForYou
 * @access  Private
 */
router.post('/run/:organizationId/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  console.log('🚀 SYNC RUN ROUTE HIT!');
  const { organizationId, providerConfigId } = req.params;
  const { limit, dryRun } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await SyncService.syncArticles(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      dryRun: dryRun === 'true'
    }
  );

  res.json({
    success: true,
    data: result
  });
}));

/**
 * @swagger
 * /sync/import/{organizationId}/{providerConfigId}:
 *   post:
 *     summary: Import articles from SQL Server to staging table
 *     description: Reads articles from source SQL database and stores them in sync_articles staging table with validation
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider configuration ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Maximum number of articles to import
 *       - in: query
 *         name: replaceExisting
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Replace existing staged articles
 *     responses:
 *       200:
 *         description: Articles imported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     articlesRead:
 *                       type: integer
 *                     articlesImported:
 *                       type: integer
 *                     articlesSkipped:
 *                       type: integer
 */
router.post('/import/:organizationId/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, replaceExisting } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await SyncService.importArticlesToStaging(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      replaceExisting: replaceExisting === 'true'
    }
  );

  res.json({
    success: true,
    message: `Imported ${result.articlesImported} articles to staging`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/staging/{organizationId}/{providerConfigId}/csv:
 *   get:
 *     summary: Generate CSV from staged articles
 *     description: Generates CSV file from articles in staging table for manual review or download
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, VALIDATED, SENT, ERROR, REJECTED, SKIPPED]
 *         description: Filter by article status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of articles to include
 *     responses:
 *       200:
 *         description: CSV file generated
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/staging/:organizationId/:providerConfigId/csv', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { status, limit } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await SyncService.generateCsvFromStaging(
    organizationId,
    providerConfigId,
    {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    }
  );

  // Return CSV as downloadable file
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="articles_${Date.now()}.csv"`);
  res.send(result.csv);
}));

/**
 * @swagger
 * /sync/staging/{organizationId}/{providerConfigId}/sync-existing:
 *   post:
 *     summary: Sync existing articles from TypsForYou
 *     description: Fetches all articles from TypsForYou and marks them as SENT in staging table to avoid duplicate uploads
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Existing articles synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalFetched:
 *                       type: integer
 *                     markedAsSent:
 *                       type: integer
 */
router.post('/staging/:organizationId/:providerConfigId/sync-existing', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await SyncService.syncExistingArticles(
    organizationId,
    providerConfigId
  );

  res.json({
    success: true,
    message: `Synced ${result.totalFetched} articles from TypsForYou, ${result.markedAsSent} marked as sent`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/staging/{organizationId}/{providerConfigId}/reset:
 *   post:
 *     summary: Reset article status to PENDING
 *     description: Resets articles in staging table back to PENDING status for retry
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: fromStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, VALIDATED, SENT, ERROR, REJECTED, SKIPPED]
 *         description: Only reset articles with this specific status
 *     responses:
 *       200:
 *         description: Articles reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 */
router.post('/staging/:organizationId/:providerConfigId/reset', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { fromStatus } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  // Reset articles back to PENDING
  const result = await prisma.syncArticle.updateMany({
    where: {
      organizationId,
      providerConfigId,
      ...(fromStatus && { status: fromStatus as any })
    },
    data: {
      status: 'PENDING',
      attempts: 0,
      errorMessage: null,
      lastAttemptAt: null,
      sentAt: null
    }
  });

  res.json({
    success: true,
    message: `Reset ${result.count} articles to PENDING status`,
    data: { count: result.count }
  });
}));

/**
 * @swagger
 * /sync/staging/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send staged articles to TypsForYou
 *     description: Generates CSV from staging table and uploads to TypsForYou marketplace. Updates article status based on API response.
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, VALIDATED, ERROR, REJECTED]
 *           default: PENDING
 *         description: Send only articles with this status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *         description: Maximum number of articles to send
 *     responses:
 *       200:
 *         description: Articles sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     sent:
 *                       type: integer
 *                     rejected:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.post('/staging/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { status, limit } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  // Send staged articles (with automatic status update)
  const result = await SyncService.sendStagedArticles(
    organizationId,
    providerConfigId,
    {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined
    }
  );

  res.json({
    success: result.success,
    message: `Sent ${result.sent} articles, ${result.rejected} rejected`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/discount-groups/{organizationId}/{providerConfigId}/csv:
 *   get:
 *     summary: Generate CSV for discount groups and automatically send to TypsForYou
 *     description: Generates CSV file from SQL Server discount groups view and automatically sends to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of groups to include
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *     responses:
 *       200:
 *         description: CSV file generated and sent to TypsForYou
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/discount-groups/:organizationId/:providerConfigId/csv', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  // 1. Generate CSV
  const result = await DiscountGroupSyncService.generateDiscountGroupsCsv(
    organizationId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string
    }
  );

  // 2. Automatically send to TypsForYou
  const sendResult = await DiscountGroupSyncService.sendDiscountGroupsToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string
    }
  );

  logger.info('Discount groups auto-sync completed', {
    csvGenerated: result.count,
    sent: sendResult.sent,
    loadedRecords: sendResult.loadedRecords,
    success: sendResult.success
  });

  // 3. Return CSV as downloadable file
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="discount_groups_${Date.now()}.csv"`);
  res.setHeader('X-Sync-Status', sendResult.success ? 'success' : 'failed');
  res.setHeader('X-Records-Sent', String(sendResult.sent));
  res.setHeader('X-Records-Loaded', String(sendResult.loadedRecords || 0));
  res.send(result.csv);
}));

/**
 * @swagger
 * /sync/discount-groups/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send discount groups to TypsForYou
 *     description: Generates CSV from SQL Server and uploads to TypsForYou marketplace
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of groups to send
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by search term
 *     responses:
 *       200:
 *         description: Discount groups sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.post('/discount-groups/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await DiscountGroupSyncService.sendDiscountGroupsToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} discount groups, ${result.loadedRecords} loaded by API`
      : `Failed to send discount groups`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/discount-subgroups/{organizationId}/{providerConfigId}/csv:
 *   get:
 *     summary: Generate CSV for discount sub-groups and automatically send to TypsForYou
 *     description: Generates CSV file from SQL Server discount sub-groups view and automatically sends to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of sub-groups to include
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: groupCode
 *         schema:
 *           type: string
 *         description: Filter by parent group code
 *     responses:
 *       200:
 *         description: CSV file generated and sent to TypsForYou
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/discount-subgroups/:organizationId/:providerConfigId/csv', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, groupCode } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  // 1. Generate CSV
  const result = await DiscountSubGroupSyncService.generateDiscountSubGroupsCsv(
    organizationId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      groupCode: groupCode as string
    }
  );

  // 2. Automatically send to TypsForYou
  const sendResult = await DiscountSubGroupSyncService.sendDiscountSubGroupsToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      groupCode: groupCode as string
    }
  );

  logger.info('Discount sub-groups auto-sync completed', {
    csvGenerated: result.count,
    sent: sendResult.sent,
    loadedRecords: sendResult.loadedRecords,
    success: sendResult.success
  });

  // 3. Return CSV as downloadable file
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="discount_subgroups_${Date.now()}.csv"`);
  res.setHeader('X-Sync-Status', sendResult.success ? 'success' : 'failed');
  res.setHeader('X-Records-Sent', String(sendResult.sent));
  res.setHeader('X-Records-Loaded', String(sendResult.loadedRecords || 0));
  res.send(result.csv);
}));

/**
 * @swagger
 * /sync/discount-subgroups/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send discount sub-groups to TypsForYou
 *     description: Generates CSV from SQL Server and uploads to TypsForYou marketplace
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of sub-groups to send
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by search term
 *       - in: query
 *         name: groupCode
 *         schema:
 *           type: string
 *         description: Filter by parent group code
 *     responses:
 *       200:
 *         description: Discount sub-groups sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.post('/discount-subgroups/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, groupCode } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  const result = await DiscountSubGroupSyncService.sendDiscountSubGroupsToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      groupCode: groupCode as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} discount sub-groups, ${result.loadedRecords} loaded by API`
      : `Failed to send discount sub-groups`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/articles/{organizationId}/{providerConfigId}/csv:
 *   get:
 *     summary: Generate articles CSV from SQL Server (preview/download)
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of articles to include
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by part number, internal part number, or article name
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *         description: Filter by brand ID
 *     responses:
 *       200:
 *         description: CSV file with articles
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/articles/:organizationId/:providerConfigId/csv', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId } = req.query;

  const result = await ArticleSyncService.generateArticlesCsv(
    organizationId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      brandId: brandId as string
    }
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="articles_${Date.now()}.csv"`);
  res.send(result.csv);
}));

/**
 * @swagger
 * /sync/articles/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send articles from SQL Server to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of articles to send
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by part number, internal part number, or article name
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *         description: Filter by brand ID
 *     responses:
 *       200:
 *         description: Articles sent successfully
 */
router.post('/articles/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId } = req.query;

  const result = await ArticleSyncService.sendArticlesToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      brandId: brandId as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} articles, ${result.loadedRecords} loaded by API`
      : `Failed to send articles`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/articles/{organizationId}/{providerConfigId}/send-chunked:
 *   post:
 *     summary: Send articles in chunks (respects 500KB limit)
 *     description: Automatically splits large datasets into multiple uploads respecting TypsForYou 500KB file size limit
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Articles sent in chunks successfully
 */
router.post('/articles/:organizationId/:providerConfigId/send-chunked', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId } = req.query;

  const result = await ArticleSyncService.sendArticlesToTypsForYouChunked(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      brandId: brandId as string
    }
  );

  res.json({
    success: result.success,
    message: `Sent ${result.totalSent} articles in ${result.chunks} chunk(s), ${result.totalLoaded} loaded by API`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/article-warehouse/{organizationId}/{providerConfigId}/csv:
 *   get:
 *     summary: Generate article warehouse CSV from SQL Server (preview/download)
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of warehouse records to include
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by part number
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *         description: Filter by brand ID
 *       - in: query
 *         name: warehouseCode
 *         schema:
 *           type: string
 *         description: Filter by warehouse code
 *     responses:
 *       200:
 *         description: CSV file with article warehouse data
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/article-warehouse/:organizationId/:providerConfigId/csv', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId, warehouseCode } = req.query;

  const options = {
    limit: limit ? parseInt(limit as string) : undefined,
    search: search as string,
    brandId: brandId as string,
    warehouseCode: warehouseCode as string
  };

  // Generate CSV
  const result = await ArticleWarehouseSyncService.generateArticleWarehouseCsv(
    organizationId,
    providerConfigId,
    options
  );

  // Auto-sync: Send to TypsForYou after generating CSV
  let syncStatus = 'not_attempted';
  let recordsSent = 0;
  let loadedRecords = 0;

  try {
    logger.info('[ArticleWarehouseSync] Auto-sending to TypsForYou after CSV generation');
    
    const syncResult = await ArticleWarehouseSyncService.sendArticleWarehouseToTypsForYou(
      organizationId,
      providerConfigId,
      options
    );

    syncStatus = syncResult.success ? 'success' : 'failed';
    recordsSent = syncResult.sent;
    loadedRecords = syncResult.loadedRecords || 0;

    logger.info('[ArticleWarehouseSync] Auto-sync completed', {
      success: syncResult.success,
      recordsSent,
      loadedRecords
    });
  } catch (syncError) {
    syncStatus = 'error';
    logger.error('[ArticleWarehouseSync] Auto-sync failed', {
      error: syncError instanceof Error ? syncError.message : String(syncError)
    });
  }

  // Add sync info to response headers
  res.setHeader('X-Sync-Status', syncStatus);
  res.setHeader('X-Records-Sent', recordsSent.toString());
  res.setHeader('X-Records-Loaded', loadedRecords.toString());
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="article_warehouse_${Date.now()}.csv"`);
  res.send(result.csv);
}));

/**
 * @swagger
 * /sync/article-warehouse/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send article warehouse data from SQL Server to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of warehouse records to send
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by part number
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *         description: Filter by brand ID
 *       - in: query
 *         name: warehouseCode
 *         schema:
 *           type: string
 *         description: Filter by warehouse code
 *     responses:
 *       200:
 *         description: Article warehouse data sent successfully
 */
router.post('/article-warehouse/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId, warehouseCode } = req.query;

  const result = await ArticleWarehouseSyncService.sendArticleWarehouseToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      brandId: brandId as string,
      warehouseCode: warehouseCode as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} warehouse records, ${result.loadedRecords} loaded by API`
      : `Failed to send warehouse records`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/article-warehouse/{organizationId}/{providerConfigId}/send-chunked:
 *   post:
 *     summary: Send article warehouse in chunks (respects 500KB limit)
 *     description: Automatically splits large warehouse datasets into multiple uploads respecting TypsForYou 500KB file size limit
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: brandId
 *         schema:
 *           type: string
 *       - in: query
 *         name: warehouseCode
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Article warehouse sent in chunks successfully
 */
router.post('/article-warehouse/:organizationId/:providerConfigId/send-chunked', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search, brandId, warehouseCode } = req.query;

  const result = await ArticleWarehouseSyncService.sendArticleWarehouseToTypsForYouChunked(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      brandId: brandId as string,
      warehouseCode: warehouseCode as string
    }
  );

  res.json({
    success: result.success,
    message: `Sent ${result.totalSent} warehouse records in ${result.chunks} chunk(s), ${result.totalLoaded} loaded by API`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/customer-discount-groups/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send customer discount groups from SQL Server to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of groups to send
 *     responses:
 *       200:
 *         description: Customer discount groups sent successfully
 */
router.post('/customer-discount-groups/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, search } = req.query;

  const result = await CustomerDiscountGroupSyncService.sendCustomerDiscountGroupsToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} customer discount groups, ${result.loadedRecords} loaded by API`
      : `Failed to send customer discount groups`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/customers/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send customers from SQL Server to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Optional - sync specific customer only
 *     responses:
 *       200:
 *         description: Customers sent successfully
 */
router.post('/customers/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { customerId } = req.query;

  const result = await CustomerSyncService.sendCustomersToTypsForYou(
    organizationId,
    providerConfigId,
    {
      customerId: customerId as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} customers, ${result.loadedRecords} loaded by API`
      : `Failed to send customers`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/customers/{organizationId}/{providerConfigId}/send:
 *   put:
 *     summary: Update customers in TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Optional - update specific customer only
 *     responses:
 *       200:
 *         description: Customers updated successfully
 */
router.put('/customers/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { customerId } = req.query;

  const result = await CustomerSyncService.updateCustomersInTypsForYou(
    organizationId,
    providerConfigId,
    {
      customerId: customerId as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully updated ${result.sent} customers, ${result.loadedRecords} loaded by API`
      : `Failed to update customers`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/customer-warehouses/{organizationId}/{providerConfigId}/send:
 *   post:
 *     summary: Send customer warehouses from SQL Server to TypsForYou
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of records to send
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *         description: Optional - sync specific customer only
 *     responses:
 *       200:
 *         description: Customer warehouses sent successfully
 */
router.post('/customer-warehouses/:organizationId/:providerConfigId/send', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { limit, customerId } = req.query;

  const result = await CustomerWarehouseSyncService.sendCustomerWarehousesToTypsForYou(
    organizationId,
    providerConfigId,
    {
      limit: limit ? parseInt(limit as string) : undefined,
      customerId: customerId as string
    }
  );

  res.json({
    success: result.success,
    message: result.success 
      ? `Successfully sent ${result.sent} customer warehouses, ${result.loadedRecords} loaded by API`
      : `Failed to send customer warehouses`,
    data: result
  });
}));

/**
 * @swagger
 * /sync/debug/check-article/{organizationId}:
 *   get:
 *     summary: Debug - Check if specific PartNumbers exist in articles view with all validations
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: partNumbers
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated PartNumbers to check (e.g. "150035004G,390512,408107")
 *     responses:
 *       200:
 *         description: Check results
 */
router.get('/debug/check-article/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { partNumbers } = req.query;

  if (!partNumbers) {
    return res.status(400).json({ error: 'partNumbers query parameter required' });
  }

  const partNumberList = (partNumbers as string).split(',').map(p => p.trim());

  const results = await Promise.all(
    partNumberList.map(async (partNumber) => {
      // Check if exists without validations
      const existsQuery = `
        SELECT TOP 1 
          BrandId, PartNumber, 
          DiscountSubGroupCode, InternalPartNumber, CategoryCode,
          ArticleName, ArticleDescription, ArticleDiscountGroupCode
        FROM (SELECT * FROM [dbo].[u_csw_tips4y_Articles]) a
        WHERE PartNumber = '${partNumber}'
      `;

      // Check if passes validations
      const validQuery = `
        SELECT TOP 1 
          BrandId, PartNumber
        FROM (SELECT * FROM [dbo].[u_csw_tips4y_Articles]) a
        WHERE PartNumber = '${partNumber}'
          AND BrandId IS NOT NULL AND BrandId <> 0
          AND PartNumber IS NOT NULL AND LTRIM(RTRIM(PartNumber)) <> ''
          AND DiscountSubGroupCode IS NOT NULL AND LTRIM(RTRIM(DiscountSubGroupCode)) <> ''
          AND InternalPartNumber IS NOT NULL AND LTRIM(RTRIM(InternalPartNumber)) <> ''
          AND CategoryCode IS NOT NULL AND LTRIM(RTRIM(CategoryCode)) <> ''
          AND ArticleName IS NOT NULL AND LTRIM(RTRIM(ArticleName)) <> ''
          AND ArticleDescription IS NOT NULL AND LTRIM(RTRIM(ArticleDescription)) <> ''
          AND ArticleDiscountGroupCode IS NOT NULL AND LTRIM(RTRIM(ArticleDiscountGroupCode)) <> ''
      `;

      const [existsResult, validResult] = await Promise.all([
        SQLService.query(organizationId, existsQuery),
        SQLService.query(organizationId, validQuery)
      ]);

      return {
        partNumber,
        exists: existsResult.length > 0,
        existsData: existsResult[0] || null,
        passesValidation: validResult.length > 0,
        validData: validResult[0] || null
      };
    })
  );

  res.json({
    success: true,
    results
  });
}));

/**
 * @swagger
 * /sync/orders/:organizationId/stats:
 *   get:
 *     summary: Get order integration statistics
 *     tags: [Sync - Orders]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/orders/:organizationId/stats', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  const stats = await OrderIntegrationService.getIntegrationStats(organizationId);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * @swagger
 * /sync/orders/{organizationId}/{providerConfigId}:
 *   get:
 *     summary: Get orders from TypsForYou and automatically process them
 *     description: Fetches orders from TypsForYou API and automatically inserts into SQL Server (DataDrive_CAB and DataDrive_LIN)
 *     tags: [Sync - Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *       - in: path
 *         name: providerConfigId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Provider Config ID (TypsForYou)
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: Optional Order ID to filter
 *       - in: query
 *         name: autoProcess
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Automatically process and insert orders into SQL Server (default true)
 *     responses:
 *       200:
 *         description: Orders fetched and processed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.get('/orders/:organizationId/:providerConfigId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId } = req.params;
  const { orderId, autoProcess } = req.query;

  if (!organizationId || !providerConfigId) {
    throw new AppError('Organization ID and Provider Config ID are required', 400);
  }

  // Fetch orders from TypsForYou
  const fetchResult = await OrderSyncService.getOrdersFromTypsForYou(
    organizationId,
    providerConfigId,
    orderId as string | undefined
  );

  logger.info('Orders fetched from TypsForYou', {
    organizationId,
    providerConfigId,
    ordersCount: fetchResult.count
  });

  // Auto-process by default (unless explicitly disabled)
  const shouldAutoProcess = autoProcess === undefined || autoProcess === 'true';

  if (shouldAutoProcess && fetchResult.orders) {
    logger.info('Auto-processing orders', { 
      organizationId,
      ordersCount: fetchResult.count 
    });

    try {
      // Get provider config for TypsForYou notification credentials
      const providerConfig = await prisma.providerConfig.findUnique({
        where: { id: providerConfigId }
      });

      if (!providerConfig) {
        throw new AppError('Provider configuration not found', 404);
      }

      // Decrypt credentials for TypsForYou notification
      const subscriptionKey = providerConfig.webhookSecret 
        ? CryptoService.decrypt(providerConfig.webhookSecret) 
        : undefined;

      // Get authentication token
      const client = new Typs4YouClient(providerConfigId);
      const token = await client.authenticate();

      // Process and insert orders into SQL Server with TypsForYou notification
      const processResult = await OrderProcessingService.processOrders(
        organizationId,
        fetchResult.orders as any,
        {
          notifyTypsForYou: true,
          subscriptionKey,
          token
        }
      );

      // Build comprehensive message
      let message = `Fetched ${fetchResult.count} order(s) from TypsForYou. `;
      if (processResult.ordersProcessed > 0) {
        message += `${processResult.ordersProcessed} new order(s) inserted with ${processResult.totalLines} line(s)`;
      }
      if (processResult.ordersSkipped > 0) {
        message += processResult.ordersProcessed > 0 ? '. ' : '';
        message += `${processResult.ordersSkipped} order(s) already existed in SQL`;
      }
      if (processResult.ordersNotified > 0) {
        message += `. ${processResult.ordersNotified} order(s) marked as integrated in TypsForYou`;
      }
      const realErrors = processResult.errors.filter(e => e.type === 'error');
      if (realErrors.length > 0) {
        message += `. ${realErrors.length} order(s) failed`;
      }
      if (processResult.notificationErrors.length > 0) {
        message += `. ${processResult.notificationErrors.length} notification(s) failed`;
      }

      res.json({
        success: processResult.success,
        message,
        data: {
          fetch: fetchResult,
          processing: processResult
        }
      });

      // Send email notification if orders were processed
      if (processResult.ordersProcessed > 0 || processResult.ordersNotified > 0) {
        try {
          const emailService = (await import('@utils/email')).default;
          const { config } = await import('@config/index');
          
          // Get notification emails from config
          const notificationEmails = config.email.orderNotificationEmails;
          
          if (notificationEmails && notificationEmails.length > 0) {
            // Build orders details for email
            const ordersResponse = fetchResult.orders as any;
            const ordersTable = ordersResponse?.Orders_Table || [];
            
            const ordersDetails = ordersTable.slice(0, 10).map((order: any) => ({
              orderID: order.OrderID,
              customerName: order.Name,
              total: order.Total,
              linesCount: order.Details?.length || 0,
              orderDate: new Date(order.OrderDate).toLocaleDateString('pt-PT')
            }));

            await emailService.sendOrdersIntegratedEmail(notificationEmails, {
              totalOrders: fetchResult.count,
              newOrders: processResult.ordersProcessed,
              duplicateOrders: processResult.ordersSkipped,
              totalLines: processResult.totalLines,
              notifiedToTypsForYou: processResult.ordersNotified,
              organizationName: 'PHC SQL Server',
              orders: ordersDetails
            });

            logger.info('Order notification email sent', {
              recipients: notificationEmails,
              ordersCount: processResult.ordersProcessed
            });
          }
        } catch (emailError) {
          // Don't fail the request if email fails
          logger.error('Failed to send order notification email', {
            error: emailError instanceof Error ? emailError.message : String(emailError)
          });
        }
      }
    } catch (error) {
      logger.error('Failed to auto-process orders', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fetch result even if processing failed
      res.json({
        success: false,
        message: `Fetched ${fetchResult.count} order(s) but failed to process: ${error instanceof Error ? error.message : String(error)}`,
        data: {
          fetch: fetchResult,
          processing: {
            error: error instanceof Error ? error.message : String(error)
          }
        }
      });
    }
  } else {
    // Just return fetched orders without processing
    res.json({
      success: true,
      message: `Successfully fetched ${fetchResult.count} order(s) (auto-process disabled)`,
      data: fetchResult
    });
  }
}));

/**
 * @swagger
 * /sync/orders/{organizationId}/process:
 *   post:
 *     summary: Process orders from TypsForYou and insert into SQL Server
 *     description: Receives orders from TypsForYou API and inserts into DataDrive_CAB and DataDrive_LIN tables
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orders:
 *                 type: object
 *                 description: Orders response from TypsForYou API
 *     responses:
 *       200:
 *         description: Orders processed successfully
 */
router.post('/orders/:organizationId/process', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const body = req.body;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  // Log body structure for debugging
  logger.info('Received orders data', {
    hasOrders: !!body.orders,
    hasOrdersTable: !!body.Orders_Table,
    hasData: !!body.data,
    bodyKeys: Object.keys(body),
    ordersKeys: body.orders ? Object.keys(body.orders) : null,
    dataKeys: body.data ? Object.keys(body.data) : null
  });

  // Accept multiple formats:
  // 1. Direct: { "Orders_Table": [...] }
  // 2. Wrapped: { "orders": { "Orders_Table": [...] } }
  // 3. From GET response: { "data": { "orders": { "Orders_Table": [...] } } }
  // 4. Full response: { "success": true, "data": { "orders": { "Orders_Table": [...] } } }
  
  let ordersData;
  
  if (body.Orders_Table) {
    // Format 1: Direct Orders_Table
    ordersData = body;
  } else if (body.orders && body.orders.Orders_Table) {
    // Format 2: Wrapped in orders
    ordersData = body.orders;
  } else if (body.data && body.data.orders && body.data.orders.Orders_Table) {
    // Format 3: From GET response
    ordersData = body.data.orders;
  } else if (body.success && body.data && body.data.orders && body.data.orders.Orders_Table) {
    // Format 4: Full API response
    ordersData = body.data.orders;
  } else {
    throw new AppError('Invalid orders data format. Expected Orders_Table array. Received keys: ' + Object.keys(body).join(', '), 400);
  }

  if (!ordersData.Orders_Table || !Array.isArray(ordersData.Orders_Table)) {
    throw new AppError('Orders_Table must be an array', 400);
  }

  const result = await OrderProcessingService.processOrders(
    organizationId,
    ordersData
  );

  // Build descriptive message
  let message = '';
  if (result.ordersProcessed > 0) {
    message += `Successfully processed ${result.ordersProcessed} order(s) with ${result.totalLines} line(s)`;
  }
  if (result.ordersSkipped > 0) {
    message += message ? '. ' : '';
    message += `${result.ordersSkipped} order(s) skipped (already exist)`;
  }
  const realErrors = result.errors.filter(e => e.type === 'error');
  if (realErrors.length > 0) {
    message += message ? '. ' : '';
    message += `${realErrors.length} order(s) failed`;
  }

  res.json({
    success: result.success,
    message: message || 'No orders processed',
    data: result
  });
}));

// =====================================================
// BATCH SYNC ROUTES - Process large datasets in batches
// =====================================================

/**
 * @swagger
 * /sync/batch/jobs:
 *   post:
 *     summary: Create a batch sync job
 *     description: Start a background job to sync large datasets in batches (1000-5000 records per batch)
 *     tags: [Sync - Batch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationId
 *               - providerConfigId
 *               - type
 *             properties:
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               providerConfigId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [ARTICLES, ARTICLE_WAREHOUSE, CUSTOMERS, DISCOUNT_GROUPS, DISCOUNT_SUBGROUPS]
 *               batchSize:
 *                 type: integer
 *                 default: 1000
 *                 minimum: 100
 *                 maximum: 5000
 *               filters:
 *                 type: object
 *                 properties:
 *                   brandId:
 *                     type: string
 *                   warehouseCode:
 *                     type: string
 *                   search:
 *                     type: string
 *     responses:
 *       201:
 *         description: Batch job created successfully
 */
router.post('/batch/jobs', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, providerConfigId, type, batchSize, filters } = req.body;

  if (!organizationId || !providerConfigId || !type) {
    throw new AppError('organizationId, providerConfigId and type are required', 400);
  }

  const job = await BatchSyncService.createSyncJob(
    organizationId,
    providerConfigId,
    type as SyncJobType,
    filters,
    batchSize || 1000
  );

  res.status(201).json({
    success: true,
    message: 'Batch sync job created successfully',
    data: job
  });
}));

/**
 * @swagger
 * /sync/batch/jobs/{jobId}:
 *   get:
 *     summary: Get batch job status
 *     tags: [Sync - Batch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 */
router.get('/batch/jobs/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = await BatchSyncService.getJobStatus(jobId);

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  res.json({
    success: true,
    data: job
  });
}));

/**
 * @swagger
 * /sync/batch/jobs:
 *   get:
 *     summary: List batch jobs for an organization
 *     tags: [Sync - Batch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ARTICLES, ARTICLE_WAREHOUSE, CUSTOMERS, DISCOUNT_GROUPS, DISCOUNT_SUBGROUPS]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Jobs list retrieved successfully
 */
router.get('/batch/jobs', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId, type, status, limit } = req.query;

  if (!organizationId) {
    throw new AppError('organizationId is required', 400);
  }

  const jobs = await BatchSyncService.listJobs(organizationId as string, {
    type: type as SyncJobType,
    status: status as SyncJobStatus,
    limit: limit ? parseInt(limit as string) : undefined
  });

  res.json({
    success: true,
    data: jobs
  });
}));

/**
 * @swagger
 * /sync/batch/jobs/{jobId}/cancel:
 *   post:
 *     summary: Cancel a batch job
 *     tags: [Sync - Batch]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Job cancelled successfully
 */
router.post('/batch/jobs/:jobId/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params;

  const job = await BatchSyncService.cancelJob(jobId);

  res.json({
    success: true,
    message: 'Job cancelled successfully',
    data: job
  });
}));

// =====================================================
// ERROR LOGS ROUTES - View detailed error information
// =====================================================

/**
 * @swagger
 * /sync/errors/{syncJobId}:
 *   get:
 *     summary: Get all errors for a specific sync job
 *     description: Retrieves detailed error logs with full context for debugging
 *     tags: [Sync - Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: syncJobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Sync Job ID
 *     responses:
 *       200:
 *         description: Error logs retrieved successfully
 */
router.get('/errors/:syncJobId', asyncHandler(async (req: Request, res: Response) => {
  const { syncJobId } = req.params;

  const errors = await ErrorLogger.getErrorsForJob(syncJobId);
  const stats = await ErrorLogger.getJobErrorStats(syncJobId);

  res.json({
    success: true,
    data: {
      errors,
      stats
    }
  });
}));

/**
 * @swagger
 * /sync/errors/organization/{organizationId}:
 *   get:
 *     summary: Get recent errors for an organization
 *     description: Retrieves recent sync errors with optional filters
 *     tags: [Sync - Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [ARTICLE, ARTICLE_WAREHOUSE, CUSTOMER, DISCOUNT_GROUP, ORDER]
 *       - in: query
 *         name: operation
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Recent errors retrieved successfully
 */
router.get('/errors/organization/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { entityType, operation, limit } = req.query;

  const errors = await ErrorLogger.getRecentErrors(organizationId, {
    entityType: entityType as string,
    operation: operation as string,
    limit: limit ? parseInt(limit as string) : undefined
  });

  res.json({
    success: true,
    data: errors
  });
}));

/**
 * @swagger
 * /sync/errors/{errorId}/details:
 *   get:
 *     summary: Get formatted error details for display
 *     description: Returns human-readable error information with context
 *     tags: [Sync - Errors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: errorId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Error details retrieved successfully
 */
router.get('/errors/:errorId/details', asyncHandler(async (req: Request, res: Response) => {
  const { errorId } = req.params;

  const errorLog = await prisma.syncErrorLog.findUnique({
    where: { id: errorId }
  });

  if (!errorLog) {
    throw new AppError('Error log not found', 404);
  }

  const formatted = ErrorLogger.formatErrorForDisplay(errorLog);

  res.json({
    success: true,
    data: formatted
  });
}));

/**
 * @swagger
 * /sync/orders/:organizationId/integrate:
 *   post:
 *     summary: Notify TypsForYou about integrated orders
 *     description: Reads integrated orders from DataDrive_CAB (integra=1 by PHC) and notifies TypsForYou
 *     tags: [Sync - Orders]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Orders notified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: number
 *                     notifiedOrders:
 *                       type: number
 *                     response:
 *                       type: object
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.post('/orders/:organizationId/integrate', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  // Get client-provider connection to find the provider
  const connection = await prisma.clientProviderConnection.findFirst({
    where: { 
      clientOrgId: organizationId,
      isActive: true 
    },
    include: {
      providerOrg: {
        include: {
          providerConfig: true
        }
      }
    }
  });

  if (!connection || !connection.providerOrg.providerConfig) {
    throw new AppError('Provider configuration not found. Please connect this organization to a provider first.', 404);
  }

  const providerConfig = connection.providerOrg.providerConfig;

  logger.info('[OrderIntegrate] Connection found:', {
    clientOrg: connection.clientOrgId,
    providerOrg: connection.providerOrgId,
    hasApiKey: !!providerConfig.apiKey,
    hasSubscriptionKey: !!providerConfig.webhookSecret
  });

  // Decrypt credentials
  const subscriptionKey = providerConfig.webhookSecret ? CryptoService.decrypt(providerConfig.webhookSecret) : '';
  const apiKey = providerConfig.apiKey ? CryptoService.decrypt(providerConfig.apiKey) : '';
  const apiSecret = providerConfig.apiSecret ? CryptoService.decrypt(providerConfig.apiSecret) : '';

  // Get token
  const client = new Typs4YouClient(providerConfig.id);
  const token = await client.authenticate();

  // Notify TypsForYou about integrated orders
  const result = await OrderIntegrationService.notifyIntegratedOrders(
    organizationId,
    subscriptionKey,
    token
  );

  logger.info('[OrderIntegrate] Service completed');

  res.json({
    success: result.success,
    message: result.success
      ? `Successfully notified TypsForYou about ${result.notifiedOrders} orders`
      : 'Order notification completed with errors',
    data: result
  });
}));

export default router;
