import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '@/utils/apiError.js'
import { verifyAccessToken } from '@/utils/jwt.js'
import { hasPermission, type Permission } from '@/config/permissions.js'

// Reads the access token from the httpOnly cookie set at login. A Bearer
// header is also accepted so non-browser clients (mobile, server-to-server,
// tests) don't need cookie support.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.access_token as string | undefined
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined
  const token = cookieToken ?? headerToken

  if (!token) return next(ApiError.unauthorized())

  try {
    req.auth = verifyAccessToken(token)
    next()
  } catch {
    next(ApiError.unauthorized('Session expired, please sign in again'))
  }
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.platformRole !== 'SUPER_ADMIN') return next(ApiError.forbidden('Super admin access required'))
  next()
}

// Business-app routes require an authenticated session that is scoped to a
// tenant (i.e. not a bare platform-admin session with no membership).
export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) return next(ApiError.forbidden('No active workspace for this session'))
  next()
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasPermission(req.auth?.role, permission)) {
      return next(ApiError.forbidden(`Missing permission: ${permission}`))
    }
    next()
  }
}
