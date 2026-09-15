import { z } from 'zod'

export const integrationIdParamSchema = z.object({ id: z.string().min(1) })

export const saveIntegrationConfigSchema = z.object({ config: z.record(z.string(), z.string()) })
