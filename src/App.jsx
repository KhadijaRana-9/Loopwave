import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Spinner from '@/components/ui/Spinner'
import ToastViewport from '@/components/ui/ToastViewport'
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import AdminLayout from '@/layouts/AdminLayout'
import RequireAuth from '@/routes/RequireAuth'
import RequireSuperAdmin from '@/routes/RequireSuperAdmin'
import RequirePermission from '@/routes/RequirePermission'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/store/authStore'

// Public marketing site
const Home = lazy(() => import('@/pages/public/Home'))
const Features = lazy(() => import('@/pages/public/Features'))
const Solutions = lazy(() => import('@/pages/public/Solutions'))
const Pricing = lazy(() => import('@/pages/public/Pricing'))
const IntegrationsMarketing = lazy(() => import('@/pages/public/Integrations'))
const Resources = lazy(() => import('@/pages/public/Resources'))
const Contact = lazy(() => import('@/pages/public/Contact'))
const PrivacyPolicy = lazy(() => import('@/pages/public/PrivacyPolicy'))
const TermsOfService = lazy(() => import('@/pages/public/TermsOfService'))
const DataDeletion = lazy(() => import('@/pages/public/DataDeletion'))

// Auth
const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const AdminLogin = lazy(() => import('@/pages/auth/AdminLogin'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))

// Business app
const Dashboard = lazy(() => import('@/pages/app/Dashboard'))
const Inbox = lazy(() => import('@/pages/app/Inbox'))
const Contacts = lazy(() => import('@/pages/app/Contacts'))
const Pipeline = lazy(() => import('@/pages/app/Pipeline'))
const Campaigns = lazy(() => import('@/pages/app/Campaigns'))
const CampaignDetail = lazy(() => import('@/pages/app/CampaignDetail'))
const Templates = lazy(() => import('@/pages/app/Templates'))
const Chatbots = lazy(() => import('@/pages/app/Chatbots'))
const ChatbotBuilder = lazy(() => import('@/pages/app/ChatbotBuilder'))
const AiAgents = lazy(() => import('@/pages/app/AiAgents'))
const AiAgentDetail = lazy(() => import('@/pages/app/AiAgentDetail'))
const Automations = lazy(() => import('@/pages/app/Automations'))
const AutomationBuilder = lazy(() => import('@/pages/app/AutomationBuilder'))
const Forms = lazy(() => import('@/pages/app/Forms'))
const Analytics = lazy(() => import('@/pages/app/Analytics'))
const Team = lazy(() => import('@/pages/app/Team'))
const WhatsappPage = lazy(() => import('@/pages/app/Whatsapp'))
const IntegrationsApp = lazy(() => import('@/pages/app/Integrations'))
const Billing = lazy(() => import('@/pages/app/Billing'))
const SettingsPage = lazy(() => import('@/pages/app/Settings'))

// Super admin
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminTenants = lazy(() => import('@/pages/admin/Tenants'))
const AdminUsers = lazy(() => import('@/pages/admin/Users'))
const AdminPlans = lazy(() => import('@/pages/admin/Plans'))
const AdminSubscriptions = lazy(() => import('@/pages/admin/Subscriptions'))
const AdminUsage = lazy(() => import('@/pages/admin/Usage'))
const AdminWhatsapp = lazy(() => import('@/pages/admin/Whatsapp'))
const AdminCampaigns = lazy(() => import('@/pages/admin/Campaigns'))
const AdminAi = lazy(() => import('@/pages/admin/Ai'))
const AdminBilling = lazy(() => import('@/pages/admin/Billing'))
const AdminIntegrations = lazy(() => import('@/pages/admin/Integrations'))
const AdminSystemLogs = lazy(() => import('@/pages/admin/SystemLogs'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))

const NotFound = lazy(() => import('@/pages/NotFound'))

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <Suspense fallback={<Spinner label="Loading Loopwave..." />}>
      <ToastViewport />
      <Routes>
        {/* Public marketing site */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/integrations" element={<IntegrationsMarketing />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Business application */}
        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route
              path="inbox"
              element={
                <RequirePermission permission={PERMISSIONS.VIEW_INBOX}>
                  <Inbox />
                </RequirePermission>
              }
            />
            <Route
              path="contacts"
              element={
                <RequirePermission permission={PERMISSIONS.VIEW_CONTACTS}>
                  <Contacts />
                </RequirePermission>
              }
            />
            <Route
              path="pipeline"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_PIPELINE}>
                  <Pipeline />
                </RequirePermission>
              }
            />
            <Route
              path="campaigns"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_CAMPAIGNS}>
                  <Campaigns />
                </RequirePermission>
              }
            />
            <Route
              path="campaigns/:id"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_CAMPAIGNS}>
                  <CampaignDetail />
                </RequirePermission>
              }
            />
            <Route
              path="templates"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_CAMPAIGNS}>
                  <Templates />
                </RequirePermission>
              }
            />
            <Route
              path="chatbots"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_CHATBOT}>
                  <Chatbots />
                </RequirePermission>
              }
            />
            <Route
              path="chatbots/:id"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_CHATBOT}>
                  <ChatbotBuilder />
                </RequirePermission>
              }
            />
            <Route
              path="ai-agents"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_AI_AGENTS}>
                  <AiAgents />
                </RequirePermission>
              }
            />
            <Route
              path="ai-agents/:id"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_AI_AGENTS}>
                  <AiAgentDetail />
                </RequirePermission>
              }
            />
            <Route
              path="automations"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_AUTOMATIONS}>
                  <Automations />
                </RequirePermission>
              }
            />
            <Route
              path="automations/:id"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_AUTOMATIONS}>
                  <AutomationBuilder />
                </RequirePermission>
              }
            />
            <Route
              path="forms"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_FORMS}>
                  <Forms />
                </RequirePermission>
              }
            />
            <Route
              path="analytics"
              element={
                <RequirePermission permission={PERMISSIONS.VIEW_ANALYTICS}>
                  <Analytics />
                </RequirePermission>
              }
            />
            <Route
              path="team"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_TEAM}>
                  <Team />
                </RequirePermission>
              }
            />
            <Route
              path="whatsapp"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_WHATSAPP}>
                  <WhatsappPage />
                </RequirePermission>
              }
            />
            <Route
              path="integrations"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_INTEGRATIONS}>
                  <IntegrationsApp />
                </RequirePermission>
              }
            />
            <Route
              path="billing"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_BILLING}>
                  <Billing />
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission permission={PERMISSIONS.MANAGE_SETTINGS}>
                  <SettingsPage />
                </RequirePermission>
              }
            />
          </Route>
        </Route>

        {/* Super admin */}
        <Route element={<RequireSuperAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="tenants" element={<AdminTenants />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="usage" element={<AdminUsage />} />
            <Route path="whatsapp" element={<AdminWhatsapp />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="ai" element={<AdminAi />} />
            <Route path="billing" element={<AdminBilling />} />
            <Route path="integrations" element={<AdminIntegrations />} />
            <Route path="system-logs" element={<AdminSystemLogs />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
