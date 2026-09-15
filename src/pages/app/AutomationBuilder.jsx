import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { useFlowBuilder } from '@/features/flow-builder/useFlowBuilder'
import { AUTOMATION_PALETTE } from '@/features/flow-builder/nodeConfig'
import * as automationsService from '@/services/automationsService'

export default function AutomationBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: automation, isLoading } = useQuery({
    queryKey: ['automation', id],
    queryFn: () => automationsService.getAutomation(id),
  })

  const saveMutation = useMutation({
    mutationFn: ({ nodes, edges }) => automationsService.updateAutomation(id, { nodes, edges }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: () => automationsService.toggleAutomationStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', id] })
      queryClient.invalidateQueries({ queryKey: ['automations'] })
    },
  })

  if (isLoading) return <Spinner label="Loading builder..." />
  if (!automation) return <p className="text-sm text-ink-500">Automation not found.</p>

  // Keyed by automation.id so opening a different automation resets the
  // canvas instead of reusing the previous one's in-progress state.
  return (
    <BuilderCanvas
      key={automation.id}
      automation={automation}
      onBack={() => navigate('/app/automations')}
      onSave={saveMutation.mutate}
      saving={saveMutation.isPending}
      onToggle={toggleMutation.mutate}
    />
  )
}

function BuilderCanvas({ automation, onBack, onSave, saving, onToggle }) {
  const { nodes, edges, canvas, openPreview } = useFlowBuilder({
    initialNodes: automation.nodes,
    initialEdges: automation.edges,
    paletteTypes: AUTOMATION_PALETTE,
  })

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button onClick={onBack} className="mb-1 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800">
            <ArrowLeft className="h-4 w-4" /> Automations
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink-900">{automation.name}</h1>
            <Badge tone={automation.status === 'active' ? 'success' : 'neutral'}>{automation.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openPreview}>
            <Play className="h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onToggle}>
            {automation.status === 'active' ? 'Pause' : 'Activate'}
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
