import { Request, Response } from 'express';
import { IntegrationStatsService } from './integration-stats.service';
import { asyncHandler } from '@utils/response';
import { AppError } from '@utils/errors';

export class IntegrationStatsController {
  /**
   * Get overview statistics
   * GET /api/v1/integration/stats/:organizationId/overview
   */
  static getOverview = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getOverview(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get real-time sync status
   * GET /api/v1/integration/stats/:organizationId/realtime
   */
  static getRealtime = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getRealtime(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get statistics by sync type
   * GET /api/v1/integration/stats/:organizationId/by-type
   */
  static getByType = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getByType(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get error statistics
   * GET /api/v1/integration/stats/:organizationId/errors
   */
  static getErrors = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getErrors(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get performance metrics
   * GET /api/v1/integration/stats/:organizationId/performance
   */
  static getPerformance = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getPerformance(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get trends over time
   * GET /api/v1/integration/stats/:organizationId/trends?days=30
   */
  static getTrends = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    if (days < 1 || days > 365) {
      throw new AppError('Days must be between 1 and 365', 400);
    }

    const data = await IntegrationStatsService.getTrends(organizationId, days);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        days
      }
    });
  });

  /**
   * Get schedule information
   * GET /api/v1/integration/stats/:organizationId/schedule
   */
  static getSchedule = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;

    if (!organizationId) {
      throw new AppError('Organization ID is required', 400);
    }

    const data = await IntegrationStatsService.getSchedule(organizationId);

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });
}
