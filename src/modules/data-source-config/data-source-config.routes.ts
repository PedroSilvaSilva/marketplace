import { Router } from 'express';
import { DataSourceConfigController } from './data-source-config.controller';
import { authenticate } from '@middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/data-source-configs
 * @desc    Create new data source config
 * @access  Private (OWNER/ADMIN only)
 */
router.post('/', DataSourceConfigController.create);

/**
 * @route   GET /api/v1/data-source-configs/organization/:organizationId
 * @desc    Get data source config by organization ID
 * @access  Private (Organization members)
 * @query   decrypt=true (OWNER/ADMIN only)
 */
router.get('/organization/:organizationId', DataSourceConfigController.getByOrganizationId);

/**
 * @route   PUT /api/v1/data-source-configs/organization/:organizationId
 * @desc    Update data source config
 * @access  Private (OWNER/ADMIN only)
 */
router.put('/organization/:organizationId', DataSourceConfigController.update);

/**
 * @route   DELETE /api/v1/data-source-configs/organization/:organizationId
 * @desc    Delete data source config
 * @access  Private (OWNER only)
 */
router.delete('/organization/:organizationId', DataSourceConfigController.delete);

/**
 * @route   POST /api/v1/data-source-configs/organization/:organizationId/test
 * @desc    Test connection to data source
 * @access  Private (Organization members)
 */
router.post('/organization/:organizationId/test', DataSourceConfigController.testConnection);

export default router;
