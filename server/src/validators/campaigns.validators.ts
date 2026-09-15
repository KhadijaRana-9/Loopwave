import { z } from 'zod'

export const campaignIdParamSchema = z.object({ id: z.string().min(1) })

export const audienceFilterSchema = z.object({
  tags: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  statuses: z.array(z.string()).default([]),
})

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(150),
  templateId: z.string().min(1, 'A template is required'),
  audienceFilter: audienceFilterSchema.default({}),
  scheduledAt: z.coerce.date().nullable().optional(),
})
