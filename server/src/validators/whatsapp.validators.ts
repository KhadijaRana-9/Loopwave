import { z } from 'zod'

export const whatsappNumberIdParamSchema = z.object({ id: z.string().min(1) })

export const startSignupSchema = z.object({ label: z.string().trim().min(1).max(120) })
