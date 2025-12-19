import { Router } from 'express';
import { ClientProviderController } from './client-provider.controller';
import { authenticate } from '@middlewares/auth';

const router = Router();
const controller = new ClientProviderController();

/**
 * @swagger
 * /client-provider-connections:
 *   post:
 *     summary: Connect client to provider
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientOrgId
 *               - providerOrgId
 *             properties:
 *               clientOrgId:
 *                 type: string
 *               providerOrgId:
 *                 type: string
 *               merchantId:
 *                 type: string
 *               storeId:
 *                 type: string
 *               sellerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Connection created
 */
router.post('/', authenticate, controller.connect);

/**
 * @swagger
 * /client-provider-connections:
 *   get:
 *     summary: Get all connections with filters
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clientOrgId
 *         schema:
 *           type: string
 *       - in: query
 *         name: providerOrgId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Connections list
 */
router.get('/', authenticate, controller.getAll);

/**
 * @swagger
 * /client-provider-connections/client/{clientOrgId}:
 *   get:
 *     summary: Get all connections for a client (cross-provider view)
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientOrgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client connections
 */
router.get('/client/:clientOrgId', authenticate, controller.getClientConnections);

/**
 * @swagger
 * /client-provider-connections/{id}:
 *   get:
 *     summary: Get connection by ID
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection details
 */
router.get('/:id', authenticate, controller.getById);

/**
 * @swagger
 * /client-provider-connections/{id}:
 *   put:
 *     summary: Update connection
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Connection updated
 */
router.put('/:id', authenticate, controller.update);

/**
 * @swagger
 * /client-provider-connections/{id}/sync-status:
 *   put:
 *     summary: Update sync status
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - lastSyncStatus
 *             properties:
 *               lastSyncStatus:
 *                 type: string
 *                 enum: [SUCCESS, FAILED, PARTIAL]
 *               lastSyncError:
 *                 type: string
 *               totalOrders:
 *                 type: number
 *               totalProducts:
 *                 type: number
 *               totalRevenue:
 *                 type: number
 *     responses:
 *       200:
 *         description: Sync status updated
 */
router.put('/:id/sync-status', authenticate, controller.updateSyncStatus);

/**
 * @swagger
 * /client-provider-connections/{id}/disconnect:
 *   post:
 *     summary: Disconnect (deactivate connection)
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection deactivated
 */
router.post('/:id/disconnect', authenticate, controller.disconnect);

/**
 * @swagger
 * /client-provider-connections/{id}:
 *   delete:
 *     summary: Permanently delete connection
 *     tags: [ClientProviderConnection]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection deleted
 */
router.delete('/:id', authenticate, controller.delete);

export default router;
