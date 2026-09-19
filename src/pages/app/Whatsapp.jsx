import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus, ShieldAlert } from 'lucide-react'
import { getCountries, getCountryCallingCode, isValidPhoneNumber, AsYouType } from 'libphonenumber-js'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import * as whatsappService from '@/services/whatsappService'

const QUALITY_TONE = { green: 'success', yellow: 'warning', red: 'danger' }
const STATUS_LABEL = { pending_verification: 'Verification required', connected: 'Connected', disconnected: 'Disconnected', error: 'Error' }
const STATUS_TONE = { pending_verification: 'warning', connected: 'success', disconnected: 'neutral', error: 'danger' }

// Country names from ISO codes without pulling in a second dependency —
// Intl.DisplayNames is built into every modern browser.
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const COUNTRIES = getCountries()
  .map((code) => ({ code, name: countryNames.of(code) ?? code, callingCode: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))
const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.code === 'PK') ?? COUNTRIES[0]

export default function WhatsappPage() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code)
  const [nationalNumber, setNationalNumber] = useState('')
  const [connectError, setConnectError] = useState('')
  const queryClient = useQueryClient()

  const numbersQuery = useQuery({ queryKey: ['whatsapp-numbers'], queryFn: whatsappService.listWhatsappNumbers })

  const country = COUNTRIES.find((c) => c.code === countryCode) ?? DEFAULT_COUNTRY
  // AsYouType formats the national number as the user types, using the
  // selected country's own formatting rules (e.g. "300 1234567" for PK).
  const formattedNational = useMemo(() => new AsYouType(country.code).input(nationalNumber), [nationalNumber, country])
  const fullNumber = nationalNumber ? `+${country.callingCode}${nationalNumber.replace(/\D/g, '')}` : ''
  const isValidNumber = fullNumber ? isValidPhoneNumber(fullNumber) : false

  const connectMutation = useMutation({
    mutationFn: () => whatsappService.startEmbeddedSignup({ label, phoneNumber: fullNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      closeAndReset()
      toast.success('Number added — pending verification.')
    },
    onError: (err) => setConnectError(err.message || 'Could not connect this number.'),
  })

  const disconnectMutation = useMutation({
    mutationFn: whatsappService.disconnectNumber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      toast.success('Number disconnected.')
    },
  })

  function closeAndReset() {
    setConnectOpen(false)
    setLabel('')
    setNationalNumber('')
    setConnectError('')
  }

  function handleSubmit() {
    if (!isValidNumber) {
      setConnectError(`Enter a valid phone number for ${country.name}.`)
      return
    }
    setConnectError('')
    connectMutation.mutate()
  }

  if (numbersQuery.isLoading) return <Spinner label="Loading WhatsApp numbers..." />
  const numbers = numbersQuery.data

  return (
    <div>
      <PageHeader
        title="WhatsApp numbers"
        description="Numbers connected via the official Meta WhatsApp Business Cloud API"
        action={
          <Button onClick={() => setConnectOpen(true)}>
            <Plus className="h-4 w-4" /> Connect number
          </Button>
        }
      />

      {numbers.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">No WhatsApp numbers yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">Connect a WhatsApp Business number to start sending and receiving messages from this workspace.</p>
          </div>
          <Button size="sm" onClick={() => setConnectOpen(true)}>
            <Plus className="h-4 w-4" /> Connect number
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {numbers.map((num) => (
            <Card key={num.id}>
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <MessageCircle className="h-4.5 w-4.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {num.sandbox && (
                    <Badge tone="warning" className="uppercase tracking-wide">
                      Sandbox
                    </Badge>
                  )}
                  <Badge tone={STATUS_TONE[num.status] ?? 'neutral'}>{STATUS_LABEL[num.status] ?? num.status.replace('_', ' ')}</Badge>
                </div>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink-900">{num.label}</h3>
              <p className="mt-1 text-xs text-ink-500">{num.displayNumber}</p>
              {num.status === 'pending_verification' && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-600">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {num.sandbox
                    ? 'Sandbox mode — no real Meta WhatsApp credentials are configured, so this number cannot send or receive real messages.'
                    : 'Waiting on Meta to verify this number.'}
                </p>
              )}
              {num.status === 'connected' && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Badge tone={QUALITY_TONE[num.qualityRating]}>Quality: {num.qualityRating}</Badge>
                  <Badge>{num.messagingTier}</Badge>
                </div>
              )}
              {num.status !== 'disconnected' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full justify-center"
                  loading={disconnectMutation.isPending && disconnectMutation.variables === num.id}
                  onClick={() => disconnectMutation.mutate(num.id)}
                >
                  Disconnect
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={connectOpen}
        onClose={closeAndReset}
        title="Connect a WhatsApp number"
        description="Uses Meta's Embedded Signup flow — in this demo build it simulates a pending connection instead of opening the real Meta OAuth popup, and is clearly labeled Sandbox once added."
        footer={
          <>
            <Button variant="outline" onClick={closeAndReset}>
              Cancel
            </Button>
            <Button loading={connectMutation.isPending} onClick={handleSubmit} disabled={!label || !nationalNumber}>
              Continue with Meta
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Internal label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales Line" />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">WhatsApp number</label>
            <div className="flex gap-2">
              <Select
                aria-label="Country"
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value)
                  setConnectError('')
                }}
                className="w-40 shrink-0"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} (+{c.callingCode})
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Phone number"
                value={formattedNational}
                onChange={(e) => {
                  setNationalNumber(e.target.value.replace(/\D/g, ''))
                  setConnectError('')
                }}
                placeholder="3XX XXXXXXX"
                inputMode="tel"
                className="flex-1"
              />
            </div>
            {connectError && <p className="mt-1.5 text-xs text-danger-500">{connectError}</p>}
            {!connectError && nationalNumber && !isValidNumber && (
              <p className="mt-1.5 text-xs text-ink-400">Enter the full number without the country code.</p>
            )}
            {!connectError && isValidNumber && <p className="mt-1.5 text-xs text-success-600">Will connect as {fullNumber}</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
