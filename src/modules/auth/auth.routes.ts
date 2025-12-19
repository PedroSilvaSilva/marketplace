import { Router } from 'express';
import { body, query } from 'express-validator';
import { AuthController } from './auth.controller';
import { validate } from '@middlewares/validator';
import { authenticate, requireEmailVerification } from '@middlewares/auth';
import { authRateLimiter } from '@middlewares/security';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               userType:
 *                 type: string
 *                 enum: [ADMIN, DEV, USER, PARCERIA, CLIENTE, LICENCAS, TECNICO, AUDITORIA]
 *               profileData:
 *                 type: object
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   phone:
 *                     type: string
 *                   companyName:
 *                     type: string
 *                   companyVat:
 *                     type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post(
  '/register',
  authRateLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain at least one uppercase, one lowercase, one number, and one special character'),
    body('userType').optional().isIn(['ADMIN', 'DEV', 'USER', 'PARCERIA', 'CLIENTE', 'LICENCAS', 'TECNICO', 'AUDITORIA']),
    body('profileData.firstName').optional().trim().notEmpty(),
    body('profileData.lastName').optional().trim().notEmpty(),
    body('profileData.phone').optional().trim(),
    body('profileData.companyName').optional().trim(),
    body('profileData.companyVat').optional().trim(),
  ]),
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user with secure HTTPOnly cookies
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful. Cookies set for authentication.
 */
router.post(
  '/login',
  authRateLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ]),
  authController.login
);

/**
 * @swagger
 * /auth/mfa/verify:
 *   post:
 *     summary: Verify MFA token during login
 *     tags: [Auth, MFA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: MFA verification successful
 */
router.post(
  '/mfa/verify',
  authRateLimiter,
  validate([
    body('userId').notEmpty().isString(),
    body('token').notEmpty().isString(),
  ]),
  authController.verifyMFA
);

/**
 * @swagger
 * /auth/mfa/enable:
 *   post:
 *     summary: Enable MFA for authenticated user
 *     tags: [Auth, MFA]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: MFA setup initiated. Returns QR code and backup codes.
 */
router.post(
  '/mfa/enable',
  authenticate,
  requireEmailVerification,
  authController.enableMFA
);

/**
 * @swagger
 * /auth/mfa/confirm:
 *   post:
 *     summary: Confirm MFA setup with TOTP token
 *     tags: [Auth, MFA]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: MFA enabled successfully
 */
router.post(
  '/mfa/confirm',
  authenticate,
  validate([
    body('token').notEmpty().isString(),
  ]),
  authController.confirmMFA
);

/**
 * @swagger
 * /auth/mfa/disable:
 *   post:
 *     summary: Disable MFA for authenticated user
 *     tags: [Auth, MFA]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: MFA disabled successfully
 */
router.post(
  '/mfa/disable',
  authenticate,
  validate([
    body('password').notEmpty(),
  ]),
  authController.disableMFA
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 */
router.post('/refresh', authController.refreshToken);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and clear cookies
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify email with token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.get(
  '/verify-email',
  validate([
    query('token').notEmpty(),
  ]),
  authController.verifyEmail
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
router.post(
  '/forgot-password',
  authRateLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
  ]),
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post(
  '/reset-password',
  authRateLimiter,
  validate([
    body('token').notEmpty(),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  ]),
  authController.resetPassword
);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get all active sessions for authenticated user
 *     tags: [Auth, Sessions]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions', authenticate, authController.getSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Auth, Sessions]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked successfully
 */
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 */
router.get('/profile', authenticate, authController.getProfile);

export default router;
