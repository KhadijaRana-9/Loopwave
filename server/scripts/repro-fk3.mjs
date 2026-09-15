import 'dotenv/config'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import jwt from 'jsonwebtoken'

const app = createApp()

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10)
}

function decodeCookieTenant(setCookieHeader) {
  const raw = setCookieHeader.find((c) => c.startsWith('access_token='))
  const token = raw.split(';')[0].split('=')[1]
  const decoded = jwt.decode(token)
  return decoded.tenantId
}

async function main() {
  const agent = request.agent(app)
  const email = `repro3-${randomSuffix()}@test.loopwave.internal`

  const t0 = Date.now()
  const signupRes = await agent.post('/api/auth/signup').send({
    name: 'Repro3',
    email,
    password: 'TestPass123',
    workspaceName: `Repro3 WS ${randomSuffix()}`,
  })
  console.log('signup', signupRes.status, Date.now() - t0, 'ms')
  console.log('body tenant id:', signupRes.body.tenant.id)
  console.log('jwt tenant id: ', decodeCookieTenant(signupRes.headers['set-cookie']))

  const steps = [
    ['contact', () => agent.post('/api/contacts').send({ name: 'X', phone: `+1${Date.now()}` })],
    ['chatbot', () => agent.post('/api/chatbots').send({ name: 'X' })],
    ['aiAgent', () => agent.post('/api/ai-agents').send({ name: 'X' })],
  ]

  for (const [label, fn] of steps) {
    const t1 = Date.now()
    const res = await fn()
    console.log(label, res.status, Date.now() - t1, 'ms', res.status >= 400 ? JSON.stringify(res.body) : '')
  }

  const meRes = await agent.get('/api/auth/me')
  console.log('final /me tenant id:', meRes.body.tenant?.id)
}

main().catch((e) => console.error('FATAL', e))
