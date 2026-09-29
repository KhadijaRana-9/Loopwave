// The one place for business/legal details that only the owner can supply.
// Anything left `null` renders on the legal pages as a highlighted
// "[Owner to provide: ...]" marker — never as an invented value — so it is
// obvious what is still missing. Fill these in (and have counsel review the
// pages) before submitting the app to Meta for review or going Live.
export const LEGAL = {
  productName: 'Loopwave',
  websiteUrl: 'https://loopwave-pi.vercel.app',
  legalEntityName: null, // registered name of the company that operates Loopwave
  registeredAddress: null, // registered postal address
  jurisdiction: null, // governing law and courts, e.g. "the laws of <country/state>"
  contactEmail: null, // general contact (also shown on the public Contact page)
  contactPhone: null, // optional public phone number (shown on the Contact page)
  privacyEmail: null, // privacy, data-subject and data-deletion requests
  dataProtectionOfficer: null, // optional: name/contact if one is appointed
  effectiveDate: '28 September 2026',
  lastUpdated: '28 September 2026',
}
