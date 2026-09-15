import { prisma } from '@/config/prisma.js'
import type { Prisma } from '@prisma/client'

export const templatesRepository = {
  list(tenantId: string) {
    return prisma.template.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  },

  findById(tenantId: string, id: string) {
    return prisma.template.findFirst({ where: { id, tenantId } })
  },

  create(tenantId: string, data: Omit<Prisma.TemplateUncheckedCreateInput, 'tenantId'>) {
    return prisma.template.create({ data: { ...data, tenantId } })
  },

  async update(tenantId: string, id: string, data: Prisma.TemplateUncheckedUpdateInput) {
    const existing = await prisma.template.findFirst({ where: { id, tenantId }, select: { id: true, body: true, variables: true } })
    if (!existing) return null
    if (typeof data.body === 'string' && data.body !== existing.body) {
      await prisma.templateVersion.create({ data: { templateId: id, body: existing.body, variables: existing.variables ?? [] } })
    }
    return prisma.template.update({ where: { id }, data })
  },

  async delete(tenantId: string, id: string) {
    const result = await prisma.template.deleteMany({ where: { id, tenantId } })
    return result.count > 0
  },

  count(tenantId: string) {
    return prisma.template.count({ where: { tenantId } })
  },
}
