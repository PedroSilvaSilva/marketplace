import { Request, Response } from 'express';
import { NotificationSettingsService } from '@services/notification-settings.service';
import logger from '@config/logger';

export class NotificationSettingsController {
  /**
   * GET /api/v1/notification-settings
   * Get notification settings (global or for current organization)
   */
  static async getSettings(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      
      const settings = await NotificationSettingsService.getSettings(organizationId);
      
      return res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Failed to get notification settings:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get notification settings'
      });
    }
  }

  /**
   * PUT /api/v1/notification-settings
   * Update notification settings
   */
  static async updateSettings(req: Request, res: Response) {
    try {
      const organizationId = req.body.organizationId as string | null;
      const {
        notifyOnSuccess,
        notifyOnError,
        notifyOnPartial,
        emailRecipients,
        syncTypes
      } = req.body;
      
      const settings = await NotificationSettingsService.upsertSettings(organizationId, {
        notifyOnSuccess,
        notifyOnError,
        notifyOnPartial,
        emailRecipients,
        syncTypes
      });
      
      logger.info('Notification settings updated', {
        organizationId,
        settingsId: settings.id
      });
      
      return res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      logger.error('Failed to update notification settings:', error);
      
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 400;
      
      return res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notification settings'
      });
    }
  }

  /**
   * DELETE /api/v1/notification-settings/:organizationId
   * Delete organization-specific settings (revert to global)
   */
  static async deleteSettings(req: Request, res: Response) {
    try {
      const { organizationId } = req.params;
      
      await NotificationSettingsService.deleteSettings(organizationId);
      
      logger.info('Notification settings deleted', { organizationId });
      
      return res.json({
        success: true,
        message: 'Settings deleted successfully. Reverted to global settings.'
      });
    } catch (error) {
      logger.error('Failed to delete notification settings:', error);
      
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete notification settings'
      });
    }
  }
}
