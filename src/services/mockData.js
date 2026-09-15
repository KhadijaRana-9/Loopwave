// Static product catalog for the public marketing site only (src/pages/public/Integrations.jsx).
// Every other page now talks to the real backend (see src/services/apiClient.js)
// — this is product copy, not demo/tenant data, so it has no backend-equivalent to fetch.
export const integrationsCatalog = [
  { id: 'shopify', name: 'Shopify', category: 'E-commerce', connected: true, description: 'Sync orders and trigger abandoned cart recovery.', configFields: [{ key: 'storeUrl', label: 'Store URL' }, { key: 'apiKey', label: 'Admin API key' }] },
  { id: 'razorpay', name: 'Razorpay', category: 'Payments', connected: true, description: 'Collect payments directly inside WhatsApp chats.', configFields: [{ key: 'keyId', label: 'Key ID' }, { key: 'keySecret', label: 'Key secret' }] },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', connected: false, description: 'Two-way contact and deal sync.', configFields: [{ key: 'apiKey', label: 'Private app token' }] },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', connected: false, description: 'Sync leads and opportunities with Salesforce.', configFields: [{ key: 'instanceUrl', label: 'Instance URL' }, { key: 'accessToken', label: 'Access token' }] },
  { id: 'zapier', name: 'Zapier', category: 'Automation', connected: false, description: 'Connect Loopwave to 5,000+ apps.', configFields: [{ key: 'webhookUrl', label: 'Zapier webhook URL' }] },
  { id: 'googlesheets', name: 'Google Sheets', category: 'Productivity', connected: true, description: 'Export leads and campaign reports automatically.', configFields: [{ key: 'sheetUrl', label: 'Sheet URL' }] },
  { id: 'n8n', name: 'n8n', category: 'Automation', connected: false, description: 'Self-hosted workflow automation via webhooks.', configFields: [{ key: 'webhookUrl', label: 'n8n webhook URL' }] },
  { id: 'meta-ads', name: 'Meta Ads Manager', category: 'Advertising', connected: true, description: 'Click-to-WhatsApp ads with Conversions API sync.', configFields: [{ key: 'pixelId', label: 'Pixel / Dataset ID' }, { key: 'accessToken', label: 'Conversions API token' }] },
  { id: 'slack', name: 'Slack', category: 'Productivity', connected: false, description: 'Get notified of hot leads and campaign results.', configFields: [{ key: 'webhookUrl', label: 'Slack incoming webhook URL' }] },
  { id: 'webhooks', name: 'Custom Webhooks', category: 'Developer', connected: false, description: 'Push message/conversation/payment events to any endpoint.', configFields: [{ key: 'endpointUrl', label: 'Endpoint URL' }, { key: 'secret', label: 'Signing secret' }] },
  { id: 'generic-api', name: 'Generic API', category: 'Developer', connected: false, description: 'Bring your own REST API for custom data lookups in flows.', configFields: [{ key: 'baseUrl', label: 'Base URL' }, { key: 'apiKey', label: 'API key' }] },
]
