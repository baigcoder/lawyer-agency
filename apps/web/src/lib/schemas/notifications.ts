import { z } from 'zod';

/** Rows written before title/body/url were stored only carry ids, so all three are optional. */
export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.string(),
  payload: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      url: z.string().optional(),
    })
    .loose(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export const notificationListSchema = z.array(notificationSchema);
export const unreadCountSchema = z.number().int().nonnegative();

export type NotificationDto = z.infer<typeof notificationSchema>;
