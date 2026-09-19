// Shared between the campaign wizard and template preview so both render a
// WhatsApp-style bubble with sample values substituted the same way —
// {{unknownVar}} is left as-is rather than rendered as "undefined"/"null".
export const SAMPLE_VALUES = {
  firstName: 'Aisha',
  lastName: 'Khan',
  name: 'Aisha Khan',
  companyName: 'Your Business',
  phone: '+91 98765 43210',
  discount: '50%',
  shopLink: 'https://yourshop.example/sale',
  1: 'Aisha',
  2: 'Your Business',
}

export function renderPreviewText(text) {
  return (text || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => SAMPLE_VALUES[key] ?? match)
}
