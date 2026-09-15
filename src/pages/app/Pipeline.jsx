import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, IndianRupee } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Avatar from '@/components/ui/Avatar'
import DealDetailDrawer from '@/features/pipeline/DealDetailDrawer'
import * as pipelineService from '@/services/pipelineService'
import * as teamService from '@/services/teamService'

export default function Pipeline() {
  const [draggedId, setDraggedId] = useState(null)
  const [activeDealId, setActiveDealId] = useState(null)
  const justDragged = useRef(false)
  const queryClient = useQueryClient()

  const stagesQuery = useQuery({ queryKey: ['pipeline-stages'], queryFn: pipelineService.listStages })
  const dealsQuery = useQuery({ queryKey: ['deals'], queryFn: pipelineService.listDeals })
  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })
  const teamMembers = teamQuery.data ?? []

  const moveMutation = useMutation({
    mutationFn: ({ dealId, stage }) => pipelineService.moveDeal(dealId, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })

  if (stagesQuery.isLoading || dealsQuery.isLoading) return <Spinner label="Loading pipeline..." />

  const stages = stagesQuery.data
  const deals = dealsQuery.data
  const activeDeal = deals.find((d) => d.id === activeDealId) ?? null

  function agentName(id) {
    return teamMembers.find((m) => m.id === id)?.name ?? 'Unassigned'
  }

  function handleDrop(stageId) {
    if (draggedId) {
      moveMutation.mutate({ dealId: draggedId, stage: stageId })
      setDraggedId(null)
    }
  }

  function handleCardClick(dealId) {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    setActiveDealId(dealId)
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)

  return (
    <div>
      <PageHeader
        title="Sales pipeline"
        description={`${deals.length} deals · ₹${totalValue.toLocaleString()} total value`}
      />
      <div className="flex gap-4 overflow-x-auto pb-4" tabIndex={0} role="group" aria-label="Pipeline stages, scroll horizontally to see more">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage.id)
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0)
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
              className="flex w-72 shrink-0 flex-col rounded-xl border border-ink-200 bg-ink-50"
            >
              <div className="flex items-center justify-between border-b border-ink-200 p-3">
                <span className="text-sm font-semibold text-ink-800">{stage.label}</span>
                <Badge>{stageDeals.length}</Badge>
              </div>
              <div className="px-3 pt-2 text-xs text-ink-500">₹{stageValue.toLocaleString()}</div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggedId(deal.id)}
                    onDragEnd={() => {
                      justDragged.current = true
                    }}
                    onClick={() => handleCardClick(deal.id)}
                    className="cursor-pointer rounded-lg border border-ink-200 bg-white p-3 shadow-sm hover:border-brand-300 active:cursor-grabbing"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-ink-900">{deal.title}</span>
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-success-500">
                      <IndianRupee className="h-3 w-3" /> {deal.value.toLocaleString()}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {deal.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                      <Avatar name={agentName(deal.assignedAgentId)} size={18} />
                      {agentName(deal.assignedAgentId)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <DealDetailDrawer deal={activeDeal} stages={stages} onClose={() => setActiveDealId(null)} />
    </div>
  )
}
