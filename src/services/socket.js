import { io } from 'socket.io-client'

// Session auth travels via the same httpOnly cookies as the REST API
// (withCredentials sends them cross-origin to the :4000 dev server) — no
// token handling needed here, matching apiClient.js's approach.
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

let socket = null

export function getSocket() {
  socket ??= io(SOCKET_URL, { withCredentials: true, path: '/socket.io' })
  return socket
}
