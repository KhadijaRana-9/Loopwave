import { BookOpen, FileText, LifeBuoy, Video } from 'lucide-react'

const RESOURCES = [
  { icon: BookOpen, title: 'Getting started guide', text: 'Connect your WhatsApp number and send your first campaign in under an hour.' },
  { icon: Video, title: 'Product walkthroughs', text: 'Short videos covering the inbox, chatbot builder, and automations.' },
  { icon: FileText, title: 'API & webhook docs', text: 'Reference for the Application and Platform APIs, and webhook event payloads.' },
  { icon: LifeBuoy, title: 'Help center', text: 'Answers to common setup, billing and messaging questions.' },
]

export default function Resources() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Resources</h1>
        <p className="mt-3 text-ink-500">Guides and references to get the most out of Loopwave.</p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {RESOURCES.map((r) => (
          <div key={r.title} className="rounded-xl border border-ink-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <r.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink-900">{r.title}</h3>
            <p className="mt-1.5 text-sm text-ink-500">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
