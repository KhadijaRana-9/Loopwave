import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import { assertMediaAllowed } from '@/utils/mediaLimits.js'
import { prisma } from '@/config/prisma.js'
import { encryptSecret } from '@/utils/crypto.js'
import { cleanupTenant, signupTenant, type TestSession } from './helpers.js'

// No real S3/AWS credentials are configured in this environment (confirmed:
// STORAGE_* and AWS_* are both unset everywhere right now). Two things are
// genuinely provable without them:
//
// 1. The HONEST "not configured" behavior, against the real, current,
//    unconfigured environment — no env trickery, this is exactly what
//    production sees today.
// 2. The REAL upload/download/delete logic (Bucket/Key/Body/ContentType
//    construction, error propagation) with fixture (clearly-fake) S3
//    credentials and only the actual network call — S3Client.send — stubbed,
//    the same boundary-only-mocking approach the WhatsApp tests use for
//    Meta's Graph API (vi.spyOn(globalThis, 'fetch')). This proves the
//    adapter is wired correctly; it is NOT a live S3 upload.
describe('Media storage — honest "not configured" state (real, unconfigured environment)', () => {
  it('isStorageConfigured() is false and every operation refuses honestly', async () => {
    const { isStorageConfigured, uploadObject, getSignedReadUrl, deleteObject } = await import('@/integrations/storage.adapter.js')
    expect(isStorageConfigured()).toBe(false)
    await expect(uploadObject('k', Buffer.from('x'), 'image/png')).rejects.toThrow('Media storage is not configured')
    await expect(getSignedReadUrl('k')).rejects.toThrow('Media storage is not configured')
    // deleteObject is best-effort cleanup — it must NOT throw when storage was
    // never configured (there is nothing to clean up), unlike upload/read.
    await expect(deleteObject('k')).resolves.toBeUndefined()
  })

  it('sendMedia (Inbox) and uploadHeaderMedia (Campaigns) refuse with the real, current-requirement message — never a fake success', async () => {
    const tenant = await signupTenant('storage-unconfigured')
    try {
      // A connected number + an open 24h customer-service window (a real
      // inbound message) — otherwise sendMedia correctly refuses for THOSE
      // reasons first, and never reaches the storage check this test is
      // actually about. (Media can't be simulated in demo mode, so a
      // connected number is required to get this far either way.)
      const account = await prisma.whatsAppAccount.create({ data: { tenantId: tenant.tenantId, wabaId: `waba-storage-test-${Date.now()}`, accessTokenCipher: encryptSecret('token-never-reaches-meta-storage-check-throws-first') } })
      await prisma.whatsAppPhoneNumber.create({ data: { accountId: account.id, displayNumber: '+15550009999', metaPhoneNumberId: `meta-pn-storage-${Date.now()}`, status: 'CONNECTED', connectedAt: new Date() } })
      const contact = await tenant.agent.post('/api/contacts').send({ name: 'Storage Test', phone: `+1555${Date.now()}`.slice(0, 13) })
      const conv = await prisma.conversation.create({ data: { tenantId: tenant.tenantId, contactId: contact.body.contact.id, lastMessageAt: new Date() } })
      await prisma.message.create({ data: { conversationId: conv.id, direction: 'INBOUND', type: 'text', text: 'opening the window', status: 'DELIVERED' } })

      const send = await tenant.agent.post(`/api/conversations/${conv.id}/messages/media`).attach('file', Buffer.from('fake-image-bytes'), { filename: 'photo.png', contentType: 'image/png' })
      expect(send.status).toBe(400)
      expect(send.body.error.message).toMatch(/media storage is not configured/i)
      expect(send.body.error.message).not.toMatch(/STORAGE_ENDPOINT/) // endpoint is optional now — must not be listed as required

      const header = await tenant.agent.post('/api/campaigns/header-media').attach('file', Buffer.from('fake-image-bytes'), { filename: 'header.png', contentType: 'image/png' })
      expect(header.status).toBe(400)
      expect(header.body.error.message).toMatch(/media storage is not configured/i)
    } finally {
      await cleanupTenant(tenant)
    }
  })
})

