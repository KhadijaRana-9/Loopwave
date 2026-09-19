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

export type BillingCycle = 'monthly' | 'yearly'

// Yearly = 10x the monthly price (2 months free) rather than a separate
// stored price — Plan only carries one `price` field, and adding a whole
// second pricing column for a single derived discount isn't worth the
// migration + reseed. If real per-plan yearly pricing is ever needed this is
// the one place that would change.
const YEARLY_MONTHS = 10

function stripeForm(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params)
}

async function stripeRequest<T>(path: string, method: 'GET' | 'POST', body?: Record<string, string>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: body ? stripeForm(body) : undefined,
  })
  const payload = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null
  if (!res.ok || !payload) throw new Error(payload?.error?.message || `Stripe request to ${path} failed`)
  return payload
}

// Creates a real Stripe Checkout Session when STRIPE_SECRET_KEY is
// configured. The actual plan change never happens here — only once the
// webhook below confirms payment — so a client can never fake success by
// simply calling this endpoint (Section 52: "never trust client-side payment success").
export async function createCheckoutSession(params: {
  tenantId: string
  planId: string
  amount: number
  billingCycle: BillingCycle
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutSession> {
  if (integrationReadiness.stripe) {
    const unitAmount = params.billingCycle === 'yearly' ? params.amount * YEARLY_MONTHS : params.amount
    const payload = await stripeRequest<{ url?: string; id?: string }>('/checkout/sessions', 'POST', {
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      'line_items[0][price_data][currency]': 'inr',
      'line_items[0][price_data][product_data][name]': `Loopwave — ${params.planId} plan (${params.billingCycle})`,
      'line_items[0][price_data][unit_amount]': String(unitAmount * 100),
      'line_items[0][price_data][recurring][interval]': params.billingCycle === 'yearly' ? 'year' : 'month',
      'line_items[0][quantity]': '1',
      'metadata[tenantId]': params.tenantId,
      'metadata[planId]': params.planId,
      'metadata[billingCycle]': params.billingCycle,
    })
    if (!payload.url) throw new Error('Stripe checkout session creation failed')
    return { checkoutUrl: payload.url, providerSessionId: payload.id ?? '' }
  }

  throw new Error('No payment provider configured')
}

export function verifyStripeSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.STRIPE_WEBHOOK_SECRET || !signatureHeader) return false
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=') as [string, string]))
  if (!parts.t || !parts.v1) return false
  const expected = crypto.createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${rawBody.toString()}`).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(parts.v1)
  // timingSafeEqual throws on mismatched lengths rather than returning false —
  // a malformed/truncated signature would otherwise crash into a 500 instead
  // of the clean 401 a bad signature should produce.
  if (expectedBuf.length !== receivedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}

// Schedules (or unschedules) cancellation at the end of the current billing
// period — never an immediate cancellation, so a client action can't cut off
// service the subscriber already paid for. Real deactivation only happens
// when Stripe actually sends customer.subscription.deleted at period end.
export async function setStripeCancelAtPeriodEnd(providerSubId: string, cancelAtPeriodEnd: boolean): Promise<void> {
  await stripeRequest(`/subscriptions/${providerSubId}`, 'POST', { cancel_at_period_end: String(cancelAtPeriodEnd) })
}

export interface StripePaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

// Reads the customer's default payment method (attached automatically by
// Stripe Checkout on first successful subscription payment) — read-only,
// never used to charge anything from here.
export async function fetchStripeDefaultPaymentMethod(customerId: string): Promise<StripePaymentMethod | null> {
  const res = await fetch(
    `https://api.stripe.com/v1/customers/${customerId}?${new URLSearchParams({ 'expand[]': 'invoice_settings.default_payment_method' })}`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
  )
  const payload = (await res.json().catch(() => null)) as {
    invoice_settings?: { default_payment_method?: { card?: { brand: string; last4: string; exp_month: number; exp_year: number } } }
  } | null
  const card = payload?.invoice_settings?.default_payment_method?.card
  if (!res.ok || !card) return null
  return { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year }
}
