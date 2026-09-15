import { Waves } from 'lucide-react'
import clsx from 'clsx'

export default function Logo({ dark = false, className }) {
  return (
    <div className={clsx('flex items-center gap-2 font-semibold', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
        <Waves className="h-4.5 w-4.5" />
      </div>
      <span className={clsx('text-lg tracking-tight', dark ? 'text-white' : 'text-ink-900')}>Loopwave</span>
    </div>
  )
}
