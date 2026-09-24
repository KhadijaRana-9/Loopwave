import { apiClient } from './apiClient'

export async function listCampaigns() {
  const { campaigns } = await apiClient.get('/campaigns')
  return campaigns
}

export async function getCampaign(id) {
  const { campaign } = await apiClient.get(`/campaigns/${id}`)
  return campaign
}

export async function createCampaign(data) {
  const { campaign } = await apiClient.post('/campaigns', data)
  return campaign
}

export async function duplicateCampaign(id) {
  const { campaign } = await apiClient.post(`/campaigns/${id}/duplicate`)
  return campaign
}

export async function cancelScheduledCampaign(id) {
  const { campaign } = await apiClient.post(`/campaigns/${id}/cancel`)
  return campaign
}

// Talks to the real backend AI composer (server/src/integrations/ai.adapter.ts) —
// returns a real OpenAI completion when configured, otherwise an honestly-labeled
// demo message actually assembled from the given brief.
export async function composeAiMessage(payload) {
  return apiClient.post('/campaigns/ai/compose', payload)
}

// Server-resolved count for the current audience filter — never loads the
// full contact list just to show "how many". This is what "Select All"
// actually means: whatever the backend resolves for this filter at send time.
export async function previewAudience(audienceFilter) {
  return apiClient.post('/campaigns/audience/preview', { audienceFilter })
}

// Uploads the ONE media file a template header needs — every recipient's
// send reuses this same Meta media handle. Requires a real connected
// WhatsApp number (server/src/services/campaigns.service.ts#uploadHeaderMedia).
export async function uploadHeaderMedia(file) {
  const form = new FormData()
  form.append('file', file)
  return apiClient.postForm('/campaigns/header-media', form)
}
