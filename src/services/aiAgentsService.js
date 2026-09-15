import { apiClient } from './apiClient'

export async function listAiAgents() {
  const { agents } = await apiClient.get('/ai-agents')
  return agents
}

export async function getAiAgent(id) {
  const { agent } = await apiClient.get(`/ai-agents/${id}`)
  return agent
}

export async function createAiAgent(data) {
  const { agent } = await apiClient.post('/ai-agents', data)
  return agent
}

export async function updateAiAgent(id, patch) {
  const { agent } = await apiClient.patch(`/ai-agents/${id}`, patch)
  return agent
}

// Backs TestConversationModal — talks to the real (or honestly-labeled demo)
// AI provider on the backend instead of simulating a reply in the browser.
export async function testAgentMessage(id, message, history) {
  return apiClient.post(`/ai-agents/${id}/test`, { message, history })
}
