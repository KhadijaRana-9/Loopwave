import { env, integrationReadiness } from '@/config/env.js'

export interface AiAgentProfile {
  name: string
  description: string | null
  personality: string | null
  businessInfo: string | null
  goals: string[]
  qualificationQuestions: string[]
  handoffRules: string | null
  faqs: { question: string; answer: string }[]
}

export interface AiReplyResult {
  reply: string
  demo: boolean
}

// Provider-abstracted so business logic never imports OpenAI directly (see
// Section 16 in the product brief). Without OPENAI_API_KEY this runs a
// deterministic, clearly-labeled rule-based simulation grounded in the
// agent's own configured FAQs/questions — a real interactive test, not a
// static transcript, but never presented to the user as a live LLM call.
export async function generateAgentReply(
  profile: AiAgentProfile,
  history: { from: 'user' | 'agent'; text: string }[],
  message: string,
): Promise<AiReplyResult> {
  if (integrationReadiness.ai) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are ${profile.name}, an AI agent for a WhatsApp business. Personality: ${profile.personality ?? 'friendly and professional'}. Business info: ${profile.businessInfo ?? ''}. Goals: ${profile.goals.join(', ')}. Handoff rule: ${profile.handoffRules ?? 'escalate complex requests to a human'}.`,
            },
            ...history.map((h) => ({ role: h.from === 'user' ? ('user' as const) : ('assistant' as const), content: h.text })),
            { role: 'user', content: message },
          ],
        }),
      })
      const payload = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
      const reply = payload?.choices?.[0]?.message?.content
      if (res.ok && reply) return { reply, demo: false }
    } catch {
      // fall through to demo mode below
    }
  }

  const lower = message.toLowerCase()
  const faqHit = profile.faqs.find((f) => lower.includes(f.question.toLowerCase().split(' ')[0] ?? '') || f.question.toLowerCase().includes(lower.split(' ')[0] ?? ''))
  if (faqHit) return { reply: faqHit.answer, demo: true }

  const answeredCount = history.filter((h) => h.from === 'user').length
  const nextQuestion = profile.qualificationQuestions[answeredCount]
  if (nextQuestion) return { reply: nextQuestion, demo: true }

  const score = Math.min(96, 45 + answeredCount * 15)
  const reply = `Thanks — that's everything I need. Lead score: ${score}/100. ${score >= 70 ? (profile.handoffRules || 'Recommend handing off to a human sales agent.') : 'This lead needs more nurturing before handoff.'}`
  return { reply, demo: true }
}
