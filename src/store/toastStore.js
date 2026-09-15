import { create } from 'zustand'

let nextId = 1

export const useToastStore = create((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  push: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextId++, tone: 'info', duration: 4000, ...toast }] })),
}))

export const toast = {
  success: (message, opts) => useToastStore.getState().push({ tone: 'success', message, ...opts }),
  error: (message, opts) => useToastStore.getState().push({ tone: 'danger', message, ...opts }),
  info: (message, opts) => useToastStore.getState().push({ tone: 'info', message, ...opts }),
}
