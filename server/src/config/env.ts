import 'dotenv/config'
import { z } from 'zod'

// Fail fast on boot rather than throwing confusing errors deep in a request handler.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_APP_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  // App-level Meta config — one Meta App serves every tenant's Embedded
  // Signup. META_APP_ID/META_CONFIG_ID are not secret (they ship in the
  // frontend bundle to init the Facebook JS SDK); WHATSAPP_APP_SECRET and
  // WHATSAPP_VERIFY_TOKEN are backend-only. Per-tenant WABA id + access
  // token live encrypted in WhatsAppAccount, not here — see whatsapp.service.ts.
  META_APP_ID: z.string().optional().default(''),
  META_CONFIG_ID: z.string().optional().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  STORAGE_ENDPOINT: z.string().optional().default(''),
  STORAGE_REGION: z.string().optional().default(''),
  STORAGE_BUCKET: z.string().optional().default(''),
  STORAGE_ACCESS_KEY_ID: z.string().optional().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional().default(''),

  AI_PROVIDER: z.enum(['demo', 'openai']).default('demo'),
  OPENAI_API_KEY: z.string().optional().default(''),

  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),

  EMAIL_PROVIDER: z.enum(['demo', 'resend']).default('demo'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Loopwave <notifications@loopwave.demo>'),

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
  // Whether ANY tenant can even attempt Meta Embedded Signup — a platform-level
  // condition (this Meta App exists and is configured), not a per-tenant one.
  // Whether a *specific* tenant can actually send is a separate, per-tenant
  // question answered by WhatsAppAccount.accessTokenCipher — see whatsapp.service.ts.
  whatsappSignup: Boolean(env.META_APP_ID && env.META_CONFIG_ID && env.WHATSAPP_APP_SECRET),
  storage: Boolean(env.STORAGE_ENDPOINT && env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY),
  ai: env.AI_PROVIDER === 'openai' && Boolean(env.OPENAI_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  email: env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY),
}
