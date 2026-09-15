import type { Response } from 'express'
import { env, isProduction } from '@/config/env.js'

const ACCESS_COOKIE = 'access_token'
const REFRESH_COOKIE = 'refresh_token'

// httpOnly + sameSite=lax stops JS-based and cross-site CSRF-style reads;
// `secure` is forced on in production (cookies must travel over HTTPS there).
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
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
