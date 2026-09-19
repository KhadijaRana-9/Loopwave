import { z } from 'zod'

export const whatsappNumberIdParamSchema = z.object({ id: z.string().min(1) })

// E.164: a leading +, first digit 1-9 (no leading 0), 1-14 more digits (max
// 15 total, the international standard). The frontend formats/validates
// per-country via libphonenumber-js for good UX, but the backend is what
// actually enforces this — it never trusts a client-formatted string.
const E164 = /^\+[1-9]\d{7,14}$/

export const startSignupSchema = z.object({
  label: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().regex(E164, 'Enter a valid phone number in international format, e.g. +923001234567'),
})
