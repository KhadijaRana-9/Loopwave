import { useAuthStore } from '@/store/authStore'
import { hasPermission, hasAnyPermission } from '@/constants/permissions'

export function usePermission() {
  const role = useAuthStore((s) => s.user?.role)
  return {
    role,
    can: (permission) => hasPermission(role, permission),
    canAny: (permissions) => hasAnyPermission(role, permissions),
  }
}
