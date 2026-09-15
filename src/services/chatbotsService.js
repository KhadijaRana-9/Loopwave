import { apiClient } from './apiClient'

export async function listChatbots() {
  const { chatbots } = await apiClient.get('/chatbots')
  return chatbots
}

export async function getChatbot(id) {
  const { chatbot } = await apiClient.get(`/chatbots/${id}`)
  return chatbot
}

export async function createChatbot(data) {
  const { chatbot } = await apiClient.post('/chatbots', data)
  return chatbot
}

export async function updateChatbot(id, patch) {
  const { chatbot } = await apiClient.patch(`/chatbots/${id}`, patch)
  return chatbot
}

export async function deleteChatbot(id) {
  await apiClient.delete(`/chatbots/${id}`)
  return { deleted: id }
}
