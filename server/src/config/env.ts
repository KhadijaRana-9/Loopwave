import 'dotenv/config'
import { z } from 'zod'

// Fail fast on boot rather than throwing confusing errors deep in a request handler.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  WEB_APP_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  AI_PROVIDER: z.enum(['demo', 'openai']).default('demo'),
  OPENAI_API_KEY: z.string().optional().default(''),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),

  EMAIL_PROVIDER: z.enum(['demo', 'resend']).default('demo'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Loopwave <notifications@loopwave.demo>'),

  STORAGE_ENDPOINT: z.string().optional().default(''),
  STORAGE_REGION: z.string().optional().default(''),
  STORAGE_BUCKET: z.string().optional().default(''),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(''),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'

// Integration readiness flags — the UI/API should reflect these honestly
// rather than claiming a connection that was never established.
export const integrationReadiness = {
  whatsapp: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_BUSINESS_ACCOUNT_ID),
  ai: env.AI_PROVIDER === 'openai' && Boolean(env.OPENAI_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  email: env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY),
}
