import { Router } from 'express';
import { ProviderConfigController } from './provider-config.controller';
import { authenticate } from '@middlewares/auth';

const router = Router();
const controller = new ProviderConfigController();

/**
 * @swagger
 * /provider-configs:
 *   post:
 *     summary: Create provider configuration
 *     tags: [ProviderConfig]
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
 *               - apiUrl
 *             properties:
 *               organizationId:
 *                 type: string
 *               apiUrl:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               apiSecret:
 *                 type: string
 *               authType:
 *                 type: string
 *                 enum: [API_KEY, OAUTH2, BASIC, BEARER, CUSTOM]
 *     responses:
 *       201:
 *         description: Provider config created
 */
router.post('/', authenticate, controller.create);

/**
 * @swagger
 * /provider-configs/organization/{organizationId}:
 *   get:
 *     summary: Get provider config by organization ID
 *     tags: [ProviderConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: decrypt
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Provider config retrieved
 */
router.get('/organization/:organizationId', authenticate, controller.getByOrganizationId);

/**
 * @swagger
 * /provider-configs/organization/{organizationId}:
 *   put:
 *     summary: Update provider configuration
 *     tags: [ProviderConfig]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: organizationId
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
 *         description: Provider config updated
 */
router.put('/organization/:organizationId', authenticate, controller.update);

/**
 * @swagger
 * /provider-configs/organization/{organizationId}:
 *   delete:
 *     summary: Delete provider configuration
 *     tags: [ProviderConfig]
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
 *         description: Provider config deleted
 */
router.delete('/organization/:organizationId', authenticate, controller.delete);

/**
 * @swagger
 * /provider-configs/organization/{organizationId}/test:
 *   post:
 *     summary: Test provider connection
 *     tags: [ProviderConfig]
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
 *         description: Connection test result
 */
router.post('/organization/:organizationId/test', authenticate, controller.testConnection);

/**
 * @swagger
 * /provider-configs/organization/{organizationId}/refresh-token:
 *   post:
 *     summary: Refresh OAuth token
 *     tags: [ProviderConfig]
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
 *         description: Token refreshed
 */
router.post('/organization/:organizationId/refresh-token', authenticate, controller.refreshToken);

export default router;
