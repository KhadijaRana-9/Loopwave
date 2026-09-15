import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'

const STATUS_TONE = { draft: 'neutral', scheduled: 'info', running: 'brand', completed: 'success', failed: 'danger' }

export default function AdminCampaigns() {
  const campaignsQuery = useQuery({ queryKey: ['admin-campaigns'], queryFn: adminService.listAdminCampaigns })
  if (campaignsQuery.isLoading) return <Spinner label="Loading campaigns..." />
  const campaigns = campaignsQuery.data

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0)
  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted, 0)

  const columns = [
    { key: 'name', header: 'Campaign' },
    { key: 'tenant', header: 'Business', render: (r) => r.tenantName },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: 'sent', header: 'Sent', render: (r) => r.sent.toLocaleString() },
    { key: 'converted', header: 'Converted', render: (r) => r.converted.toLocaleString() },
  ]

  return (
    <div>
      <PageHeader title="Campaigns" description="Oversight of broadcast activity across every tenant" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns running" value={campaigns.filter((c) => c.status === 'running').length} />
        <StatCard label="Total messages sent" value={totalSent.toLocaleString()} />
        <StatCard label="Total converted" value={totalConverted.toLocaleString()} />
      </div>
      <Table columns={columns} data={campaigns} />
    </div>
  )
}
