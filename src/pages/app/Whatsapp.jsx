import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Plus } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import * as whatsappService from '@/services/whatsappService'

const QUALITY_TONE = { green: 'success', yellow: 'warning', red: 'danger' }

export default function WhatsappPage() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [label, setLabel] = useState('')
  const queryClient = useQueryClient()

  const numbersQuery = useQuery({ queryKey: ['whatsapp-numbers'], queryFn: whatsappService.listWhatsappNumbers })

  const connectMutation = useMutation({
    mutationFn: () => whatsappService.startEmbeddedSignup({ label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] })
      setConnectOpen(false)
      setLabel('')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: whatsappService.disconnectNumber,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-numbers'] }),
  })

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {numbers.map((num) => (
          <Card key={num.id}>
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <MessageCircle className="h-4.5 w-4.5" />
              </div>
              <Badge tone={num.status === 'connected' ? 'success' : 'warning'}>{num.status.replace('_', ' ')}</Badge>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-ink-900">{num.label}</h3>
            <p className="mt-1 text-xs text-ink-500">{num.displayNumber}</p>
            {num.status === 'connected' && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Badge tone={QUALITY_TONE[num.qualityRating]}>Quality: {num.qualityRating}</Badge>
                <Badge>{num.messagingTier}</Badge>
              </div>
            )}
            {num.status === 'connected' && (
              <Button variant="outline" size="sm" className="mt-3 w-full justify-center" onClick={() => disconnectMutation.mutate(num.id)}>
                Disconnect
              </Button>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect a WhatsApp number"
        description="Uses Meta's Embedded Signup flow — in this demo build it simulates a pending connection instead of opening the real Meta OAuth popup."
        footer={
          <>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button loading={connectMutation.isPending} onClick={() => connectMutation.mutate()} disabled={!label}>
              Continue with Meta
            </Button>
          </>
        }
      >
        <Input label="Internal label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Sales Line" />
      </Modal>
    </div>
  )
}
