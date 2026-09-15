import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'

export default function RequireSuperAdmin() {
  const user = useAuthStore((s) => s.user)
  const hydrated = useAuthStore((s) => s.hydrated)

  if (!hydrated) return <Spinner label="Loading Loopwave..." />

  if (!user) return <Navigate to="/admin/login" replace />
  if (user.role !== 'super_admin') return <Navigate to="/app/dashboard" replace />
  return <Outlet />
}
