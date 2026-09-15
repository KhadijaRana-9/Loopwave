import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, Plus } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import * as chatbotsService from '@/services/chatbotsService'

export default function Chatbots() {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const chatbotsQuery = useQuery({ queryKey: ['chatbots'], queryFn: chatbotsService.listChatbots })

  const createMutation = useMutation({
    mutationFn: () => chatbotsService.createChatbot({ name }),
    onSuccess: (bot) => {
      queryClient.invalidateQueries({ queryKey: ['chatbots'] })
      setCreateOpen(false)
      setName('')
      navigate(`/app/chatbots/${bot.id}`)
    },
  })

  if (chatbotsQuery.isLoading) return <Spinner label="Loading chatbots..." />
  const chatbots = chatbotsQuery.data

  return (
    <div>
      <PageHeader
        title="Chatbots"
        description="Visual flows that answer, qualify and route customers automatically"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New chatbot
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chatbots.map((bot) => (
          <Card key={bot.id} className="cursor-pointer hover:border-brand-300" onClick={() => navigate(`/app/chatbots/${bot.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <Badge tone={bot.status === 'active' ? 'success' : 'neutral'}>{bot.status}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{bot.name}</h3>
            <p className="mt-1 text-xs text-ink-500">{bot.triggers.join(', ') || 'No triggers set'}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
              <span>{bot.nodes.length} steps</span>
              <span>{bot.conversationsHandled.toLocaleString()} handled</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create chatbot"
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
        <Input label="Chatbot name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Order Status Bot" />
      </Modal>
    </div>
  )
}
