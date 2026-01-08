import prisma from '@config/database';
import { ConflictError, NotFoundError, ForbiddenError } from '@utils/errors';
import logger from '@config/logger';
import type { CreateOrganizationData, UpdateOrganizationData, InviteMemberData } from './organization.validation';
import { CryptoService } from '@utils/crypto';

export class OrganizationService {
  /**
   * Create new organization
   */
  async create(data: CreateOrganizationData, userId: string) {
    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: data.slug },
    });

    if (existingOrg) {
      throw new ConflictError('Organization slug already exists');
    }

    // Create organization with creator as owner
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        type: data.type,
        website: data.website,
        email: data.email,
        phone: data.phone,
        logoUrl: data.logoUrl,
        settings: data.settings || {},
        metadata: data.metadata || {},
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                userType: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'Organization',
        entityId: organization.id,
        description: `Organization created: ${organization.name}`,
        metadata: { slug: organization.slug, type: organization.type } as any,
      },
    });

    logger.info(`Organization created: ${organization.id} - ${organization.name} by user ${userId}`);

    return organization;
  }

  /**
   * Get all organizations (with filtering)
   */
  async getAll(filters?: {
    type?: string;
    isActive?: boolean;
    search?: string;
    userId?: string;
  }) {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // If userId provided, filter by user's organizations
    if (filters?.userId) {
      where.members = {
        some: {
          userId: filters.userId,
          isActive: true,
        },
      };
    }

    const organizations = await prisma.organization.findMany({
      where,
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return organizations;
  }

  /**
   * Get organization by ID
   */
  async getById(id: string, userId?: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                userType: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Check if user has access
    if (userId) {
      const isMember = organization.members.some((m) => m.userId === userId && m.isActive);
      if (!isMember) {
        throw new ForbiddenError('You do not have access to this organization');
      }
    }

    return organization;
  }

  /**
   * Get organization by slug
   */
  async getBySlug(slug: string) {
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(id: string, data: UpdateOrganizationData, userId: string) {
    const organization = await this.getById(id, userId);

    // Check if user has permission (OWNER or ADMIN)
    const member = organization.members.find((m) => m.userId === userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      throw new ForbiddenError('Only owners and admins can update organization');
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        website: data.website,
        email: data.email,
        phone: data.phone,
        logoUrl: data.logoUrl,
        isActive: data.isActive,
        settings: data.settings as any,
        metadata: data.metadata as any,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                userType: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'Organization',
        entityId: id,
        description: `Organization updated: ${updated.name}`,
        changes: data as any,
      },
    });

    logger.info(`Organization updated: ${id} by user ${userId}`);

    return updated;
  }

  /**
   * Delete organization (soft delete)
   */
  async delete(id: string, userId: string) {
    const organization = await this.getById(id, userId);

    // Check if user is owner
    const member = organization.members.find((m) => m.userId === userId);
    if (!member || member.role !== 'OWNER') {
      throw new ForbiddenError('Only owners can delete organization');
    }

    await prisma.organization.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'Organization',
        entityId: id,
        description: `Organization deleted: ${organization.name}`,
      },
    });

    logger.info(`Organization deleted: ${id} by user ${userId}`);

    return { message: 'Organization deleted successfully' };
  }

  /**
   * Invite member to organization
   */
  async inviteMember(organizationId: string, data: InviteMemberData, inviterId: string) {
    const organization = await this.getById(organizationId, inviterId);

    // Check if inviter has permission (OWNER or ADMIN)
    const inviter = organization.members.find((m) => m.userId === inviterId);
    if (!inviter || !['OWNER', 'ADMIN'].includes(inviter.role)) {
      throw new ForbiddenError('Only owners and admins can invite members');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new NotFoundError('User with this email not found');
    }

    // Check if already a member
    const existingMember = organization.members.find((m) => m.userId === user.id);
    if (existingMember) {
      throw new ConflictError('User is already a member of this organization');
    }

    // Generate invite token
    const inviteToken = CryptoService.generateRandomToken(32);
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create member with pending status
    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: data.role,
        isActive: false, // Pending acceptance
        invitedBy: inviterId,
        inviteToken,
        inviteExpires,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // TODO: Send invite email
    // await emailService.sendOrganizationInvite(user.email, organization.name, inviteToken);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: inviterId,
        action: 'CREATE',
        entity: 'OrganizationMember',
        entityId: member.id,
        description: `Member invited to ${organization.name}: ${user.email}`,
        metadata: { role: data.role, organizationId } as any,
      },
    });

    logger.info(`Member invited to organization ${organizationId}: ${user.email}`);

    return { member, inviteToken };
  }

  /**
   * Accept organization invite
   */
  async acceptInvite(token: string, userId: string) {
    const member = await prisma.organizationMember.findFirst({
      where: {
        userId,
        inviteToken: token,
        inviteExpires: { gt: new Date() },
      },
      include: {
        organization: true,
      },
    });

    if (!member) {
      throw new NotFoundError('Invalid or expired invite');
    }

    const updated = await prisma.organizationMember.update({
      where: { id: member.id },
      data: {
        isActive: true,
        inviteToken: null,
        inviteExpires: null,
        joinedAt: new Date(),
      },
      include: {
        organization: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entity: 'OrganizationMember',
        entityId: member.id,
        description: `Invite accepted for ${member.organization.name}`,
      },
    });

    logger.info(`Invite accepted: ${member.id} for organization ${member.organizationId}`);

    return updated;
  }

  /**
   * Update member role
   */
  async updateMemberRole(organizationId: string, memberId: string, role: string, updaterId: string) {
    const organization = await this.getById(organizationId, updaterId);

    // Check if updater has permission (OWNER only)
    const updater = organization.members.find((m) => m.userId === updaterId);
    if (!updater || updater.role !== 'OWNER') {
      throw new ForbiddenError('Only owners can change member roles');
    }

    const member = organization.members.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Cannot change own role
    if (member.userId === updaterId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: role as any },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: updaterId,
        action: 'UPDATE',
        entity: 'OrganizationMember',
        entityId: memberId,
        description: `Member role updated in ${organization.name}`,
        changes: { role } as any,
      },
    });

    logger.info(`Member role updated: ${memberId} to ${role}`);

    return updated;
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, memberId: string, removerId: string) {
    const organization = await this.getById(organizationId, removerId);

    // Check if remover has permission (OWNER or ADMIN)
    const remover = organization.members.find((m) => m.userId === removerId);
    if (!remover || !['OWNER', 'ADMIN'].includes(remover.role)) {
      throw new ForbiddenError('Only owners and admins can remove members');
    }

    const member = organization.members.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Cannot remove yourself
    if (member.userId === removerId) {
      throw new ForbiddenError('Cannot remove yourself');
    }

    // Cannot remove owner
    if (member.role === 'OWNER') {
      throw new ForbiddenError('Cannot remove owner');
    }

    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: removerId,
        action: 'DELETE',
        entity: 'OrganizationMember',
        entityId: memberId,
        description: `Member removed from ${organization.name}`,
      },
    });

    logger.info(`Member removed: ${memberId} from organization ${organizationId}`);

    return { message: 'Member removed successfully' };
  }

  /**
   * Leave organization
   */
  async leaveOrganization(organizationId: string, userId: string) {
    const organization = await this.getById(organizationId, userId);

    const member = organization.members.find((m) => m.userId === userId);
    if (!member) {
      throw new NotFoundError('You are not a member of this organization');
    }

    // Cannot leave if you're the only owner
    if (member.role === 'OWNER') {
      const ownerCount = organization.members.filter((m) => m.role === 'OWNER' && m.isActive).length;
      if (ownerCount === 1) {
        throw new ForbiddenError('Cannot leave: you are the only owner. Transfer ownership first.');
      }
    }

    await prisma.organizationMember.delete({
      where: { id: member.id },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entity: 'OrganizationMember',
        entityId: member.id,
        description: `Left organization: ${organization.name}`,
      },
    });

    logger.info(`User ${userId} left organization ${organizationId}`);

    return { message: 'Left organization successfully' };
  }

  /**
   * Update member status (activate/deactivate)
   */
  async updateMemberStatus(organizationId: string, memberId: string, isActive: boolean, updaterId: string) {
    const organization = await this.getById(organizationId, updaterId);

    // Check if updater has permission (OWNER or ADMIN)
    const updater = organization.members.find((m) => m.userId === updaterId);
    if (!updater || !['OWNER', 'ADMIN'].includes(updater.role)) {
      throw new ForbiddenError('Only owners and admins can change member status');
    }

    const member = organization.members.find((m) => m.id === memberId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Cannot change own status
    if (member.userId === updaterId) {
      throw new ForbiddenError('Cannot change your own status');
    }

    // Cannot deactivate the last active owner
    if (!isActive && member.role === 'OWNER') {
      const activeOwners = organization.members.filter((m) => m.role === 'OWNER' && m.isActive).length;
      if (activeOwners <= 1) {
        throw new ForbiddenError('Cannot deactivate the last active owner');
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { isActive },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: updaterId,
        action: 'UPDATE',
        entity: 'OrganizationMember',
        entityId: memberId,
        description: `Member ${isActive ? 'activated' : 'deactivated'} in ${organization.name}`,
        changes: { isActive } as any,
      },
    });

    logger.info(`Member ${memberId} ${isActive ? 'activated' : 'deactivated'} in organization ${organizationId} by user ${updaterId}`);

    return updated;
  }
}
