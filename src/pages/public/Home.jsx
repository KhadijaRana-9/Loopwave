import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  Inbox as InboxIcon,
  KanbanSquare,
  Megaphone,
  Sparkles,
  Workflow,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

const FEATURES = [
  { icon: Megaphone, title: 'Broadcast campaigns', text: 'Send templated marketing, utility and authentication messages at scale, with delivery and read tracking.' },
  { icon: InboxIcon, title: 'Shared team inbox', text: 'Every WhatsApp conversation in one place — assign, tag, and resolve as a team without collisions.' },
  { icon: Bot, title: 'Chatbot builder', text: 'Design multi-step flows visually — questions, buttons, conditions, handoffs — no code required.' },
  { icon: Sparkles, title: 'AI agents', text: 'Qualify leads and answer FAQs 24/7, then hand off to a human with full context when it matters.' },
  { icon: Workflow, title: 'Automations', text: 'Trigger tag updates, delays, and agent assignment automatically from any event in your workspace.' },
  { icon: KanbanSquare, title: 'Sales pipeline', text: 'Track every lead from first message to closed deal with a drag-and-drop pipeline board.' },
]

const STEPS = [
  { title: 'Connect your WhatsApp number', text: 'Onboard through the official Meta Cloud API via guided embedded signup.' },
  { title: 'Build your flows', text: 'Set up chatbots, automations and AI agents that match how your team actually sells and supports.' },
  { title: 'Launch & grow', text: 'Run campaigns, manage the shared inbox, and track performance from one analytics dashboard.' },
]

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="brand">Built on the official WhatsApp Business Platform</Badge>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              Turn WhatsApp into your growth engine
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500">
              Loopwave brings campaigns, a shared team inbox, chatbots and AI agents together — so every
              customer conversation on WhatsApp moves your business forward.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup">
                <Button size="lg">
                  Start free trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl rounded-2xl border border-ink-200 bg-ink-50 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-ink-200 px-3 pb-3">
              <span className="h-3 w-3 rounded-full bg-ink-300" />
              <span className="h-3 w-3 rounded-full bg-ink-300" />
              <span className="h-3 w-3 rounded-full bg-ink-300" />
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              <PreviewCard label="Unread conversations" value="18" tone="brand" />
              <PreviewCard label="Campaign read rate" value="68.4%" tone="success" />
              <PreviewCard label="AI conversations today" value="142" tone="info" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-ink-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-ink-900 sm:text-3xl">Everything your team needs, one workspace</h2>
            <p className="mt-3 text-ink-500">
              Marketing, automation and CRM tooling designed around one channel: WhatsApp.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-ink-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-ink-900 sm:text-3xl">Live in an afternoon</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="text-center sm:text-left">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white sm:mx-0">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-ink-950 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to grow on WhatsApp?</h2>
          <p className="mt-3 text-ink-300">Start your free trial today — no credit card required.</p>
          <div className="mt-6 flex justify-center">
            <Link to="/signup">
              <Button size="lg">
                Start free trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function PreviewCard({ label, value, tone }) {
  const tones = {
    brand: 'text-brand-600',
    success: 'text-success-500',
    info: 'text-info-500',
  }
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
    </div>
  )
}
