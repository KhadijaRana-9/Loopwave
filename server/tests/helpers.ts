import request from 'supertest'
import { createApp } from '@/app.js'
import { prisma } from '@/config/prisma.js'

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

export async function cleanupTenant(session: TestSession | null | undefined) {
  if (!session) return
  await prisma.tenant.deleteMany({ where: { id: session.tenantId } })
  await prisma.user.deleteMany({ where: { id: session.userId } })
}

export async function cleanupUser(session: TestSession | null | undefined) {
  if (!session) return
  await prisma.user.deleteMany({ where: { id: session.userId } })
}
