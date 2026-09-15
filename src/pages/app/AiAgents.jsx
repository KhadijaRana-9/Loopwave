import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import * as aiAgentsService from '@/services/aiAgentsService'

export default function AiAgents() {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const agentsQuery = useQuery({ queryKey: ['ai-agents'], queryFn: aiAgentsService.listAiAgents })

  const createMutation = useMutation({
    mutationFn: () => aiAgentsService.createAiAgent({ name, description: '', personality: '', businessInfo: '' }),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] })
      setCreateOpen(false)
      setName('')
      navigate(`/app/ai-agents/${agent.id}`)
    },
  })

  if (agentsQuery.isLoading) return <Spinner label="Loading AI agents..." />
  const agents = agentsQuery.data

  return (
    <div>
      <PageHeader
        title="AI Agents"
        description="Configure AI personas that qualify leads and handle FAQs 24/7"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New AI agent
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="cursor-pointer hover:border-brand-300" onClick={() => navigate(`/app/ai-agents/${agent.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <Badge tone={agent.status === 'active' ? 'success' : 'neutral'}>{agent.status}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{agent.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-ink-500">{agent.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
              <span>{agent.conversationsHandled.toLocaleString()} handled</span>
              {agent.avgLeadScore != null && <span>Avg score {agent.avgLeadScore}</span>}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create AI agent"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate()} disabled={!name}>
              Create & configure
            </Button>
          </>
        }
      >
        <Input label="Agent name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sales Qualifier" />
      </Modal>
    </div>
  )
}
