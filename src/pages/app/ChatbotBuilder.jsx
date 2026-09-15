import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useFlowBuilder } from '@/features/flow-builder/useFlowBuilder'
import { CHATBOT_PALETTE } from '@/features/flow-builder/nodeConfig'
import * as chatbotsService from '@/services/chatbotsService'

export default function ChatbotBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: bot, isLoading } = useQuery({ queryKey: ['chatbot', id], queryFn: () => chatbotsService.getChatbot(id) })

  const saveMutation = useMutation({
    mutationFn: ({ nodes, edges }) => chatbotsService.updateChatbot(id, { nodes, edges }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chatbots'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: () => chatbotsService.updateChatbot(id, { status: bot.status === 'active' ? 'draft' : 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot', id] })
      queryClient.invalidateQueries({ queryKey: ['chatbots'] })
    },
  })

  if (isLoading) return <Spinner label="Loading builder..." />
  if (!bot) return <p className="text-sm text-ink-500">Chatbot not found.</p>

  // Keyed by bot.id so opening a different chatbot resets the canvas instead
  // of reusing the previous bot's in-progress nodes/edges state.
  return (
    <BuilderCanvas
      key={bot.id}
      bot={bot}
      onBack={() => navigate('/app/chatbots')}
      onSave={saveMutation.mutate}
      saving={saveMutation.isPending}
      onToggle={toggleMutation.mutate}
    />
  )
}

function BuilderCanvas({ bot, onBack, onSave, saving, onToggle }) {
  const { nodes, edges, canvas, openPreview } = useFlowBuilder({
    initialNodes: bot.nodes,
    initialEdges: bot.edges,
    paletteTypes: CHATBOT_PALETTE,
  })

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> Chatbots
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink-900">{bot.name}</h1>
            <Badge tone={bot.status === 'active' ? 'success' : 'neutral'}>{bot.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openPreview}>
            <Play className="h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onToggle}>
            {bot.status === 'active' ? 'Pause bot' : 'Activate bot'}
          </Button>
          <Button size="sm" loading={saving} onClick={() => onSave({ nodes, edges })}>
            Save flow
          </Button>
        </div>
      </div>
      <div className="flex-1">{canvas}</div>
    </div>
  )
}
