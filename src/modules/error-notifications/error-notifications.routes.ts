import { Router, Request, Response } from 'express';
import { asyncHandler } from '@utils/response';
import { authenticate } from '@middlewares/auth';
import { ErrorNotificationService, ErrorNotificationData } from '@services/error-notification.service';
import { z } from 'zod';
import { AppError } from '@utils/errors';
import prisma from '@config/database';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * Schema for error notification request
 */
const errorNotificationSchema = z.object({
  context: z.enum([
    'articles',
    'warehouse',
    'orders',
    'discountGroup',
    'discountSubGroup',
    'customers',
    'customerDiscountGroup',
    'customerWarehouse'
  ]),
  method: z.string(),
  errorMessage: z.string(),
  errorStack: z.string().optional(),
  internalPartNumber: z.string().optional(),
  orderNumber: z.string().optional(),
  articleDiscountGroupCode: z.string().optional(),
  discountSubGroupCode: z.string().optional(),
  customerId: z.string().optional(),
  additionalInfo: z.record(z.any()).optional()
});

/**
 * @swagger
 * /error-notifications/send:
 *   post:
 *     summary: Send an error notification email
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - context
 *               - method
 *               - errorMessage
 *             properties:
 *               context:
 *                 type: string
 *                 enum: [articles, warehouse, orders, discountGroup, discountSubGroup, customers, customerDiscountGroup, customerWarehouse]
 *                 description: The context where the error occurred
 *               method:
 *                 type: string
 *                 description: The method name where the error occurred
 *               errorMessage:
 *                 type: string
 *                 description: The error message
 *               errorStack:
 *                 type: string
 *                 description: The error stack trace
 *               internalPartNumber:
 *                 type: string
 *                 description: Internal part number (for articles/warehouse)
 *               orderNumber:
 *                 type: string
 *                 description: Order number (for orders)
 *               articleDiscountGroupCode:
 *                 type: string
 *                 description: Article discount group code (for discountGroup)
 *               discountSubGroupCode:
 *                 type: string
 *                 description: Discount sub-group code (for discountSubGroup)
 *               customerId:
 *                 type: string
 *                 description: Customer ID (for customers)
 *               additionalInfo:
 *                 type: object
 *                 description: Additional context information
 *     responses:
 *       200:
 *         description: Error notification sent successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/send', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validation = errorNotificationSchema.safeParse(req.body);
  
  if (!validation.success) {
    throw new AppError('Invalid request data: ' + validation.error.message, 400);
  }

  const data = validation.data;

  // Create error object from message and stack
  const error = new Error(data.errorMessage);
  if (data.errorStack) {
    error.stack = data.errorStack;
  }

  // Build notification data
  const notificationData: ErrorNotificationData = {
    context: data.context,
    method: data.method,
    error,
    additionalInfo: data.additionalInfo,
    internalPartNumber: data.internalPartNumber,
    orderNumber: data.orderNumber,
    articleDiscountGroupCode: data.articleDiscountGroupCode,
    discountSubGroupCode: data.discountSubGroupCode,
    customerId: data.customerId
  };

  // Send notification
  await ErrorNotificationService.sendErrorNotification(notificationData);

  res.json({
    success: true,
    message: 'Error notification sent successfully'
  });
}));

/**
 * @swagger
 * /error-notifications/formatted:
 *   get:
 *     summary: Get all error logs with formatted identifiers (articles->InternalPartNumber, orders->OrderNumber, etc)
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [articles, warehouse, orders, discountGroup, discountSubGroup, customers]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of error logs with formatted identifiers
 */
router.get('/formatted', asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '50',
    context,
    startDate,
    endDate
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {};

  if (context) {
    where.context = context;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  // Get logs and count
  const [logs, total] = await Promise.all([
    prisma.errorNotificationLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.errorNotificationLog.count({ where })
  ]);

  // Format logs with specific identifiers
  const formattedLogs = logs.map(log => {
    let identifier = 'N/A';
    let identifierLabel = '';

    switch (log.context) {
      case 'articles':
        identifier = log.internalPartNumber || 'N/A';
        identifierLabel = 'InternalPartNumber';
        break;
      case 'warehouse':
        identifier = log.internalPartNumber || 'N/A';
        identifierLabel = 'InternalPartNumber';
        break;
      case 'orders':
        identifier = log.orderNumber || 'N/A';
        identifierLabel = 'Numero da Encomenda';
        break;
      case 'discountGroup':
        identifier = log.articleDiscountGroupCode || 'N/A';
        identifierLabel = 'ArticleDiscountGroupCode';
        break;
      case 'discountSubGroup':
        identifier = log.discountSubGroupCode || 'N/A';
        identifierLabel = 'DiscountSubGroupCode';
        break;
      case 'customers':
      case 'customerDiscountGroup':
      case 'customerWarehouse':
        identifier = log.customerId || 'N/A';
        identifierLabel = 'CustomerID';
        break;
    }

    return {
      id: log.id,
      context: log.context,
      method: log.method,
      errorMessage: log.errorMessage,
      identifier,
      identifierLabel,
      emailSent: log.emailSent,
      createdAt: log.createdAt,
      // Include full details if needed
      details: {
        errorStack: log.errorStack,
        additionalInfo: log.additionalInfo,
        emailSentAt: log.emailSentAt,
        emailRecipients: log.emailRecipients,
        emailError: log.emailError
      }
    };
  });

  res.json({
    success: true,
    data: formattedLogs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    }
  });
}));

