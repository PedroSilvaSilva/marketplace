import prisma from '@config/database';
import { AppError } from '@utils/errors';
import { config } from '@config/index';

export interface NotificationSettingsData {
  notifyOnSuccess?: boolean;
  notifyOnError?: boolean;
  notifyOnPartial?: boolean;
  emailRecipients?: string[];
  syncTypes?: string[];
}

export class NotificationSettingsService {
  /**
   * Get notification settings for organization (or global if not specified)
   */
  static async getSettings(organizationId?: string) {
    // Try to get organization-specific settings
    if (organizationId) {
      const orgSettings = await prisma.notificationSettings.findUnique({
        where: { organizationId }
      });
      
      if (orgSettings) {
        return orgSettings;
      }
    }
    
    // Fall back to global settings
    const globalSettings = await prisma.notificationSettings.findFirst({
      where: { organizationId: null }
    });
    
    if (globalSettings) {
      return globalSettings;
    }
    
    // Return default settings if none exist
    return {
      id: 'default',
      organizationId: null,
      notifyOnSuccess: false,
      notifyOnError: true,
      notifyOnPartial: true,
      emailRecipients: config.email.orderNotificationEmails,
      syncTypes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Update or create notification settings for organization
   */
  static async upsertSettings(
    organizationId: string | null,
    data: NotificationSettingsData
  ) {
    // Validate organization exists if specified
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      
      if (!org) {
        throw new AppError('Organization not found', 404);
      }
    }
    
    // Validate email recipients
    if (data.emailRecipients) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = data.emailRecipients.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        throw new AppError(`Invalid email addresses: ${invalidEmails.join(', ')}`, 400);
      }
    }
    
    // Upsert settings
    return prisma.notificationSettings.upsert({
      where: {
        organizationId: organizationId || undefined
      },
      create: {
        organizationId,
        notifyOnSuccess: data.notifyOnSuccess ?? false,
        notifyOnError: data.notifyOnError ?? true,
        notifyOnPartial: data.notifyOnPartial ?? true,
        emailRecipients: data.emailRecipients ?? [],
        syncTypes: data.syncTypes ?? []
      },
      update: {
        notifyOnSuccess: data.notifyOnSuccess,
        notifyOnError: data.notifyOnError,
        notifyOnPartial: data.notifyOnPartial,
        emailRecipients: data.emailRecipients,
        syncTypes: data.syncTypes,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Check if should send notification based on settings
   */
  static async shouldNotify(
    organizationId: string,
    syncType: string,
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  ): Promise<{
    shouldSend: boolean;
    recipients: string[];
  }> {
    const settings = await this.getSettings(organizationId);
    
    // Check status notification preference
    let shouldSend = false;
    if (status === 'SUCCESS' && settings.notifyOnSuccess) {
      shouldSend = true;
    } else if (status === 'FAILED' && settings.notifyOnError) {
      shouldSend = true;
    } else if (status === 'PARTIAL' && settings.notifyOnPartial) {
      shouldSend = true;
    }
    
    // Check sync type filter (empty = all types)
    if (shouldSend && settings.syncTypes.length > 0) {
      shouldSend = settings.syncTypes.includes(syncType);
    }
    
    // Get recipients
    const recipients = settings.emailRecipients.length > 0
      ? settings.emailRecipients
      : config.email.orderNotificationEmails;
    
    return {
      shouldSend,
      recipients
    };
  }

  /**
   * Delete notification settings (revert to global)
   */
  static async deleteSettings(organizationId: string) {
    const settings = await prisma.notificationSettings.findUnique({
      where: { organizationId }
    });
    
    if (!settings) {
      throw new AppError('Settings not found', 404);
    }
    
    return prisma.notificationSettings.delete({
      where: { organizationId }
    });
  }
}
