import { Loader2 } from 'lucide-react'

export default function Spinner({ className = 'h-5 w-5', label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-400">
      <Loader2 className={`${className} animate-spin`} />
      <span className="text-sm">{label}</span>
    </div>
  )
}
