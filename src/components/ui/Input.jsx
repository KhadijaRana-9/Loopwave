import clsx from 'clsx'
import { forwardRef } from 'react'

export const Input = forwardRef(function Input({ label, error, hint, className, id, 'aria-label': ariaLabel, ...props }, ref) {
  const inputId = id || props.name
  // A visible <label> is the real fix, but several call sites are
  // intentionally label-less (inline search boxes, filter bars) — falling
  // back to the placeholder as the accessible name beats no name at all,
  // which is what axe's "label" rule was catching.
  const resolvedAriaLabel = label ? ariaLabel : (ariaLabel ?? props.placeholder)
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-label={resolvedAriaLabel}
        className={clsx(
          'h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-100',
          className,
        )}
        {...props}
      />
      {hint && !error && <span className="text-xs text-ink-500">{hint}</span>}
      {error && <span className="text-xs text-danger-500">{error}</span>}
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, id, rows = 4, ...props }, ref) {
  const inputId = id || props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={clsx(
          'rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          error && 'border-danger-500',
          className,
        )}
        {...props}
      />
      {hint && !error && <span className="text-xs text-ink-500">{hint}</span>}
      {error && <span className="text-xs text-danger-500">{error}</span>}
    </div>
  )
})

export const Select = forwardRef(function Select({ label, error, className, id, children, 'aria-label': ariaLabel, ...props }, ref) {
  const inputId = id || props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        aria-label={ariaLabel}
        className={clsx(
          'h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900',
          'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
          error && 'border-danger-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-danger-500">{error}</span>}
    </div>
  )
})
