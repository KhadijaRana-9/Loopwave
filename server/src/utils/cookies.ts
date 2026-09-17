import type { Response } from 'express'
import { env, isProduction } from '@/config/env.js'

const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'

// httpOnly stops JS-based reads. In production the frontend (Vercel) and API
// (Railway) are on different registrable domains, so the cookie is
// necessarily cross-site from the browser's perspective — SameSite=Lax would
// never be attached to the fetch()/XHR calls apiClient.js makes with
// credentials:'include', breaking auth immediately after login. SameSite=None
// requires Secure, which is already forced on in production; CORS (locked to
// the single WEB_APP_URL origin, credentials:true) is the actual access
// control here, not SameSite. Locally, frontend and API are both `localhost`
// (same site regardless of port), so Lax is kept there.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as const,
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
  }
}

export function setSessionCookies(res: Response, tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date }) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseCookieOptions(), maxAge: 15 * 60_000, path: '/' })
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions(),
    expires: tokens.refreshExpiresAt,
    path: '/api/auth',
  })
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), path: '/' })
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), path: '/api/auth' })
}

export const COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE }
