import clsx from 'clsx'

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-ink-200">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'relative px-3 py-2.5 text-sm font-medium transition-colors',
            active === tab.value ? 'text-brand-600' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {tab.label}
          {active === tab.value && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500" />
          )}
        </button>
      ))}
    </div>
  )
}
