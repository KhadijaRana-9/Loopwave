import { apiClient } from './apiClient'

export async function listTenants() {
  const { tenants } = await apiClient.get('/admin/tenants')
  return tenants
}

export async function setTenantStatus(id, status) {
  const { tenant } = await apiClient.patch(`/admin/tenants/${id}/status`, { status })
  return tenant
}

export async function getTenantUsage(id) {
  return apiClient.get(`/admin/tenants/${id}/usage`)
}

export async function getPlatformDashboard() {
  return apiClient.get('/admin/dashboard')
}

export async function listPlatformUsers() {
  const { users } = await apiClient.get('/admin/users')
  return users
}

export async function listPlansAdmin() {
  const { plans } = await apiClient.get('/admin/plans')
  return plans
}

export async function updatePlan(id, patch) {
  const { plan } = await apiClient.patch(`/admin/plans/${id}`, patch)
  return plan
}

export async function createPlan(data) {
  const { plan } = await apiClient.post('/admin/plans', data)
  return plan
}

export async function getPlatformSettings() {
  const { settings } = await apiClient.get('/admin/settings')
  return settings
}

export async function updatePlatformSettings(patch) {
  const { settings } = await apiClient.patch('/admin/settings', patch)
  return settings
}

export async function listSystemLogs() {
  const { logs } = await apiClient.get('/admin/system-logs')
  return logs
}

export async function listAdminAiAgents() {
  const { agents } = await apiClient.get('/admin/ai-agents')
  return agents
}

export async function listAdminCampaigns() {
  const { campaigns } = await apiClient.get('/admin/campaigns')
  return campaigns
}
