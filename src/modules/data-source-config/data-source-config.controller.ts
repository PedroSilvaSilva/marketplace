import { Request, Response } from 'express';
import { DataSourceConfigService } from './data-source-config.service';
import { 
  createDataSourceConfigSchema, 
  updateDataSourceConfigSchema
} from './data-source-config.validation';
import { asyncHandler } from '@utils/response';
import { AppError } from '@utils/errors';

export class DataSourceConfigController {
  
  /**
   * Create new data source config
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = createDataSourceConfigSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const config = await DataSourceConfigService.create(validatedData, userId);

    res.status(201).json({
      success: true,
      data: config
    });
  });

  /**
   * Get config by organization ID
   */
  static getByOrganizationId = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    const decrypt = req.query.decrypt === 'true';

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const config = await DataSourceConfigService.getByOrganizationId(
      organizationId, 
      userId, 
      decrypt
    );

    res.json({
      success: true,
      data: config
    });
  });

  /**
   * Update data source config
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const validatedData = updateDataSourceConfigSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const config = await DataSourceConfigService.update(
      organizationId,
      validatedData,
      userId
    );

    res.json({
      success: true,
      data: config
    });
  });

  /**
   * Delete data source config
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const result = await DataSourceConfigService.delete(organizationId, userId);

    res.json({
      success: true,
      ...result
    });
  });

  /**
   * Test connection
   */
  static testConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const result = await DataSourceConfigService.testConnection(organizationId, userId);

    res.json({
      success: true,
      ...result
    });
  });
}
