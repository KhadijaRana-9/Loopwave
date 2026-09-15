import type { Request, Response } from 'express'
import { authService } from '@/services/auth.service.js'
import { teamRepository } from '@/repositories/team.repository.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { setSessionCookies, clearSessionCookies, COOKIE_NAMES } from '@/utils/cookies.js'
import { serializeMembership, serializeTenant, serializeUser } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.signup(req.body, req.ip)
    setSessionCookies(res, result)
    res.status(201).json({
      user: serializeUser(result.user, result.membership.role),
      tenant: serializeTenant(result.tenant),
      membership: serializeMembership(result.membership),
    })
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, req.ip)
    setSessionCookies(res, result)
    res.json({
      user: serializeUser(result.user, result.membership.role),
      tenant: serializeTenant(result.tenant),
      membership: serializeMembership(result.membership),
    })
  }),

  adminLogin: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.adminLogin(req.body, req.ip)
    setSessionCookies(res, result)
    res.json({ user: serializeUser(result.user, null), tenant: null, membership: null })
  }),

  checkInvite: asyncHandler(async (req: Request, res: Response) => {
    const membership = await teamRepository.findByInviteToken(req.query.token as string)
    if (!membership || (membership.inviteTokenExpiresAt && membership.inviteTokenExpiresAt < new Date())) {
      throw ApiError.notFound('This invite link is invalid or has expired.')
    }
    res.json({ name: membership.user.name, email: membership.user.email, workspaceName: membership.tenant.name, role: membership.role.toLowerCase() })
  }),

  acceptInvite: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.acceptInvite(req.body, req.ip)
    setSessionCookies(res, result)
    res.json({
      user: serializeUser(result.user, result.membership.role),
      tenant: serializeTenant(result.tenant),
      membership: serializeMembership(result.membership),
    })
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.cookies?.[COOKIE_NAMES.REFRESH_COOKIE] as string | undefined
    if (!raw) throw ApiError.unauthorized('No session to refresh')
    const result = await authService.refresh(raw, req.ip)
    setSessionCookies(res, result)
    const membership = result.user.memberships[0] ?? null
    res.json({
      user: serializeUser(result.user, membership?.role ?? null),
      tenant: serializeTenant(result.tenant),
      membership: serializeMembership(membership),
    })
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const raw = req.cookies?.[COOKIE_NAMES.REFRESH_COOKIE] as string | undefined
    await authService.logout(raw)
    clearSessionCookies(res)
    res.status(204).send()
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized()
    const { user, tenant, membership } = await authService.me(req.auth.sub, req.auth.tenantId)
    res.json({
      user: serializeUser(user, membership?.role ?? null),
      tenant: serializeTenant(tenant),
      membership: serializeMembership(membership),
    })
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized()
    const user = await authService.updateProfile(req.auth.sub, req.body)
    res.json({ user: serializeUser(user, req.auth.role) })
  }),
}
