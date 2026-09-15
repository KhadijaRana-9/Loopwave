import { afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { prisma } from '@/config/prisma.js'
import { app, cleanupTenant, cleanupUser, inviteAndLogin, signupTenant, TEST_PASSWORD, type TestSession } from './helpers.js'

describe('auth', () => {
  let session: TestSession

  afterAll(async () => {
    await cleanupTenant(session)
  })

  it('signs up a new tenant + owner', async () => {
    session = await signupTenant('auth')
    expect(session.tenantId).toBeTruthy()
    expect(session.userId).toBeTruthy()
  })

  it('rejects duplicate signup email', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Dup',
      email: session.email,
      password: TEST_PASSWORD,
      workspaceName: 'Dup Workspace',
    })
    expect(res.status).toBe(409)
  })

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: session.email, password: 'WrongPass123' })
    expect(res.status).toBe(401)
  })

  it('rejects login with unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.loopwave.internal', password: TEST_PASSWORD })
    expect(res.status).toBe(401)
  })

  it('rejects weak passwords on signup', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Weak',
      email: `weak-${Date.now()}@test.loopwave.internal`,
      password: 'weak',
      workspaceName: 'Weak Workspace',
    })
    expect(res.status).toBe(400)
  })

  it('returns the current session on /me', async () => {
    const res = await session.agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(session.email)
    expect(res.body.tenant.id).toBe(session.tenantId)
  })

  it('rejects /me with no session', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('refreshes the session using the refresh cookie', async () => {
    const res = await session.agent.post('/api/auth/refresh')
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(session.email)
  })

  it('logs out and invalidates the session', async () => {
    const fresh = await signupTenant('logout')
    const meBefore = await fresh.agent.get('/api/auth/me')
    expect(meBefore.status).toBe(200)

    const logoutRes = await fresh.agent.post('/api/auth/logout')
    expect(logoutRes.status).toBe(204)

    const meAfter = await fresh.agent.get('/api/auth/me')
    expect(meAfter.status).toBe(401)

    // The refresh token itself must be revoked server-side, not just the
    // cookie cleared client-side — replaying it should fail too.
    const refreshAfterLogout = await fresh.agent.post('/api/auth/refresh')
    expect(refreshAfterLogout.status).toBe(401)

    await cleanupTenant(fresh)
  })

  describe('invite acceptance', () => {
    it('activates the membership and lets the invitee log in afterward', async () => {
      const teammate = await inviteAndLogin(session, 'viewer')

      const meRes = await teammate.agent.get('/api/auth/me')
      expect(meRes.status).toBe(200)
      expect(meRes.body.membership.status).toBe('active')

      // The whole point: before acceptInvite existed, this exact call failed
      // with 403 "no active workspace" because login only ever considered
      // ACTIVE memberships, and nothing transitioned INVITED -> ACTIVE.
      const freshLogin = await request(app).post('/api/auth/login').send({ email: teammate.email, password: TEST_PASSWORD })
      expect(freshLogin.status).toBe(200)

      await cleanupUser(teammate)
    })

    it('rejects an invite token that has already been used', async () => {
      const inviteRes = await session.agent.post('/api/team').send({ name: 'Reuse Test', email: `qa-reuse-${Date.now()}@test.loopwave.internal`, role: 'viewer' })
      const membership = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId: session.tenantId, userId: inviteRes.body.member.id } } })
      const token = membership!.inviteToken!

      const first = await request(app).post('/api/auth/accept-invite').send({ token, password: TEST_PASSWORD })
      expect(first.status).toBe(200)

      const second = await request(app).post('/api/auth/accept-invite').send({ token, password: 'SomethingElse123' })
      expect(second.status).toBe(400)

      await prisma.user.deleteMany({ where: { id: inviteRes.body.member.id } })
    })

    it('rejects an unknown invite token', async () => {
      const res = await request(app).post('/api/auth/accept-invite').send({ token: 'not-a-real-token', password: TEST_PASSWORD })
      expect(res.status).toBe(400)
    })
  })
})
