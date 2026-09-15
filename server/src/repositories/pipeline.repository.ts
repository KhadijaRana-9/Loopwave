import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

// Every tenant gets exactly one pipeline today (created at signup — see
// auth.repository.ts). getOrCreateDefault is a safety net for tenants that
// somehow don't have one yet rather than a real multi-pipeline feature.
export const pipelineRepository = {
  async getOrCreateDefault(tenantId: string) {
    const existing = await prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { stages: { orderBy: { order: 'asc' } } },
    })
    if (existing) return existing
    return prisma.pipeline.create({
      data: {
        tenantId,
        name: 'Default Pipeline',
        isDefault: true,
        stages: {
          create: [
            { key: 'new', label: 'New', order: 0 },
            { key: 'qualified', label: 'Qualified', order: 1 },
            { key: 'contacted', label: 'Contacted', order: 2 },
            { key: 'interested', label: 'Interested', order: 3 },
            { key: 'demo_booked', label: 'Demo Booked', order: 4 },
            { key: 'converted', label: 'Converted', order: 5 },
            { key: 'lost', label: 'Lost', order: 6 },
          ],
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    })
  },

  listDeals(tenantId: string) {
    return prisma.deal.findMany({
      where: { tenantId },
      include: { contact: { select: { id: true, name: true, phone: true, source: true } }, stage: true },
      orderBy: { updatedAt: 'desc' },
    })
  },

  findById(tenantId: string, id: string) {
    return prisma.deal.findFirst({
      where: { id, tenantId },
      include: {
        contact: { select: { id: true, name: true, phone: true, source: true } },
        stage: true,
        notes: { orderBy: { createdAt: 'desc' } },
      },
    })
  },

  async create(tenantId: string, pipelineId: string, stageId: string, data: Omit<Prisma.DealUncheckedCreateInput, 'tenantId' | 'pipelineId' | 'stageId'>) {
    const deal = await prisma.deal.create({ data: { ...data, tenantId, pipelineId, stageId } })
    return this.findById(tenantId, deal.id)
  },

  async update(tenantId: string, id: string, data: Prisma.DealUncheckedUpdateInput) {
    const existing = await prisma.deal.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null
    await prisma.deal.update({ where: { id }, data })
    return this.findById(tenantId, id)
  },

  findStageByKey(pipelineId: string, key: string) {
    return prisma.pipelineStage.findUnique({ where: { pipelineId_key: { pipelineId, key } } })
  },

  addNote(dealId: string, authorId: string | undefined, text: string) {
    return prisma.dealNote.create({ data: { dealId, authorId, text } })
  },
}
