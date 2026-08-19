import { z } from 'zod';

export const userSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  roleName: z.string(),
  roleId: z.uuid(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']),
  createdAt: z.coerce.date(),
});

export const userListSchema = z.array(userSummarySchema);

export const roleSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isSystem: z.boolean(),
});

export const roleListSchema = z.array(roleSummarySchema);

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(200),
  roleId: z.uuid(),
  clerkUserId: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type RoleSummary = z.infer<typeof roleSummarySchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
