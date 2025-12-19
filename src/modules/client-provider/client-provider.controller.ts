import { Request, Response } from 'express';
import { ClientProviderService } from './client-provider.service';
import { asyncHandler } from '@utils/response';
import { createConnectionSchema, updateConnectionSchema, updateSyncStatusSchema, connectionFiltersSchema } from './client-provider.validation';

export class ClientProviderController {
  private service: ClientProviderService;

  constructor() {
    this.service = new ClientProviderService();
  }

  connect = asyncHandler(async (req: Request, res: Response) => {
    const data = createConnectionSchema.parse(req.body);
    const result = await this.service.connect(data, req.user?.id!);
    res.status(201).json({ success: true, data: result, message: 'Connection created successfully' });
  });

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const filters = connectionFiltersSchema.parse(req.query);
    const result = await this.service.getAll(filters, req.user?.id!);
    res.json({ success: true, ...result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.service.getById(id, req.user?.id!);
    res.json({ success: true, data: result });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateConnectionSchema.parse(req.body);
    const result = await this.service.update(id, data, req.user?.id!);
    res.json({ success: true, data: result, message: 'Connection updated successfully' });
  });

  updateSyncStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = updateSyncStatusSchema.parse(req.body);
    const result = await this.service.updateSyncStatus(id, data, req.user?.id!);
    res.json({ success: true, data: result, message: 'Sync status updated' });
  });

  disconnect = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.service.disconnect(id, req.user?.id!);
    res.json(result);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await this.service.delete(id, req.user?.id!);
    res.json(result);
  });

  getClientConnections = asyncHandler(async (req: Request, res: Response) => {
    const { clientOrgId } = req.params;
    const result = await this.service.getClientConnections(clientOrgId, req.user?.id!);
    res.json({ success: true, data: result, meta: { total: result.length } });
  });
}
