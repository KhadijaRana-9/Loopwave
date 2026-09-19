import { Prisma } from '@prisma/client'
import { prisma } from '@/config/prisma.js'
import type { InvoiceStatus, SubscriptionStatus } from '@prisma/client'

const TRIAL_PLAN_ID = 'trial'

function periodEndFor(billingCycle: string, from = new Date()): Date {
  const days = billingCycle === 'yearly' ? 365 : 30
  return new Date(from.getTime() + days * 86_400_000)
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

// Invoice.number is globally unique, so the sequence driving it has to be
// counted globally too — counting per-subscription (as this used to) meant
// any two different tenants' first invoice both landed on e.g.
// "SANDBOX-2026-0001" and the second one's insert failed outright. Counts
// per prefix+year rather than the whole table so sandbox/real numbering
// stay in their own independent series, and retries on an actual collision
// (a genuinely concurrent request landing between the count and the
// insert) instead of assuming the count alone guarantees uniqueness.
async function createInvoiceWithNumber(prefix: string, data: { subscriptionId: string; amount: number; status: InvoiceStatus; providerRef?: string | null; issuedAt: Date }) {
  const year = new Date().getFullYear()
  const numberPrefix = `${prefix}-${year}-`
  let attempt = await prisma.invoice.count({ where: { number: { startsWith: numberPrefix } } })

  for (let tries = 0; tries < 5; tries++) {
    const number = `${numberPrefix}${String(attempt + 1).padStart(4, '0')}`
    try {
      return await prisma.invoice.create({ data: { ...data, number } })
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err
      attempt += 1
    }
  }
  throw new Error(`Could not allocate a unique invoice number with prefix ${numberPrefix} after 5 attempts`)
}

export const billingRepository = {
  getSubscription(tenantId: string) {
    return prisma.subscription.findUnique({ where: { tenantId }, include: { plan: true } })
  },

  getSubscriptionByProviderSubId(providerSubId: string) {
    return prisma.subscription.findFirst({ where: { providerSubId }, include: { plan: true } })
  },

  listPlans() {
    return prisma.plan.findMany({ orderBy: { price: 'asc' } })
  },

  getPlan(id: string) {
    return prisma.plan.findUnique({ where: { id } })
  },

  listInvoices(subscriptionId: string) {
    return prisma.invoice.findMany({ where: { subscriptionId }, orderBy: { issuedAt: 'desc' } })
  },

  switchPlanSandbox(tenantId: string, planId: string, billingCycle: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: { planId, billingCycle, status: 'ACTIVE', cancelAtPeriodEnd: false, currentPeriodEnd: periodEndFor(billingCycle) },
      include: { plan: true },
    })
  },

  createSandboxInvoice(subscriptionId: string, amount: number) {
    return createInvoiceWithNumber('SANDBOX', { subscriptionId, amount, status: 'PAID', issuedAt: new Date() })
  },

  // Only path that ever activates a paid plan for real — called exclusively
  // from a signature-verified webhook, never from a client-reachable route.
  confirmFromWebhook(tenantId: string, planId: string, providerSubId: string, providerCustomerId: string, provider: string, billingCycle: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: {
        planId,
        billingCycle,
        status: 'ACTIVE',
        provider,
        providerSubId,
        providerCustomerId,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEndFor(billingCycle),
      },
    })
  },

  // Real, sequential invoice numbers for actual provider-confirmed payments
  // — kept separate from the honestly-labeled "SANDBOX-" series above so the
  // two can never be confused in the billing history table.
  recordRealInvoice(subscriptionId: string, amount: number, status: InvoiceStatus, providerRef: string | null) {
    return createInvoiceWithNumber('INV', { subscriptionId, amount, status, providerRef, issuedAt: new Date() })
  },

  markPastDue(tenantId: string) {
    return prisma.subscription.update({ where: { tenantId }, data: { status: 'PAST_DUE' } })
  },

  syncPeriodAndCancelFlag(providerSubId: string, data: { currentPeriodEnd?: Date; cancelAtPeriodEnd?: boolean; status?: SubscriptionStatus }) {
    return prisma.subscription.updateMany({ where: { providerSubId }, data })
  },

  // Full deactivation — Stripe only sends this once the period the
  // subscriber already paid for has actually ended, so reverting to the
  // free plan's limits here doesn't cut off anything they paid for.
  downgradeToFreeOnCancellation(providerSubId: string) {
    return prisma.subscription.updateMany({
      where: { providerSubId },
      data: { status: 'CANCELLED', planId: TRIAL_PLAN_ID, provider: null, providerSubId: null, cancelAtPeriodEnd: false, currentPeriodEnd: null },
    })
  },

  scheduleCancelAtPeriodEnd(tenantId: string) {
    return prisma.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: true }, include: { plan: true } })
  },

  unscheduleCancelAtPeriodEnd(tenantId: string) {
    return prisma.subscription.update({ where: { tenantId }, data: { cancelAtPeriodEnd: false }, include: { plan: true } })
  },

  // Sandbox has no real billing period to honor, so "cancel" here is
  // immediate and honestly labeled as such by the caller/UI, unlike the real
  // provider path above which only ever schedules cancellation.
  cancelSandboxImmediately(tenantId: string) {
    return prisma.subscription.update({
      where: { tenantId },
      data: { status: 'CANCELLED', planId: TRIAL_PLAN_ID, cancelAtPeriodEnd: false, currentPeriodEnd: null },
      include: { plan: true },
    })
  },
}
