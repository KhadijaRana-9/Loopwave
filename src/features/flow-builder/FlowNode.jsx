import { Handle, Position } from '@xyflow/react'
import { NODE_CONFIG } from './nodeConfig'

export default function FlowNode({ data, type, selected }) {
  const config = NODE_CONFIG[type] ?? NODE_CONFIG.message
  const Icon = config.icon

  return (
    <div
      className={`w-56 rounded-lg border-2 bg-white shadow-sm transition-shadow ${selected ? 'shadow-md' : ''}`}
      style={{ borderColor: selected ? config.color : '#dfe2e9' }}
    >
      {type !== 'start' && type !== 'trigger' && (
        <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-ink-300 !bg-white" />
      )}
      <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${config.color}1a`, color: config.color }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-semibold text-ink-800">{data.label ?? config.label}</span>
      </div>
      {data.text && <div className="truncate px-3 py-2 text-xs text-ink-500">{data.text}</div>}
      {type !== 'end' && <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-ink-300 !bg-white" />}
    </div>
  )
}
