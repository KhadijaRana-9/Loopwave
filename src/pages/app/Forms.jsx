import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Inbox, Plus, Trash2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import Drawer from '@/components/ui/Drawer'
import EmptyState from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Input'
import * as formsService from '@/services/formsService'
import { generateId } from '@/services/http'

const FIELD_TYPES = ['text', 'phone', 'email', 'dropdown', 'radio', 'checkbox', 'date']

export default function Forms() {
  const [createOpen, setCreateOpen] = useState(false)
  const [previewForm, setPreviewForm] = useState(null)
  const [submissionsForm, setSubmissionsForm] = useState(null)
  const [name, setName] = useState('')
  const [fields, setFields] = useState([{ id: generateId('field'), type: 'text', label: '', required: true }])
  const queryClient = useQueryClient()

  const formsQuery = useQuery({ queryKey: ['forms'], queryFn: formsService.listForms })

  const createMutation = useMutation({
    mutationFn: () => formsService.createForm({ name, fields, status: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] })
      setCreateOpen(false)
      setName('')
      setFields([{ id: generateId('field'), type: 'text', label: '', required: true }])
    },
  })

  const publishMutation = useMutation({
    mutationFn: (form) => formsService.updateForm(form.id, { status: form.status === 'published' ? 'draft' : 'published' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forms'] }),
  })

  const submissionsQuery = useQuery({
    queryKey: ['form-submissions', submissionsForm?.id],
    queryFn: () => formsService.listSubmissions(submissionsForm.id),
    enabled: !!submissionsForm,
  })

  if (formsQuery.isLoading) return <Spinner label="Loading forms..." />
  const forms = formsQuery.data

  function updateField(id, patch) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp forms"
        description="Native in-chat forms that create or update CRM contacts on submission"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New form
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.id}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <ClipboardList className="h-4.5 w-4.5" />
              </div>
              <Badge tone={form.status === 'published' ? 'success' : 'neutral'}>{form.status}</Badge>
            </div>
            <button className="mt-3 block text-left" onClick={() => setPreviewForm(form)}>
              <h3 className="text-sm font-semibold text-ink-900 hover:underline">{form.name}</h3>
            </button>
            <button className="mt-1 text-xs text-ink-500 hover:text-brand-600 hover:underline" onClick={() => setSubmissionsForm(form)}>
              {form.fields.length} fields · {form.submissions} submissions
            </button>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => setSubmissionsForm(form)}>
                <Inbox className="h-3.5 w-3.5" /> Submissions
              </Button>
              <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={() => publishMutation.mutate(form)}>
                {form.status === 'published' ? 'Unpublish' : 'Publish'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create form"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!name}>
              Save form
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Form name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.id} className="flex items-end gap-2 rounded-lg border border-ink-200 p-3">
                <Input label="Field label" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className="flex-1" />
                <Select label="Type" value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value })} className="w-36">
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
                <label className="mb-2.5 flex items-center gap-1.5 text-xs text-ink-600">
                  <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} />
                  Required
                </label>
                <button
                  onClick={() => setFields((fs) => fs.filter((f) => f.id !== field.id))}
                  className="mb-2.5 rounded-lg p-2 text-ink-400 hover:bg-danger-100 hover:text-danger-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setFields((fs) => [...fs, { id: generateId('field'), type: 'text', label: '', required: false }])}
            >
              <Plus className="h-4 w-4" /> Add field
            </Button>
          </div>
        </div>
      </Modal>

      <Drawer open={!!previewForm} onClose={() => setPreviewForm(null)} title={previewForm?.name}>
        {previewForm && (
          <div className="flex flex-col gap-4">
            {previewForm.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1 block text-sm font-medium text-ink-700">
                  {field.label} {field.required && <span className="text-danger-500">*</span>}
                </label>
                {field.type === 'dropdown' || field.type === 'radio' ? (
                  <div className="flex flex-wrap gap-2">
                    {(field.options ?? []).map((opt) => (
                      <Badge key={opt}>{opt}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="h-10 rounded-lg border border-ink-200 bg-ink-50" />
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <Drawer open={!!submissionsForm} onClose={() => setSubmissionsForm(null)} title={`${submissionsForm?.name} — submissions`}>
        {submissionsQuery.isLoading && <Spinner />}
        {submissionsQuery.data?.length === 0 && (
          <EmptyState icon={Inbox} title="No submissions yet" description="Submissions will appear here once this form starts collecting responses." />
        )}
        <div className="flex flex-col gap-3">
          {submissionsQuery.data?.map((sub) => (
            <div key={sub.id} className="rounded-lg border border-ink-200 p-3">
              <div className="mb-2 text-xs text-ink-400">{new Date(sub.submittedAt).toLocaleString()}</div>
              <div className="space-y-1.5 text-sm">
                {Object.entries(sub.values).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-ink-100 py-1 last:border-0">
                    <span className="text-ink-500">{label}</span>
                    <span className="text-right font-medium text-ink-800">{value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Drawer>
    </div>
  )
}
