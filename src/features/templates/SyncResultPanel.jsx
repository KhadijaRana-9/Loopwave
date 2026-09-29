import { CheckCircle2, ChevronDown, X } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { WHATSAPP_LANGUAGES } from '@/constants/whatsappLanguages'

const languageName = (code) => WHATSAPP_LANGUAGES.find((l) => l.code === code)?.name ?? code ?? 'Unknown'

// What kind of template it is, from the flags the server computed while
// deciding to skip it. "Standard" only means none of the special cases apply.
function templateKind(t) {
  const kinds = []
  if (t.isCarousel) kinds.push('Carousel')
  if (t.hasMediaHeader) kinds.push('Media header')
  if (t.unsupported) kinds.push('Unsupported')
  return kinds.length ? kinds.join(', ') : 'Standard'
}

function Fact({ label, value, tone }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-900">
        {tone ? <Badge tone={tone}>{value}</Badge> : value}
      </dd>
    </div>
  )
}

// Shown after "Sync from Meta". Every number is derived from the server's own
// lists, so a template is only ever shown as imported if it really was, and
// every skipped one is listed with why it was skipped.
export default function SyncResultPanel({ result, onDismiss }) {
  const { synced, imported, skipped, total, importedTemplates = [], skippedTemplates = [] } = result
  const nothingChanged = synced + imported + skipped === 0

  return (
    <section aria-label="Result of the last sync from Meta" className="mb-6 rounded-xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-500" />
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Synced with Meta</h2>
            <p className="text-sm text-ink-500">
              Meta returned {total} template{total === 1 ? '' : 's'} for your WhatsApp Business Account.
              {total === 0 && ' There is nothing to update or import.'}
              {total > 0 && nothingChanged && ' Nothing needed changing.'}
            </p>
          </div>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss sync result" className="rounded-lg p-1 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <dt className="text-xs text-ink-500">Updated</dt>
          <dd className="text-xl font-semibold text-ink-900">{synced}</dd>
        </div>
        <div className="rounded-lg bg-ink-50 p-3">
          <dt className="text-xs text-ink-500">Imported</dt>
          <dd className="text-xl font-semibold text-ink-900">{imported}</dd>
        </div>
        <div className="rounded-lg bg-ink-50 p-3">
          <dt className="text-xs text-ink-500">Skipped</dt>
          <dd className={`text-xl font-semibold ${skipped ? 'text-warning-700' : 'text-ink-900'}`}>{skipped}</dd>
        </div>
      </dl>

      {importedTemplates.length > 0 && (
        <p className="mt-3 text-sm text-ink-600">
          <span className="font-medium text-ink-900">Imported:</span>{' '}
          {importedTemplates.map((t) => `${t.name} (${languageName(t.language)})`).join(', ')}
        </p>
      )}

      {skippedTemplates.length > 0 && (
        <details className="group mt-3 rounded-lg border border-ink-200" open={skippedTemplates.length <= 3}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-ink-900">
            <span>
              {skippedTemplates.length} skipped template{skippedTemplates.length === 1 ? '' : 's'} — not imported
            </span>
            <ChevronDown className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {skippedTemplates.map((t) => (
              <li key={`${t.name}:${t.language}`} className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium text-ink-900">{t.name}</span>
                  <span className="text-xs text-ink-500">{languageName(t.language)}</span>
                  <Badge>Meta: {String(t.metaStatus).toLowerCase()}</Badge>
                </div>
                <p className="mt-1.5 text-sm text-ink-600">{t.reason}</p>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Fact label="Requires variables" value={t.requiresVariables ? 'Yes' : 'No'} tone={t.requiresVariables ? 'warning' : 'neutral'} />
                  <Fact label="Template type" value={templateKind(t)} />
                  <Fact label="Skipped because of plan limit" value={t.planLimit ? 'Yes' : 'No'} tone={t.planLimit ? 'danger' : 'neutral'} />
                </dl>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
