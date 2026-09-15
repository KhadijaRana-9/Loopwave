import { apiClient } from './apiClient'

export async function listWhatsappNumbers() {
  const { numbers } = await apiClient.get('/whatsapp/numbers')
  return numbers
}

export async function startEmbeddedSignup({ label }) {
  return apiClient.post('/whatsapp/connect', { label })
}

export async function disconnectNumber(id) {
  await apiClient.post(`/whatsapp/numbers/${id}/disconnect`)
  return { id, status: 'disconnected' }
}
