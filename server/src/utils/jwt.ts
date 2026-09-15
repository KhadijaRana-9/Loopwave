import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { env } from '@/config/env.js'

export interface AccessTokenPayload {
  sub: string // userId
  tenantId: string | null
  membershipId: string | null
  role: string | null // TenantRole, null for platform-only super admin sessions
  platformRole: 'USER' | 'SUPER_ADMIN'
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
}

// Refresh tokens are random opaque strings, not JWTs — only their SHA-256
// hash is persisted, so a leaked database dump doesn't hand out live sessions.
export function generateRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('hex')
  const hash = hashRefreshToken(token)
  return { token, hash }
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiry(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_TTL)
  const amount = match?.[1] ? Number(match[1]) : 30
  const unit: 's' | 'm' | 'h' | 'd' = (match?.[2] as 's' | 'm' | 'h' | 'd' | undefined) ?? 'd'
  const unitMs: Record<'s' | 'm' | 'h' | 'd', number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return new Date(Date.now() + amount * unitMs[unit])
}
