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
