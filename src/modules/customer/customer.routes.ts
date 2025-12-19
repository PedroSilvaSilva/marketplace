import { Router } from 'express';
import { body, query } from 'express-validator';
import { CustomerController } from './customer.controller';
import { validate } from '@middlewares/validator';
import { authenticate, authorize } from '@middlewares/auth';

const router = Router();
const customerController = new CustomerController();

// All customer routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get all customers with pagination
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of customers
 */
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ]),
  customerController.getAll
);

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer data
 */
router.get('/:id', customerController.getById);

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - taxId
 *               - email
 *             properties:
 *               companyName:
 *                 type: string
 *               taxId:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 */
router.post(
  '/',
  authorize('ADMIN', 'DEV'),
  validate([
    body('companyName').trim().notEmpty(),
    body('taxId').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('country').optional().trim(),
  ]),
  customerController.create
);

/**
 * @swagger
 * /customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer updated
 */
router.put(
  '/:id',
  authorize('ADMIN', 'DEV'),
  validate([
    body('companyName').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('country').optional().trim(),
  ]),
  customerController.update
);

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     summary: Delete customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer deleted
 */
router.delete('/:id', authorize('ADMIN'), customerController.delete);

export default router;
