import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import * as whatsappService from '@/services/whatsappService'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/constants/permissions'

// Real, persisted connection state — never a demo/simulated banner. Reuses
// the same ['whatsapp-numbers'] query key as src/pages/app/Whatsapp.jsx, so
// this and that page always agree and share one cache entry.
export default function WhatsappReauthBanner() {
  const { can } = usePermission()
  const navigate = useNavigate()
  const enabled = can(PERMISSIONS.MANAGE_WHATSAPP)

  const numbersQuery = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: whatsappService.listWhatsappNumbers,
    enabled,
    staleTime: 60_000,
  })

  if (!enabled) return null
  const blocked = (numbersQuery.data ?? []).filter((n) => n.status === 'reauthorization_required')
  if (blocked.length === 0) return null

  return (
    <div className="flex items-center gap-3 border-b border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700 sm:px-6">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {blocked.length === 1
          ? `${blocked[0].label ?? blocked[0].displayNumber} needs to be reconnected — sending is paused until you do.`
          : `${blocked.length} WhatsApp numbers need to be reconnected — sending is paused for them until you do.`}
      </span>
      <button onClick={() => navigate('/app/whatsapp')} className="shrink-0 font-medium underline underline-offset-2 hover:text-danger-800">
        Reconnect now
      </button>
    </div>
  )
}
