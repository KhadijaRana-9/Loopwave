import { z } from 'zod'

export const listContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  leadStatus: z
    .enum(['NEW', 'QUALIFIED', 'CONTACTED', 'INTERESTED', 'DEMO_BOOKED', 'CONVERTED', 'LOST'])
    .optional(),
  tag: z.string().trim().optional(),
  assignedAgentId: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'name', 'leadScore', 'lastInteractionAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
})

export const contactIdParamSchema = z.object({ id: z.string().min(1) })

export const createContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().min(6, 'Enter a valid phone number').max(20),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')).transform((v) => v || undefined),
  company: z.string().trim().max(150).optional(),
  source: z.string().trim().max(80).optional(),
  leadStatus: z
    .enum(['NEW', 'QUALIFIED', 'CONTACTED', 'INTERESTED', 'DEMO_BOOKED', 'CONVERTED', 'LOST'])
    .default('NEW'),
  assignedAgentId: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
})

export const updateContactSchema = createContactSchema.partial()

export const bulkContactActionSchema = z.object({
  contactIds: z.array(z.string().min(1)).min(1, 'Select at least one contact'),
  action: z.enum(['tag', 'assign', 'setStatus', 'delete']),
  tag: z.string().trim().optional(),
  assignedAgentId: z.string().trim().optional(),
  leadStatus: z
    .enum(['NEW', 'QUALIFIED', 'CONTACTED', 'INTERESTED', 'DEMO_BOOKED', 'CONVERTED', 'LOST'])
    .optional(),
})

export const addContactNoteSchema = z.object({ text: z.string().trim().min(1).max(2000) })
