import crypto from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { storageConfig, integrationReadiness } from '@/config/env.js'

// S3-compatible object storage for WhatsApp media (real AWS S3, Cloudflare
// R2, DigitalOcean Spaces, Backblaze B2 — all speak the same API; see
// storageConfig in config/env.ts for how credentials are resolved, including
// the AWS_* naming convention). Objects are stored private; the frontend
// never gets a permanent S3 URL, only a short-lived signed one minted on
// demand by the /media proxy route (see conversations.controller.ts#getMedia
// and conversations.service.ts#getMediaSignedUrl), so nothing leaks if a
// message row or its mediaUrl is ever exposed outside its tenant.
//
// integrationReadiness.storage is what callers check before using this, so
// the app fails honestly ("Media storage is not configured") instead of
// throwing a raw AWS SDK error when credentials are absent.

let client: S3Client | null = null
function s3(): S3Client {
  client ??= new S3Client({
    endpoint: storageConfig.endpoint || undefined,
    region: storageConfig.region || 'auto',
    credentials: { accessKeyId: storageConfig.accessKeyId, secretAccessKey: storageConfig.secretAccessKey },
    // Path-style addressing is required by R2/Spaces/B2-style endpoints, but
    // is deprecated — and breaks outright in some newer regions — on real
    // AWS S3. Only force it when a custom (non-AWS) endpoint is actually
    // configured; real AWS S3 (no STORAGE_ENDPOINT set) uses the SDK's
    // default virtual-hosted-style addressing.
    ...(storageConfig.endpoint ? { forcePathStyle: true } : {}),
  })
  return client
}

export function isStorageConfigured(): boolean {
  return integrationReadiness.storage
}

// tenantId is baked into the key itself — an extra layer under the API-level
// tenant check, so a leaked key can't be walked into another tenant's media.
// Slashes in the filename are stripped (replaced with `_`), so nothing can
// extend the key path beyond the tenant/message segments already fixed here.
export function mediaObjectKey(tenantId: string, messageId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(-100)
  return `whatsapp-media/${tenantId}/${messageId}/${crypto.randomUUID()}-${safeName}`
}

export async function uploadObject(key: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (!isStorageConfigured()) throw new Error('Media storage is not configured')
  await s3().send(new PutObjectCommand({ Bucket: storageConfig.bucket, Key: key, Body: buffer, ContentType: mimeType }))
}

// Signed for 10 minutes — long enough to load in the Inbox/Campaign
// Composer, short enough that a copied link doesn't stay valid.
export async function getSignedReadUrl(key: string): Promise<string> {
  if (!isStorageConfigured()) throw new Error('Media storage is not configured')
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: storageConfig.bucket, Key: key }), { expiresIn: 600 })
}

// Best-effort cleanup — callers use this after a DB delete has already
// removed the row referencing the object (e.g. a contact and its cascaded
// messages), so a stored file doesn't survive forever as an orphan nobody
// can reach. Deleting an already-gone key is not an error (S3's delete is
// idempotent); when storage isn't configured there is nothing to clean up.
export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured()) return
  await s3().send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: key }))
}
