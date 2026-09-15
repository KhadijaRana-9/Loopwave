import { NODE_CONFIG } from './nodeConfig'

export default function NodePalette({ types, onAdd, embedded = false }) {
  return (
    <div className={embedded ? 'space-y-1' : 'w-56 shrink-0 space-y-1 overflow-y-auto rounded-xl border border-ink-200 bg-white p-3'}>
      {!embedded && <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Add a step</h3>}
      {types.map((type) => {
        const config = NODE_CONFIG[type]
        const Icon = config.icon
        return (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-700 hover:bg-ink-100"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${config.color}1a`, color: config.color }}>
              <Icon className="h-4 w-4" />
            </div>
            {config.label}
          </button>
        )
      })}
    </div>
  )
}
