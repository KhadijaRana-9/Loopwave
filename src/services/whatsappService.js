import { apiClient } from './apiClient'

export async function listWhatsappNumbers() {
  const { numbers } = await apiClient.get('/whatsapp/numbers')
  return numbers
}

// { configured: boolean, appId: string|null, configId: string|null } — appId/
// configId are only ever non-null when the platform has real Meta App
// credentials configured (server/src/services/whatsapp.service.ts#getSignupConfig).
export async function getSignupConfig() {
  return apiClient.get('/whatsapp/signup-config')
}

// code/wabaId/phoneNumberId come from a completed Meta Embedded Signup popup
// (see src/utils/metaEmbeddedSignup.js) — never fabricated client-side.
export async function completeEmbeddedSignup({ code, wabaId, phoneNumberId, businessId, label }) {
  return apiClient.post('/whatsapp/connect', { code, wabaId, phoneNumberId, businessId, label })
}

export async function disconnectNumber(id) {
  await apiClient.post(`/whatsapp/numbers/${id}/disconnect`)
  return { id, status: 'disconnected' }
}
