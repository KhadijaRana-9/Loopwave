import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'

const NAV_LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/solutions', label: 'Solutions' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/integrations', label: 'Integrations' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
]

export default function PublicLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${isActive ? 'text-brand-600' : 'text-ink-600 hover:text-ink-900'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link to="/login" className="text-sm font-medium text-ink-600 hover:text-ink-900">
              Log in
            </Link>
            <Link to="/signup">
              <Button size="sm">Start free trial</Button>
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-ink-100 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} onClick={() => setOpen(false)} className="text-sm font-medium text-ink-700">
                  {link.label}
                </NavLink>
              ))}
              <hr className="my-1 border-ink-100" />
              <Link to="/login" onClick={() => setOpen(false)} className="text-sm font-medium text-ink-700">
                Log in
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full justify-center">
                  Start free trial
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-100 bg-ink-950 text-ink-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
            <div className="col-span-2">
              <Logo dark />
              <p className="mt-3 max-w-xs text-sm text-ink-400">
                WhatsApp marketing, shared inbox and AI conversations — one platform for growing businesses.
              </p>
            </div>
            <FooterColumn
              title="Product"
              links={[
                { label: 'Features', to: '/features' },
                { label: 'Solutions', to: '/solutions' },
                { label: 'Pricing', to: '/pricing' },
                { label: 'Integrations', to: '/integrations' },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: 'Resources', to: '/resources' },
                { label: 'Contact', to: '/contact' },
              ]}
            />
            <FooterColumn
              title="Account"
              links={[
                { label: 'Log in', to: '/login' },
                { label: 'Start free trial', to: '/signup' },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: 'Privacy Policy', to: '/privacy' },
                { label: 'Terms of Service', to: '/terms' },
                { label: 'Data Deletion', to: '/data-deletion' },
              ]}
            />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-6 text-xs text-ink-500">
            <span>© {new Date().getFullYear()} Loopwave. All rights reserved.</span>
            <span className="flex gap-4">
              <Link to="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-white">
                Terms
              </Link>
              <Link to="/data-deletion" className="hover:text-white">
                Data deletion
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-sm text-ink-400 hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
