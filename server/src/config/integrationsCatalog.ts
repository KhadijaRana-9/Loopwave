// Static product catalog (name/description/config field definitions) — mirrors
// src/services/mockData.js's integrationsCatalog on the frontend. Per-tenant
// connection state (connected/config/lastSyncedAt/lastError) lives in the
// Integration table and is merged onto this at request time; the catalog
// itself isn't tenant data, so it doesn't belong in the database.
export interface IntegrationConfigField {
  key: string
  label: string
}

export interface IntegrationCatalogEntry {
  id: string
  name: string
  category: string
  description: string
  configFields: IntegrationConfigField[]
}

export const INTEGRATIONS_CATALOG: IntegrationCatalogEntry[] = [
  { id: 'shopify', name: 'Shopify', category: 'E-commerce', description: 'Sync orders and trigger abandoned cart recovery.', configFields: [{ key: 'storeUrl', label: 'Store URL' }, { key: 'apiKey', label: 'Admin API key' }] },
  { id: 'razorpay', name: 'Razorpay', category: 'Payments', description: 'Collect payments directly inside WhatsApp chats.', configFields: [{ key: 'keyId', label: 'Key ID' }, { key: 'keySecret', label: 'Key secret' }] },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'Two-way contact and deal sync.', configFields: [{ key: 'apiKey', label: 'Private app token' }] },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', description: 'Sync leads and opportunities with Salesforce.', configFields: [{ key: 'instanceUrl', label: 'Instance URL' }, { key: 'accessToken', label: 'Access token' }] },
  { id: 'zapier', name: 'Zapier', category: 'Automation', description: 'Connect Loopwave to 5,000+ apps.', configFields: [{ key: 'webhookUrl', label: 'Zapier webhook URL' }] },
  { id: 'googlesheets', name: 'Google Sheets', category: 'Productivity', description: 'Export leads and campaign reports automatically.', configFields: [{ key: 'sheetUrl', label: 'Sheet URL' }] },
  { id: 'n8n', name: 'n8n', category: 'Automation', description: 'Self-hosted workflow automation via webhooks.', configFields: [{ key: 'webhookUrl', label: 'n8n webhook URL' }] },
  { id: 'meta-ads', name: 'Meta Ads Manager', category: 'Advertising', description: 'Click-to-WhatsApp ads with Conversions API sync.', configFields: [{ key: 'pixelId', label: 'Pixel / Dataset ID' }, { key: 'accessToken', label: 'Conversions API token' }] },
  { id: 'slack', name: 'Slack', category: 'Productivity', description: 'Get notified of hot leads and campaign results.', configFields: [{ key: 'webhookUrl', label: 'Slack incoming webhook URL' }] },
  { id: 'webhooks', name: 'Custom Webhooks', category: 'Developer', description: 'Push message/conversation/payment events to any endpoint.', configFields: [{ key: 'endpointUrl', label: 'Endpoint URL' }, { key: 'secret', label: 'Signing secret' }] },
  { id: 'generic-api', name: 'Generic API', category: 'Developer', description: 'Bring your own REST API for custom data lookups in flows.', configFields: [{ key: 'baseUrl', label: 'Base URL' }, { key: 'apiKey', label: 'API key' }] },
]
