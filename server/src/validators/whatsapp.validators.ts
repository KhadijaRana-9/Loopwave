import { z } from 'zod'

export const whatsappNumberIdParamSchema = z.object({ id: z.string().min(1) })

// Meta's Embedded Signup hands back the wabaId/phoneNumberId via its
// postMessage event and an authorization `code` via FB.login — the backend
// re-verifies all of it against the Graph API before trusting any of it
// (see whatsapp.service.ts#completeEmbeddedSignup). businessId is optional:
// Meta's own /waba lookup usually resolves it, this is only a fallback.
export const completeSignupSchema = z.object({
  code: z.string().trim().min(1, 'Missing Meta authorization code'),
  wabaId: z.string().trim().min(1, 'Missing WhatsApp Business Account id'),
  phoneNumberId: z.string().trim().min(1, 'Missing phone number id'),
  businessId: z.string().trim().optional(),
  label: z.string().trim().min(1).max(120),
})
