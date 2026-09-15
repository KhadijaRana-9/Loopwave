import { apiClient } from './apiClient'

export async function listAutomations() {
  const { automations } = await apiClient.get('/automations')
  return automations
}

export async function getAutomation(id) {
  const { automation } = await apiClient.get(`/automations/${id}`)
  return automation
}

export async function createAutomation(data) {
  const { automation } = await apiClient.post('/automations', data)
  return automation
}

export async function updateAutomation(id, patch) {
  const { automation } = await apiClient.patch(`/automations/${id}`, patch)
  return automation
}

export async function toggleAutomationStatus(id) {
  const { automation } = await apiClient.post(`/automations/${id}/toggle`)
  return automation
}

export async function testAutomation(id) {
  const { execution } = await apiClient.post(`/automations/${id}/test`)
  return execution
}

export async function listAutomationExecutions(id) {
  const { executions } = await apiClient.get(`/automations/${id}/executions`)
  return executions
}
