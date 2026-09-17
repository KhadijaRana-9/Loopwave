import { z } from 'zod'

export const checkoutSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
})
