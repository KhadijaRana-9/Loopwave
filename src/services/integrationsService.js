import { apiClient } from './apiClient'

export async function listIntegrations() {
  const { integrations } = await apiClient.get('/integrations')
  return integrations
}

export async function toggleIntegration(id) {
  return apiClient.post(`/integrations/${id}/toggle`)
}

export async function saveIntegrationConfig(id, config) {
  return apiClient.post(`/integrations/${id}/config`, { config })
}

export async function testIntegrationConnection(id) {
  return apiClient.post(`/integrations/${id}/test`)
}
