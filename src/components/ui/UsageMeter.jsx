import clsx from 'clsx'
import { formatLimit, usagePercent } from '@/constants/plans'

export default function UsageMeter({ label, used, limit }) {
  const percent = usagePercent(used, limit)
  const tone = percent >= 90 ? 'bg-danger-500' : percent >= 70 ? 'bg-warning-500' : 'bg-brand-500'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-medium text-ink-800">
          {used.toLocaleString()} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div className={clsx('h-full rounded-full', tone)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
