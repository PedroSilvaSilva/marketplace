import { Router } from 'express';
import syncRoutes from './sync.routes';
import sqlDataRoutes from './sql-data.routes';
import syncConfigRoutes from './sync-config.routes';

const router = Router();

// Mount sync routes
router.use('/', syncRoutes);
router.use('/sql', sqlDataRoutes);
router.use('/config', syncConfigRoutes);

export default router;
