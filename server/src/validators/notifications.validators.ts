import { z } from 'zod'

export const updateNotificationPreferencesSchema = z
  .object({
    newLead: z.boolean().optional(),
    campaignComplete: z.boolean().optional(),
    weeklyReport: z.boolean().optional(),
    mentions: z.boolean().optional(),
  })
  .strict()
