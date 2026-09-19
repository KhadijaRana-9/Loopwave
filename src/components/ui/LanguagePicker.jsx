import { useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { WHATSAPP_LANGUAGES } from '@/constants/whatsappLanguages'

// Accessible searchable combobox (WAI-ARIA combobox pattern) over the real
// Meta-supported WhatsApp template languages — a plain <select> with 70+
// options gives poor type-ahead, and this list is long enough that search
// genuinely matters. `value` / `onChange` carry the language code.
export default function LanguagePicker({ label, value, onChange, className }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()

  const selected = WHATSAPP_LANGUAGES.find((l) => l.code === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return WHATSAPP_LANGUAGES
    return WHATSAPP_LANGUAGES.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function selectLanguage(code) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      setActiveIndex(0)
      e.preventDefault()
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setActiveIndex((i) => Math.max(i - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (filtered[activeIndex]) selectLanguage(filtered[activeIndex].code)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      e.preventDefault()
    }
  }

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      {label && <label className="text-sm font-medium text-ink-700">{label}</label>}
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={label}
          className={clsx(
            'h-10 w-full rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-sm text-ink-900 placeholder:text-ink-400',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
            className,
          )}
          value={open ? query : (selected?.name ?? '')}
          placeholder="Search languages..."
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIndex(0)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        {open && (
          <ul id={listboxId} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-400">No languages match "{query}"</li>}
            {filtered.map((l, i) => (
              <li
                key={l.code}
                role="option"
                aria-selected={l.code === value}
                className={clsx('flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm', i === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50')}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // keep focus in the input instead of blurring first
                  selectLanguage(l.code)
                }}
              >
                <span>
                  {l.name} <span className="text-ink-400">({l.code})</span>
                </span>
                {l.code === value && <Check className="h-3.5 w-3.5 text-brand-600" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
