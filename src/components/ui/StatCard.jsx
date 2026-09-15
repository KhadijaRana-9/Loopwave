import clsx from 'clsx'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import Card from './Card'

export default function StatCard({ label, value, delta, deltaTone = 'success', icon: Icon, hint, onClick, className }) {
  const clickable = Boolean(onClick)

  return (
    <Card
      className={clsx(
        'flex flex-col gap-3 transition-all',
        clickable && 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md',
        className,
      )}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(e)
              }
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-500">{label}</span>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold text-ink-900">{value}</span>
        {delta && (
          <span
            className={clsx(
              'flex items-center gap-0.5 text-xs font-medium',
              deltaTone === 'success' ? 'text-success-500' : 'text-danger-500',
            )}
          >
            {deltaTone === 'success' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {delta}
          </span>
        )}
      </div>
      {hint && !clickable && <span className="text-xs text-ink-400">{hint}</span>}
      {clickable && (
        <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
          {hint ?? 'View details'} <ArrowRight className="h-3 w-3" />
        </span>
      )}
    </Card>
  )
}
