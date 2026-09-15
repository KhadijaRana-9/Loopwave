import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'

const ICONS = { success: CheckCircle2, danger: XCircle, info: Info }
const TONES = {
  success: 'border-success-500/30 text-success-500',
  danger: 'border-danger-500/30 text-danger-500',
  info: 'border-brand-500/30 text-brand-600',
}

function ToastItem({ toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const Icon = ICONS[toast.tone] ?? Info

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, dismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex w-80 items-start gap-2.5 rounded-lg border bg-white p-3 shadow-lg ${TONES[toast.tone]}`}
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
      <p className="flex-1 text-sm text-ink-700">{toast.message}</p>
      <button onClick={() => dismiss(toast.id)} className="text-ink-300 hover:text-ink-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export default function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
