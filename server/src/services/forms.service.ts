import { formsRepository } from '@/repositories/forms.repository.js'
import { assertUnderLimit } from '@/services/planLimits.service.js'
import { serializeForm, serializeFormSubmission } from '@/utils/serializers.js'
import { ApiError } from '@/utils/apiError.js'
import { prisma } from '@/config/prisma.js'
import type { z } from 'zod'
import type { createFormSchema, updateFormSchema } from '@/validators/forms.validators.js'

// Best-effort mapping from a form's free-text field labels to Contact
// columns, so a published lead form creates a real, usable CRM contact
// instead of only a raw submission record (Section 18: "lead creation, CRM mapping").
function extractContactFields(values: Record<string, unknown>) {
  const find = (...keys: string[]) => {
    for (const [key, value] of Object.entries(values)) {
      if (keys.some((k) => key.toLowerCase().includes(k)) && typeof value === 'string' && value.trim()) return value.trim()
    }
    return undefined
  }
  return {
    name: find('name'),
    phone: find('phone', 'mobile', 'whatsapp'),
    email: find('email'),
  }
}

export const formsService = {
  async list(tenantId: string) {
    return (await formsRepository.list(tenantId)).map(serializeForm)
  },

  async create(tenantId: string, input: z.infer<typeof createFormSchema>) {
    const forms = await formsRepository.list(tenantId)
    await assertUnderLimit(tenantId, 'forms', forms.length)
    const form = await formsRepository.create(tenantId, input)
    return serializeForm(form)
  },

  async update(tenantId: string, id: string, input: z.infer<typeof updateFormSchema>) {
    const { status, ...rest } = input
    const data: Record<string, unknown> = { ...rest }
    if (status) data.status = status.toUpperCase()
    const updated = await formsRepository.update(tenantId, id, data)
    if (!updated) throw ApiError.notFound('Form not found')
    return serializeForm(updated)
  },

  async remove(tenantId: string, id: string) {
    const ok = await formsRepository.delete(tenantId, id)
    if (!ok) throw ApiError.notFound('Form not found')
  },

  async listSubmissions(tenantId: string, id: string) {
    const form = await formsRepository.findById(tenantId, id)
    if (!form) throw ApiError.notFound('Form not found')
    return (await formsRepository.listSubmissions(id)).map(serializeFormSubmission)
  },

  // Called from the public, unauthenticated form-submission route.
  async submitPublic(formId: string, values: Record<string, unknown>) {
    const form = await formsRepository.findPublished(formId)
    if (!form) throw ApiError.notFound('This form is not accepting submissions.')

    const contactFields = extractContactFields(values)
    let contactId: string | null = null
    if (contactFields.phone) {
      const contact = await prisma.contact.upsert({
        where: { tenantId_phone: { tenantId: form.tenantId, phone: contactFields.phone } },
        create: {
          tenantId: form.tenantId,
          name: contactFields.name || contactFields.phone,
          phone: contactFields.phone,
          email: contactFields.email,
          source: `Form: ${form.name}`,
        },
        update: { lastInteractionAt: new Date() },
      })
      contactId = contact.id
    }

    const submission = await formsRepository.submit(formId, contactId, values)
    return serializeFormSubmission(submission)
  },
}
