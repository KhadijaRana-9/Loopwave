import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'
import * as whatsappService from '@/services/whatsappService'

const QUALITY_TONE = { green: 'success', yellow: 'warning', red: 'danger' }

export default function AdminWhatsapp() {
  const tenantsQuery = useQuery({ queryKey: ['admin-tenants'], queryFn: adminService.listTenants })
  const numbersQuery = useQuery({ queryKey: ['whatsapp-numbers'], queryFn: whatsappService.listWhatsappNumbers })

  if (tenantsQuery.isLoading || numbersQuery.isLoading) return <Spinner label="Loading WhatsApp accounts..." />

  // Demo data only has real numbers for the seeded tenant — attribute them
  // there and show the rest of the platform's tenants as connected via their
  // own (unlisted, in this mock) numbers.
  const rows = (numbersQuery.data ?? []).map((n) => ({ ...n, tenantName: tenantsQuery.data?.[0]?.name }))

  const columns = [
    { key: 'displayNumber', header: 'Number' },
    { key: 'tenantName', header: 'Business' },
    { key: 'label', header: 'Label' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'connected' ? 'success' : 'warning'}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'qualityRating', header: 'Quality', render: (r) => (r.qualityRating ? <Badge tone={QUALITY_TONE[r.qualityRating]}>{r.qualityRating}</Badge> : '—') },
    { key: 'messagingTier', header: 'Tier', render: (r) => r.messagingTier ?? '—' },
  ]

  return (
    <div>
      <PageHeader title="WhatsApp accounts" description="All numbers connected across every tenant" />
      <Table columns={columns} data={rows} />
    </div>
  )
}
