import { z } from 'zod'

export const formIdParamSchema = z.object({ id: z.string().min(1) })

const fieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'phone', 'email', 'number', 'dropdown', 'checkbox', 'radio', 'date']),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
})

export const createFormSchema = z.object({
  name: z.string().trim().min(1).max(150),
  fields: z.array(fieldSchema).default([]),
})

export const updateFormSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  status: z.enum(['draft', 'published', 'unpublished']).optional(),
  fields: z.array(fieldSchema).optional(),
})

export const submitFormSchema = z.object({ values: z.record(z.string(), z.unknown()) })
