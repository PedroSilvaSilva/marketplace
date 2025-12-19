import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from './integration.service';
import { asyncHandler, successResponse } from '@utils/response';

export class IntegrationController {
  private integrationService: IntegrationService;

  constructor() {
    this.integrationService = new IntegrationService();
  }

  getAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const type = req.query.type as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const integrations = await this.integrationService.getAll({ type, isActive });

    return successResponse(res, integrations);
  });

  getById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    const integration = await this.integrationService.getById(id);

    return successResponse(res, integration);
  });

  create = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const integration = await this.integrationService.create(req.body, req.user?.id);

    return successResponse(res, integration, 201);
  });

  update = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    const integration = await this.integrationService.update(id, req.body, req.user?.id);

    return successResponse(res, integration);
  });

  delete = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    await this.integrationService.delete(id, req.user?.id);

    return successResponse(res, { message: 'Integration deleted successfully' });
  });

  syncIntegration = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    const result = await this.integrationService.syncIntegration(id, req.user?.id);

    return successResponse(res, result);
  });
}
