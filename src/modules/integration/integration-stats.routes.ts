import { Router } from 'express';
import { authenticate } from '@middlewares/auth';
import { IntegrationStatsController } from './integration-stats.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/overview:
 *   get:
 *     summary: Get overview statistics
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Overview statistics
 */
router.get('/:organizationId/overview', IntegrationStatsController.getOverview);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/realtime:
 *   get:
 *     summary: Get real-time sync status
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Real-time sync status
 */
router.get('/:organizationId/realtime', IntegrationStatsController.getRealtime);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/by-type:
 *   get:
 *     summary: Get statistics by sync type
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistics grouped by sync type
 */
router.get('/:organizationId/by-type', IntegrationStatsController.getByType);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/errors:
 *   get:
 *     summary: Get error statistics
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Error statistics and trends
 */
router.get('/:organizationId/errors', IntegrationStatsController.getErrors);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/performance:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/:organizationId/performance', IntegrationStatsController.getPerformance);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/trends:
 *   get:
 *     summary: Get trends over time
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Trend data over time
 */
router.get('/:organizationId/trends', IntegrationStatsController.getTrends);

/**
 * @swagger
 * /api/v1/integration/stats/{organizationId}/schedule:
 *   get:
 *     summary: Get schedule information
 *     tags: [Integration Stats]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Upcoming scheduled syncs
 */
router.get('/:organizationId/schedule', IntegrationStatsController.getSchedule);

export default router;
