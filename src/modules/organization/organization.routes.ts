import { Router } from 'express';
import { OrganizationController } from './organization.controller';
import { authenticate } from '@middlewares/auth';

const router = Router();
const controller = new OrganizationController();

/**
 * @swagger
 * tags:
 *   name: Organizations
 *   description: Organization management endpoints
 */

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Create new organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Samiparts"
 *               slug:
 *                 type: string
 *                 example: "samiparts"
 *               description:
 *                 type: string
 *                 example: "Auto parts distribution company"
 *               type:
 *                 type: string
 *                 enum: [MARKETPLACE, PROVIDER, PARTNER, CLIENT]
 *                 example: "CLIENT"
 *               website:
 *                 type: string
 *                 example: "https://samiparts.com"
 *               email:
 *                 type: string
 *                 example: "info@samiparts.com"
 *               phone:
 *                 type: string
 *                 example: "+351 244 123 456"
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  controller.createOrganization
);

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: Get all organizations with filters
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MARKETPLACE, PROVIDER, PARTNER, CLIENT]
 *         description: Filter by organization type
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, slug, or description
 *       - in: query
 *         name: myOrgs
 *         schema:
 *           type: boolean
 *         description: Filter by user's organizations only
 *     responses:
 *       200:
 *         description: List of organizations
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  controller.getAllOrganizations
);

/**
 * @swagger
 * /organizations/slug/{slug}:
 *   get:
 *     summary: Get organization by slug
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization slug
 *         example: "samiparts"
 *     responses:
 *       200:
 *         description: Organization found
 *       404:
 *         description: Organization not found
 */
router.get(
  '/slug/:slug',
  controller.getOrganizationBySlug
);

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *         example: "5b28d9b0-a01f-4a7f-aee8-168adc646dd4"
 *     responses:
 *       200:
 *         description: Organization details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 */
router.get(
  '/:id',
  authenticate,
  controller.getOrganizationById
);

/**
 * @swagger
 * /organizations/{id}:
 *   put:
 *     summary: Update organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               website:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER or ADMIN role required
 *       404:
 *         description: Organization not found
 */
router.put(
  '/:id',
  authenticate,
  controller.updateOrganization
);

/**
 * @swagger
 * /organizations/{id}:
 *   delete:
 *     summary: Delete organization (soft delete)
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Organization deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER role required
 *       404:
 *         description: Organization not found
 */
router.delete(
  '/:id',
  authenticate,
  controller.deleteOrganization
);

/**
 * @swagger
 * /organizations/{id}/members/invite:
 *   post:
 *     summary: Invite member to organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               role:
 *                 type: string
 *                 enum: [OWNER, ADMIN, MEMBER, VIEWER]
 *                 example: "MEMBER"
 *     responses:
 *       200:
 *         description: Invitation sent successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER or ADMIN role required
 *       404:
 *         description: Organization not found
 */
router.post(
  '/:id/members/invite',
  authenticate,
  controller.inviteMember
);

/**
 * @swagger
 * /organizations/invites/{token}/accept:
 *   post:
 *     summary: Accept organization invite
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invitation accepted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Invalid or expired invitation token
 */
router.post(
  '/invites/:token/accept',
  authenticate,
  controller.acceptInvite
);

/**
 * @swagger
 * /organizations/{id}/members/{memberId}/role:
 *   put:
 *     summary: Update member role
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [OWNER, ADMIN, MEMBER, VIEWER]
 *                 example: "ADMIN"
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER role required
 *       404:
 *         description: Organization or member not found
 */
router.put(
  '/:id/members/:memberId/role',
  authenticate,
  controller.updateMemberRole
);

/**
 * @swagger
 * /organizations/{id}/members/{memberId}/status:
 *   patch:
 *     summary: Activate or deactivate member
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Member status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER or ADMIN role required
 *       404:
 *         description: Organization or member not found
 */
router.patch(
  '/:id/members/:memberId/status',
  authenticate,
  controller.updateMemberStatus
);

/**
 * @swagger
 * /organizations/{id}/members/{memberId}:
 *   delete:
 *     summary: Remove member from organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: Member ID
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER or ADMIN role required
 *       404:
 *         description: Organization or member not found
 */
router.delete(
  '/:id/members/:memberId',
  authenticate,
  controller.removeMember
);

/**
 * @swagger
 * /organizations/{id}/leave:
 *   post:
 *     summary: Leave organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     responses:
 *       200:
 *         description: Successfully left organization
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - OWNER cannot leave (must transfer ownership first)
 *       404:
 *         description: Organization not found
 */
router.post(
  '/:id/leave',
  authenticate,
  controller.leaveOrganization
);

export default router;
