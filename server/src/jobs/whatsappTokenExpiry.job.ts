import { Queue, Worker } from 'bullmq'
import { redisConnection, isRedisAvailable } from './redis.js'
import { checkExpiringWhatsAppTokens } from '@/services/whatsappTokenExpiry.service.js'

export const WHATSAPP_TOKEN_EXPIRY_QUEUE_NAME = 'whatsapp-token-expiry'
const DAILY_MS = 24 * 60 * 60 * 1000

// Schedules the recurring check. upsertJobScheduler is idempotent by its
// scheduler id, so calling this again on every worker restart replaces
// rather than stacks up duplicate schedules. No-ops honestly when Redis
// isn't reachable — same as the campaign queue's fallback pattern — rather
// than pretending a schedule exists.
export async function scheduleWhatsAppTokenExpiryCheck(): Promise<void> {
  if (!(await isRedisAvailable())) return
  const queue = new Queue(WHATSAPP_TOKEN_EXPIRY_QUEUE_NAME, { connection: redisConnection() })
  await queue.upsertJobScheduler('whatsapp-token-expiry-daily', { every: DAILY_MS }, { name: 'check' })
}

export function startWhatsAppTokenExpiryWorker() {
  return new Worker(
    WHATSAPP_TOKEN_EXPIRY_QUEUE_NAME,
    async () => {
      await checkExpiringWhatsAppTokens()
    },
    { connection: redisConnection() },
  )
}
