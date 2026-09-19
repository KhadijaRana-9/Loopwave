import clsx from 'clsx'

const TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-100 text-success-500',
  warning: 'bg-warning-100 text-warning-500',
  danger: 'bg-danger-100 text-danger-500',
  // 700 not 500 — same reason `brand` above uses 700: info-500 on info-100
  // fails WCAG AA contrast (confirmed via axe-core).
  info: 'bg-info-100 text-info-700',
}

export default function Badge({ tone = 'neutral', children, className, dot = false }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
