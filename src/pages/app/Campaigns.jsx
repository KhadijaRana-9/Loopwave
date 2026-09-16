import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Copy, Plus, XCircle } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { Input, Select } from '@/components/ui/Input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CampaignWizard from '@/features/campaigns/CampaignWizard'
import { toast } from '@/store/toastStore'
import { usePagination } from '@/hooks/usePagination'
import * as campaignsService from '@/services/campaignsService'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'

const STATUS_TONE = { draft: 'neutral', scheduled: 'info', running: 'brand', completed: 'success', failed: 'danger' }
const STATUS_OPTIONS = ['all', 'draft', 'scheduled', 'running', 'completed', 'failed']

export default function Campaigns() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [cancelId, setCancelId] = useState(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { can } = usePermission()
  const canSend = can(PERMISSIONS.SEND_CAMPAIGNS)

  const campaignsQuery = useQuery({ queryKey: ['campaigns'], queryFn: campaignsService.listCampaigns })

  const createMutation = useMutation({
    mutationFn: campaignsService.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['subscription'] })
      setWizardOpen(false)
      createMutation.reset()
      toast.success('Campaign created')
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: campaignsService.duplicateCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign duplicated as a draft')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: campaignsService.cancelScheduledCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setCancelId(null)
      toast.success('Scheduled campaign cancelled and moved back to drafts')
    },
  })

  const campaigns = campaignsQuery.data ?? []
  const filtered = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || c.status === status
    return matchesSearch && matchesStatus
  })
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(filtered, 10)

  const columns = [
    { key: 'name', header: 'Campaign', render: (row) => <span className="font-medium text-ink-900">{row.name}</span> },
    { key: 'template', header: 'Template', render: (row) => row.template?.name ?? '—' },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    { key: 'audienceSize', header: 'Audience', render: (row) => row.audienceSize.toLocaleString() },
    { key: 'delivered', header: 'Delivered', render: (row) => row.delivered.toLocaleString() },
    { key: 'read', header: 'Read', render: (row) => row.read.toLocaleString() },
    { key: 'converted', header: 'Converted', render: (row) => row.converted.toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            title="Duplicate campaign"
            onClick={() => duplicateMutation.mutate(row.id)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <Copy className="h-4 w-4" />
          </button>
          {row.status === 'scheduled' && (
            <button
              title="Cancel scheduled campaign"
              onClick={() => setCancelId(row.id)}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-100 hover:text-danger-500"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Broadcast marketing, utility and authentication messages"
        action={
          canSend && (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" /> Create campaign
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search campaigns" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s}
            </option>
          ))}
        </Select>
      </div>

      <Table
        columns={columns}
        data={pageItems}
        onRowClick={(row) => navigate(`/app/campaigns/${row.id}`)}
        emptyTitle="No campaigns match your filters"
        emptyDescription="Try a different search term or status."
      />
      <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />

      <CampaignWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false)
          createMutation.reset()
        }}
        onSubmit={(data) => createMutation.mutate(data)}
        submitting={createMutation.isPending}
        submitError={createMutation.error?.message}
      />

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={() => cancelMutation.mutate(cancelId)}
        title="Cancel scheduled campaign?"
        description="It will move back to drafts and won't be sent at its scheduled time."
        confirmLabel="Cancel campaign"
        loading={cancelMutation.isPending}
      />
    </div>
  )
}
