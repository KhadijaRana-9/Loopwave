import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import * as authService from '@/services/authService'
import * as notificationsService from '@/services/notificationsService'

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'notifications', label: 'Notifications' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('profile')
  const user = useAuthStore((s) => s.user)
  const tenant = useAuthStore((s) => s.tenant)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const updateTenant = useAuthStore((s) => s.updateTenant)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [workspaceName, setWorkspaceName] = useState(tenant?.name ?? '')
  const queryClient = useQueryClient()

  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsService.getNotificationPreferences,
    enabled: tab === 'notifications',
  })

  const preferencesMutation = useMutation({
    mutationFn: notificationsService.updateNotificationPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated)
    },
    onError: (err) => toast.error(err.message || 'Could not save this preference'),
  })

  const profileMutation = useMutation({
    mutationFn: () => authService.updateProfile({ name, email }),
    onSuccess: (updatedUser) => {
      updateProfile(updatedUser)
      toast.success('Profile updated')
    },
    onError: (err) => toast.error(err.message),
  })

  const workspaceMutation = useMutation({
    mutationFn: () => authService.updateWorkspace({ name: workspaceName }),
    onSuccess: (updatedTenant) => {
      updateTenant(updatedTenant)
      toast.success('Workspace updated')
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, workspace and notification preferences" />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="mt-5 max-w-xl">
        {tab === 'profile' && (
          <Card className="flex flex-col gap-4">
            <CardHeader title="Your profile" />
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-fit" loading={profileMutation.isPending} onClick={() => profileMutation.mutate()}>
              Save changes
            </Button>
          </Card>
        )}

        {tab === 'workspace' && (
          <Card className="flex flex-col gap-4">
            <CardHeader title="Workspace" />
            <Input label="Workspace name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
            <Input label="Workspace URL" value={`loopwave.app/${tenant?.slug}`} disabled />
            <Button className="w-fit" loading={workspaceMutation.isPending} onClick={() => workspaceMutation.mutate()}>
              Save changes
            </Button>
          </Card>
        )}

        {tab === 'notifications' && (
          <Card className="flex flex-col gap-1">
            <CardHeader title="Notification preferences" description="Saved to your account — persists across devices and sessions." />
            {preferencesQuery.isLoading ? (
              <Spinner label="Loading preferences..." />
            ) : (
              Object.entries({
                newLead: 'New lead assigned to me',
                campaignComplete: 'Campaign finished sending',
                weeklyReport: 'Weekly performance summary',
                mentions: 'Mentioned in an internal note',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between border-b border-ink-100 py-3 text-sm text-ink-700 last:border-0">
                  {label}
                  <input
                    type="checkbox"
                    checked={preferencesQuery.data?.[key] ?? false}
                    disabled={preferencesMutation.isPending}
                    onChange={(e) => preferencesMutation.mutate({ [key]: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300"
                  />
                </label>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
