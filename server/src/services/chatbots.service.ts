import { chatbotsRepository } from '@/repositories/chatbots.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeChatbot } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { createChatbotSchema, updateChatbotSchema } from '@/validators/chatbots.validators.js'

export const chatbotsService = {
  async list(tenantId: string) {
    return (await chatbotsRepository.list(tenantId)).map(serializeChatbot)
  },

  async getById(tenantId: string, id: string) {
    const bot = await chatbotsRepository.findById(tenantId, id)
    if (!bot) throw ApiError.notFound('Chatbot not found')
    return serializeChatbot(bot)
  },

  async create(tenantId: string, input: z.infer<typeof createChatbotSchema>) {
    const count = await chatbotsRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'chatbotFlows', count)
    const bot = await chatbotsRepository.create(tenantId, input.name, input.nodes, input.edges)
    return serializeChatbot(bot)
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateChatbotSchema>) {
    const { nodes, edges, status, ...rest } = input
    const data: Record<string, unknown> = { ...rest }
    if (status) data.status = status.toUpperCase()
    const flow = nodes && edges ? { nodes, edges } : undefined
    const updated = await chatbotsRepository.update(tenantId, id, data, flow)
    if (!updated) throw ApiError.notFound('Chatbot not found')
    return serializeChatbot(updated)
  },

  async remove(tenantId: string, id: string) {
    const ok = await chatbotsRepository.delete(tenantId, id)
    if (!ok) throw ApiError.notFound('Chatbot not found')
  },
}
