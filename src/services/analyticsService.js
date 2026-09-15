import { apiClient } from './apiClient'

export async function getMessagingAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/messaging?days=${days}`)
}

export async function getCampaignAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/campaigns?days=${days}`)
}

export async function getContactsAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/contacts?days=${days}`)
}

export async function getLeadsAnalytics() {
  return apiClient.get('/analytics/leads')
}

export async function getConversionAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/conversion?days=${days}`)
}

export async function getAgentAnalytics() {
  return apiClient.get('/analytics/agents')
}

export async function getAiUsageAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/ai-usage?days=${days}`)
}

export async function getAutomationAnalytics() {
  return apiClient.get('/analytics/automations')
}

export async function getWhatsappUsageAnalytics({ days = 30 } = {}) {
  return apiClient.get(`/analytics/whatsapp-usage?days=${days}`)
}
