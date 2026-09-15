import {
  Bot,
  ClipboardList,
  Inbox,
  KanbanSquare,
  Megaphone,
  MessageCircle,
  Sparkles,
  Workflow,
} from 'lucide-react'

const FEATURE_GROUPS = [
  {
    title: 'Marketing',
    items: [
      { icon: Megaphone, name: 'Broadcast campaigns', text: 'Schedule marketing, utility and authentication broadcasts to segmented audiences.' },
      { icon: MessageCircle, name: 'Template management', text: 'Create, submit and track WhatsApp message templates with variable interpolation.' },
    ],
  },
  {
    title: 'Automation',
    items: [
      { icon: Bot, name: 'Chatbot builder', text: 'Visual, node-based flows — messages, questions, conditions, API calls, AI handoff.' },
      { icon: Sparkles, name: 'AI agents', text: 'Configurable AI personas that qualify leads, answer FAQs and score conversations.' },
      { icon: Workflow, name: 'Workflow automations', text: 'Trigger-based automations across tags, forms, campaigns and scheduled events.' },
      { icon: ClipboardList, name: 'WhatsApp forms', text: 'Native in-chat forms that capture leads directly into your CRM.' },
    ],
  },
  {
    title: 'CRM',
    items: [
      { icon: Inbox, name: 'Shared inbox', text: 'Multi-agent inbox with routing, capacity limits, tags and internal notes.' },
      { icon: KanbanSquare, name: 'Sales pipeline', text: 'Drag-and-drop deal tracking from new lead through to converted customer.' },
    ],
  },
]

export default function Features() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Built for every part of the customer journey</h1>
        <p className="mt-3 text-ink-500">From first message to closed deal, on the channel your customers already use.</p>
      </div>

      <div className="mt-16 space-y-14">
        {FEATURE_GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="text-lg font-semibold text-ink-900">{group.title}</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {group.items.map((item) => (
                <div key={item.name} className="rounded-xl border border-ink-200 bg-white p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink-900">{item.name}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
