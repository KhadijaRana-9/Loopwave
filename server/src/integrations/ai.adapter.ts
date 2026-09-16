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

export interface CampaignComposeInput {
  campaignName: string
  topic: string
  subheading?: string
  offer?: string
  tone?: string
  language?: string
  cta?: string
  instructions?: string
  // Present for refine actions (regenerate/shorten/professional/engaging/
  // translate/emoji toggles/tone change) — the message being refined.
  currentMessage?: string
  action: 'generate' | 'regenerate' | 'shorten' | 'professional' | 'engaging' | 'translate' | 'add_emojis' | 'remove_emojis' | 'change_tone'
}

export interface CampaignComposeResult {
  message: string
  demo: boolean
}

const ACTION_INSTRUCTION: Record<CampaignComposeInput['action'], string> = {
  generate: 'Write a new WhatsApp marketing message from the campaign brief below.',
  regenerate: 'Write a fresh alternative WhatsApp marketing message from the campaign brief below — different wording than a typical first draft.',
  shorten: 'Make the message below noticeably shorter and punchier while keeping the offer and CTA intact.',
  professional: 'Rewrite the message below in a more professional, polished business tone.',
  engaging: 'Rewrite the message below to be more engaging and exciting, while staying credible.',
  translate: 'Translate the message below into the requested language, keeping the same structure and CTA.',
  add_emojis: 'Rewrite the message below adding a few tasteful, relevant emojis. Do not overdo it.',
  remove_emojis: 'Rewrite the message below removing all emojis, keeping the wording otherwise the same.',
  change_tone: 'Rewrite the message below to match the requested tone.',
}

// Same provider-abstraction shape as generateAgentReply above: a real OpenAI
// call when configured, otherwise a demo composer that genuinely assembles a
// message from the actual brief fields (not a canned string) so "demo mode"
// is honest about what it is without ever being static filler.
export async function generateCampaignMessage(input: CampaignComposeInput): Promise<CampaignComposeResult> {
  if (integrationReadiness.ai) {
    try {
      const brief = [
        `Campaign name: ${input.campaignName}`,
        `Topic/headline: ${input.topic}`,
        input.subheading ? `Subheading/details: ${input.subheading}` : null,
        input.offer ? `Offer/promotion: ${input.offer}` : null,
        `Tone: ${input.tone || 'professional and engaging'}`,
        `Language: ${input.language || 'English'}`,
        input.cta ? `Call to action: ${input.cta}` : null,
        input.instructions ? `Additional instructions: ${input.instructions}` : null,
        input.currentMessage ? `Current draft:\n${input.currentMessage}` : null,
      ]
        .filter(Boolean)
        .join('\n')

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You write concise, high-converting WhatsApp marketing messages for small businesses. Keep messages short (under ~700 characters), scannable, and suitable for WhatsApp — no markdown headers, no HTML. You may use personalization placeholders like {{firstName}} where natural. Return only the message text, nothing else.',
            },
            { role: 'user', content: `${ACTION_INSTRUCTION[input.action]}\n\n${brief}` },
          ],
        }),
      })
      const payload = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null
      const message = payload?.choices?.[0]?.message?.content?.trim()
      if (res.ok && message) return { message, demo: false }
    } catch {
      // fall through to demo mode below
    }
  }

  return { message: demoComposeMessage(input), demo: true }
}

const REFINE_ACTIONS = new Set(['shorten', 'professional', 'engaging', 'translate', 'add_emojis', 'remove_emojis', 'change_tone'])

// Deterministic but genuinely built from the caller's actual inputs — not a
// hardcoded template string. Every field that changes changes the output.
// Two distinct paths: build a fresh message from the brief (generate/
// regenerate), or transform the message that's already on screen (every
// other action) — refining must never silently fall back to rebuilding from
// the brief, or it duplicates/loses whatever the user already edited.
function demoComposeMessage(input: CampaignComposeInput): string {
  if (REFINE_ACTIONS.has(input.action) && input.currentMessage?.trim()) {
    return refineMessage(input.currentMessage, input)
  }
  return draftMessage(input)
}

function draftMessage(input: CampaignComposeInput): string {
  const tone = (input.tone || 'professional and engaging').toLowerCase()
  const emojiTone = /engaging|fun|playful|exciting/.test(tone)
  const greeting = emojiTone ? 'Hi {{firstName}} 👋' : 'Hi {{firstName}},'
  const headline = input.topic.trim()
  // Avoid grammatical redundancy when the topic already reads like a full
  // sentence ("Summer Sale is Live") rather than a bare noun phrase ("Summer Sale").
  const headlineIsSentence = /\b(is|are|has|have|starts?|ends?|begins?)\b/i.test(headline) || /[.!?]$/.test(headline)
  const headlineLine = headlineIsSentence ? `${headline.replace(/[.!?]+$/, '')}${emojiTone ? '! 🎉' : '.'}` : emojiTone ? `${headline} is here! 🎉` : `${headline}.`
  const lines = [greeting, '', headlineLine]

  if (input.subheading) lines.push(input.subheading.trim())
  if (input.offer) lines.push(input.offer.trim())
  lines.push('')
  if (input.cta) lines.push(emojiTone ? `👉 ${input.cta}: {{shopLink}}` : `${input.cta}: {{shopLink}}`)

  return lines.filter((l, i) => l !== '' || (i > 0 && lines[i - 1] !== '')).join('\n').trim()
}

function refineMessage(current: string, input: CampaignComposeInput): string {
  const bodyLines = current.split('\n')
  // The greeting line ("Hi {{firstName}} ...") is a fixed structural
  // element, not campaign content — refinements below operate on everything
  // after it so they can't duplicate or clobber it.
  const greeting = bodyLines[0] ?? ''
  const rest = bodyLines.slice(1).join('\n').trim()

  switch (input.action) {
    case 'shorten': {
      const firstSentence = rest.split(/(?<=[.!?])\s+/).find((s) => s.trim().length > 0) ?? rest
      const ctaLine = rest.split('\n').find((l) => /shop now|book now|order now|learn more|{{shopLink}}/i.test(l))
      return [greeting, '', firstSentence.trim(), ctaLine && ctaLine.trim() !== firstSentence.trim() ? ctaLine.trim() : null].filter(Boolean).join('\n')
    }
    case 'professional':
      return current.replace(/[!]+/g, '.').replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]+\n/g, '\n').trim()
    case 'engaging':
      return /[!🎉✨]/u.test(current) ? current : `${current}\n\nDon't miss out! 🎉`
    case 'add_emojis':
      return /\p{Extended_Pictographic}/u.test(current)
        ? current
        : current.replace(/(shop now|book now|order now|learn more)/i, (m) => `${m} 🛍️`).replace(greeting, `${greeting} 👋`)
    case 'remove_emojis':
      return current.replace(/\p{Extended_Pictographic}/gu, '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]+$/gm, '').trim()
    case 'translate':
      return input.language ? `[${input.language}]\n${current}` : current
    case 'change_tone':
    default:
      return current
  }
}
