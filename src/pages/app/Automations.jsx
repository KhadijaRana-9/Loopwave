import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Input, Select } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import * as automationsService from '@/services/automationsService'

const TRIGGERS = [
  { value: 'new_contact', label: 'New contact' },
  { value: 'incoming_message', label: 'Incoming message' },
  { value: 'tag_added', label: 'Tag added' },
  { value: 'lead_status_changed', label: 'Lead status changed' },
  { value: 'form_submitted', label: 'Form submitted' },
  { value: 'campaign_interaction', label: 'Campaign interaction' },
  { value: 'scheduled_event', label: 'Scheduled event' },
]

export default function Automations() {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState(TRIGGERS[0].value)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const automationsQuery = useQuery({ queryKey: ['automations'], queryFn: automationsService.listAutomations })

  const createMutation = useMutation({
    mutationFn: () => automationsService.createAutomation({ name, trigger }),
    onSuccess: (automation) => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      setCreateOpen(false)
      setName('')
      navigate(`/app/automations/${automation.id}`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: automationsService.toggleAutomationStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  if (automationsQuery.isLoading) return <Spinner label="Loading automations..." />
  const automations = automationsQuery.data

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Trigger-based workflows that act on your behalf"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New automation
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {automations.map((a) => (
          <Card key={a.id}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Workflow className="h-4.5 w-4.5" />
              </div>
              <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>{a.status}</Badge>
            </div>
            <button className="mt-3 block text-left" onClick={() => navigate(`/app/automations/${a.id}`)}>
              <h3 className="text-sm font-semibold text-ink-900 hover:underline">{a.name}</h3>
            </button>
            <p className="mt-1 text-xs text-ink-500">Trigger: {a.trigger.replace(/_/g, ' ')}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
              <span>{a.nodes.length} steps</span>
              <span>{a.runsThisMonth.toLocaleString()} runs this month</span>
            </div>
            <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => toggleMutation.mutate(a.id)}>
              {a.status === 'active' ? 'Pause' : 'Activate'}
            </Button>
          </Card>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create automation"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!name}>
              Create & open builder
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Automation name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New Lead Nurture" />
          <Select label="Trigger" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
