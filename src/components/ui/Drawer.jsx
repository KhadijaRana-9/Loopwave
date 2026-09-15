import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

export default function Drawer({ open, onClose, title, children, width = 'max-w-md' }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            className="absolute inset-0 bg-ink-950/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className={`relative z-10 h-full w-full ${width} overflow-y-auto bg-white shadow-xl`}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white p-5">
              <h2 className="text-base font-semibold text-ink-900">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
