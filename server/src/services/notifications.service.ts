import { prisma } from '@/config/prisma.js'
import { getIo } from '@/websocket/io.js'
import { serializeNotification } from '@/utils/serializers.js'

export async function notifyUser(tenantId: string, userId: string | null, input: { category: string; title: string; body?: string }) {
  const notification = await prisma.notification.create({
    data: { tenantId, userId, category: input.category, title: input.title, body: input.body },
  })
  const serialized = serializeNotification(notification)
  getIo()
    ?.to(userId ? `user:${userId}` : `tenant:${tenantId}`)
    .emit('notification:new', serialized)
  return serialized
}

export async function notifyTenant(tenantId: string, input: { category: string; title: string; body?: string }) {
  return notifyUser(tenantId, null, input)
}
