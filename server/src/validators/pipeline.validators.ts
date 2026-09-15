import { z } from 'zod'

export const dealIdParamSchema = z.object({ id: z.string().min(1) })

export const createDealSchema = z.object({
  contactId: z.string().min(1, 'A contact is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  value: z.coerce.number().int().min(0).default(0),
  stage: z.string().trim().optional(),
  assignedAgentId: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  expectedCloseDate: z.coerce.date().optional(),
})

export const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  value: z.coerce.number().int().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  stage: z.string().trim().optional(),
  assignedAgentId: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  expectedCloseDate: z.coerce.date().nullable().optional(),
})

export const addDealNoteSchema = z.object({ text: z.string().trim().min(1).max(2000) })
