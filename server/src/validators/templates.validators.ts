import { z } from 'zod'

export const templateIdParamSchema = z.object({ id: z.string().min(1) })

const buttonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().trim().min(1).max(25),
  url: z.string().trim().url().optional(),
  phone_number: z.string().trim().optional(),
})

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only'),
  category: z.enum(['utility', 'marketing', 'authentication']),
  language: z.string().trim().default('en_US'),
  headerType: z.enum(['none', 'text', 'image', 'video', 'document']).default('none'),
  header: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(buttonSchema).max(3).default([]),
  variables: z.array(z.string().trim().min(1)).default([]),
})

export const updateTemplateSchema = z.object({
  name: createTemplateSchema.shape.name.optional(),
  category: createTemplateSchema.shape.category.optional(),
  headerType: createTemplateSchema.shape.headerType.optional(),
  header: z.string().trim().max(60).optional(),
  body: z.string().trim().min(1).max(1024).optional(),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(buttonSchema).max(3).optional(),
  variables: z.array(z.string().trim().min(1)).optional(),
})