describe('Media storage — adapter logic (fixture credentials, only the S3 network call stubbed)', () => {
  const originalEnv = { ...process.env }
  let sendSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    process.env.STORAGE_REGION = 'us-east-1'
    process.env.STORAGE_BUCKET = 'loopwave-test-fixture-bucket'
    process.env.STORAGE_ACCESS_KEY_ID = 'TESTFIXTUREACCESSKEY'
    process.env.STORAGE_SECRET_ACCESS_KEY = 'test-fixture-secret-not-real'
    // STORAGE_ENDPOINT deliberately left unset — this is the real-AWS-S3 shape.
  })

  afterEach(() => {
    sendSpy?.mockRestore()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  async function freshAdapter() {
    vi.resetModules()
    const mod = await import('@/integrations/storage.adapter.js')
    sendSpy = vi.spyOn(S3Client.prototype, 'send')
    return mod
  }

  it('isStorageConfigured() is true with region+bucket+keys alone — STORAGE_ENDPOINT is NOT required (real AWS S3 never sets it)', async () => {
    const { isStorageConfigured } = await freshAdapter()
    expect(isStorageConfigured()).toBe(true)
  })

  it('does not force path-style addressing when no custom endpoint is set (path-style breaks real AWS S3 in some regions)', async () => {
    const { uploadObject } = await freshAdapter()
    sendSpy.mockResolvedValue({})
    await uploadObject('some/key', Buffer.from('x'), 'image/png')
    const client = sendSpy.mock.instances[0] as S3Client
    expect(client.config.forcePathStyle).not.toBe(true)
  })

  it('successful upload sends the correct Bucket/Key/ContentType/Body', async () => {
    const { uploadObject, mediaObjectKey } = await freshAdapter()
    sendSpy.mockResolvedValue({ ETag: '"abc"' })
    const key = mediaObjectKey('tenant-1', 'msg-1', 'photo.png')
    const buffer = Buffer.from('real-bytes')
    await uploadObject(key, buffer, 'image/png')
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const command = sendSpy.mock.calls[0]![0] as { input: Record<string, unknown> }
    expect(command.input).toMatchObject({ Bucket: 'loopwave-test-fixture-bucket', Key: key, ContentType: 'image/png' })
    expect(command.input.Body).toBe(buffer)
  })

  it('a real storage failure (S3 rejects) propagates as a real error — never swallowed into a fake success', async () => {
    const { uploadObject } = await freshAdapter()
    sendSpy.mockRejectedValue(new Error('SimulatedS3Failure: access denied'))
    await expect(uploadObject('k', Buffer.from('x'), 'image/png')).rejects.toThrow('SimulatedS3Failure')
  })

  it('getSignedReadUrl returns a URL referencing the configured bucket and key, and never the AWS secret', async () => {
    const { getSignedReadUrl } = await freshAdapter()
    const url = await getSignedReadUrl('whatsapp-media/tenant-1/msg-1/photo.png')
    expect(url).toContain('loopwave-test-fixture-bucket')
    expect(url).not.toContain('test-fixture-secret-not-real')
  })

  it('deleteObject sends a real DeleteObjectCommand for the given key', async () => {
    const { deleteObject } = await freshAdapter()
    sendSpy.mockResolvedValue({})
    await deleteObject('whatsapp-media/tenant-1/msg-1/photo.png')
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const command = sendSpy.mock.calls[0]![0] as { input: Record<string, unknown>; constructor: { name: string } }
    expect(command.constructor.name).toBe('DeleteObjectCommand')
    expect(command.input).toMatchObject({ Bucket: 'loopwave-test-fixture-bucket', Key: 'whatsapp-media/tenant-1/msg-1/photo.png' })
  })

})

describe('mediaObjectKey — pure key-generation logic (no storage needed)', () => {
  it('is tenant-scoped, namespaced per message, and never collides for the same inputs', async () => {
    const { mediaObjectKey } = await import('@/integrations/storage.adapter.js')
    const keyA = mediaObjectKey('tenant-1', 'msg-1', 'photo.png')
    const keyB = mediaObjectKey('tenant-1', 'msg-1', 'photo.png')
    expect(keyA.startsWith('whatsapp-media/tenant-1/msg-1/')).toBe(true)
    expect(keyA).not.toBe(keyB) // a fresh crypto.randomUUID() per call — two uploads never overwrite each other
  })

  it("strips path separators from an attacker-controlled filename — can't escape the fixed tenant/message prefix", async () => {
    const { mediaObjectKey } = await import('@/integrations/storage.adapter.js')
    const key = mediaObjectKey('tenant-1', 'msg-1', '../../etc/passwd')
    expect(key.startsWith('whatsapp-media/tenant-1/msg-1/')).toBe(true)
    expect(key).not.toContain('/../')
    expect(key.split('/')).toHaveLength(4) // whatsapp-media / tenantId / messageId / <uuid>-filename — no extra segments smuggled in
  })
})

describe('Media file validation (assertMediaAllowed — pure logic, no storage needed)', () => {
  it('rejects an unsupported file type', () => {
    expect(() => assertMediaAllowed('application/x-msdownload', 1000)).toThrow(/unsupported file type/i)
  })

  it('rejects an oversized image (over the real Meta 5MB cap)', () => {
    expect(() => assertMediaAllowed('image/jpeg', 6 * 1024 * 1024)).toThrow(/5MB or smaller/i)
  })

  it('accepts a valid, in-limit document', () => {
    expect(assertMediaAllowed('application/pdf', 1024)).toEqual({ kind: 'document' })
  })
})

describe('Media — tenant isolation (real DB, real HTTP API, no storage needed for this boundary)', () => {
  let tenantA: TestSession
  let tenantB: TestSession

  beforeAll(async () => {
    tenantA = await signupTenant('media-iso-a')
    tenantB = await signupTenant('media-iso-b')
  })

  afterAll(async () => {
    await cleanupTenant(tenantA)
    await cleanupTenant(tenantB)
  })

  it("Tenant B cannot reach Tenant A's media through the signed-URL proxy, by guessing or enumerating the message id", async () => {
    const contact = await tenantA.agent.post('/api/contacts').send({ name: 'A Media Contact', phone: `+1555${Date.now()}`.slice(0, 13) })
    const conv = await prisma.conversation.create({ data: { tenantId: tenantA.tenantId, contactId: contact.body.contact.id } })
    // A message that really does have a stored media key (seeded directly — a
    // real upload needs real credentials, but the authorization boundary this
    // test proves is enforced before storage is ever touched).
    const message = await prisma.message.create({
      data: { conversationId: conv.id, direction: 'OUTBOUND', type: 'image', status: 'SENT', mediaUrl: 'whatsapp-media/tenant-a/real-key.png', mediaMimeType: 'image/png' },
    })

    const asOwner = await tenantA.agent.get(`/api/conversations/media/${message.id}`).redirects(0)
    // 302 (storage configured, would redirect to a signed URL) or 400/500
    // (storage not configured here) are both "the owner was allowed through";
    // what must NEVER happen is Tenant B getting past the tenant check.
    expect(asOwner.status).not.toBe(404)

    const asOtherTenant = await tenantB.agent.get(`/api/conversations/media/${message.id}`)
    expect(asOtherTenant.status).toBe(404)
  })
})
