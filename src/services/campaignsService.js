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
