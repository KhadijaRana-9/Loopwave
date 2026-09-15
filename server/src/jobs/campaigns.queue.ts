import { Queue } from 'bullmq'
import { redisConnection, isRedisAvailable } from './redis.js'

export const CAMPAIGN_QUEUE_NAME = 'campaign-send'

let queue: Queue | null = null

// Real production path: enqueues onto BullMQ/Redis so sending survives a
// server restart and runs in the dedicated worker process (see
// campaign.worker.ts, started via `npm run worker`). Returns false when
// Redis isn't reachable so the caller can fall back to direct in-process
// dispatch — never silently drops the send.
export async function enqueueCampaignSend(tenantId: string, campaignId: string, delayMs = 0): Promise<boolean> {
  if (!(await isRedisAvailable())) return false
  queue ??= new Queue(CAMPAIGN_QUEUE_NAME, { connection: redisConnection() })
  await queue.add('send', { tenantId, campaignId }, { delay: delayMs, removeOnComplete: true, removeOnFail: 100 })
  return true
}
