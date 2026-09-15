import { z } from 'zod'

export const templateIdParamSchema = z.object({ id: z.string().min(1) })

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only'),
  category: z.enum(['utility', 'marketing', 'authentication']),
  language: z.string().trim().default('en_US'),
  body: z.string().trim().min(1).max(1024),
  variables: z.array(z.string().trim().min(1)).default([]),
})

export const updateTemplateSchema = z.object({
  name: createTemplateSchema.shape.name.optional(),
  category: createTemplateSchema.shape.category.optional(),
  body: z.string().trim().min(1).max(1024).optional(),
  variables: z.array(z.string().trim().min(1)).optional(),
})
