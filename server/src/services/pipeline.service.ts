import { pipelineRepository } from '@/repositories/pipeline.repository.js'
import { attachAuthorNames, resolveAuthorName } from '@/utils/notes.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'
import type { z } from 'zod'
import type { createDealSchema, updateDealSchema } from '@/validators/pipeline.validators.js'

function serializeDeal(deal: NonNullable<Awaited<ReturnType<typeof pipelineRepository.findById>>>) {
  return {
    id: deal.id,
    contactId: deal.contactId,
    title: deal.title,
    stage: deal.stage.key,
    value: deal.value,
    probability: deal.probability,
    source: deal.source ?? deal.contact.source ?? null,
    tags: (deal.tags as string[]) ?? [],
    assignedAgentId: deal.assignedAgentId,
    expectedCloseDate: deal.expectedCloseDate,
    updatedAt: deal.updatedAt,
    createdAt: deal.createdAt,
    contact: deal.contact,
  }
}

export const pipelineService = {
  async listStages(tenantId: string) {
    const pipeline = await pipelineRepository.getOrCreateDefault(tenantId)
    return pipeline.stages.map((s) => ({ id: s.key, label: s.label, order: s.order }))
  },

  async listDeals(tenantId: string) {
    const deals = await pipelineRepository.listDeals(tenantId)
    return deals.map((d) => ({
      id: d.id,
      contactId: d.contactId,
      title: d.title,
      stage: d.stage.key,
      value: d.value,
      source: d.source ?? d.contact.source ?? null,
      tags: (d.tags as string[]) ?? [],
      assignedAgentId: d.assignedAgentId,
      updatedAt: d.updatedAt,
      contact: d.contact,
    }))
  },

  async getById(tenantId: string, id: string) {
    const deal = await pipelineRepository.findById(tenantId, id)
    if (!deal) throw ApiError.notFound('Deal not found')
    const notesWithAuthors = await attachAuthorNames(deal.notes)
    return { ...serializeDeal(deal), notes: notesWithAuthors }
  },

  async create(tenantId: string, input: z.infer<typeof createDealSchema>) {
    const pipeline = await pipelineRepository.getOrCreateDefault(tenantId)
    const contact = await prisma.contact.findFirst({ where: { id: input.contactId, tenantId } })
    if (!contact) throw ApiError.notFound('Contact not found')

    const dealCount = await prisma.deal.count({ where: { tenantId } })
    await assertUnderLimit(tenantId, 'deals', dealCount)

    const stageKey = input.stage ?? pipeline.stages[0]?.key ?? 'new'
    const stage = pipeline.stages.find((s) => s.key === stageKey)
    if (!stage) throw ApiError.badRequest('Unknown pipeline stage')

    const deal = await pipelineRepository.create(tenantId, pipeline.id, stage.id, {
      contactId: input.contactId,
      title: input.title,
      value: input.value,
      assignedAgentId: input.assignedAgentId,
      tags: input.tags,
      source: contact.source,
      expectedCloseDate: input.expectedCloseDate,
    })
    return { ...serializeDeal(deal!), notes: [] }
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateDealSchema>) {
    const { stage, ...rest } = input
    const data: Record<string, unknown> = { ...rest }

    if (stage) {
      const existing = await prisma.deal.findFirst({ where: { id, tenantId }, select: { pipelineId: true } })
      if (!existing) throw ApiError.notFound('Deal not found')
      const stageRow = await pipelineRepository.findStageByKey(existing.pipelineId, stage)
      if (!stageRow) throw ApiError.badRequest('Unknown pipeline stage')
      data.stageId = stageRow.id
    }

    const updated = await pipelineRepository.update(tenantId, id, data)
    if (!updated) throw ApiError.notFound('Deal not found')
    const notesWithAuthors = await attachAuthorNames(updated.notes)
    return { ...serializeDeal(updated), notes: notesWithAuthors }
  },

  async addNote(tenantId: string, dealId: string, authorId: string | undefined, text: string) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId }, select: { id: true } })
    if (!deal) throw ApiError.notFound('Deal not found')
    const note = await pipelineRepository.addNote(dealId, authorId, text)
    const author = await resolveAuthorName(authorId)
    return { id: note.id, text: note.text, createdAt: note.createdAt, author }
  },
}
