import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Avatar from '@/components/ui/Avatar'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import * as teamService from '@/services/teamService'
import { TENANT_ROLES, ROLE_LABELS } from '@/constants/roles'
import { usePermission } from '@/hooks/usePermission'

export default function Team() {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'support_agent' })
  const queryClient = useQueryClient()
  const { role: myRole } = usePermission()

  const teamQuery = useQuery({ queryKey: ['team'], queryFn: teamService.listTeamMembers })

  const inviteMutation = useMutation({
    mutationFn: () => teamService.inviteTeamMember(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] })
      setInviteOpen(false)
      setForm({ name: '', email: '', role: 'support_agent' })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => teamService.updateTeamMemberRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  })

  const removeMutation = useMutation({
    mutationFn: teamService.removeTeamMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team'] }),
  })

  if (teamQuery.isLoading) return <Spinner label="Loading team..." />
  const team = teamQuery.data

  const columns = [
    {
      key: 'name',
      header: 'Member',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size={30} />
          <div>
            <div className="font-medium text-ink-900">{row.name}</div>
            <div className="text-xs text-ink-500">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) =>
        row.role === 'owner' ? (
          <Badge tone="brand">{ROLE_LABELS[row.role]}</Badge>
        ) : (
          <Select aria-label={`Change role for ${row.name}`} value={row.role} onChange={(e) => roleMutation.mutate({ id: row.id, role: e.target.value })} className="h-8 w-40 text-xs">
            {TENANT_ROLES.filter((r) => r !== 'owner').map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        ),
    },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'active' ? 'success' : 'warning'}>{row.status}</Badge> },
    { key: 'lastActive', header: 'Last active', render: (row) => (row.lastActive ? new Date(row.lastActive).toLocaleString() : '—') },
    {
      key: 'actions',
      header: '',
      render: (row) =>
        row.role !== 'owner' && (
          <button onClick={() => removeMutation.mutate(row.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-danger-100 hover:text-danger-500" aria-label={`Remove ${row.name} from team`}>
            <Trash2 className="h-4 w-4" />
          </button>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Team"
        description={`${team.length} members · your role: ${ROLE_LABELS[myRole]}`}
        action={
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" /> Invite teammate
          </Button>
        }
      />
      <Table columns={columns} data={team} />

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite teammate"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button loading={inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {TENANT_ROLES.filter((r) => r !== 'owner').map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
