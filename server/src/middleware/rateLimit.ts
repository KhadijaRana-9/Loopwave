import rateLimit from 'express-rate-limit'

// Generous general API limit; auth endpoints get a tighter one to blunt
// credential-stuffing / brute force attempts against login.
// Provider-facing webhooks (Meta, Stripe) are exempt from the per-IP limit:
// a busy WhatsApp Business Account legitimately sends far more than 300
// events/minute from a small set of Meta IPs, and a 429 makes Meta retry and
// eventually disable the subscription. They are not open to abuse the way a
// user endpoint is — every request must carry a valid HMAC signature over the
// body (whatsapp.controller.ts / billing.controller.ts), verified before any
// work is done.
const PROVIDER_WEBHOOK_PATHS = ['/api/whatsapp/webhook', '/api/billing/webhook']

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => PROVIDER_WEBHOOK_PATHS.some((p) => req.originalUrl.split('?')[0] === p),
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.' } },
})
