import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const formsRepository = {
  list(tenantId: string) {
    return prisma.form.findMany({ where: { tenantId }, include: { _count: { select: { submissions: true } } }, orderBy: { createdAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.form.findFirst({ where: { id, tenantId }, include: { _count: { select: { submissions: true } } } })
  },

  create(tenantId: string, data: Omit<Prisma.FormUncheckedCreateInput, 'tenantId'>) {
    return prisma.form.create({ data: { ...data, tenantId }, include: { _count: { select: { submissions: true } } } })
  },

  async update(tenantId: string, id: string, data: Prisma.FormUncheckedUpdateInput) {
    const existing = await prisma.form.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) return null
    return prisma.form.update({ where: { id }, data, include: { _count: { select: { submissions: true } } } })
  },

  async delete(tenantId: string, id: string) {
    const result = await prisma.form.deleteMany({ where: { id, tenantId } })
    return result.count > 0
  },

  listSubmissions(formId: string) {
    return prisma.formSubmission.findMany({ where: { formId }, orderBy: { submittedAt: 'desc' } })
  },

  // Public endpoint (no auth) — looked up by id + PUBLISHED status only, so
  // an unpublished/draft form can never be submitted to from the outside.
  findPublished(id: string) {
    return prisma.form.findFirst({ where: { id, status: 'PUBLISHED' } })
  },

  submit(formId: string, contactId: string | null, values: Record<string, unknown>) {
    return prisma.formSubmission.create({ data: { formId, contactId, values: values as Prisma.InputJsonValue } })
  },
}
