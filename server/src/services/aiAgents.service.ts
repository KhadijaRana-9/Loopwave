import { aiAgentsRepository } from '@/repositories/aiAgents.repository.js'
import { generateAgentReply } from '@/integrations/ai.adapter.js'
import { recordUsage } from '@/services/usage.service.js'
import { serializeAiAgent } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { createAiAgentSchema, testConversationSchema, updateAiAgentSchema } from '@/validators/aiAgents.validators.js'

export const aiAgentsService = {
  async list(tenantId: string) {
    return (await aiAgentsRepository.list(tenantId)).map(serializeAiAgent)
  },

  async getById(tenantId: string, id: string) {
    const agent = await aiAgentsRepository.findById(tenantId, id)
    if (!agent) throw ApiError.notFound('AI agent not found')
    return serializeAiAgent(agent)
  },

  async create(tenantId: string, input: z.infer<typeof createAiAgentSchema>) {
    const { faqs, ...rest } = input
    const agent = await aiAgentsRepository.create(tenantId, rest, faqs)
    return serializeAiAgent(agent)
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateAiAgentSchema>) {
    const { faqs, status, ...rest } = input
    const data: Record<string, unknown> = { ...rest }
    if (status) data.status = status.toUpperCase()
    const updated = await aiAgentsRepository.update(tenantId, id, data, faqs)
    if (!updated) throw ApiError.notFound('AI agent not found')
    return serializeAiAgent(updated)
  },

  async testConversation(tenantId: string, id: string, input: z.infer<typeof testConversationSchema>) {
    const agent = await aiAgentsRepository.findById(tenantId, id)
    if (!agent) throw ApiError.notFound('AI agent not found')

    const result = await generateAgentReply(
      {
        name: agent.name,
        description: agent.description,
        personality: agent.personality,
        businessInfo: agent.businessInfo,
        goals: agent.goals as string[],
        qualificationQuestions: agent.qualificationQuestions as string[],
        handoffRules: agent.handoffRules,
        faqs: agent.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      },
      input.history,
      input.message,
    )

    await recordUsage(tenantId, 'aiUsage')
    return result
  },
}
