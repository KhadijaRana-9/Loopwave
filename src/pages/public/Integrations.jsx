import { integrationsCatalog } from '@/services/mockData'
import { Plug } from 'lucide-react'

export default function Integrations() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold text-ink-900 sm:text-4xl">Connects with the tools you already use</h1>
        <p className="mt-3 text-ink-500">E-commerce, payments, CRM and automation — synced with your WhatsApp workspace.</p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {integrationsCatalog.map((integration) => (
          <div key={integration.id} className="rounded-xl border border-ink-200 bg-white p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
              <Plug className="h-4.5 w-4.5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{integration.name}</h3>
            <span className="text-xs text-ink-400">{integration.category}</span>
            <p className="mt-2 text-sm text-ink-500">{integration.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
