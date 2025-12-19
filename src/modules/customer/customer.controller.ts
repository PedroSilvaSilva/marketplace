import { Request, Response, NextFunction } from 'express';
import { CustomerService } from './customer.service';
import { asyncHandler, successResponse, paginatedResponse } from '@utils/response';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  getAll = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { customers, total } = await this.customerService.getAll(page, limit);

    return paginatedResponse(res, customers, page, limit, total);
  });

  getById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    const customer = await this.customerService.getById(id);

    return successResponse(res, customer);
  });

  create = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const customer = await this.customerService.create(req.body, req.user?.id);

    return successResponse(res, customer, 201);
  });

  update = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    const customer = await this.customerService.update(id, req.body, req.user?.id);

    return successResponse(res, customer);
  });

  delete = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const { id } = req.params;

    await this.customerService.delete(id, req.user?.id);

    return successResponse(res, { message: 'Customer deleted successfully' });
  });
}
