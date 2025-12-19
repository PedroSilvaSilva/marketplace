import { Request, Response } from 'express';
import { ProviderConfigService } from './provider-config.service';
import { asyncHandler } from '@utils/response';
import { createProviderConfigSchema, updateProviderConfigSchema, testConnectionSchema } from './provider-config.validation';

export class ProviderConfigController {
  private service: ProviderConfigService;

  constructor() {
    this.service = new ProviderConfigService();
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = createProviderConfigSchema.parse(req.body);
    const result = await this.service.create(data, req.user?.id!);
    res.status(201).json({ success: true, data: result });
  });

  getByOrganizationId = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const decrypt = req.query.decrypt === 'true';
    const result = await this.service.getByOrganizationId(organizationId, req.user?.id!, decrypt);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const data = updateProviderConfigSchema.parse(req.body);
    const result = await this.service.update(organizationId, data, req.user?.id!);
    res.json({ success: true, data: result });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const result = await this.service.delete(organizationId, req.user?.id!);
    res.json({ success: true, data: result });
  });

  testConnection = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const result = await this.service.testConnection(organizationId, req.user?.id!);
    res.json({ success: true, data: result });
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const result = await this.service.refreshOAuthToken(organizationId, req.user?.id!);
    res.json({ success: true, data: result });
  });
}
