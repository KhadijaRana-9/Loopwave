import { prisma } from '@/config/prisma.js'
import type { TenantRole } from '@prisma/client'

export const teamRepository = {
  listMembers(tenantId: string) {
    return prisma.membership.findMany({
      where: { tenantId, status: { not: 'DISABLED' } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
  },

  findMembershipByUserEmail(tenantId: string, email: string) {
    return prisma.membership.findFirst({ where: { tenantId, user: { email } } })
  },

  findMembershipByUserId(tenantId: string, userId: string) {
    return prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, include: { user: true } })
  },

  count(tenantId: string) {
    return prisma.membership.count({ where: { tenantId, status: { not: 'DISABLED' } } })
  },

  async createInvite(tenantId: string, params: { name: string; email: string; role: TenantRole; passwordHash: string; inviteToken: string }) {
    const user = await prisma.user.upsert({
      where: { email: params.email },
      create: { name: params.name, email: params.email, passwordHash: params.passwordHash },
      update: {},
    })
    const inviteTokenExpiresAt = new Date(Date.now() + 7 * 86_400_000)
    const membership = await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role: params.role, status: 'INVITED', inviteToken: params.inviteToken, inviteTokenExpiresAt },
      update: { role: params.role, status: 'INVITED', inviteToken: params.inviteToken, inviteTokenExpiresAt },
      include: { user: true },
    })
    return membership
  },

  findByInviteToken(token: string) {
    return prisma.membership.findUnique({
      where: { inviteToken: token },
      include: { user: true, tenant: { include: { subscription: true } } },
    })
  },

  async acceptInvite(membershipId: string, passwordHash: string) {
    const membership = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } })
    await prisma.$transaction([
      prisma.user.update({ where: { id: membership.userId }, data: { passwordHash } }),
      prisma.membership.update({ where: { id: membershipId }, data: { status: 'ACTIVE', inviteToken: null, inviteTokenExpiresAt: null } }),
    ])
  },

  updateRole(tenantId: string, userId: string, role: TenantRole) {
    return prisma.membership.update({ where: { tenantId_userId: { tenantId, userId } }, data: { role }, include: { user: true } })
  },

  async remove(tenantId: string, userId: string) {
    const result = await prisma.membership.deleteMany({ where: { tenantId, userId, role: { not: 'OWNER' } } })
    return result.count > 0
  },
}
