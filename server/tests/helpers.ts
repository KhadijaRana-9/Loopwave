import request from 'supertest'
import { createApp } from '@/app.js'
import { prisma } from '@/config/prisma.js'
import crypto from 'node:crypto'
import { env, integrationReadiness } from '@/config/env.js'

// Real integration tests: real Express app, real Prisma client, real
// database (whatever DATABASE_URL in server/.env points at). Nothing here
// mocks Prisma or the HTTP layer — that's the point, since the thing being
// proven (tenant isolation, RBAC) lives in that real stack.
export const app = createApp()

export const TEST_PASSWORD = 'TestPass123'

export interface TestSession {
  agent: ReturnType<typeof request.agent>
  tenantId: string
  userId: string
  email: string
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

export async function signupTenant(label: string): Promise<TestSession> {
  const email = `qa-${label}-${randomSuffix()}@test.loopwave.internal`
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/signup').send({
    name: `QA ${label}`,
    email,
    password: TEST_PASSWORD,
    workspaceName: `QA Workspace ${label} ${randomSuffix()}`,
  })
  if (res.status !== 201) throw new Error(`Signup failed for ${label}: ${res.status} ${JSON.stringify(res.body)}`)
  return { agent, tenantId: res.body.tenant.id as string, userId: res.body.user.id as string, email }
}

// Invites a teammate through the real API (as the owner), then walks the
// real accept-invite flow (server/src/services/auth.service.ts#acceptInvite)
// instead of a DB shortcut — this is the same code path a real invitee's
// browser hits, and is what caught the invited-users-can-never-log-in bug
// (login only considers ACTIVE memberships, and nothing used to ever move an
// invite out of INVITED status).
export async function inviteAndLogin(owner: TestSession, role: string): Promise<TestSession> {
  const email = `qa-member-${randomSuffix()}@test.loopwave.internal`
  const inviteRes = await owner.agent.post('/api/team').send({ name: 'QA Teammate', email, role })
  if (inviteRes.status !== 201) throw new Error(`Invite failed: ${inviteRes.status} ${JSON.stringify(inviteRes.body)}`)
  const userId = inviteRes.body.member.id as string

  const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId: owner.tenantId, userId } } })
  if (!membership?.inviteToken) throw new Error('Invite created but no inviteToken was stored')

  const agent = request.agent(app)
  const acceptRes = await agent.post('/api/auth/accept-invite').send({ token: membership.inviteToken, password: TEST_PASSWORD })
  if (acceptRes.status !== 200) throw new Error(`Accept invite failed: ${acceptRes.status} ${JSON.stringify(acceptRes.body)}`)

  return { agent, tenantId: owner.tenantId, userId, email }
}

// Also removes every OTHER user that was invited into the tenant during the
// test (team-invite tests create real User rows). Deleting only the tenant and
// the session user left one orphan `dup-…@test.loopwave.internal` user per run
// in the shared Neon database. The email-domain guard means a real user can
// never be deleted here, whatever memberships the tenant had.
export async function cleanupTenant(session: TestSession | null | undefined) {
  if (!session) return
  const memberships = await prisma.membership.findMany({ where: { tenantId: session.tenantId }, select: { userId: true } })
  await prisma.tenant.deleteMany({ where: { id: session.tenantId } })
  await prisma.user.deleteMany({
    where: { id: { in: [...new Set([session.userId, ...memberships.map((m) => m.userId)])] }, email: { endsWith: '@test.loopwave.internal' } },
  })
}

export async function cleanupUser(session: TestSession | null | undefined) {
  if (!session) return
  await prisma.user.deleteMany({ where: { id: session.userId } })
}

// The controller deliberately responds 200 BEFORE processing finishes (Meta
// retries webhooks that aren't acked fast — whatsapp.controller.ts#receiveWebhook),
// so a test that asserts on DB state must wait for the async processing, not
// just the HTTP response. It polls the same WebhookEvent row the controller
// stamps (processedAt / errorMessage) when it is done. The generous timeout is
// deliberate: processing is ~10 sequential queries and this suite runs against
// a remote Neon database at ~0.5s/query — a short timeout here made tests end
// (and afterAll delete the tenant) while processing was still in flight,
// producing spurious foreign-key errors.
export async function waitForWhatsappWebhookProcessed(externalId: string, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const event = await prisma.webhookEvent.findUnique({ where: { source_externalId: { source: 'whatsapp', externalId } } })
    if (event?.processedAt || event?.errorMessage) return event
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`WhatsApp webhook event ${externalId} was not processed within ${timeoutMs}ms`)
}

// POSTs a genuinely HMAC-signed webhook (same scheme Meta uses:
// X-Hub-Signature-256 = sha256(rawBody, WHATSAPP_APP_SECRET)) and waits for
// processing to finish. WHATSAPP_APP_SECRET is a fixture set in vitest.config.ts.
// The WebhookEvent idempotency key the controller derives for a delivery:
// SHA-256 of the exact signed body (NOT entry[].id — that is the WABA id in
// real Meta payloads and identical on every event).
export function whatsappWebhookEventId(body: string): string {
  return `sha256:${crypto.createHash('sha256').update(body).digest('hex')}`
}

export async function signedWhatsappWebhookPost(payload: object) {
  const body = JSON.stringify(payload)
  const signature = 'sha256=' + crypto.createHmac('sha256', env.WHATSAPP_APP_SECRET).update(body).digest('hex')
  const res = await request(app).post('/api/whatsapp/webhook').set('Content-Type', 'application/json').set('x-hub-signature-256', signature).send(body)
  if (res.status === 200) await waitForWhatsappWebhookProcessed(whatsappWebhookEventId(body))
  return res
}

// Gate for the "real Graph API" half of a WhatsApp test — true only when
// META_APP_ID/META_CONFIG_ID/WHATSAPP_APP_SECRET are genuinely configured
// (see src/config/env.ts#integrationReadiness). No real credentials exist
// in this environment today, so describe.skipIf(!hasLiveWhatsappCredentials())
// blocks currently skip — they start running the moment real credentials
// are added, rather than being deleted or left permanently unwritten.
export function hasLiveWhatsappCredentials(): boolean {
  return integrationReadiness.whatsappSignup
}
