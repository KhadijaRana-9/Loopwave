import { env, integrationReadiness } from '@/config/env.js'

export interface SendEmailResult {
  sent: boolean
  demo: boolean
}

// Sends via Resend when RESEND_API_KEY is configured; otherwise logs to the
// server console in clearly-labeled demo mode. Never claims an email was
// delivered when it wasn't — see Section 51 in the product brief.
export async function sendEmail(params: { to: string; subject: string; body: string }): Promise<SendEmailResult> {
  if (!integrationReadiness.email) {
    console.log(`[email:demo] to=${params.to} subject="${params.subject}"`)
    return { sent: false, demo: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: params.to, subject: params.subject, text: params.body }),
    })
    return { sent: res.ok, demo: false }
  } catch {
    return { sent: false, demo: false }
  }
}
