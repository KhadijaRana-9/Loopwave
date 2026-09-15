import { describe, it, expect } from 'vitest'
import { createApp } from '@/app.js'
import request from 'supertest'

describe('sanity', () => {
  it('health check responds', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
