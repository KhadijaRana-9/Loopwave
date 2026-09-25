import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { Input, Select, Textarea } from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { toast } from '@/store/toastStore'
import { usePagination } from '@/hooks/usePagination'
import * as templatesService from '@/services/templatesService'
import { WHATSAPP_LANGUAGES } from '@/constants/whatsappLanguages'
import LanguagePicker from '@/components/ui/LanguagePicker'
import { renderPreviewText } from '@/utils/messagePreview'

const STATUS_TONE = { draft: 'neutral', approved: 'success', pending: 'warning', rejected: 'danger' }
const EMPTY_FORM = { name: '', category: 'marketing', language: 'en_US', body: '' }

export default function Templates() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const queryClient = useQueryClient()

  const templatesQuery = useQuery({ queryKey: ['templates'], queryFn: templatesService.listTemplates })

  const saveMutation = useMutation({
    mutationFn: () => {
      const variables = [...form.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => `var_${m[1]}`)
      return editingId ? templatesService.updateTemplate(editingId, { ...form, variables }) : templatesService.createTemplate({ ...form, variables })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      closeForm()
      toast.success(editingId ? 'Template updated' : 'Template saved as draft')
    },
  })

  const submitMutation = useMutation({
    mutationFn: templatesService.submitTemplateForReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template submitted to Meta for review')
    },
    onError: (err) => toast.error(err.message || 'Could not submit this template'),
  })

  const deleteMutation = useMutation({
    mutationFn: templatesService.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template deleted')
    },
  })

  const syncMutation = useMutation({
    mutationFn: templatesService.syncTemplates,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success(`Synced ${result.synced} of ${result.total} template${result.total === 1 ? '' : 's'} from Meta`)
    },
    onError: (err) => toast.error(err.message || 'Could not sync with Meta'),
  })

  const templates = templatesQuery.data ?? []
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(templates, 10)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(template) {
    setEditingId(template.id)
    setForm({ name: template.name, category: template.category, language: template.language, body: template.body })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const columns = [
    { key: 'name', header: 'Template', render: (row) => <span className="font-mono text-xs font-medium text-ink-900">{row.name}</span> },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="brand">{row.category}</Badge> },
    { key: 'language', header: 'Language', render: (row) => WHATSAPP_LANGUAGES.find((l) => l.code === row.language)?.name ?? row.language },
    { key: 'status', header: 'Meta approval', render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === 'draft' && (
            <button
              title="Submit for review"
              onClick={() => submitMutation.mutate(row.id)}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-100 hover:text-brand-600"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
          {(row.status === 'draft' || row.status === 'rejected') && (
            <button title="Edit" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button title="Preview" onClick={() => setPreviewTemplate(row)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100">
            <Eye className="h-4 w-4" />
          </button>
          <button title="Delete" onClick={() => deleteMutation.mutate(row.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-100 hover:text-danger-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Message templates"
        description="UI-managed templates — actual Meta approval happens once submitted through a connected WABA."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
              <RefreshCw className="h-4 w-4" /> Sync from Meta
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New template
            </Button>
          </div>
        }
      />

      {templatesQuery.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table columns={columns} data={pageItems} emptyTitle="No templates yet" emptyDescription="Create your first message template to get started." />
          <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? 'Edit template' : 'Create template'}
        description="Use {{1}}, {{2}}... for variables. New templates start as a draft until you submit them for review."
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} disabled={!form.name || !form.body}>
              {editingId ? 'Save changes' : 'Save as draft'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Template name (snake_case)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
              <option value="authentication">Authentication</option>
            </Select>
            <LanguagePicker label="Language" value={form.language} onChange={(code) => setForm({ ...form, language: code })} />
          </div>
          <Textarea label="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hi {{1}}, ..." />
        </div>
      </Modal>

      <Modal open={!!previewTemplate} onClose={() => setPreviewTemplate(null)} title="Template preview" size="sm">
        {previewTemplate && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-xs rounded-2xl bg-ink-950 p-4">
              <div className="whitespace-pre-wrap rounded-xl bg-[#e9fbe5] p-3 text-sm text-ink-900">{renderPreviewText(previewTemplate.body)}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previewTemplate.variables.map((v) => (
                <Badge key={v}>{v}</Badge>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
