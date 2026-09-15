import crypto from 'node:crypto'
import { env } from '@/config/env.js'

// AES-256-GCM field-level encryption for secrets we must store but never
// return to the frontend (WhatsApp access tokens, integration API keys).
// ENCRYPTION_KEY is a 32-byte hex string set via env, never hard-coded.
const KEY = Buffer.from(env.ENCRYPTION_KEY.padEnd(64, '0').slice(0, 64), 'hex')
const IV_LENGTH = 12

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16)
  const encrypted = buf.subarray(IV_LENGTH + 16)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
