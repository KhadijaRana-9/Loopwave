import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles, RefreshCw, Wand2, Smile, SmilePlus, AlertTriangle, Search, Check, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import * as templatesService from '@/services/templatesService'
import * as contactsService from '@/services/contactsService'
import * as campaignsService from '@/services/campaignsService'
import * as billingService from '@/services/billingService'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const STEPS = ['Compose', 'Audience', 'Preview', 'Schedule']

const TONE_OPTIONS = ['Professional and engaging', 'Professional', 'Friendly and casual', 'Exciting and bold', 'Warm and appreciative']
const LANGUAGE_CODES = { English: 'en_US', Hindi: 'hi_IN', Urdu: 'ur_PK', Arabic: 'ar', Spanish: 'es_ES', French: 'fr_FR' }

const QUICK_ACTIONS = [
  { action: 'regenerate', label: 'Regenerate', icon: RefreshCw },
  { action: 'shorten', label: 'Shorten', icon: Wand2 },
  { action: 'professional', label: 'More professional', icon: Wand2 },
  { action: 'engaging', label: 'More engaging', icon: Sparkles },
  { action: 'add_emojis', label: 'Add emojis', icon: Smile },
  { action: 'remove_emojis', label: 'Remove emojis', icon: SmilePlus },
]

const SAMPLE_VALUES = {
  firstName: 'Aisha',
  lastName: 'Khan',
  name: 'Aisha Khan',
  companyName: 'Your Business',
  phone: '+91 98765 43210',
  discount: '50%',
  shopLink: 'https://yourshop.example/sale',
}

function renderPreviewText(text) {
  return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => SAMPLE_VALUES[key] ?? match)
}

