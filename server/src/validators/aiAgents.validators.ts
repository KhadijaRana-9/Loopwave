import { z } from 'zod'

export const aiAgentIdParamSchema = z.object({ id: z.string().min(1) })

const faqSchema = z.object({ question: z.string().trim().min(1), answer: z.string().trim().min(1) })

export const createAiAgentSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  personality: z.string().trim().max(500).optional(),
  businessInfo: z.string().trim().max(2000).optional(),
  goals: z.array(z.string().trim().min(1)).default([]),
  qualificationQuestions: z.array(z.string().trim().min(1)).default([]),
  handoffRules: z.string().trim().max(1000).optional(),
  faqs: z.array(faqSchema).default([]),
})

export const updateAiAgentSchema = createAiAgentSchema.partial().extend({
  status: z.enum(['draft', 'active', 'paused']).optional(),
})

export const testConversationSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ from: z.enum(['user', 'agent']), text: z.string() }))
    .default([]),
})
