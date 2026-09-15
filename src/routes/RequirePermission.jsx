import { ShieldAlert } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

// Real permission gate (not just a hidden button) — used to wrap whole
// pages/routes that a role without the permission should not be able to
// reach even via a direct URL.
export default function RequirePermission({ permission, children }) {
  const { can } = usePermission()

  if (!can(permission)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 px-6 py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-100">
          <ShieldAlert className="h-6 w-6 text-danger-500" />
        </div>
        <h3 className="text-sm font-semibold text-ink-900">Access restricted</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Your role doesn't have permission to view this section. Ask a workspace admin to grant access.
        </p>
      </div>
    )
  }

  return children
}
