import { apiClient } from './apiClient'

export async function listForms() {
  const { forms } = await apiClient.get('/forms')
  return forms
}

export async function createForm(data) {
  const { form } = await apiClient.post('/forms', data)
  return form
}

export async function updateForm(id, patch) {
  const { form } = await apiClient.patch(`/forms/${id}`, patch)
  return form
}

export async function deleteForm(id) {
  await apiClient.delete(`/forms/${id}`)
  return { deleted: id }
}

export async function listSubmissions(formId) {
  const { submissions } = await apiClient.get(`/forms/${formId}/submissions`)
  return submissions
}
