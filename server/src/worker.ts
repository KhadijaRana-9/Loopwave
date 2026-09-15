// Standalone background-job process — run alongside the API server in
// production (`npm run worker`) once REDIS_URL points at a real Redis
// instance. The API server works fine without this running (campaigns.service.ts
// falls back to direct in-process dispatch when Redis is unreachable), but a
// scheduled send only survives a server restart when this worker is running.
import { startCampaignWorker } from '@/jobs/campaign.worker.js'
import { prisma } from '@/config/prisma.js'

const worker = startCampaignWorker()
console.log('Loopwave campaign worker started, listening for jobs...')

worker.on('failed', (job, err) => {
  console.error(`Campaign job ${job?.id} failed:`, err)
})

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down worker...`)
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
