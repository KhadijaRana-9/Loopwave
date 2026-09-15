// Talks to the real Loopwave backend (server/). Unlike simulateRequest in
// http.js, this hits an actual API over the network, so callers get real
// errors (network failures, validation errors, 401s) instead of simulated ones.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export class ApiRequestError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.details = details
  }
}

let refreshInFlight = null

async function tryRefresh() {
  refreshInFlight ??= fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' }).finally(() => {
    refreshInFlight = null
  })
  const res = await refreshInFlight
  return res.ok
}

async function request(path, { method = 'GET', body, retryOn401 = true } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include', // send/receive the httpOnly session cookies
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retryOn401 && path !== '/auth/refresh' && path !== '/auth/login') {
    const refreshed = await tryRefresh()
    if (refreshed) return request(path, { method, body, retryOn401: false })
  }

  if (res.status === 204) return null

  let payload = null
  try {
    payload = await res.json()
  } catch {
    // empty/non-JSON body — payload stays null
  }

  if (!res.ok) {
    const error = payload?.error
    throw new ApiRequestError(error?.message || 'Something went wrong. Please try again.', {
      status: res.status,
      code: error?.code,
      details: error?.details,
    })
  }

  return payload
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
