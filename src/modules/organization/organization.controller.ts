import { Request, Response } from 'express';
import { OrganizationService } from './organization.service';
import { createOrganizationSchema, updateOrganizationSchema, inviteMemberSchema, updateMemberRoleSchema } from './organization.validation';
import { asyncHandler } from '@utils/response';

export class OrganizationController {
  private service: OrganizationService;
  
  constructor() { 
    this.service = new OrganizationService(); 
  }
  
  createOrganization = asyncHandler(async (req: Request, res: Response) => {
    const validated = createOrganizationSchema.parse(req.body);
    const userId = req.user?.id!;
    const organization = await this.service.create(validated, userId);
    res.status(201).json({ success: true, data: organization, meta: { timestamp: new Date().toISOString() } });
  });

  getAllOrganizations = asyncHandler(async (req: Request, res: Response) => {
    const { type, isActive, search, myOrgs } = req.query;
    const filters: Record<string, unknown> = {};
    if (type) filters.type = type as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (search) filters.search = search as string;
    if (myOrgs === 'true') filters.userId = req.user?.id!;
    const organizations = await this.service.getAll(filters);
    res.json({ success: true, data: organizations, meta: { timestamp: new Date().toISOString(), count: organizations.length } });
  });

  getOrganizationById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id!;
    const organization = await this.service.getById(id, userId);
    res.json({ success: true, data: organization, meta: { timestamp: new Date().toISOString() } });
  });

  getOrganizationBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;
    const organization = await this.service.getBySlug(slug);
    res.json({ success: true, data: organization, meta: { timestamp: new Date().toISOString() } });
  });

  updateOrganization = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validated = updateOrganizationSchema.parse(req.body);
    const userId = req.user?.id!;
    const organization = await this.service.update(id, validated, userId);
    res.json({ success: true, data: organization, meta: { timestamp: new Date().toISOString(), message: 'Organization updated successfully' } });
  });

  deleteOrganization = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id!;
    const result = await this.service.delete(id, userId);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } });
  });

  inviteMember = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validated = inviteMemberSchema.parse(req.body);
    const userId = req.user?.id!;
    const result = await this.service.inviteMember(id, validated, userId);
    res.status(201).json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), message: 'Member invited successfully' } });
  });

  acceptInvite = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const userId = req.user?.id!;
    const member = await this.service.acceptInvite(token, userId);
    res.json({ success: true, data: member, meta: { timestamp: new Date().toISOString(), message: 'Invite accepted successfully' } });
  });

  updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
    const { id, memberId } = req.params;
    const { role } = updateMemberRoleSchema.parse(req.body);
    const userId = req.user?.id!;
    const member = await this.service.updateMemberRole(id, memberId, role, userId);
    res.json({ success: true, data: member, meta: { timestamp: new Date().toISOString(), message: 'Member role updated successfully' } });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const { id, memberId } = req.params;
    const userId = req.user?.id!;
    const result = await this.service.removeMember(id, memberId, userId);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } });
  });

  leaveOrganization = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id!;
    const result = await this.service.leaveOrganization(id, userId);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString() } });
  });
}
