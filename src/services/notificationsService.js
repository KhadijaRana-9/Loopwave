import { apiClient } from './apiClient'

export async function listNotifications() {
  return apiClient.get('/notifications')
}

export async function markNotificationRead(id) {
  await apiClient.patch(`/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  await apiClient.post('/notifications/read-all')
}

export async function getNotificationPreferences() {
  const { preferences } = await apiClient.get('/notifications/preferences')
  return preferences
}

export async function updateNotificationPreferences(patch) {
  const { preferences } = await apiClient.patch('/notifications/preferences', patch)
  return preferences
}
