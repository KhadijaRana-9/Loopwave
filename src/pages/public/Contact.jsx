import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Owner } from '@/components/legal/LegalPage'
import { LEGAL } from '@/constants/legal'

// Contact details come from src/constants/legal.js — the owner fills them in
// once, and nothing here is invented. There is deliberately no message form:
// no backend endpoint exists to receive one, and a form that only pretends to
// send would be a fake success. Until an email address is configured this page
// shows a marker in its place.
export default function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-ink-900">Talk to our team</h1>
      <p className="mt-3 text-ink-500">Questions about pricing, migrations, or enterprise needs? We're happy to help.</p>

      <div className="mt-8 space-y-4 text-sm text-ink-600">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <Owner field="contactEmail" label="contact email" />
          </span>
        </div>
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <Owner field="contactPhone" label="contact phone, or remove this line if you do not want to publish one" />
          </span>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
          <span>
            <Owner field="registeredAddress" label="business address" />
          </span>
        </div>
      </div>

      {LEGAL.contactEmail && (
        <a href={`mailto:${LEGAL.contactEmail}`} className="mt-8 inline-block">
          <Button>Email us</Button>
        </a>
      )}

      <p className="mt-10 text-sm text-ink-500">
        Privacy or data requests: see our{' '}
        <Link to="/privacy" className="font-medium text-brand-600 hover:underline">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link to="/data-deletion" className="font-medium text-brand-600 hover:underline">
          Data Deletion
        </Link>{' '}
        page.
      </p>
    </div>
  )
}
