import type { Request, Response } from 'express'
import { prisma } from '@/config/prisma.js'
import { asyncHandler } from '@/utils/asyncHandler.js'
import { ApiError } from '@/utils/apiError.js'
import { serializeNotification } from '@/utils/serializers.js'

function requireAuthCtx(req: Request) {
  if (!req.auth?.tenantId || !req.auth.sub) throw ApiError.forbidden('No active workspace for this session')
  return { tenantId: req.auth.tenantId, userId: req.auth.sub }
}

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
}
