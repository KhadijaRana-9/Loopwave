import { useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'

export default function AdminSettings() {
  const [platformName, setPlatformName] = useState('Loopwave')
  const [supportEmail, setSupportEmail] = useState('support@loopwavedemo.com')
  const [trialDays, setTrialDays] = useState(14)

  return (
    <div>
      <PageHeader title="Platform settings" description="Global configuration for the Loopwave platform" />
      <Card className="max-w-xl flex-col gap-4">
        <CardHeader title="General" />
        <div className="flex flex-col gap-4">
          <Input label="Platform name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
          <Input label="Support email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
          <Input label="Default trial length (days)" type="number" value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
          <Button className="w-fit" onClick={() => toast.success('Platform settings saved locally (demo — connect a backend to persist these for real).')}>
            Save settings
          </Button>
        </div>
      </Card>
    </div>
  )
}
