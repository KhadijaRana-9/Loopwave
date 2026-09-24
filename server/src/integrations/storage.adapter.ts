import crypto from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env, integrationReadiness } from '@/config/env.js'

// S3-compatible object storage for WhatsApp media (AWS S3, Cloudflare R2,
// DigitalOcean Spaces, Backblaze B2 — all speak the same API). Objects are
// stored private; the frontend never gets a permanent S3 URL, only a
// short-lived signed one minted on demand by the /media proxy route (see
// whatsapp.controller.ts#serveMedia), so nothing leaks if a message row or
// its mediaUrl is ever exposed outside its tenant.
//
// NOT wired to real credentials yet — STORAGE_* is empty in every
// environment right now (confirmed in the WhatsApp integration audit). Every
// function here is real, working code; integrationReadiness.storage is what
// callers check before using it, so the app fails honestly ("media storage
// is not configured yet") instead of throwing a raw AWS SDK error.

let client: S3Client | null = null
function s3(): S3Client {
  client ??= new S3Client({
    endpoint: env.STORAGE_ENDPOINT || undefined,
    region: env.STORAGE_REGION || 'auto',
    credentials: { accessKeyId: env.STORAGE_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY },
    forcePathStyle: true, // required by R2/Spaces-style endpoints, harmless on AWS
  })
  return client
}

export function isStorageConfigured(): boolean {
  return integrationReadiness.storage
}

// tenantId is baked into the key itself — an extra layer under the API-level
// tenant check, so a leaked key can't be walked into another tenant's media.
export function mediaObjectKey(tenantId: string, messageId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100)
  return `whatsapp-media/${tenantId}/${messageId}/${crypto.randomUUID()}-${safeName}`
}

export async function uploadObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (!isStorageConfigured()) throw new Error('Media storage is not configured yet')
  await s3().send(new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: buffer, ContentType: mimeType }))
}

// Signed for 10 minutes — long enough to load in the Inbox/Campaign
// Composer, short enough that a copied link doesn't stay valid.
export async function getSignedReadUrl(key: string): Promise<string> {
  if (!isStorageConfigured()) throw new Error('Media storage is not configured yet')
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }), { expiresIn: 600 })
}
