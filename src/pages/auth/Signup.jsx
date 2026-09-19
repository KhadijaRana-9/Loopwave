import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'

const EMPTY_ERRORS = { workspaceName: '', name: '', email: '', password: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Mirrors server/src/validators/auth.validators.ts#passwordSchema exactly —
// client-side checks exist to give instant feedback and avoid an
// unnecessary round trip, but the backend is still what's actually
// authoritative; its response is what populates these same field errors
// for anything caught server-side (e.g. a duplicate email).
function validate(form) {
  const errors = { ...EMPTY_ERRORS }
  if (!form.workspaceName.trim()) errors.workspaceName = 'Workspace name is required.'
  if (!form.name.trim()) errors.name = 'Please enter your full name.'
  if (!form.email.trim()) errors.email = 'Please enter a work email.'
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Please enter a valid work email.'
  if (!form.password) errors.password = 'Password is required.'
  else if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
  else if (!/[a-z]/.test(form.password)) errors.password = 'Password must include a lowercase letter.'
  else if (!/[A-Z]/.test(form.password)) errors.password = 'Password must include an uppercase letter.'
  else if (!/[0-9]/.test(form.password)) errors.password = 'Password must include a number.'
  return errors
}

export default function Signup() {
  const [form, setForm] = useState({ workspaceName: '', name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS)
  const signup = useAuthStore((s) => s.signup)
  const status = useAuthStore((s) => s.status)
  const navigate = useNavigate()

  function update(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      if (fieldErrors[field]) setFieldErrors((errs) => ({ ...errs, [field]: '' }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const clientErrors = validate(form)
    if (Object.values(clientErrors).some(Boolean)) {
      setFieldErrors(clientErrors)
      return
    }
    setFieldErrors(EMPTY_ERRORS)

    try {
      await signup(form)
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        // Real backend field errors, not the generic wrapper message —
        // details[].path matches this form's field names exactly (see
        // server/src/validators/auth.validators.ts#signupSchema).
        const backendErrors = { ...EMPTY_ERRORS }
        for (const d of err.details) if (d.path in backendErrors) backendErrors[d.path] = d.message
        setFieldErrors(backendErrors)
        toast.error('Please fix the highlighted fields.')
      } else if (err.status === 409) {
        setFieldErrors((errs) => ({ ...errs, email: 'An account with this email already exists.' }))
        toast.error('An account with this email already exists. Please log in instead.')
      } else if (err.status && err.status < 500) {
        // Some other real client-side rejection with an actual message
        // (e.g. a permission/rate-limit error) — show it as given.
        toast.error(err.message || 'Could not create your workspace. Please try again.')
      } else {
        // No usable status (network failure) or a genuine 5xx — never show
        // "Some fields need your attention" or a raw fetch error for this.
        toast.error("We couldn't create your workspace right now. Please try again.")
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-ink-900">Start your free trial</h1>
          <p className="mt-1 text-sm text-ink-500">14 days on the Pro plan. No card required for this demo.</p>
          <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
            <Input
              id="signup-workspace"
              label="Business / workspace name"
              value={form.workspaceName}
              onChange={update('workspaceName')}
              error={fieldErrors.workspaceName}
              required
            />
            <Input id="signup-name" label="Your name" value={form.name} onChange={update('name')} error={fieldErrors.name} required />
            <Input
              id="signup-email"
              label="Work email"
              type="email"
              value={form.email}
              onChange={update('email')}
              error={fieldErrors.email}
              required
            />
            <Input
              id="signup-password"
              label="Password"
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              error={fieldErrors.password}
              required
              hint={fieldErrors.password ? undefined : 'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.'}
            />
            <Button type="submit" loading={status === 'loading'} className="mt-1 w-full justify-center">
              {status === 'loading' ? 'Creating workspace...' : 'Create workspace'}
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-ink-500">
          Already have a workspace?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
