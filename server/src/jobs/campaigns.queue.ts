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
  await queue.add('send', { tenantId, campaignId }, { delay: delayMs, removeOnComplete: true, removeOnFail: 100, jobId: campaignId })
  return true
}

// Cancelling a scheduled campaign must actually remove the delayed BullMQ
// job, not just flip the DB status back to draft — otherwise the job still
// fires at its original time and sends anyway. jobId is set to the
// campaignId above specifically so this lookup is a direct get, not a scan.
export async function removeCampaignSend(campaignId: string): Promise<void> {
  if (!(await isRedisAvailable())) return
  queue ??= new Queue(CAMPAIGN_QUEUE_NAME, { connection: redisConnection() })
  const job = await queue.getJob(campaignId)
  if (job) await job.remove().catch(() => {})
}
