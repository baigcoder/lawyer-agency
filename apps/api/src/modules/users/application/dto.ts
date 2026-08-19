import { z } from 'zod';

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(200),
  roleId: z.uuid(),
  clerkUserId: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  roleId: z.uuid().optional(),
  phone: z.string().max(30).nullable().optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersSchema = z.object({
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;