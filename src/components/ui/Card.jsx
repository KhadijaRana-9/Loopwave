import clsx from 'clsx'

export default function Card({ children, className, padded = true, ...props }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-ink-200 bg-white',
        padded && 'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={clsx('mb-4 flex items-start justify-between gap-3', className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
