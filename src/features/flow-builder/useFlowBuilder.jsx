import { useCallback, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Plus } from 'lucide-react'
import { generateId } from '@/services/http'
import Drawer from '@/components/ui/Drawer'
import FlowNode from './FlowNode'
import NodePalette from './NodePalette'
import NodeInspector from './NodeInspector'
import FlowPreviewModal from './FlowPreviewModal'

// Every entry in NODE_CONFIG renders through the same FlowNode component, so
// one proxy covers all node types without listing them out for React Flow.
const nodeTypes = new Proxy({}, { get: () => FlowNode })

// Shared canvas state + rendering for both the Chatbot Builder and the
// Automation Builder. Returns the current nodes/edges (for the caller's save
// mutation) plus the ready-to-render canvas JSX.
export function useFlowBuilder({ initialNodes, initialEdges, paletteTypes }) {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState(initialEdges)
  const [selectedId, setSelectedId] = useState(null)
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), [])

  function handleAddNode(type) {
    const id = generateId('node')
    const lastNode = nodes[nodes.length - 1]
    const position = lastNode ? { x: lastNode.position.x, y: lastNode.position.y + 120 } : { x: 0, y: 0 }
    setNodes((nds) => [...nds, { id, type, position, data: {} }])
    setMobilePaletteOpen(false)
  }

  function handleNodeDataChange(data) {
    setNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data } : n)))
  }

  function handleDeleteNode() {
    setNodes((nds) => nds.filter((n) => n.id !== selectedId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId))
    setSelectedId(null)
  }

  function handleDuplicateNode() {
    const source = nodes.find((n) => n.id === selectedId)
    if (!source) return
    const id = generateId('node')
    const copy = { ...source, id, position: { x: source.position.x + 40, y: source.position.y + 40 }, data: { ...source.data } }
    setNodes((nds) => [...nds, copy])
    setSelectedId(id)
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null

  const inspectorProps = {
    node: selectedNode,
    onChange: handleNodeDataChange,
    onDelete: handleDeleteNode,
    onDuplicate: handleDuplicateNode,
    onClose: () => setSelectedId(null),
  }

  const canvas = (
    <div className="flex h-full gap-4">
      <div className="hidden lg:block">
        <NodePalette types={paletteTypes} onAdd={handleAddNode} />
      </div>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background gap={16} color="#dfe2e9" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="top-right" className="!bg-white" style={{ width: 120, height: 80 }} />
          </ReactFlow>
        </ReactFlowProvider>
        <button
          onClick={() => setMobilePaletteOpen(true)}
          className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:hidden"
        >
          <Plus className="h-4 w-4" /> Add step
        </button>
      </div>

      <div className="hidden lg:block">
        <NodeInspector {...inspectorProps} />
      </div>

      <div className="lg:hidden">
        <Drawer open={mobilePaletteOpen} onClose={() => setMobilePaletteOpen(false)} title="Add a step">
          <NodePalette types={paletteTypes} onAdd={handleAddNode} embedded />
        </Drawer>
      </div>

      <div className="lg:hidden">
        <Drawer open={!!selectedNode} onClose={() => setSelectedId(null)} title="Edit step">
          <NodeInspector {...inspectorProps} embedded />
        </Drawer>
      </div>

      <FlowPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} nodes={nodes} edges={edges} />
    </div>
  )

  return { nodes, edges, canvas, openPreview: () => setPreviewOpen(true) }
}
