import { z } from 'zod';

export const sessionSchema = z.object({
  userId: z.string().uuid().nullable(),
  tenantId: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  role: z.string(),
  permissions: z.array(z.string()),
  isOwner: z.boolean(),
});

export type Session = z.infer<typeof sessionSchema>;
