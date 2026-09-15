import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-500',
  secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200 focus-visible:outline-ink-400',
  outline: 'border border-ink-200 text-ink-700 hover:bg-ink-50 focus-visible:outline-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 focus-visible:outline-ink-400',
  danger: 'bg-danger-500 text-white hover:bg-red-700 focus-visible:outline-danger-500',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 justify-center',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center rounded-lg font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
