import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: passwordSchema,
  workspaceName: z.string().trim().min(1, 'Workspace name is required').max(120),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const adminLoginSchema = loginSchema

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: passwordSchema,
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
})
