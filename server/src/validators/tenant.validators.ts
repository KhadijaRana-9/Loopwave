import { z } from 'zod'

export const updateTenantSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(120),
})
