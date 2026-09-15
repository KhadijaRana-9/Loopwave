import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import { Input, Select } from '@/components/ui/Input'
import { usePagination } from '@/hooks/usePagination'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Avatar from '@/components/ui/Avatar'
import Spinner from '@/components/ui/Spinner'
import ContactDetailDrawer from '@/features/contacts/ContactDetailDrawer'
import { toast } from '@/store/toastStore'
import * as contactsService from '@/services/contactsService'
import * as teamService from '@/services/teamService'

const STATUS_OPTIONS = ['all', 'new', 'qualified', 'contacted', 'interested', 'demo_booked', 'converted', 'lost']

export default function Contacts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? 'all'
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeContactId, setActiveContactId] = useState(searchParams.get('highlight'))
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', company: '' })
  const queryClient = useQueryClient()

  const contactsQuery = useQuery({
    queryKey: ['contacts', search, status],
    queryFn: () => contactsService.listContacts({ search, status }),
  })
  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })
  const teamMembers = teamQuery.data ?? []

  const createMutation = useMutation({
    mutationFn: contactsService.createContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setCreateOpen(false)
      setNewContact({ name: '', phone: '', email: '', company: '' })
      toast.success('Contact created')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: contactsService.deleteContacts,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setSelectedIds([])
      setDeleteOpen(false)
      toast.success(`${result.deleted} contact(s) deleted`)
    },
  })

  const contacts = contactsQuery.data ?? []
  const activeContact = contacts.find((c) => c.id === activeContactId) ?? null
  const { page, pageCount, pageSize, totalItems, pageItems, setPage, setPageSize } = usePagination(contacts, 10)

  function setStatus(value) {
    setSearchParams((params) => {
      if (value === 'all') params.delete('status')
      else params.set('status', value)
      return params
    })
  }

  function toggleSelect(id) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function toggleSelectAll() {
    const pageIds = pageItems.map((c) => c.id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))
    setSelectedIds((ids) => (allSelected ? ids.filter((id) => !pageIds.includes(id)) : [...new Set([...ids, ...pageIds])]))
  }

  function agentName(id) {
    return teamMembers.find((m) => m.id === id)?.name ?? '—'
  }

  const columns = [
    {
      key: 'name',
      header: 'Contact',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size={30} />
          <div>
            <div className="font-medium text-ink-900">{row.name}</div>
            <div className="text-xs text-ink-500">{row.phone}</div>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Company', render: (row) => row.company || '—' },
    {
      key: 'tags',
      header: 'Tags',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'leadStatus',
      header: 'Status',
      render: (row) => <Badge tone={row.leadStatus === 'converted' ? 'success' : row.leadStatus === 'lost' ? 'danger' : 'brand'}>{row.leadStatus.replace('_', ' ')}</Badge>,
    },
    { key: 'leadScore', header: 'Score' },
    { key: 'assignedAgentId', header: 'Assigned to', render: (row) => agentName(row.assignedAgentId) },
    {
      key: 'lastInteractionAt',
      header: 'Last interaction',
      render: (row) => new Date(row.lastInteractionAt).toLocaleDateString(),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Contacts"
        description={`${contacts.length} contact${contacts.length === 1 ? '' : 's'}${status !== 'all' ? ` · filtered by ${status.replace('_', ' ')}` : ''}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.info('Demo: connect a backend to enable real CSV import.')}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info('Demo: connect a backend to enable real CSV export.')}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Add contact
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Search by name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </Select>
        {selectedIds.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete ({selectedIds.length})
          </Button>
        )}
      </div>

      {contactsQuery.isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table
            columns={columns}
            data={pageItems}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onRowClick={(row) => setActiveContactId(row.id)}
            emptyTitle="No contacts match your filters"
            emptyDescription="Try a different search term or status filter."
          />
          <Pagination page={page} pageCount={pageCount} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add contact"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending} onClick={() => createMutation.mutate(newContact)} disabled={!newContact.name || !newContact.phone}>
              Save contact
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Full name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} required />
          <Input label="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} required />
          <Input label="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
          <Input label="Company" value={newContact.company} onChange={(e) => setNewContact({ ...newContact, company: e.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(selectedIds)}
        title="Delete contacts"
        description={`This will permanently remove ${selectedIds.length} contact(s).`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />

      <ContactDetailDrawer contact={activeContact} onClose={() => setActiveContactId(null)} />
    </div>
  )
}