/**
 * @swagger
 * /error-notifications:
 *   get:
 *     summary: Get all error notification logs with filters
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [articles, warehouse, orders, discountGroup, discountSubGroup, customers, customerDiscountGroup, customerWarehouse]
 *         description: Filter by error context
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: Filter by method name
 *       - in: query
 *         name: emailSent
 *         schema:
 *           type: boolean
 *         description: Filter by email sent status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date (ISO 8601)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in error message or identifiers
 *     responses:
 *       200:
 *         description: List of error logs
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    page = '1',
    limit = '50',
    context,
    method,
    emailSent,
    startDate,
    endDate,
    search
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {};

  if (context) {
    where.context = context;
  }

  if (method) {
    where.method = { contains: method as string, mode: 'insensitive' };
  }

  if (emailSent !== undefined) {
    where.emailSent = emailSent === 'true';
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  if (search) {
    where.OR = [
      { errorMessage: { contains: search as string, mode: 'insensitive' } },
      { internalPartNumber: { contains: search as string, mode: 'insensitive' } },
      { orderNumber: { contains: search as string, mode: 'insensitive' } },
      { customerId: { contains: search as string, mode: 'insensitive' } },
      { articleDiscountGroupCode: { contains: search as string, mode: 'insensitive' } },
      { discountSubGroupCode: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  // Get logs and count
  const [logs, total] = await Promise.all([
    prisma.errorNotificationLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.errorNotificationLog.count({ where })
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    }
  });
}));

/**
 * @swagger
 * /error-notifications/{id}:
 *   get:
 *     summary: Get a specific error notification log by ID
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Error log ID
 *     responses:
 *       200:
 *         description: Error log details
 *       404:
 *         description: Error log not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const log = await prisma.errorNotificationLog.findUnique({
    where: { id }
  });

  if (!log) {
    throw new AppError('Error log not found', 404);
  }

  res.json({
    success: true,
    data: log
  });
}));

/**
 * @swagger
 * /error-notifications/stats/summary:
 *   get:
 *     summary: Get error notification statistics
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to include in stats
 *     responses:
 *       200:
 *         description: Error statistics
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/stats/summary', asyncHandler(async (req: Request, res: Response) => {
  const { days = '7' } = req.query;
  const daysNum = parseInt(days as string);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  // Get statistics
  const [
    total,
    totalEmailSent,
    totalEmailFailed,
    byContext,
    byMethod,
    recent
  ] = await Promise.all([
    prisma.errorNotificationLog.count({
      where: { createdAt: { gte: startDate } }
    }),
    prisma.errorNotificationLog.count({
      where: {
        createdAt: { gte: startDate },
        emailSent: true
      }
    }),
    prisma.errorNotificationLog.count({
      where: {
        createdAt: { gte: startDate },
        emailSent: false
      }
    }),
    prisma.errorNotificationLog.groupBy({
      by: ['context'],
      where: { createdAt: { gte: startDate } },
      _count: true
    }),
    prisma.errorNotificationLog.groupBy({
      by: ['method'],
      where: { createdAt: { gte: startDate } },
      _count: true,
      orderBy: { _count: { method: 'desc' } },
      take: 10
    }),
    prisma.errorNotificationLog.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        context: true,
        method: true,
        errorMessage: true,
        createdAt: true,
        emailSent: true
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      period: {
        days: daysNum,
        startDate,
        endDate: new Date()
      },
      totals: {
        total,
        emailSent: totalEmailSent,
        emailFailed: totalEmailFailed,
        emailSuccessRate: total > 0 ? ((totalEmailSent / total) * 100).toFixed(2) : '0.00'
      },
      byContext: byContext.map(item => ({
        context: item.context,
        count: item._count
      })),
      topMethods: byMethod.map(item => ({
        method: item.method,
        count: item._count
      })),
      recentErrors: recent
    }
  });
}));

/**
 * @swagger
 * /error-notifications/{id}:
 *   delete:
 *     summary: Delete an error notification log
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Error log ID
 *     responses:
 *       200:
 *         description: Error log deleted successfully
 *       404:
 *         description: Error log not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const log = await prisma.errorNotificationLog.findUnique({
    where: { id }
  });

  if (!log) {
    throw new AppError('Error log not found', 404);
  }

  await prisma.errorNotificationLog.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Error log deleted successfully'
  });
}));

/**
 * @swagger
 * /error-notifications/bulk/delete:
 *   delete:
 *     summary: Delete multiple error logs (bulk delete)
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of error log IDs to delete
 *               olderThan:
 *                 type: string
 *                 format: date-time
 *                 description: Delete all logs older than this date
 *     responses:
 *       200:
 *         description: Error logs deleted successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/bulk/delete', asyncHandler(async (req: Request, res: Response) => {
  const { ids, olderThan } = req.body;

  let deletedCount = 0;

  if (ids && Array.isArray(ids) && ids.length > 0) {
    const result = await prisma.errorNotificationLog.deleteMany({
      where: { id: { in: ids } }
    });
    deletedCount = result.count;
  } else if (olderThan) {
    const result = await prisma.errorNotificationLog.deleteMany({
      where: { createdAt: { lt: new Date(olderThan) } }
    });
    deletedCount = result.count;
  } else {
    throw new AppError('Either ids array or olderThan date is required', 400);
  }

  res.json({
    success: true,
    message: `Deleted ${deletedCount} error log(s)`,
    deletedCount
  });
}));

/**
 * @swagger
 * /error-notifications/test:
 *   post:
 *     summary: Send a test error notification email
 *     tags: [Error Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  await ErrorNotificationService.sendTestNotification();

  res.json({
    success: true,
    message: 'Test error notification sent successfully'
  });
}));

export default router;
