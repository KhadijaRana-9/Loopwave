import { campaignsRepository } from '@/repositories/campaigns.repository.js'
import { sendWhatsAppMessage, scheduleDemoRecipientProgression } from '@/integrations/whatsapp.adapter.js'
import { recordUsage } from '@/services/usage.service.js'
import { notifyTenant } from '@/services/notifications.service.js'
import { enqueueCampaignSend } from '@/jobs/campaigns.queue.js'
import { serializeTemplate } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'
import type { z } from 'zod'
import type { createCampaignSchema } from '@/validators/campaigns.validators.js'
import type { Campaign, Template } from '@prisma/client'

type CampaignWithTemplate = Campaign & { template: Template }

async function serialize(campaign: CampaignWithTemplate) {
  const stats = await campaignsRepository.stats(campaign.id)
  return {
    id: campaign.id,
    name: campaign.name,
    templateId: campaign.templateId,
    template: serializeTemplate(campaign.template),
    status: campaign.status.toLowerCase(),
    audienceFilter: campaign.audienceFilter,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    ...stats,
  }
}

// Actually delivers the campaign: fetches every still-pending recipient,
// sends through the WhatsApp adapter (real Cloud API if configured, an
// honestly-labeled demo simulation otherwise), and persists a real status
// per recipient — nothing here is a fabricated success count. Exported so
// both the in-process fallback below and the BullMQ worker (jobs/campaign.worker.ts)
// call the exact same delivery logic.
export async function dispatchCampaign(tenantId: string, campaignId: string) {
  const campaign = await campaignsRepository.findById(tenantId, campaignId)
  if (!campaign) return

  const pending = await campaignsRepository.pendingRecipients(campaignId)
  const contacts = await prisma.contact.findMany({ where: { id: { in: pending.map((r) => r.contactId) } }, select: { id: true, phone: true } })
  const phoneById = new Map(contacts.map((c) => [c.id, c.phone]))

  for (const recipient of pending) {
    const phone = phoneById.get(recipient.contactId)
    if (!phone) {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: 'Contact has no phone number on file' })
      continue
    }
    const result = await sendWhatsAppMessage({ to: phone, text: campaign.template.body })
    if (result.status === 'SENT') {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'SENT', waMessageId: result.waMessageId || null, sentAt: new Date() })
      if (result.demo) scheduleDemoRecipientProgression(recipient.id)
    } else {
      await campaignsRepository.updateRecipient(recipient.id, { status: 'FAILED', errorMessage: result.errorMessage })
    }
  }

  if (pending.length) await recordUsage(tenantId, 'monthlyMarketingMessages', pending.length)
  await campaignsRepository.update(tenantId, campaignId, { status: 'COMPLETED', completedAt: new Date() })
  await notifyTenant(tenantId, {
    category: 'campaign_completed',
    title: `Campaign "${campaign.name}" completed`,
    body: `${pending.length} message${pending.length === 1 ? '' : 's'} sent.`,
  })
}

// Delayed sends fall back to an in-process timer when Redis/BullMQ isn't
// reachable — it works for the lifetime of this server process but doesn't
// survive a restart. The real production path is jobs/campaigns.queue.ts +
// the dedicated worker (npm run worker), tried first in scheduleSend below.
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleFutureSendFallback(tenantId: string, campaignId: string, atMs: number) {
  const delay = Math.max(0, atMs - Date.now())
  const timer = setTimeout(() => {
    scheduledTimers.delete(campaignId)
    campaignsRepository
      .update(tenantId, campaignId, { status: 'RUNNING', startedAt: new Date() })
      .then(() => dispatchCampaign(tenantId, campaignId))
      .catch(() => {})
  }, delay)
  scheduledTimers.set(campaignId, timer)
}

async function scheduleSend(tenantId: string, campaignId: string, sendAtMs: number) {
  const delayMs = Math.max(0, sendAtMs - Date.now())
  const queued = await enqueueCampaignSend(tenantId, campaignId, delayMs)
  if (queued) return

  if (delayMs <= 5000) {
    await campaignsRepository.update(tenantId, campaignId, { status: 'RUNNING', startedAt: new Date() })
    void dispatchCampaign(tenantId, campaignId)
  } else {
    await campaignsRepository.update(tenantId, campaignId, { status: 'SCHEDULED' })
    scheduleFutureSendFallback(tenantId, campaignId, sendAtMs)
  }
}

export const campaignsService = {
  async list(tenantId: string) {
    return Promise.all((await campaignsRepository.list(tenantId)).map(serialize))
  },

  async getById(tenantId: string, id: string) {
    const campaign = await campaignsRepository.findById(tenantId, id)
    if (!campaign) throw ApiError.notFound('Campaign not found')
    return serialize(campaign)
  },

  async create(tenantId: string, input: z.infer<typeof createCampaignSchema>) {
    const template = await prisma.template.findFirst({ where: { id: input.templateId, tenantId } })
    if (!template) throw ApiError.notFound('Template not found')

    const audience = await campaignsRepository.resolveAudience(tenantId, input.audienceFilter)
    const campaign = await campaignsRepository.create(tenantId, {
      name: input.name,
      templateId: input.templateId,
      audienceFilter: input.audienceFilter,
      scheduledAt: input.scheduledAt,
      status: 'DRAFT',
    })
    if (audience.length) await campaignsRepository.createRecipients(campaign.id, audience.map((c) => c.id))

    const sendAtMs = input.scheduledAt ? new Date(input.scheduledAt).getTime() : Date.now()
    await scheduleSend(tenantId, campaign.id, sendAtMs)

    const final = await campaignsRepository.findById(tenantId, campaign.id)
    return serialize(final!)
  },

  async duplicate(tenantId: string, id: string) {
    const source = await campaignsRepository.findById(tenantId, id)
    if (!source) throw ApiError.notFound('Campaign not found')
    const audience = await campaignsRepository.resolveAudience(tenantId, source.audienceFilter as { tags?: string[]; sources?: string[]; statuses?: string[] })
    const copy = await campaignsRepository.create(tenantId, {
      name: `${source.name} (copy)`,
      templateId: source.templateId,
      audienceFilter: source.audienceFilter as object,
      status: 'DRAFT',
    })
    if (audience.length) await campaignsRepository.createRecipients(copy.id, audience.map((c) => c.id))
    return serialize(copy)
  },

  async cancelScheduled(tenantId: string, id: string) {
    const existing = await campaignsRepository.findById(tenantId, id)
    if (!existing) throw ApiError.notFound('Campaign not found')
    if (existing.status !== 'SCHEDULED') throw ApiError.badRequest('Only scheduled campaigns can be cancelled')
    const timer = scheduledTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      scheduledTimers.delete(id)
    }
    const updated = await campaignsRepository.update(tenantId, id, { status: 'DRAFT', scheduledAt: null })
    return serialize(updated!)
  },
}
