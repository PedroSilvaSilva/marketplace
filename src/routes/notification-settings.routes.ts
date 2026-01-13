import { Router } from 'express';
import { NotificationSettingsController } from '@controllers/notification-settings.controller';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/notification-settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notification Settings]
 *     parameters:
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *         description: Organization ID (omit for global settings)
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 */
router.get('/', authenticate, NotificationSettingsController.getSettings);

/**
 * @swagger
 * /api/v1/notification-settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notification Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationId:
 *                 type: string
 *                 nullable: true
 *                 description: Organization ID (null for global settings)
 *               notifyOnSuccess:
 *                 type: boolean
 *                 description: Send notification on successful sync
 *               notifyOnError:
 *                 type: boolean
 *                 description: Send notification on failed sync
 *               notifyOnPartial:
 *                 type: boolean
 *                 description: Send notification on partial sync
 *               emailRecipients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Email recipients
 *               syncTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Sync types to notify (empty = all)
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put('/', authenticate, NotificationSettingsController.updateSettings);

/**
 * @swagger
 * /api/v1/notification-settings/{organizationId}:
 *   delete:
 *     summary: Delete organization notification settings (revert to global)
 *     tags: [Notification Settings]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Settings deleted successfully
 */
router.delete('/:organizationId', authenticate, NotificationSettingsController.deleteSettings);

export default router;
