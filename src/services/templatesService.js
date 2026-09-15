import { apiClient } from './apiClient'

export async function listTemplates() {
  const { templates } = await apiClient.get('/templates')
  return templates
}

export async function createTemplate(data) {
  const { template } = await apiClient.post('/templates', data)
  return template
}

export async function updateTemplate(id, patch) {
  const { template } = await apiClient.patch(`/templates/${id}`, patch)
  return template
}

export async function submitTemplateForReview(id) {
  const { template } = await apiClient.post(`/templates/${id}/submit`)
  return template
}

export async function deleteTemplate(id) {
  await apiClient.delete(`/templates/${id}`)
  return { deleted: id }
}
