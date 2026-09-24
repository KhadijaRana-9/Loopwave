import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus, ShieldAlert, AlertTriangle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import * as whatsappService from '@/services/whatsappService'
import { runEmbeddedSignup } from '@/utils/metaEmbeddedSignup'

const QUALITY_TONE = { green: 'success', yellow: 'warning', red: 'danger' }
const STATUS_LABEL = {
  pending_verification: 'Verification required',
  connected: 'Connected',
  reauthorization_required: 'Reauthorization required',
  disconnected: 'Disconnected',
  error: 'Error',
}
const STATUS_TONE = {
  pending_verification: 'warning',
  connected: 'success',
  reauthorization_required: 'danger',
  disconnected: 'neutral',
  error: 'danger',
}
// A card offers Reconnect (re-run Embedded Signup for this number) instead
// of Disconnect once it's no longer actively connected.
const RECONNECTABLE_STATUSES = new Set(['disconnected', 'reauthorization_required', 'error'])

export default function WhatsappPage() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const queryClient = useQueryClient()

  const numbersQuery = useQuery({ queryKey: ['whatsapp-numbers'], queryFn: whatsappService.listWhatsappNumbers })
  const signupConfigQuery = useQuery({ queryKey: ['whatsapp-signup-config'], queryFn: whatsappService.getSignupConfig })

  const completeMutation = useMutation({
    mutationFn: whatsappService.completeEmbeddedSignup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      closeAndReset()
      toast.success('WhatsApp number connected.')
    },
    onError: (err) => {
      setConnectError(err.message || 'Could not connect this number.')
      setConnecting(false)
    },
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
    setConnectError('')
    setConnecting(false)
  }

  function openConnect(prefillLabel = '') {
    setLabel(prefillLabel)
    setConnectError('')
    setConnectOpen(true)
  }

  async function handleContinueWithMeta() {
    const config = signupConfigQuery.data
    if (!config?.configured) return
    if (!label.trim()) {
      setConnectError('Give this number an internal label first.')
      return
    }
    setConnectError('')
    setConnecting(true)
    try {
      const { code, wabaId, phoneNumberId, businessId } = await runEmbeddedSignup({
        appId: config.appId,
        configId: config.configId,
      })
      completeMutation.mutate({ code, wabaId, phoneNumberId, businessId, label: label.trim() })
    } catch (err) {
      setConnectError(err.message || 'Meta connection was not completed.')
      setConnecting(false)
    }
  }

  if (numbersQuery.isLoading || signupConfigQuery.isLoading) return <Spinner label="Loading WhatsApp numbers..." />

  // A failed request must never be presented as "no numbers" or "Meta not
  // configured" — those are real, different states and this isn't either.
  if (numbersQuery.isError || signupConfigQuery.isError) {
    return (
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">Couldn't load your WhatsApp connection</p>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            {numbersQuery.error?.message || signupConfigQuery.error?.message || 'Something went wrong reaching the server.'}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            numbersQuery.refetch()
            signupConfigQuery.refetch()
          }}
        >
          Retry
        </Button>
      </Card>
    )
  }

  const numbers = numbersQuery.data
  const signupConfigured = signupConfigQuery.data.configured

  return (
    <div>
      <PageHeader
        title="WhatsApp numbers"
        description="Numbers connected via the official Meta WhatsApp Business Cloud API"
        action={
          <Button onClick={() => openConnect()}>
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
          <Button size="sm" onClick={() => openConnect()}>
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
                <Badge tone={STATUS_TONE[num.status] ?? 'neutral'}>{STATUS_LABEL[num.status] ?? num.status.replace('_', ' ')}</Badge>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink-900">{num.label}</h3>
              <p className="mt-1 text-xs text-ink-500">{num.displayNumber}</p>
              {num.status === 'pending_verification' && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-600">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Waiting on Meta to verify this number.
                </p>
              )}
              {num.status === 'reauthorization_required' && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-danger-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Meta invalidated this connection — sending is paused until you reconnect.
                </p>
              )}
              {num.status === 'connected' && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Badge tone={QUALITY_TONE[num.qualityRating]}>Quality: {num.qualityRating}</Badge>
                  <Badge>{num.messagingTier}</Badge>
                </div>
              )}
              {RECONNECTABLE_STATUSES.has(num.status) ? (
                <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => openConnect(num.label)}>
                  Reconnect
                </Button>
              ) : (
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
        description={
          signupConfigured
            ? "Uses Meta's Embedded Signup — you'll pick your WhatsApp Business Account and number inside Meta's own popup."
            : undefined
        }
        footer={
          signupConfigured ? (
            <>
              <Button variant="outline" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button loading={connecting} onClick={handleContinueWithMeta} disabled={!label.trim()}>
                Continue with Meta
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={closeAndReset}>
              Close
            </Button>
          )
        }
      >
        {signupConfigured ? (
          <div className="flex flex-col gap-4">
            <Input label="Internal label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales Line" />
            {connectError && <p className="text-xs text-danger-500">{connectError}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-50 text-warning-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-900">Meta App not configured</p>
              <p className="mt-1 max-w-sm text-sm text-ink-500">
                This platform hasn't been set up with a Meta App yet — an administrator needs to configure META_APP_ID,
                META_CONFIG_ID and WHATSAPP_APP_SECRET on the server before any workspace can connect a real WhatsApp number.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
