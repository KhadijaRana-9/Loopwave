import { describe, expect, it } from 'vitest'
import { redactUrlForLog } from '@/utils/logRedaction.js'

describe('request-log URL redaction', () => {
  it("never writes Meta's webhook verify token into the logs, but keeps the non-secret params", () => {
    const logged = redactUrlForLog('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=s3cr3t-value&hub.challenge=12345')
    expect(logged).not.toContain('s3cr3t-value')
    expect(logged).toBe('/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=[REDACTED]&hub.challenge=12345')
  })

  it('redacts other credential-looking params, including URL-encoded names', () => {
    const logged = redactUrlForLog('/api/x?access_token=EAAabc&client_secret=zzz&code=abc123&password=hunter2&page=2&hub%2Everify_token=t0k')
    expect(logged).not.toMatch(/EAAabc|zzz|abc123|hunter2|t0k/)
    expect(logged).toContain('page=2')
  })

  it('leaves URLs without a query string, and undefined, untouched', () => {
    expect(redactUrlForLog('/api/contacts')).toBe('/api/contacts')
    expect(redactUrlForLog(undefined)).toBeUndefined()
  })
})
