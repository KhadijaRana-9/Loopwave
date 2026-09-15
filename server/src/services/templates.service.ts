import { templatesRepository } from '@/repositories/templates.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { ApiError } from '@/utils/apiError.js'
import type { z } from 'zod'
import type { createTemplateSchema, updateTemplateSchema } from '@/validators/templates.validators.js'

export const templatesService = {
  list(tenantId: string) {
    return templatesRepository.list(tenantId)
  },

  async create(tenantId: string, input: z.infer<typeof createTemplateSchema>) {
    const count = await templatesRepository.count(tenantId)
    await assertUnderLimit(tenantId, 'templates', count)
    return templatesRepository.create(tenantId, { ...input, status: 'DRAFT' })
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateTemplateSchema>) {
    const updated = await templatesRepository.update(tenantId, id, input)
    if (!updated) throw ApiError.notFound('Template not found')
    return updated
  },

  async submitForReview(tenantId: string, id: string) {
    const updated = await templatesRepository.update(tenantId, id, { status: 'PENDING' })
    if (!updated) throw ApiError.notFound('Template not found')
    return updated
  },

  async remove(tenantId: string, id: string) {
    const ok = await templatesRepository.delete(tenantId, id)
    if (!ok) throw ApiError.notFound('Template not found')
  },
}
