import { z } from 'zod'

export const membershipIdParamSchema = z.object({ id: z.string().min(1) })

const roleSchema = z.enum(['admin', 'manager', 'sales_agent', 'support_agent', 'viewer']).transform((r) => r.toUpperCase() as 'ADMIN' | 'MANAGER' | 'SALES_AGENT' | 'SUPPORT_AGENT' | 'VIEWER')

export const inviteTeamMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: roleSchema,
})

export const updateRoleSchema = z.object({ role: roleSchema })
