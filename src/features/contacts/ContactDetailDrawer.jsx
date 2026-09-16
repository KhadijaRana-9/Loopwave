import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, X } from 'lucide-react'
import Drawer from '@/components/ui/Drawer'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import * as contactsService from '@/services/contactsService'
import * as teamService from '@/services/teamService'

const LEAD_STATUSES = ['new', 'qualified', 'contacted', 'interested', 'demo_booked', 'converted', 'lost']

export default function ContactDetailDrawer({ contact, onClose }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [newTag, setNewTag] = useState('')
  const queryClient = useQueryClient()
  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })
  const teamMembers = teamQuery.data ?? []

  function agentName(id) {
    return teamMembers.find((m) => m.id === id)?.name ?? 'Unassigned'
  }

  const updateMutation = useMutation({
    mutationFn: (patch) => contactsService.updateContact(contact.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })

  function patch(fields, successMessage) {
    updateMutation.mutate(fields, { onSuccess: () => successMessage && toast.success(successMessage) })
  }

  function startEdit() {
    setForm({ name: contact.name, phone: contact.phone, email: contact.email, company: contact.company })
    setEditing(true)
  }

  function saveEdit() {
    patch(form, 'Contact details updated')
    setEditing(false)
  }

  function addTag() {
    const tag = newTag.trim()
    if (!tag || contact.tags.includes(tag)) return
    patch({ tags: [...contact.tags, tag] })
    setNewTag('')
  }

  function removeTag(tag) {
    patch({ tags: contact.tags.filter((t) => t !== tag) })
  }

  return (
    <Drawer open={!!contact} onClose={onClose} title={contact?.name}>
      {contact && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-center">
            <Avatar name={contact.name} size={64} />
          </div>

          {editing ? (
            <div className="flex flex-col gap-3">
              <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} loading={updateMutation.isPending}>
                  Save changes
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Phone" value={contact.phone} />
              <Field label="Email" value={contact.email || '—'} />
              <Field label="Company" value={contact.company || '—'} />
              <Field label="Source" value={contact.source} />
              <div className="col-span-2">
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit contact
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="mb-1 text-xs text-ink-500">Lead status</div>
              <Select
                aria-label="Lead status"
                value={contact.leadStatus}
                onChange={(e) => patch({ leadStatus: e.target.value }, 'Lead status updated')}
                className="h-9 text-xs"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-500">Assigned agent</div>
              <Select
                aria-label="Assigned agent"
                value={contact.assignedAgentId ?? ''}
                onChange={(e) => patch({ assignedAgentId: e.target.value || null }, 'Assigned agent updated')}
                className="h-9 text-xs"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Lead score</div>
            <div className="text-lg font-semibold text-ink-900">{contact.leadScore} / 100</div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Tags</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {contact.tags.map((t) => (
                <Badge key={t} className="pr-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 rounded-full hover:bg-black/10" aria-label={`Remove tag ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add a tag..."
                className="h-8 flex-1 text-xs"
              />
              <Button size="sm" variant="outline" onClick={addTag}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Custom fields</div>
            <div className="space-y-1 text-sm">
              {Object.entries(contact.customFields).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-ink-100 py-1.5">
                  <span className="capitalize text-ink-500">{k}</span>
                  <span className="text-ink-800">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Last interaction</div>
            <p className="text-sm text-ink-700">
              {contact.lastInteractionAt ? new Date(contact.lastInteractionAt).toLocaleString() : 'No interactions yet'} — {agentName(contact.assignedAgentId)}
            </p>
          </div>
        </div>
      )}
    </Drawer>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="font-medium text-ink-900">{value}</div>
    </div>
  )
}
