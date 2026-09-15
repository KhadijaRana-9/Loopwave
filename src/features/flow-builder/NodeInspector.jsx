import { Copy, Trash2 } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { NODE_CONFIG } from './nodeConfig'

export default function NodeInspector({ node, onChange, onDelete, onDuplicate, onClose, embedded = false }) {
  if (!node) {
    return embedded ? null : (
      <div className="w-72 shrink-0 rounded-xl border border-dashed border-ink-200 p-4 text-center text-sm text-ink-400">
        Select a step on the canvas to edit it.
      </div>
    )
  }

  const config = NODE_CONFIG[node.type] ?? NODE_CONFIG.message

  return (
    <div className={embedded ? '' : 'w-72 shrink-0 rounded-xl border border-ink-200 bg-white p-4'}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">{config.label} settings</h3>
          <button onClick={onClose} className="text-xs text-ink-400 hover:text-ink-600">
            Close
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <Input label="Step label" value={node.data.label ?? ''} onChange={(e) => onChange({ ...node.data, label: e.target.value })} />
        {config.field === 'text' && (
          <Textarea
            label={node.type === 'condition' ? 'Condition' : node.type === 'delay' ? 'Wait duration' : 'Content'}
            value={node.data.text ?? ''}
            onChange={(e) => onChange({ ...node.data, text: e.target.value })}
            rows={4}
          />
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 justify-center" onClick={onDuplicate}>
          <Copy className="h-4 w-4" /> Duplicate
        </Button>
        <Button variant="danger" size="sm" className="flex-1 justify-center" onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
    </div>
  )
}
