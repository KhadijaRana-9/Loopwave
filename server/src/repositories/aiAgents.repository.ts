import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const aiAgentsRepository = {
  list(tenantId: string) {
    return prisma.aIAgent.findMany({ where: { tenantId }, include: { faqs: true }, orderBy: { createdAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.aIAgent.findFirst({ where: { id, tenantId }, include: { faqs: true, knowledge: true } })
  },

  count(tenantId: string) {
    return prisma.aIAgent.count({ where: { tenantId } })
  },

  async create(tenantId: string, data: Omit<Prisma.AIAgentUncheckedCreateInput, 'tenantId'>, faqs: { question: string; answer: string }[]) {
    const agent = await prisma.aIAgent.create({
      data: { ...data, tenantId, faqs: { create: faqs } },
      include: { faqs: true },
    })
    return agent
  },

  async update(tenantId: string, id: string, data: Prisma.AIAgentUncheckedUpdateInput, faqs?: { question: string; answer: string }[]) {
    const existing = await prisma.aIAgent.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null
    await prisma.$transaction(async (tx) => {
      await tx.aIAgent.update({ where: { id }, data })
      if (faqs) {
        await tx.aIAgentFaq.deleteMany({ where: { agentId: id } })
        if (faqs.length) await tx.aIAgentFaq.createMany({ data: faqs.map((f) => ({ agentId: id, ...f })) })
      }
    })
    return this.findById(tenantId, id)
  },

  incrementConversations(id: string) {
    return prisma.aIAgent.update({ where: { id }, data: { conversationsHandled: { increment: 1 } } })
  },
}
