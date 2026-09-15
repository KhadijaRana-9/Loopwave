import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useAuthStore((s) => s.login)
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await login({ email, password })
      navigate(location.state?.from?.pathname ?? '/app/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Could not log in. Please check your details and try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-ink-900">Log in to your workspace</h1>
          <p className="mt-1 text-sm text-ink-500">Enter your email and password to continue.</p>
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" loading={status === 'loading'} className="mt-1 w-full justify-center">
              Log in
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-ink-500">
          Don't have a workspace?{' '}
          <Link to="/signup" className="font-medium text-brand-600 hover:underline">
            Start a free trial
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-ink-400">
          Platform admin?{' '}
          <Link to="/admin/login" className="font-medium text-ink-500 hover:underline">
            Go to admin login
          </Link>
        </p>
      </div>
    </div>
  )
}
