import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import * as templatesService from '@/services/templatesService'
import * as contactsService from '@/services/contactsService'

const STEPS = ['Audience', 'Template', 'Variables', 'Preview', 'Schedule']

const emptyFilters = { tags: [], sources: [], statuses: [] }

function matchesFilters(contact, filters) {
  const tagMatch = filters.tags.length === 0 || contact.tags.some((t) => filters.tags.includes(t))
  const sourceMatch = filters.sources.length === 0 || filters.sources.includes(contact.source)
  const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(contact.leadStatus)
  return tagMatch && sourceMatch && statusMatch
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export default function CampaignWizard({ open, onClose, onSubmit, submitting }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState({})
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: templatesService.listTemplates, enabled: open })
  const contactsQuery = useQuery({ queryKey: ['contacts', 'all'], queryFn: () => contactsService.listContacts(), enabled: open })
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data])
  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data])
  const approvedTemplates = useMemo(() => templates.filter((t) => t.status === 'approved'), [templates])

  const ALL_TAGS = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))], [contacts])
  const ALL_SOURCES = useMemo(() => [...new Set(contacts.map((c) => c.source).filter(Boolean))], [contacts])
  const ALL_STATUSES = useMemo(() => [...new Set(contacts.map((c) => c.leadStatus))], [contacts])

  // Derived during render rather than synced via an effect: the moment
  // approved templates load, this resolves to the first one without an
  // extra render-and-setState round trip.
  const effectiveTemplateId = templateId || approvedTemplates[0]?.id || ''

  const ready = !templatesQuery.isLoading && !contactsQuery.isLoading
  const template = templates.find((t) => t.id === effectiveTemplateId)
  const audienceCount = useMemo(() => contacts.filter((c) => matchesFilters(c, filters)).length, [filters, contacts])
  const audienceLabel = useMemo(() => {
    const parts = [...filters.tags.map((t) => `#${t}`), ...filters.sources, ...filters.statuses.map((s) => s.replace('_', ' '))]
    return parts.length ? parts.join(' + ') : 'All contacts'
  }, [filters])

  function reset() {
    setStep(0)
    setName('')
    setFilters(emptyFilters)
    setTemplateId('')
    setVariables({})
    setScheduleMode('now')
    setScheduledAt('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function previewText() {
    if (!template) return ''
    let text = template.body
    template.variables.forEach((v, i) => {
      text = text.replace(`{{${i + 1}}}`, variables[v] || `[${v}]`)
    })
    return text
  }

  function handleSubmit() {
    onSubmit({
      name: name || `${template.name} campaign`,
      templateId: effectiveTemplateId,
      audienceFilter: filters,
      audienceSize: audienceCount,
      scheduledAt: scheduleMode === 'now' ? new Date().toISOString() : scheduledAt || null,
    })
    reset()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Create campaign" size="lg">
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i <= step ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-400'
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-ink-200" />}
          </div>
        ))}
      </div>

      <div className="min-h-[260px]">
        {!ready && (
          <div className="flex h-64 items-center justify-center">
            <Spinner label="Loading campaign data..." />
          </div>
        )}
        {ready && step === 0 && (
          <div className="flex flex-col gap-4">
            <Input label="Campaign name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. September Flash Sale" />

            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2.5">
              <span className="text-sm font-medium text-brand-800">{audienceLabel}</span>
              <Badge tone="brand">{audienceCount} contacts</Badge>
            </div>

            <FilterGroup
              title="Tags"
              options={ALL_TAGS}
              selected={filters.tags}
              onToggle={(v) => setFilters({ ...filters, tags: toggle(filters.tags, v) })}
            />
            <FilterGroup
              title="Source"
              options={ALL_SOURCES}
              selected={filters.sources}
              onToggle={(v) => setFilters({ ...filters, sources: toggle(filters.sources, v) })}
            />
            <FilterGroup
              title="Lead status"
              options={ALL_STATUSES}
              selected={filters.statuses}
              format={(s) => s.replace('_', ' ')}
              onToggle={(v) => setFilters({ ...filters, statuses: toggle(filters.statuses, v) })}
            />

            {(filters.tags.length > 0 || filters.sources.length > 0 || filters.statuses.length > 0) && (
              <button onClick={() => setFilters(emptyFilters)} className="w-fit text-xs font-medium text-ink-500 hover:text-ink-800 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}

        {ready && step === 1 && (
          <div className="space-y-2">
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Select a template</label>
            {templates
              .filter((t) => t.status === 'approved')
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`flex w-full flex-col rounded-lg border p-3 text-left ${
                    effectiveTemplateId === t.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-900">{t.name}</span>
                    <Badge tone="brand">{t.category}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{t.body}</p>
                </button>
              ))}
          </div>
        )}

        {ready && step === 2 && template && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-500">Fill in the template variables for this campaign.</p>
            {template.variables.map((v) => (
              <Input
                key={v}
                label={v.replace('_', ' ')}
                value={variables[v] || ''}
                onChange={(e) => setVariables({ ...variables, [v]: e.target.value })}
              />
            ))}
            {template.variables.length === 0 && <p className="text-sm text-ink-400">This template has no variables.</p>}
          </div>
        )}

        {ready && step === 3 && template && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-full max-w-xs rounded-2xl bg-ink-950 p-4">
              <div className="rounded-xl bg-[#e9fbe5] p-3 text-sm text-ink-900">{previewText()}</div>
            </div>
            <p className="text-xs text-ink-500">
              Preview — sent to {audienceCount} contacts ({audienceLabel}) as "{template.name}"
            </p>
          </div>
        )}

        {ready && step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <button
                onClick={() => setScheduleMode('now')}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium ${scheduleMode === 'now' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}
              >
                Send now
              </button>
              <button
                onClick={() => setScheduleMode('later')}
                className={`flex-1 rounded-lg border p-3 text-sm font-medium ${scheduleMode === 'later' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}
              >
                Schedule for later
              </button>
            </div>
            {scheduleMode === 'later' && (
              <Input type="datetime-local" label="Send at" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between border-t border-ink-100 pt-4">
        <Button variant="outline" onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!ready}>Continue</Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting} disabled={!ready || !template}>
            {scheduleMode === 'now' ? 'Send campaign' : 'Schedule campaign'}
          </Button>
        )}
      </div>
    </Modal>
  )
}

function FilterGroup({ title, options, selected, onToggle, format = (v) => v }) {
  if (options.length === 0) return null
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              selected.includes(opt) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {format(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}
