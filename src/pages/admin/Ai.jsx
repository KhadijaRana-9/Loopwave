import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import StatCard from '@/components/ui/StatCard'
import Table from '@/components/ui/Table'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import * as adminService from '@/services/adminService'

export default function AdminAi() {
  const agentsQuery = useQuery({ queryKey: ['admin-ai-agents'], queryFn: adminService.listAdminAiAgents })
  if (agentsQuery.isLoading) return <Spinner label="Loading AI usage..." />
  const agents = agentsQuery.data

  const totalHandled = agents.reduce((sum, a) => sum + a.conversationsHandled, 0)
  const activeAgents = agents.filter((a) => a.status === 'active').length

  const columns = [
    { key: 'name', header: 'Agent' },
    { key: 'tenant', header: 'Business', render: (r) => r.tenantName },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status}</Badge> },
    { key: 'conversationsHandled', header: 'Conversations handled', render: (r) => r.conversationsHandled.toLocaleString() },
  ]

  return (
    <div>
      <PageHeader title="AI usage" description="AI agent activity across every tenant" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active AI agents" value={activeAgents} />
        <StatCard label="Total conversations handled" value={totalHandled.toLocaleString()} />
        <StatCard label="Agents on platform" value={agents.length} />
      </div>
      <Table columns={columns} data={agents} />
    </div>
  )
}
