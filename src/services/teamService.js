import { apiClient } from './apiClient'

export async function listTeamMembers() {
  const { members } = await apiClient.get('/team')
  return members
}

export async function inviteTeamMember({ name, email, role }) {
  const { member } = await apiClient.post('/team', { name, email, role })
  return member
}

export async function updateTeamMemberRole(id, role) {
  const { member } = await apiClient.patch(`/team/${id}/role`, { role })
  return member
}

export async function removeTeamMember(id) {
  await apiClient.delete(`/team/${id}`)
  return { deleted: id }
}
