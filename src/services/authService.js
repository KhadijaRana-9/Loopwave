import { apiClient } from './apiClient'

// Real backend calls (server/src/routes/auth.routes.ts). Session state lives
// in httpOnly cookies the browser sends automatically — these functions
// return the user/tenant/membership payloads for the store to hold in memory,
// never a token (there isn't one to hold; see src/store/authStore.js).
export async function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password })
}

export async function signup({ name, email, password, workspaceName }) {
  return apiClient.post('/auth/signup', { name, email, password, workspaceName })
}

export async function checkInvite(token) {
  return apiClient.get(`/auth/invite?token=${encodeURIComponent(token)}`)
}

export async function acceptInvite({ token, password }) {
  return apiClient.post('/auth/accept-invite', { token, password })
}

export async function loginAsSuperAdmin({ email, password }) {
  return apiClient.post('/auth/admin-login', { email, password })
}

export async function logout() {
  await apiClient.post('/auth/logout')
}

export async function me() {
  return apiClient.get('/auth/me')
}

export async function updateProfile({ name, email }) {
  const { user } = await apiClient.patch('/auth/me', { name, email })
  return user
}

export async function updateWorkspace({ name }) {
  const { tenant } = await apiClient.patch('/tenant/me', { name })
  return tenant
}
