import { Router, Request, Response } from 'express';
import { SQLService } from '../../services/sql.service';
import { AppError } from '@utils/errors';
import { asyncHandler } from '@utils/response';

const router = Router();

/**
 * @route   GET /api/v1/sync/sql/articles/:organizationId
 * @desc    Get articles from SQL Server view
 * @access  Private
 */
router.get('/articles/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { limit } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const articles = await SQLService.getArticles(
    organizationId,
    limit ? parseInt(limit as string) : undefined
  );

  res.json({
    success: true,
    data: articles,
    count: articles.length
  });
}));

/**
 * @route   GET /api/v1/sync/sql/warehouse/:organizationId
 * @desc    Get article warehouse (stock) from SQL Server view
 * @access  Private
 */
router.get('/warehouse/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { brandId, partNumber, limit } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const warehouse = await SQLService.getArticleWarehouse(
    organizationId,
    brandId as string,
    partNumber as string,
    limit ? parseInt(limit as string) : undefined
  );

  res.json({
    success: true,
    data: warehouse,
    count: warehouse.length
  });
}));

/**
 * @route   GET /api/v1/sync/sql/customers/:organizationId
 * @desc    Get customers from SQL Server view
 * @access  Private
 */
router.get('/customers/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { customerId } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const customers = await SQLService.getCustomers(
    organizationId,
    customerId as string
  );

  res.json({
    success: true,
    data: customers,
    count: customers.length
  });
}));

/**
 * @route   GET /api/v1/sync/sql/customers-warehouses/:organizationId
 * @desc    Get customers warehouses from SQL Server view
 * @access  Private
 */
router.get('/customers-warehouses/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { customerId } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const customersWarehouses = await SQLService.getCustomerWarehouses(
    organizationId,
    customerId as string
  );

  res.json({
    success: true,
    data: customersWarehouses,
    count: customersWarehouses.length
  });
}));

/**
 * @route   GET /api/v1/sync/sql/discount-groups/:organizationId
 * @desc    Get article discount groups from SQL Server view with pagination
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @query   search - Search term for code or name
 */
router.get('/discount-groups/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { page, limit, search } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const result = await SQLService.getArticleDiscountGroups(
    organizationId,
    {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string
    }
  );

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}));

/**
 * @route   GET /api/v1/sync/sql/discount-subgroups/:organizationId
 * @desc    Get article discount sub-groups from SQL Server view with pagination
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @query   search - Search term for code or name
 * @query   groupCode - Filter by parent group code
 */
router.get('/discount-subgroups/:organizationId', asyncHandler(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { page, limit, search, groupCode } = req.query;

  if (!organizationId) {
    throw new AppError('Organization ID is required', 400);
  }

  const result = await SQLService.getArticleDiscountSubGroups(
    organizationId,
    {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      groupCode: groupCode as string
    }
  );

  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination
  });
}));

export default router;
