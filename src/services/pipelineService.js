import { apiClient } from './apiClient'

export async function listStages() {
  const { stages } = await apiClient.get('/pipeline/stages')
  return stages
}

export async function listDeals() {
  const { deals } = await apiClient.get('/pipeline/deals')
  return deals
}

export async function moveDeal(dealId, stage) {
  const { deal } = await apiClient.patch(`/pipeline/deals/${dealId}`, { stage })
  return deal
}

export async function updateDeal(dealId, patch) {
  const { deal } = await apiClient.patch(`/pipeline/deals/${dealId}`, patch)
  return deal
}

export async function addDealNote(dealId, text) {
  const { note } = await apiClient.post(`/pipeline/deals/${dealId}/notes`, { text })
  return note
}
