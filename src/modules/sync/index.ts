import { Router } from 'express';
import syncRoutes from './sync.routes';
import sqlDataRoutes from './sql-data.routes';

const router = Router();

// Mount sync routes
router.use('/', syncRoutes);
router.use('/sql', sqlDataRoutes);

export default router;
