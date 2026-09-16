import { z } from 'zod'

export const campaignIdParamSchema = z.object({ id: z.string().min(1) })

// mode 'all' = every eligible contact in the tenant. 'filter' = tags/sources/
// statuses/search/assignedAgentId applied server-side (this is what makes
// "select all matching the current filter" correct instead of a
// frontend-only trick — see campaigns.repository.ts#resolveAudience).
// 'contacts' = an explicit id list from individual/multi-select in the UI.
export const audienceFilterSchema = z.object({
  mode: z.enum(['all', 'filter', 'contacts']).default('all'),
  tags: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  statuses: z.array(z.string()).default([]),
  search: z.string().trim().max(200).optional(),
  assignedAgentId: z.string().trim().optional(),
  contactIds: z.array(z.string().min(1)).max(20000).default([]),
})

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    templateId: z.string().min(1).optional(),
    // Alternative to templateId: an AI-composed / hand-written message that
    // gets saved as a real Template row on creation (see campaigns.service.ts).
    message: z.string().trim().min(1).max(4096).optional(),
    language: z.string().trim().default('en_US'),
    audienceFilter: audienceFilterSchema.default({}),
    scheduledAt: z.coerce.date().nullable().optional(),
  })
  .refine((v) => v.templateId || v.message, { message: 'Either templateId or message is required', path: ['message'] })

export const campaignComposeSchema = z.object({
  campaignName: z.string().trim().max(150).default(''),
  topic: z.string().trim().min(1, 'Topic is required').max(200),
  subheading: z.string().trim().max(400).optional(),
  offer: z.string().trim().max(200).optional(),
  tone: z.string().trim().max(80).optional(),
  language: z.string().trim().max(40).optional(),
  cta: z.string().trim().max(60).optional(),
  instructions: z.string().trim().max(500).optional(),
  currentMessage: z.string().trim().max(4096).optional(),
  action: z.enum(['generate', 'regenerate', 'shorten', 'professional', 'engaging', 'translate', 'add_emojis', 'remove_emojis', 'change_tone']).default('generate'),
})

export const audiencePreviewSchema = z.object({ audienceFilter: audienceFilterSchema.default({}) })
