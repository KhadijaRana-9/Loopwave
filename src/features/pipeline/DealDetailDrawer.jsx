import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IndianRupee, Plus, X } from 'lucide-react'
import Drawer from '@/components/ui/Drawer'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import * as pipelineService from '@/services/pipelineService'
import * as teamService from '@/services/teamService'
import { useAuthStore } from '@/store/authStore'

export default function DealDetailDrawer({ deal, stages, onClose }) {
  const [newTag, setNewTag] = useState('')
  const [noteText, setNoteText] = useState('')
  const [editingValue, setEditingValue] = useState(false)
  const [valueDraft, setValueDraft] = useState(0)
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })
  const teamMembers = teamQuery.data ?? []

  const updateMutation = useMutation({
    mutationFn: (patch) => pipelineService.updateDeal(deal.id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })

  const noteMutation = useMutation({
    mutationFn: (text) => pipelineService.addDealNote(deal.id, text, currentUser?.name ?? 'You'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] })
      setNoteText('')
    },
  })

  function patch(fields, message) {
    updateMutation.mutate(fields, { onSuccess: () => message && toast.success(message) })
  }

  function addTag() {
    const tag = newTag.trim()
    if (!tag || deal.tags.includes(tag)) return
    patch({ tags: [...deal.tags, tag] })
    setNewTag('')
  }

  return (
    <Drawer open={!!deal} onClose={onClose} title={deal?.title}>
      {deal && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={deal.contact?.name} size={44} />
            <div>
              <div className="text-sm font-semibold text-ink-900">{deal.contact?.name}</div>
              <div className="text-xs text-ink-500">{deal.contact?.phone}</div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-ink-500">Deal value</div>
            {editingValue ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={valueDraft}
                  onChange={(e) => setValueDraft(Number(e.target.value))}
                  className="h-9"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => {
                    patch({ value: valueDraft }, 'Deal value updated')
                    setEditingValue(false)
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingValue(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1 text-lg font-semibold text-success-500 hover:underline"
                onClick={() => {
                  setValueDraft(deal.value)
                  setEditingValue(true)
                }}
              >
                <IndianRupee className="h-4 w-4" /> {deal.value.toLocaleString()}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-xs text-ink-500">Stage</div>
              <Select aria-label="Deal stage" value={deal.stage} onChange={(e) => patch({ stage: e.target.value }, 'Stage updated')} className="h-9 text-xs">
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-500">Assigned agent</div>
              <Select
                aria-label="Assigned agent"
                value={deal.assignedAgentId ?? ''}
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

          <div className="text-xs text-ink-500">Source: {deal.source}</div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Tags</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {deal.tags.map((t) => (
                <Badge key={t} className="pr-1">
                  {t}
                  <button onClick={() => patch({ tags: deal.tags.filter((x) => x !== t) })} className="ml-1 rounded-full hover:bg-black/10" aria-label={`Remove tag ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Add a tag..." className="h-8 flex-1 text-xs" />
              <Button size="sm" variant="outline" onClick={addTag}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-ink-500">Activity & notes</div>
            <div className="space-y-2">
              <div className="rounded-lg bg-ink-50 p-2 text-xs text-ink-500">Last updated {new Date(deal.updatedAt).toLocaleString()}</div>
              {deal.notes.map((note) => (
                <div key={note.id} className="rounded-lg bg-ink-50 p-2 text-xs">
                  <p className="text-ink-700">{note.text}</p>
                  <span className="text-ink-400">
                    — {note.author}, {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && noteText.trim() && noteMutation.mutate(noteText.trim())}
                placeholder="Add a note..."
                className="h-8 flex-1 rounded-lg border border-ink-200 px-2.5 text-xs outline-none focus:border-brand-500"
              />
              <Button size="sm" variant="outline" disabled={!noteText.trim()} loading={noteMutation.isPending} onClick={() => noteMutation.mutate(noteText.trim())}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  )
}
