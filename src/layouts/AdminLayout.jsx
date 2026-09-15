import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import Avatar from '@/components/ui/Avatar'
import { ADMIN_NAV } from '@/constants/navigation'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  const navList = (onNavigate) => (
    <nav className="flex-1 overflow-y-auto p-3">
      {ADMIN_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon className="h-4.5 w-4.5 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-950 md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="text-sm font-semibold text-white">Loopwave Admin</span>
        </div>
        {navList()}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex h-full w-64 flex-col bg-ink-950">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="text-sm font-semibold text-white">Loopwave Admin</span>
              <button onClick={() => setMobileOpen(false)} className="text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-ink-200 bg-white px-4 sm:px-6">
          <button className="text-ink-500 md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-ink-500">Platform Control Center</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar name={user?.name} color={user?.avatarColor} size={32} />
              <span className="hidden text-sm font-medium text-ink-800 sm:block">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="rounded-lg p-2 text-ink-400 hover:bg-ink-100" title="Log out">
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
