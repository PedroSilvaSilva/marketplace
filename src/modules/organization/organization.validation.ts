import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(500).optional(),
  type: z.enum(['MARKETPLACE', 'PROVIDER', 'PARTNER', 'CLIENT']),
  website: z.string().url().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(['MARKETPLACE', 'PROVIDER', 'PARTNER', 'CLIENT']).optional(),
  website: z.string().url().optional().nullable(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
  message: z.string().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
});

export const updateMemberStatusSchema = z.object({
  isActive: z.boolean(),
});

export type CreateOrganizationData = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationData = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberData = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleData = z.infer<typeof updateMemberRoleSchema>;
export type UpdateMemberStatusData = z.infer<typeof updateMemberStatusSchema>;
