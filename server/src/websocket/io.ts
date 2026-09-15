import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { env } from '@/config/env.js'
import { verifyAccessToken } from '@/utils/jwt.js'

let io: Server | null = null

function parseCookie(header: string, name: string): string | undefined {
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

// Every real-time feature (new inbox messages, assignment changes, campaign
// progress, notifications) is scoped to a `tenant:{tenantId}` room so one
// workspace's socket connection can never observe another's events — the
// same tenant-isolation rule as the REST API, applied to the realtime layer.
export function initIo(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.WEB_APP_URL, credentials: true },
    path: '/socket.io',
  })

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? ''
      const token = parseCookie(cookieHeader, 'access_token') ?? (socket.handshake.auth?.token as string | undefined)
      if (!token) return next(new Error('Unauthorized'))
      socket.data.auth = verifyAccessToken(token)
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const auth = socket.data.auth as { tenantId: string | null; sub: string } | undefined
    if (auth?.tenantId) socket.join(`tenant:${auth.tenantId}`)
    if (auth?.sub) socket.join(`user:${auth.sub}`)
  })

  return io
}

export function getIo(): Server | null {
  return io
}
