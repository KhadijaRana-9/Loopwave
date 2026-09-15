import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Spinner from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import { usePagination } from '@/hooks/usePagination'
import * as adminService from '@/services/adminService'

const LEVEL_TONE = { info: 'info', warning: 'warning', error: 'danger' }
const STATUS_TONE = { success: 'success', pending: 'warning', failed: 'danger' }

export default function AdminSystemLogs() {
  const [level, setLevel] = useState('all')
  const logsQuery = useQuery({ queryKey: ['admin-logs'], queryFn: adminService.listSystemLogs })
  const logs = (logsQuery.data ?? []).filter((l) => level === 'all' || l.level === level)
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(logs, 10)

  if (logsQuery.isLoading) return <Spinner label="Loading system logs..." />

  const columns = [
    { key: 'createdAt', header: 'Timestamp', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'level', header: 'Level', render: (r) => <Badge tone={LEVEL_TONE[r.level]}>{r.level}</Badge> },
    { key: 'event', header: 'Event', render: (r) => <span className="font-mono text-xs">{r.event}</span> },
    { key: 'message', header: 'Message' },
    { key: 'tenant', header: 'Tenant' },
    { key: 'user', header: 'User' },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
  ]

  return (
    <div>
      <PageHeader title="System logs" description="Recent platform-level events" />
      <Select aria-label="Filter by log level" value={level} onChange={(e) => setLevel(e.target.value)} className="mb-4 w-40">
        <option value="all">All levels</option>
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </Select>
      <Table columns={columns} data={pageItems} rowKey="id" emptyTitle="No logs at this level" emptyDescription="Try a different level filter." />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