function emptyFilters() {
  return { tags: [], sources: [], statuses: [] }
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function emptyBrief() {
  return { topic: '', subheading: '', offer: '', tone: TONE_OPTIONS[0], language: 'English', cta: '', instructions: '' }
}

export default function CampaignWizard({ open, onClose, onSubmit, submitting, submitError }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')

  // --- Compose ---
  const [composeMode, setComposeMode] = useState('ai') // 'ai' | 'template'
  const [brief, setBrief] = useState(emptyBrief)
  const [message, setMessage] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [templateId, setTemplateId] = useState('')

  // --- Audience ---
  const [audienceMode, setAudienceMode] = useState('all') // 'all' | 'filter' | 'contacts'
  const [filters, setFilters] = useState(emptyFilters)
  const [search, setSearch] = useState('')
  const [selectedContactIds, setSelectedContactIds] = useState(() => new Set())

  // --- Schedule ---
  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduledAt, setScheduledAt] = useState('')

  const debouncedSearch = useDebouncedValue(search, 350)
  const hasActiveFilters = filters.tags.length > 0 || filters.sources.length > 0 || filters.statuses.length > 0 || debouncedSearch.trim().length > 0

  // Filter chips (and search, outside contacts mode) always imply "match this
  // segment" — switching mode away from manual picking is what makes
  // "select all matching the current filter" the default, not an afterthought.
  useEffect(() => {
    if (audienceMode === 'contacts') return
    setAudienceMode(hasActiveFilters ? 'filter' : 'all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveFilters])

  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: templatesService.listTemplates, enabled: open && composeMode === 'template' })
  const approvedTemplates = useMemo(() => (templatesQuery.data ?? []).filter((t) => t.status === 'approved'), [templatesQuery.data])
  const selectedTemplate = approvedTemplates.find((t) => t.id === templateId)

  const facetsQuery = useQuery({ queryKey: ['contacts-facets'], queryFn: contactsService.getContactFacets, enabled: open })
  const facets = facetsQuery.data ?? { tags: [], sources: [], statuses: [] }

  const contactSearchQuery = useQuery({
    queryKey: ['contacts-search', debouncedSearch],
    queryFn: () => contactsService.searchContacts({ search: debouncedSearch, pageSize: 25 }),
    enabled: open && step === 1,
  })
  const searchResults = contactSearchQuery.data?.items ?? []

  const audienceFilterPayload = useMemo(
    () => ({
      mode: audienceMode,
      tags: filters.tags,
      sources: filters.sources,
      statuses: filters.statuses,
      search: audienceMode === 'filter' ? debouncedSearch || undefined : undefined,
      contactIds: audienceMode === 'contacts' ? [...selectedContactIds] : [],
    }),
    [audienceMode, filters, debouncedSearch, selectedContactIds],
  )

  const audiencePreviewQuery = useQuery({
    queryKey: ['campaign-audience-preview', audienceFilterPayload],
    queryFn: () => campaignsService.previewAudience(audienceFilterPayload),
    enabled: open && step >= 1 && (audienceMode !== 'contacts' || selectedContactIds.size > 0),
  })
  const resolvedCount = audienceMode === 'contacts' && selectedContactIds.size === 0 ? 0 : (audiencePreviewQuery.data?.count ?? null)

  const subscriptionQuery = useQuery({ queryKey: ['subscription'], queryFn: billingService.getCurrentSubscription, enabled: open })
  const plan = audiencePreviewQuery.data?.plan
  const overLimit = plan && plan.remaining !== -1 && resolvedCount !== null && resolvedCount > plan.remaining

  const composeMutation = useMutation({
    mutationFn: (action) => campaignsService.composeAiMessage({ campaignName: name, ...brief, action, currentMessage: message || undefined }),
    onSuccess: (result) => {
      setMessage(result.message)
      setHasGenerated(true)
    },
  })

  function toggleContact(id) {
    setAudienceMode('contacts')
    setSelectedContactIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (audienceMode !== 'contacts') {
      setAudienceMode('contacts')
      setSelectedContactIds(new Set())
    } else {
      setAudienceMode(hasActiveFilters ? 'filter' : 'all')
    }
  }
  const isMatchingModeActive = audienceMode === 'all' || audienceMode === 'filter'

  function reset() {
    setStep(0)
    setName('')
    setComposeMode('ai')
    setBrief(emptyBrief())
    setMessage('')
    setHasGenerated(false)
    setTemplateId('')
    setAudienceMode('all')
    setFilters(emptyFilters())
    setSearch('')
    setSelectedContactIds(new Set())
    setScheduleMode('now')
    setScheduledAt('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  const messageReady = composeMode === 'ai' ? message.trim().length > 0 : Boolean(selectedTemplate)
  const canContinueFromCompose = messageReady && name.trim().length > 0
  const canContinueFromAudience = resolvedCount !== null && resolvedCount > 0
  const canSend = !overLimit && canContinueFromAudience

  function handleSubmit() {
    const payload = {
      name: name.trim(),
      audienceFilter: audienceFilterPayload,
      scheduledAt: scheduleMode === 'now' ? new Date().toISOString() : scheduledAt || null,
    }
    if (composeMode === 'ai') {
      payload.message = message
      payload.language = LANGUAGE_CODES[brief.language] || 'en_US'
    } else {
      payload.templateId = templateId
    }
    onSubmit(payload)
  }

  const previewBody = composeMode === 'ai' ? message : selectedTemplate?.body || ''

  return (
    <Modal open={open} onClose={handleClose} title="Create campaign" size="xl">
      <ol className="mb-6 flex flex-wrap items-center gap-2" aria-label="Campaign creation steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <div
              aria-current={i === step ? 'step' : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i < step ? 'bg-brand-500 text-white' : i === step ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-ink-100 text-ink-400'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-ink-900' : 'text-ink-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-ink-200" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="min-h-[320px]">
        {/* STEP 0 — Compose */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <Input id="campaign-name" label="Campaign name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale" />

            <div className="flex gap-2 rounded-lg bg-ink-50 p-1" role="tablist" aria-label="Message source">
              <button
                role="tab"
                aria-selected={composeMode === 'ai'}
                onClick={() => setComposeMode('ai')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${composeMode === 'ai' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                <Sparkles className="mr-1.5 inline h-3.5 w-3.5" /> Write with AI
              </button>
              <button
                role="tab"
                aria-selected={composeMode === 'template'}
                onClick={() => setComposeMode('template')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${composeMode === 'template' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500'}`}
              >
                Use an existing template
              </button>
            </div>

            {composeMode === 'ai' && (
              <div className="flex flex-col gap-5 rounded-xl border border-ink-100 bg-gradient-to-b from-brand-50/40 to-transparent p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input id="brief-topic" label="Topic / headline" value={brief.topic} onChange={(e) => setBrief({ ...brief, topic: e.target.value })} placeholder="Summer Sale is Live" />
                  <Input id="brief-cta" label="Call to action" value={brief.cta} onChange={(e) => setBrief({ ...brief, cta: e.target.value })} placeholder="Shop Now" />
                  <div className="sm:col-span-2">
                    <Textarea
                      id="brief-subheading"
                      label="Subheading / details / offer"
                      rows={2}
                      value={brief.subheading}
                      onChange={(e) => setBrief({ ...brief, subheading: e.target.value })}
                      placeholder="Up to 50% off on selected dresses and clothing."
                    />
                  </div>
                  <Select id="brief-tone" label="Tone" value={brief.tone} onChange={(e) => setBrief({ ...brief, tone: e.target.value })}>
                    {TONE_OPTIONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                  <Select id="brief-language" label="Language" value={brief.language} onChange={(e) => setBrief({ ...brief, language: e.target.value })}>
                    {Object.keys(LANGUAGE_CODES).map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </Select>
                  <div className="sm:col-span-2">
                    <Input
                      id="brief-instructions"
                      label="Additional instructions (optional)"
                      value={brief.instructions}
                      onChange={(e) => setBrief({ ...brief, instructions: e.target.value })}
                      placeholder="Keep the message concise and suitable for WhatsApp."
                    />
                  </div>
                </div>

                <Button
                  onClick={() => composeMutation.mutate(hasGenerated ? 'regenerate' : 'generate')}
                  loading={composeMutation.isPending}
                  disabled={!brief.topic.trim()}
                  className="w-fit"
                >
                  <Sparkles className="h-4 w-4" /> {hasGenerated ? 'Regenerate with AI' : 'Generate with AI'}
                </Button>

                <div aria-live="polite">
                  {composeMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-ink-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Writing your message…
                    </div>
                  )}
                  {composeMutation.isError && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> {composeMutation.error?.message || 'Could not generate a message. Please try again.'}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => composeMutation.mutate(hasGenerated ? 'regenerate' : 'generate')}>
                        Retry
                      </Button>
                    </div>
                  )}
                </div>

                {(hasGenerated || message) && (
                  <>
                    <Textarea
                      id="generated-message"
                      label="Generated message — edit freely"
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      hint="Personalize with {{firstName}}, {{companyName}}, {{discount}} or {{shopLink}} — resolved per contact when sent."
                    />
                    <div className="flex flex-wrap gap-2">
                      {QUICK_ACTIONS.map(({ action, label, icon: Icon }) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => composeMutation.mutate(action)}
                          disabled={composeMutation.isPending || !message.trim()}
                          className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-50"
                        >
                          <Icon className="h-3.5 w-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {composeMode === 'template' && (
              <div className="space-y-2">
                {templatesQuery.isLoading && <Spinner label="Loading templates..." />}
                {!templatesQuery.isLoading && approvedTemplates.length === 0 && (
                  <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-500">No approved templates yet — create one under Templates, or write with AI instead.</p>
                )}
                {approvedTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`flex w-full flex-col rounded-lg border p-3 text-left ${templateId === t.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'}`}
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

            {previewBody && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-500">WhatsApp preview (sample data)</div>
                <div className="w-full max-w-xs rounded-2xl bg-ink-950 p-3">
                  <div className="whitespace-pre-wrap rounded-xl bg-[#e9fbe5] p-3 text-sm text-ink-900">{renderPreviewText(previewBody)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — Audience */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input aria-label="Search contacts" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts by name, phone or company..." className="pl-9" />
            </div>

            <FilterGroup title="Tags" options={facets.tags} selected={filters.tags} onToggle={(v) => setFilters({ ...filters, tags: toggle(filters.tags, v) })} />
            <FilterGroup title="Source" options={facets.sources} selected={filters.sources} onToggle={(v) => setFilters({ ...filters, sources: toggle(filters.sources, v) })} />
            <FilterGroup
              title="Lead status"
              options={facets.statuses?.map((s) => s.value) ?? []}
              selected={filters.statuses}
              format={(s) => s.replace('_', ' ').toLowerCase()}
              onToggle={(v) => setFilters({ ...filters, statuses: toggle(filters.statuses, v) })}
            />

            <label className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-800">
                <input type="checkbox" checked={isMatchingModeActive} onChange={toggleSelectAll} className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500" />
                {hasActiveFilters ? 'Select all contacts matching these filters' : 'Select all contacts'}
              </span>
              <Badge tone="brand" aria-live="polite">
                {resolvedCount === null ? 'Loading…' : `${resolvedCount.toLocaleString()} selected`}
              </Badge>
            </label>

            {!isMatchingModeActive && (
              <div className="rounded-lg border border-ink-200">
                <div className="border-b border-ink-100 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-500">
                  Or choose individually {selectedContactIds.size > 0 && `— ${selectedContactIds.size} picked`}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {contactSearchQuery.isLoading && (
                    <div className="p-4">
                      <Spinner label="Searching contacts..." />
                    </div>
                  )}
                  {!contactSearchQuery.isLoading && searchResults.length === 0 && <p className="p-4 text-sm text-ink-400">No contacts match this search.</p>}
                  {searchResults.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-ink-50 px-3 py-2 text-sm last:border-0 hover:bg-ink-50">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-ink-900">{c.name}</span>
                        <span className="ml-2 text-ink-400">{c.phone}</span>
                      </span>
                      {!c.optedIn && (
                        <Badge tone="danger" title="Opted out — won't receive campaign messages">
                          opted out
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Preview & usage */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-ink-50 py-6">
              <div className="w-full max-w-xs rounded-2xl bg-ink-950 p-3">
                <div className="whitespace-pre-wrap rounded-xl bg-[#e9fbe5] p-3 text-sm text-ink-900">{renderPreviewText(previewBody)}</div>
              </div>
              <p className="text-xs text-ink-500">This is what will actually be sent, with each contact's own details filled in.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PreviewStat label="Recipients" value={resolvedCount === null ? '…' : resolvedCount.toLocaleString()} />
              <PreviewStat label="Plan" value={subscriptionQuery.data?.plan?.name ?? '…'} />
              <PreviewStat label="Available" value={plan ? (plan.remaining === -1 ? 'Unlimited' : plan.remaining.toLocaleString()) : '…'} />
              <PreviewStat
                label="Remaining after"
                value={plan && resolvedCount !== null ? (plan.remaining === -1 ? 'Unlimited' : Math.max(0, plan.remaining - resolvedCount).toLocaleString()) : '…'}
              />
            </div>

            {overLimit && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    You selected {resolvedCount.toLocaleString()} recipients, but your plan currently has {plan.remaining.toLocaleString()} messages available.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                      Reduce audience
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — Schedule / Send */}
        {step === 3 && (
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
              <Input id="scheduled-at" type="datetime-local" label="Send at" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            )}
            <div className="rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
              Sending <span className="font-semibold text-ink-900">{resolvedCount?.toLocaleString() ?? 0}</span> message{resolvedCount === 1 ? '' : 's'} as "
              <span className="font-medium">{name}</span>".
            </div>
            {submitError && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {submitError}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between border-t border-ink-100 pt-4">
        <Button variant="outline" onClick={() => (step === 0 ? handleClose() : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={(step === 0 && !canContinueFromCompose) || (step === 1 && !canContinueFromAudience) || (step === 2 && overLimit)}
          >
            Continue
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting} disabled={!canSend}>
            {scheduleMode === 'now' ? 'Send campaign' : 'Schedule campaign'}
          </Button>
        )}
      </div>
    </Modal>
  )
}

function PreviewStat({ label, value }) {
  return (
    <div className="rounded-lg border border-ink-100 p-3 text-center">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink-900">{value}</div>
    </div>
  )
}

function FilterGroup({ title, options, selected, onToggle, format = (v) => v }) {
  if (!options || options.length === 0) return null
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={selected.includes(opt)}
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
