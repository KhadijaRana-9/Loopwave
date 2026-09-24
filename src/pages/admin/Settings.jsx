import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageHeader from '@/components/ui/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import * as adminService from '@/services/adminService'

export default function AdminSettings() {
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: adminService.getPlatformSettings })

  if (settingsQuery.isLoading) return <Spinner label="Loading platform settings..." />
  if (settingsQuery.isError) return <p className="text-sm text-danger-600">Could not load platform settings. {settingsQuery.error?.message}</p>

  return (
    <div>
      <PageHeader title="Platform settings" description="Global configuration for the Loopwave platform" />
      <SettingsForm initial={settingsQuery.data} />
    </div>
  )
}

// Seeded from the server-loaded values via props (not an effect) — mounted
// only after the query succeeds, so the form always starts from real data.
function SettingsForm({ initial }) {
  const queryClient = useQueryClient()
  const [platformName, setPlatformName] = useState(initial.platformName)
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail)
  const [trialDays, setTrialDays] = useState(initial.trialDays)

  const saveMutation = useMutation({
    mutationFn: () => adminService.updatePlatformSettings({ platformName, supportEmail, trialDays }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin-settings'], saved)
      toast.success('Platform settings saved')
    },
    onError: (err) => toast.error(err.message || 'Could not save platform settings'),
  })

  return (
    <Card className="max-w-xl flex-col gap-4">
      <CardHeader title="General" />
      <div className="flex flex-col gap-4">
        <Input label="Platform name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
        <Input label="Support email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
        <Input
          label="Default trial length (days)"
          type="number"
          value={trialDays}
          onChange={(e) => setTrialDays(Number(e.target.value))}
          hint="Applies to workspaces created after you save — existing trials keep their current end date."
        />
        <Button className="w-fit" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Save settings
        </Button>
      </div>
    </Card>
  )
}
