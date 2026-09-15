import { apiClient } from './apiClient'

export async function listConversations({ status = 'all', assignedAgentId = 'all', search = '' } = {}) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (assignedAgentId !== 'all') params.set('assignedAgentId', assignedAgentId)
  if (search) params.set('search', search)
  const qs = params.toString()
  const { conversations } = await apiClient.get(`/conversations${qs ? `?${qs}` : ''}`)
  return conversations
}

export async function getConversation(id) {
  const { conversation } = await apiClient.get(`/conversations/${id}`)
  return conversation
}

export async function sendMessage(conversationId, text) {
  const { message } = await apiClient.post(`/conversations/${conversationId}/messages`, { text })
  return message
}

export async function assignConversation(conversationId, agentId) {
  const { conversation } = await apiClient.patch(`/conversations/${conversationId}/assign`, { agentId })
  return conversation
}

export async function updateConversationStatus(conversationId, status) {
  const { conversation } = await apiClient.patch(`/conversations/${conversationId}/status`, { status })
  return conversation
}

export async function addNote(conversationId, text) {
  const { note } = await apiClient.post(`/conversations/${conversationId}/notes`, { text })
  return note
}
