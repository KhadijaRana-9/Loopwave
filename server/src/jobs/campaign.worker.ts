import { Worker } from 'bullmq'
import { redisConnection } from './redis.js'
import { CAMPAIGN_QUEUE_NAME } from './campaigns.queue.js'
import { dispatchCampaign } from '@/services/campaigns.service.js'
import { campaignsRepository } from '@/repositories/campaigns.repository.js'

export function startCampaignWorker() {
  return new Worker(
    CAMPAIGN_QUEUE_NAME,
    async (job) => {
      await campaignsRepository.update(job.data.tenantId, job.data.campaignId, { status: 'RUNNING', startedAt: new Date() })
      await dispatchCampaign(job.data.tenantId, job.data.campaignId)
    },
    { connection: redisConnection() },
  )
}
