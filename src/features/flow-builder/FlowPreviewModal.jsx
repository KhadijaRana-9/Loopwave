import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { NODE_CONFIG } from './nodeConfig'

// Walks the flow graph starting from the start/trigger node, rendering each
// step as a chat-style transcript entry. When a node has more than one
// outgoing edge (e.g. a condition's Yes/No branches) the visitor is asked
// which path to take — this is a structural simulation of the saved graph,
// not a live bot, since there's no backend executing real logic yet.
export default function FlowPreviewModal({ open, onClose, nodes, edges }) {
  const [visited, setVisited] = useState([])
  const [currentId, setCurrentId] = useState(null)

  const startNode = nodes.find((n) => n.type === 'start' || n.type === 'trigger')

  function reset() {
    if (startNode) {
      setVisited([startNode])
      setCurrentId(startNode.id)
    } else {
      setVisited([])
      setCurrentId(null)
    }
  }

  useEffect(() => {
    if (open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const outgoing = edges.filter((e) => e.source === currentId)
  const currentNode = nodes.find((n) => n.id === currentId)
  const isEnd = currentNode?.type === 'end' || outgoing.length === 0

  function advance(edge) {
    const nextNode = nodes.find((n) => n.id === edge.target)
    if (!nextNode) return
    setVisited((v) => [...v, nextNode])
    setCurrentId(nextNode.id)
  }

  return (
    <Modal open={open} onClose={onClose} title="Preview flow" description="Simulated walkthrough of the saved graph — not a live bot." size="md">
      {!startNode ? (
        <p className="text-sm text-ink-500">Add a Start/Trigger step to preview this flow.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-ink-50 p-3">
            {visited.map((node, i) => {
              const config = NODE_CONFIG[node.type] ?? NODE_CONFIG.message
              const Icon = config.icon
              return (
                <div key={`${node.id}-${i}`} className="flex items-start gap-2 rounded-lg bg-white p-2.5 shadow-sm">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${config.color}1a`, color: config.color }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-800">{node.data.label ?? config.label}</div>
                    {node.data.text && <p className="text-xs text-ink-500">{node.data.text}</p>}
                  </div>
                </div>
              )
            })}
          </div>

          {isEnd ? (
            <p className="text-center text-sm font-medium text-success-500">Flow complete ✓</p>
          ) : outgoing.length === 1 ? (
            <Button onClick={() => advance(outgoing[0])} className="w-full justify-center">
              Continue
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-500">This step branches — choose a path to continue:</p>
              <div className="flex gap-2">
                {outgoing.map((edge, i) => (
                  <Button key={edge.id} variant="outline" className="flex-1 justify-center" onClick={() => advance(edge)}>
                    {edge.label ?? `Path ${i + 1}`}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="flex w-fit items-center gap-1.5 text-xs text-ink-400 hover:text-ink-700">
            <RotateCcw className="h-3.5 w-3.5" /> Restart preview
          </button>
        </div>
      )}
    </Modal>
  )
}
