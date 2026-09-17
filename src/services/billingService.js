import { apiClient } from './apiClient'

export async function getCurrentSubscription() {
  return apiClient.get('/billing/subscription')
}

export async function listPlans() {
  const { plans } = await apiClient.get('/billing/plans')
  return plans
}

export async function listInvoices() {
  const { invoices } = await apiClient.get('/billing/invoices')
  return invoices
}

export async function getPaymentMethod() {
  const { paymentMethod } = await apiClient.get('/billing/payment-method')
  return paymentMethod
}

// Sandbox mode (no Stripe/Razorpay keys configured) switches the plan
// immediately and returns { sandbox: true }; a live provider instead returns
// a real checkout URL and the plan changes only once its webhook confirms
// payment. See server/src/services/billing.service.ts.
export async function changePlan(planId, billingCycle = 'monthly') {
  const result = await apiClient.post('/billing/checkout', { planId, billingCycle })
  if (result.checkoutUrl) {
    window.location.href = result.checkoutUrl
    return result
  }
  return result
}

// Real subscriptions: schedules cancellation for the end of the already-paid
// period (cancelAtPeriodEnd stays true and access continues until then).
// Sandbox: cancels immediately, since there's no real period to honor.
export async function cancelSubscription() {
  return apiClient.post('/billing/cancel')
}

export async function resumeSubscription() {
  return apiClient.post('/billing/resume')
}
