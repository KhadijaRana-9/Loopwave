import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}
export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export const chatbotsRepository = {
  list(tenantId: string) {
    return prisma.chatbot.findMany({ where: { tenantId }, include: { nodes: true, edges: true }, orderBy: { updatedAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.chatbot.findFirst({ where: { id, tenantId }, include: { nodes: true, edges: true } })
  },

  count(tenantId: string) {
    return prisma.chatbot.count({ where: { tenantId } })
  },

  async create(tenantId: string, name: string, nodes: FlowNode[], edges: FlowEdge[]) {
    const bot = await prisma.chatbot.create({
      data: {
        tenantId,
        name,
        nodes: { create: nodes.map((n) => ({ nodeKey: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: n.data as Prisma.InputJsonValue })) },
        edges: { create: edges.map((e) => ({ edgeKey: e.id, source: e.source, target: e.target, label: e.label })) },
      },
      include: { nodes: true, edges: true },
    })
    return bot
  },

  async update(tenantId: string, id: string, data: Prisma.ChatbotUncheckedUpdateInput, flow?: { nodes: FlowNode[]; edges: FlowEdge[] }) {
    const existing = await prisma.chatbot.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null

    await prisma.$transaction(async (tx) => {
      await tx.chatbot.update({ where: { id }, data })
      if (flow) {
        await tx.chatbotNode.deleteMany({ where: { chatbotId: id } })
        await tx.chatbotEdge.deleteMany({ where: { chatbotId: id } })
        if (flow.nodes.length) {
          await tx.chatbotNode.createMany({
            data: flow.nodes.map((n) => ({ chatbotId: id, nodeKey: n.id, type: n.type, positionX: n.position.x, positionY: n.position.y, data: n.data as Prisma.InputJsonValue })),
          })
        }
        if (flow.edges.length) {
          await tx.chatbotEdge.createMany({ data: flow.edges.map((e) => ({ chatbotId: id, edgeKey: e.id, source: e.source, target: e.target, label: e.label })) })
        }
      }
    })

    return this.findById(tenantId, id)
  },

  async delete(tenantId: string, id: string) {
    const result = await prisma.chatbot.deleteMany({ where: { id, tenantId } })
    return result.count > 0
  },
}
