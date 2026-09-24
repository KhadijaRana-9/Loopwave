import type { Request, Response } from 'express'
import { prisma } from '@/config/prisma.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeNotification } from '@/utils/serializers.js'

function requireAuthCtx(req: Request) {
  if (!req.auth?.tenantId || !req.auth.sub) throw ApiError.forbidden('No active workspace for this session')
  return { tenantId: req.auth.tenantId, userId: req.auth.sub }
}

// Real, persisted per-user-per-workspace preferences (Membership.notificationPreferences)
// — a fresh membership has no stored keys yet, so these are the fallback
// values a brand-new member sees before ever touching a toggle.
const DEFAULT_NOTIFICATION_PREFERENCES = { newLead: true, campaignComplete: true, weeklyReport: false, mentions: true }

export const notificationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = requireAuthCtx(req)
    const notifications = await prisma.notification.findMany({
      where: { tenantId, OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const unreadCount = await prisma.notification.count({ where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null } })
    res.json({ notifications: notifications.map(serializeNotification), unreadCount })
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = requireAuthCtx(req)
    await prisma.notification.updateMany({ where: { id: req.params.id as string, tenantId }, data: { readAt: new Date() } })
    res.status(204).send()
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = requireAuthCtx(req)
    await prisma.notification.updateMany({ where: { tenantId, OR: [{ userId }, { userId: null }], readAt: null }, data: { readAt: new Date() } })
    res.status(204).send()
  }),

  getPreferences: asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = requireAuthCtx(req)
    const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { notificationPreferences: true } })
    res.json({ preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, ...((membership?.notificationPreferences as Record<string, boolean>) ?? {}) } })
  }),

  updatePreferences: asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = requireAuthCtx(req)
    const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } } })
    if (!membership) throw ApiError.forbidden('No active membership for this workspace')
    const current = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...((membership.notificationPreferences as Record<string, boolean>) ?? {}) }
    const updated = { ...current, ...req.body }
    await prisma.membership.update({ where: { id: membership.id }, data: { notificationPreferences: updated } })
    res.json({ preferences: updated })
  }),
}
