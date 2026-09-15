import { z } from 'zod'

export const tenantIdParamSchema = z.object({ id: z.string().min(1) })
export const planIdParamSchema = z.object({ id: z.string().min(1) })

export const setTenantStatusSchema = z.object({ status: z.enum(['trial', 'active', 'suspended', 'cancelled']) })

export const updatePlanSchema = z.object({
  name: z.string().trim().min(1).optional(),
  tagline: z.string().trim().optional(),
  price: z.number().int().nullable().optional(),
  limits: z.record(z.string(), z.number()).optional(),
})

export const createPlanSchema = z.object({
  id: z.string().trim().min(1).regex(/^[a-z0-9_-]+$/),
  name: z.string().trim().min(1),
  tagline: z.string().trim().optional(),
  price: z.number().int().nullable(),
  billingCycle: z.string().default('monthly'),
  limits: z.record(z.string(), z.number()).default({}),
})
