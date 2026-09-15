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

// Sandbox mode (no Stripe/Razorpay keys configured) switches the plan
// immediately and returns { sandbox: true }; a live provider instead returns
// a real checkout URL and the plan changes only once its webhook confirms
// payment. See server/src/services/billing.service.ts.
export async function changePlan(planId) {
  const result = await apiClient.post('/billing/checkout', { planId })
  if (result.checkoutUrl) {
    window.location.href = result.checkoutUrl
    return result
  }
  return result
}
