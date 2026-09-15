import crypto from 'node:crypto'
import { env, integrationReadiness } from '@/config/env.js'

export type PaymentProvider = 'stripe' | 'razorpay'

export function activeProvider(): PaymentProvider | null {
  if (integrationReadiness.stripe) return 'stripe'
  if (integrationReadiness.razorpay) return 'razorpay'
  return null
}

export interface CheckoutSession {
  checkoutUrl: string
  providerSessionId: string
}

// Creates a real Stripe Checkout Session when STRIPE_SECRET_KEY is
// configured. The actual plan change never happens here — only once the
// webhook below confirms payment — so a client can never fake success by
// simply calling this endpoint (Section 52: "never trust client-side payment success").
export async function createCheckoutSession(params: { tenantId: string; planId: string; amount: number; successUrl: string; cancelUrl: string }): Promise<CheckoutSession> {
  if (integrationReadiness.stripe) {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        'line_items[0][price_data][currency]': 'inr',
        'line_items[0][price_data][product_data][name]': `Loopwave — ${params.planId} plan`,
        'line_items[0][price_data][unit_amount]': String(params.amount * 100),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][quantity]': '1',
        'metadata[tenantId]': params.tenantId,
        'metadata[planId]': params.planId,
      }),
    })
    const payload = (await res.json()) as { url?: string; id?: string }
    if (!res.ok || !payload.url) throw new Error('Stripe checkout session creation failed')
    return { checkoutUrl: payload.url, providerSessionId: payload.id ?? '' }
  }

  throw new Error('No payment provider configured')
}

export function verifyStripeSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.STRIPE_WEBHOOK_SECRET || !signatureHeader) return false
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=') as [string, string]))
  if (!parts.t || !parts.v1) return false
  const expected = crypto.createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${rawBody.toString()}`).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
}
