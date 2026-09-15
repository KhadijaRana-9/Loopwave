import { prisma } from '@/config/prisma.js'
import { authRepository } from '@/repositories/auth.repository.js'
import { teamRepository } from '@/repositories/team.repository.js'
import { hashPassword, verifyPassword } from '@/utils/password.js'
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiry, signAccessToken } from '@/utils/jwt.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { acceptInviteSchema, loginSchema, signupSchema } from '@/validators/auth.validators.js'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'workspace'
  let candidate = root
  let attempt = 0
  while (await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    attempt += 1
    candidate = `${root}-${attempt}`
  }
  return candidate
}

interface IssuedSession {
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

async function issueSession(params: {
  userId: string
  tenantId: string | null
  membershipId: string | null
  role: string | null
  platformRole: 'USER' | 'SUPER_ADMIN'
  ip?: string
}): Promise<IssuedSession> {
  const accessToken = signAccessToken({
    sub: params.userId,
    tenantId: params.tenantId,
    membershipId: params.membershipId,
    role: params.role,
    platformRole: params.platformRole,
  })
  const { token: refreshToken, hash } = generateRefreshToken()
  const refreshExpiresAt = refreshTokenExpiry()
  await authRepository.saveRefreshToken({ userId: params.userId, tokenHash: hash, expiresAt: refreshExpiresAt, createdByIp: params.ip })
  return { accessToken, refreshToken, refreshExpiresAt }
}

export const authService = {
  async signup(input: z.infer<typeof signupSchema>, ip?: string) {
    const existing = await authRepository.findUserByEmail(input.email)
    if (existing) throw ApiError.conflict('An account with this email already exists.')

    const passwordHash = await hashPassword(input.password)
    const user = await authRepository.createUser({ name: input.name, email: input.email, passwordHash })
    const slug = await uniqueSlug(input.workspaceName)
    const { tenant: tenantRow, membership, subscription } = await authRepository.createTenantWithOwner({
      tenantName: input.workspaceName,
      slug,
      userId: user.id,
      planId: 'trial',
    })
    const tenant = { ...tenantRow, subscription }

    const session = await issueSession({
      userId: user.id,
      tenantId: tenant.id,
      membershipId: membership.id,
      role: membership.role,
      platformRole: user.platformRole,
      ip,
    })

    return { user, tenant, membership, ...session }
  },

  async login(input: z.infer<typeof loginSchema>, ip?: string) {
    const user = await authRepository.findUserByEmailWithPrimaryMembership(input.email)
    if (!user) throw ApiError.unauthorized('Invalid email or password')

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) throw ApiError.unauthorized('Invalid email or password')

    const membership = user.memberships[0] ?? null
    if (!membership) throw ApiError.forbidden('This account has no active workspace. Ask an admin to invite you.')

    await authRepository.touchLastActive(user.id)

    const session = await issueSession({
      userId: user.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
      platformRole: user.platformRole,
      ip,
    })

    return { user, tenant: membership.tenant, membership, ...session }
  },

  async adminLogin(input: z.infer<typeof loginSchema>, ip?: string) {
    const user = await authRepository.findUserByEmail(input.email)
    if (!user || user.platformRole !== 'SUPER_ADMIN') throw ApiError.unauthorized('Invalid email or password')

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) throw ApiError.unauthorized('Invalid email or password')

    await authRepository.touchLastActive(user.id)

    const session = await issueSession({
      userId: user.id,
      tenantId: null,
      membershipId: null,
      role: null,
      platformRole: 'SUPER_ADMIN',
      ip,
    })

    return { user, ...session }
  },

  async refresh(rawToken: string, ip?: string) {
    const hash = hashRefreshToken(rawToken)
    const record = await authRepository.findValidRefreshToken(hash)
    if (!record) throw ApiError.unauthorized('Session expired, please sign in again')

    // Rotate: revoke the presented token and issue a fresh pair. Prevents a
    // stolen-but-unused refresh token from being replayed indefinitely.
    await authRepository.revokeRefreshToken(hash)

    const fullUser = await authRepository.findUserWithPrimaryMembership(record.userId)
    if (!fullUser) throw ApiError.unauthorized('Session expired, please sign in again')

    const membership = fullUser.memberships[0] ?? null

    const session = await issueSession({
      userId: fullUser.id,
      tenantId: membership?.tenantId ?? null,
      membershipId: membership?.id ?? null,
      role: membership?.role ?? null,
      platformRole: fullUser.platformRole,
      ip,
    })

    return { user: fullUser, tenant: membership?.tenant ?? null, ...session }
  },

  async logout(rawToken: string | undefined) {
    if (!rawToken) return
    await authRepository.revokeRefreshToken(hashRefreshToken(rawToken))
  },

  // The other half of teamService.invite: sets the invitee's real password
  // and flips their membership from INVITED to ACTIVE — before this, login
  // is impossible for an invited user (see rbac.test.ts, which is what
  // surfaced this gap) since findUserByEmailWithPrimaryMembership only
  // considers ACTIVE memberships.
  async acceptInvite(input: z.infer<typeof acceptInviteSchema>, ip?: string) {
    const membership = await teamRepository.findByInviteToken(input.token)
    if (!membership) throw ApiError.badRequest('This invite link is invalid or has already been used.')
    if (membership.inviteTokenExpiresAt && membership.inviteTokenExpiresAt < new Date()) {
      throw ApiError.badRequest('This invite link has expired. Ask an admin to send a new one.')
    }

    const passwordHash = await hashPassword(input.password)
    await teamRepository.acceptInvite(membership.id, passwordHash)
    await authRepository.touchLastActive(membership.userId)

    const session = await issueSession({
      userId: membership.userId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
      platformRole: membership.user.platformRole,
      ip,
    })

    return { user: membership.user, tenant: membership.tenant, membership: { ...membership, status: 'ACTIVE' as const }, ...session }
  },

  async updateProfile(userId: string, input: { name?: string; email?: string }) {
    if (input.email) {
      const existing = await authRepository.findUserByEmail(input.email)
      if (existing && existing.id !== userId) throw ApiError.conflict('This email is already in use.')
    }
    return authRepository.updateProfile(userId, input)
  },

  async me(userId: string, tenantId: string | null) {
    const user = await authRepository.findUserWithPrimaryMembership(userId)
    if (!user) throw ApiError.unauthorized()
    const membership = tenantId ? await authRepository.membershipFor(userId, tenantId) : (user.memberships[0] ?? null)
    const tenant = tenantId ? user.memberships.find((m) => m.tenantId === tenantId)?.tenant : user.memberships[0]?.tenant
    return { user, tenant: tenant ?? null, membership: membership ?? null }
  },
}
