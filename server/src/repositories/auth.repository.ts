import { prisma } from '@/config/prisma.js'
import type { TenantRole } from '@prisma/client'

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },

  findUserWithPrimaryMembership(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: { include: { subscription: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })
  },

  findUserByEmailWithPrimaryMembership(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { tenant: { include: { subscription: true } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    })
  },

  createUser(data: { name: string; email: string; passwordHash: string }) {
    return prisma.user.create({ data })
  },

  createTenantWithOwner(params: { tenantName: string; slug: string; userId: string; planId: string }) {
    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: params.tenantName,
          slug: params.slug,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
        },
      })

      const membership = await tx.membership.create({
        data: { tenantId: tenant.id, userId: params.userId, role: 'OWNER', status: 'ACTIVE' },
      })

      const subscription = await tx.subscription.create({
        data: { tenantId: tenant.id, planId: params.planId, status: 'TRIALING' },
      })

      const pipeline = await tx.pipeline.create({
        data: { tenantId: tenant.id, name: 'Default Pipeline', isDefault: true },
      })

      const defaultStages: { key: string; label: string }[] = [
        { key: 'new', label: 'New' },
        { key: 'qualified', label: 'Qualified' },
        { key: 'contacted', label: 'Contacted' },
        { key: 'interested', label: 'Interested' },
        { key: 'demo_booked', label: 'Demo Booked' },
        { key: 'converted', label: 'Converted' },
        { key: 'lost', label: 'Lost' },
      ]
      await tx.pipelineStage.createMany({
        data: defaultStages.map((s, i) => ({ pipelineId: pipeline.id, key: s.key, label: s.label, order: i })),
      })

      await tx.whatsAppAccount.create({ data: { tenantId: tenant.id, isDemoMode: true } })

      return { tenant, membership, subscription }
    })
  },

  saveRefreshToken(params: { userId: string; tokenHash: string; expiresAt: Date; createdByIp?: string }) {
    return prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
        createdByIp: params.createdByIp,
      },
    })
  },

  findValidRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    })
  },

  revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
  },

  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  },

  membershipFor(userId: string, tenantId: string) {
    return prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } })
  },

  touchLastActive(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
  },

  updateProfile(userId: string, data: { name?: string; email?: string }) {
    return prisma.user.update({ where: { id: userId }, data })
  },
}

export type TenantRoleValue = TenantRole
