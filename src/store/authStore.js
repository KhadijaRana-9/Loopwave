import { create } from 'zustand'
import * as authService from '@/services/authService'

// Session state (who's logged in) is derived from the backend's httpOnly
// cookies, not from anything readable by JS — that's the point of httpOnly.
// So this store no longer persists to localStorage (previously via zustand's
// `persist`, back when there was no backend and the "session" was fake). On
// app boot it calls hydrate() to ask the server who the current cookie
// belongs to; a 401 there just means "not logged in", not an error.
export const useAuthStore = create((set, get) => ({
  user: null,
  tenant: null,
  membership: null,
  status: 'idle', // idle | loading | authenticated | unauthenticated | error
  error: null,
  hydrated: false,

  isSuperAdmin: () => get().user?.role === 'super_admin',

  hydrate: async () => {
    if (get().hydrated) return
    try {
      const { user, tenant, membership } = await authService.me()
      set({ user, tenant, membership, status: 'authenticated', hydrated: true })
    } catch {
      set({ user: null, tenant: null, membership: null, status: 'unauthenticated', hydrated: true })
    }
  },

  login: async (credentials) => {
    set({ status: 'loading', error: null })
    try {
      const { user, tenant, membership } = await authService.login(credentials)
      set({ user, tenant, membership, status: 'authenticated', hydrated: true })
      return { user, tenant }
    } catch (err) {
      set({ status: 'error', error: err.message })
      throw err
    }
  },

  signup: async (payload) => {
    set({ status: 'loading', error: null })
    try {
      const { user, tenant, membership } = await authService.signup(payload)
      set({ user, tenant, membership, status: 'authenticated', hydrated: true })
      return { user, tenant }
    } catch (err) {
      set({ status: 'error', error: err.message })
      throw err
    }
  },

  acceptInvite: async (payload) => {
    set({ status: 'loading', error: null })
    try {
      const { user, tenant, membership } = await authService.acceptInvite(payload)
      set({ user, tenant, membership, status: 'authenticated', hydrated: true })
      return { user, tenant }
    } catch (err) {
      set({ status: 'error', error: err.message })
      throw err
    }
  },

  loginAsSuperAdmin: async (credentials) => {
    set({ status: 'loading', error: null })
    try {
      const { user } = await authService.loginAsSuperAdmin(credentials)
      set({ user, tenant: null, membership: null, status: 'authenticated', hydrated: true })
      return { user }
    } catch (err) {
      set({ status: 'error', error: err.message })
      throw err
    }
  },

  logout: async () => {
    try {
      await authService.logout()
    } finally {
      set({ user: null, tenant: null, membership: null, status: 'unauthenticated' })
    }
  },

  // Profile/tenant edits go through their own services once those backend
  // routes exist; until then this only updates what's held in memory.
  updateProfile: (patch) => set((s) => ({ user: { ...s.user, ...patch } })),
  updateTenant: (patch) => set((s) => ({ tenant: { ...s.tenant, ...patch } })),
}))
