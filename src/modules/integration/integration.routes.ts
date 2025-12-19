import { Router } from 'express';
import { body, query } from 'express-validator';
import { IntegrationController } from './integration.controller';
import { validate } from '@middlewares/validator';
import { authenticate, authorize } from '@middlewares/auth';

const router = Router();
const integrationController = new IntegrationController();

// All integration routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /integrations:
 *   get:
 *     summary: Get all integrations
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of integrations
 */
router.get(
  '/',
  validate([
    query('type').optional().trim(),
    query('isActive').optional().isBoolean(),
  ]),
  integrationController.getAll
);

/**
 * @swagger
 * /integrations/{id}:
 *   get:
 *     summary: Get integration by ID
 *     tags: [Integrations]
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
 *         description: Integration data
 */
router.get('/:id', integrationController.getById);

/**
 * @swagger
 * /integrations:
 *   post:
 *     summary: Create a new integration
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - config
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               config:
 *                 type: object
 *               apiKey:
 *                 type: string
 *     responses:
 *       201:
 *         description: Integration created
 */
router.post(
  '/',
  authorize('ADMIN', 'DEV'),
  validate([
    body('name').trim().notEmpty(),
    body('type').trim().notEmpty(),
    body('config').isObject(),
    body('apiKey').optional().trim(),
  ]),
  integrationController.create
);

/**
 * @swagger
 * /integrations/{id}:
 *   put:
 *     summary: Update integration
 *     tags: [Integrations]
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
 *         description: Integration updated
 */
router.put(
  '/:id',
  authorize('ADMIN', 'DEV'),
  validate([
    body('name').optional().trim().notEmpty(),
    body('type').optional().trim().notEmpty(),
    body('config').optional().isObject(),
    body('isActive').optional().isBoolean(),
  ]),
  integrationController.update
);

/**
 * @swagger
 * /integrations/{id}/sync:
 *   post:
 *     summary: Trigger integration sync
 *     tags: [Integrations]
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
 *         description: Sync triggered successfully
 */
router.post('/:id/sync', authorize('ADMIN', 'DEV'), integrationController.syncIntegration);

/**
 * @swagger
 * /integrations/{id}:
 *   delete:
 *     summary: Delete integration
 *     tags: [Integrations]
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
 *         description: Integration deleted
 */
router.delete('/:id', authorize('ADMIN'), integrationController.delete);

export default router;
