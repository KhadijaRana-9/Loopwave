import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'

export default function RequireAuth() {
  const user = useAuthStore((s) => s.user)
  const hydrated = useAuthStore((s) => s.hydrated)
  const location = useLocation()

  // On first load (or a hard refresh) the store hasn't asked the server who
  // the session cookie belongs to yet — redirecting before that resolves
  // would bounce an actually-logged-in user straight to /login.
  if (!hydrated) return <Spinner label="Loading Loopwave..." />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (user.role === 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  return <Outlet />
}
