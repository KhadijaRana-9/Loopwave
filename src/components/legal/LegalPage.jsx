import { Link } from 'react-router-dom'
import { LEGAL } from '@/constants/legal'

const MARK = 'rounded bg-warning-100 px-1 py-0.5 text-warning-700'

// A detail only the owner can supply (see constants/legal.js). Renders the
// real value once it is filled in; until then a visible marker, never a guess.
export function Owner({ field, label }) {
  const value = LEGAL[field]
  if (value) return <>{value}</>
  return <mark className={MARK}>[Owner to provide: {label}]</mark>
}

// A commitment the product/business must actually be able to keep. The text is
// a suggested default; it stays highlighted until the owner confirms it.
export function Confirm({ children }) {
  return (
    <mark className={MARK} title="Suggested default — the owner must confirm this is what the business will do">
      {children} <span className="text-xs">[owner to confirm]</span>
    </mark>
  )
}

export function Section({ id, title, children }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink-600">{children}</div>
    </section>
  )
}

export function List({ children }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>
}

export default function LegalPage({ title, summary, sections, children }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-brand-600">Legal</p>
      <h1 className="mt-1 text-3xl font-semibold text-ink-900">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">
        Effective {LEGAL.effectiveDate} · Last updated {LEGAL.lastUpdated}
      </p>
      {summary && <p className="mt-6 text-base leading-7 text-ink-600">{summary}</p>}

      <nav aria-label="On this page" className="mt-8 rounded-xl border border-ink-200 bg-ink-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">On this page</p>
        <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm text-brand-600 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {children}

      <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-100 pt-6 text-sm text-ink-500">
        <Link to="/privacy" className="hover:text-ink-900">
          Privacy Policy
        </Link>
        <Link to="/terms" className="hover:text-ink-900">
          Terms of Service
        </Link>
        <Link to="/data-deletion" className="hover:text-ink-900">
          Data Deletion
        </Link>
      </div>
    </div>
  )
}
