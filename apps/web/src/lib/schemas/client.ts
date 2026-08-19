import { z } from 'zod';

export const clientFolderSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  waPhone: z.string(),
  documentCount: z.number().int().nonnegative(),
});

export const clientFolderListSchema = z.array(clientFolderSchema);

export type ClientFolder = z.infer<typeof clientFolderSchema>;
