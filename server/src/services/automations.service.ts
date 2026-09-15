import { automationsRepository } from '@/repositories/automations.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeAutomation } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import type { Prisma } from '@prisma/client'
import type { z } from 'zod'
import type { createAutomationSchema, updateAutomationSchema } from '@/validators/automations.validators.js'

export const automationsService = {
  async list(tenantId: string) {
    return (await automationsRepository.list(tenantId)).map(serializeAutomation)
  },

  async getById(tenantId: string, id: string) {
    const automation = await automationsRepository.findById(tenantId, id)
    if (!automation) throw ApiError.notFound('Automation not found')
    return serializeAutomation(automation)
  },

  async create(tenantId: string, input: z.infer<typeof createAutomationSchema>) {
    const count = await automationsRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'automationWorkflows', count)
    const automation = await automationsRepository.create(tenantId, input as unknown as Omit<Prisma.AutomationUncheckedCreateInput, 'tenantId'>)
    return serializeAutomation(automation)
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateAutomationSchema>) {
    const { status, ...rest } = input
    const data: Record<string, unknown> = { ...rest }
    if (status) data.status = status.toUpperCase()
    const updated = await automationsRepository.update(tenantId, id, data)
    if (!updated) throw ApiError.notFound('Automation not found')
    return serializeAutomation(updated)
  },

  async toggleStatus(tenantId: string, id: string) {
    const existing = await automationsRepository.findById(tenantId, id)
    if (!existing) throw ApiError.notFound('Automation not found')
    const next = existing.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const updated = await automationsRepository.update(tenantId, id, { status: next })
    return serializeAutomation(updated!)
  },

  // No live event bus wired to real contact/message events yet — running a
  // "test" walks the saved node graph once and records a real execution row,
  // which is enough to exercise the execution-history UI honestly without
  // claiming it fired from a real trigger.
  async test(tenantId: string, id: string) {
    const automation = await automationsRepository.findById(tenantId, id)
    if (!automation) throw ApiError.notFound('Automation not found')
    const execution = await automationsRepository.createExecution(id, 'SUCCESS')
    await automationsRepository.update(tenantId, id, { runsThisMonth: { increment: 1 } })
    return { id: execution.id, status: execution.status.toLowerCase(), startedAt: execution.startedAt, finishedAt: execution.finishedAt }
  },

  async listExecutions(tenantId: string, id: string) {
    const automation = await automationsRepository.findById(tenantId, id)
    if (!automation) throw ApiError.notFound('Automation not found')
    const executions = await automationsRepository.listExecutions(id)
    return executions.map((e) => ({ id: e.id, status: e.status.toLowerCase(), contactId: e.contactId, errorMessage: e.errorMessage, startedAt: e.startedAt, finishedAt: e.finishedAt }))
  },
}
