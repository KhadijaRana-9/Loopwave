# Meta production onboarding — Loopwave

Audience: the Loopwave owner and whoever operates the Meta app. Audited **2026-09-28** against the live Meta Graph API and Railway. No credential values are recorded here.

## 1. Where things stand

| Item | State | Evidence |
|---|---|---|
| Meta app | "Loopwave Test", **Development mode**, 1 admin (a personal Facebook account) | Graph `/{app}`, `/{app}/roles` |
| Business portfolio | "Loopwave Test", **not verified** (`business_verification_status: not_verified`) | Graph WABA lookup |
| Webhook | Registered and verified by Meta: `https://api-production-e5f5.up.railway.app/api/whatsapp/webhook`, fields `messages`, `message_template_status_update`, `account_update` | Graph `/{app}/subscriptions`, handshake in API logs |
| Basic settings | **Privacy Policy URL, Terms URL, App domains, Category, App icon: all empty** | Graph `/{app}` |
| Sandbox WABA | Meta test WABA + test number, tier `TIER_250`, quality GREEN — **sandbox only** | Graph |
| Embedded Signup | Not configured: no Facebook Login for Business configuration; `META_APP_ID`, `META_CONFIG_ID` unset on Railway | Railway variable names |
| Advanced Access / App Review / Tech Provider | Not started (dashboard shows "Become a Tech Provider") | App dashboard |
| Loopwave code | Sandbox E2E verified: send, delivery/read webhooks, inbound reply, Inbox reply, template sync/import, token expiry/reauth handling | Test log 2026-09-28 |

## 2. What is missing, in order

Meta's console labels change; use the names below to find each screen.

1. **Company Meta Business portfolio + Business Verification** (Meta approval: yes).
   Business Settings → Security Center → Business verification. Needs the company's legal documents. Do this in the *company's* portfolio, not a personal one.
2. **Decide the production app.** Recommended: create a new Meta app named `Loopwave` under the company portfolio instead of reusing "Loopwave Test" (personal ownership, "Test" in the name, unverified portfolio). A new app means a new App ID, App Secret and webhook registration (steps 6-7).
3. **Fill the owner details, then set the Live-mode basics** (Meta approval: no).
   Fill `src/constants/legal.js` (entity name, address, contact and privacy emails, jurisdiction) and have counsel review `/privacy`, `/terms`, `/data-deletion`. Then App settings → Basic:
   - Privacy Policy URL `https://loopwave-pi.vercel.app/privacy`
   - Terms of Service URL `https://loopwave-pi.vercel.app/terms`
   - User data deletion → *Data deletion instructions URL* `https://loopwave-pi.vercel.app/data-deletion`
   - App domains `loopwave-pi.vercel.app`, a Category, a 1024×1024 App icon.
4. **Become a Tech Provider, then Access Verification** (Meta approval: yes). App dashboard → Use cases → Customize → Become a Partner → Become Tech Provider. Required before App Review for other businesses' data.
5. **App Review — Advanced Access** (Meta approval: yes). App dashboard → Use cases → Customize → Permissions and features (or App Review → Permissions and Features): request `whatsapp_business_management` and `whatsapp_business_messaging` with a screencast of the real Loopwave flow (Embedded Signup → send → inbox). Loopwave does not use system-user tokens, so `business_management` is not needed.
6. **Facebook Login for Business configuration** (Meta approval: no to create). Facebook Login for Business → Configurations → Create, from the template "WhatsApp Embedded Signup Configuration With 60 Expiration Token". Copy the **Configuration ID** = `META_CONFIG_ID`.
   Facebook Login for Business → Settings → Client OAuth settings: Client OAuth login, Web OAuth login, Enforce HTTPS, Embedded Browser OAuth Login, Use Strict Mode for redirect URIs, Login with the JavaScript SDK — all **ON**. Allowed Domains for the JavaScript SDK `https://loopwave-pi.vercel.app`; Valid OAuth Redirect URIs `https://loopwave-pi.vercel.app/`.
7. **Railway (API service only).** Set `META_APP_ID` (App settings → Basic → App ID; not secret), `META_CONFIG_ID` (step 6), `WHATSAPP_APP_SECRET` (App settings → Basic → App secret; secret — enter it in the Railway dashboard, never in chat or a screenshot). Keep `WHATSAPP_VERIFY_TOKEN`. Redeploy the API, then check `GET /api/whatsapp/signup-config` returns `configured: true`.
   Webhook: register on the production app with `POST /{app-id}/subscriptions` (object `whatsapp_business_account`, the callback URL above, the Railway verify token, fields as in section 1) or WhatsApp → Configuration → Webhook in the console.
8. **Switch the app to Live** (top bar) once steps 3-6 are done. Nothing here is set by Loopwave code.
9. **Real production proof** — with a *non-test* WABA and phone number (number not registered on a WhatsApp app, or deregistered; payment method on the WABA): Embedded Signup from `/app/whatsapp`, confirm WABA/phone stored against the right tenant, send one approved template, receive the delivery/read webhooks, reply from the phone, see it in the Inbox. Until this passes, Loopwave is not production-ready for WhatsApp.

## 3. Where each value goes

| Value | Railway `api` | Railway `worker` | Vercel | Secret? |
|---|---|---|---|---|
| `META_APP_ID` | yes | no | no (served by `GET /api/whatsapp/signup-config`) | no |
| `META_CONFIG_ID` | yes | no | no (same) | no |
| `WHATSAPP_APP_SECRET` | yes | no | **never** | yes |
| `WHATSAPP_VERIFY_TOKEN` | yes | no | never | yes |
| `WHATSAPP_API_VERSION` | yes | yes | no | no |
| `ENCRYPTION_KEY`, `REDIS_URL`, `DATABASE_URL`, `DIRECT_URL` | yes | yes | never | yes |
| `STORAGE_*` (media) | yes | yes | never | yes |

## 4. Engineering follow-ups found in this audit (not changed — Meta implementation is frozen)

- **Webhook payload retention.** `WebhookEvent.payload` stores each raw webhook (message text, phone numbers, profile names) forever, and rows are never linked to a tenant, so they survive workspace deletion. The Privacy Policy and Data Deletion pages state a 30-day retention for these logs; a retention/scrub job must exist before that is true.
- **"Disconnect" keeps the token.** Disconnecting a number only sets its status to `DISCONNECTED`; the encrypted access token stays and the app stays subscribed to the WABA at Meta. Consider clearing the token (when the account has no other connected number) and calling `DELETE /{waba}/subscribed_apps`.
- **Account deletion is manual** (by email, per the Data Deletion page); it must also remove uploaded media from object storage once storage is configured.
- The public **Contact page** no longer shows invented details or a fake form: email, phone and address come from `src/constants/legal.js` and show "[Owner to provide: …]" markers until filled in. There is no contact-form endpoint on the backend, so there is deliberately no form.
- **`FB.init` SDK version** is hard-coded to `v21.0` in `src/utils/metaEmbeddedSignup.js`, while the API uses `WHATSAPP_API_VERSION` (`v25.0`). Checked against Meta's version table (2026-09-28): v21.0 is supported until **21 Jan 2027**, so it works today; v25.0 until 29 Jul 2028; v26.0 is the latest. Meta documents no requirement that the SDK version match the server version (the SDK version only selects the version of the login dialog / `.api()` calls). Left unchanged on purpose — it cannot be tested until `META_APP_ID` and `META_CONFIG_ID` exist. Before Jan 2027: move it to the same version as the API (ideally served by `GET /api/whatsapp/signup-config` so there is one source) and confirm with a real Embedded Signup popup.
- Templates that need variables, carousels, named parameters, dynamic-URL buttons or unsupported components are not imported on sync. The Templates page lists every one with its reason (requires variables / carousel / media / unsupported / plan limit), so none are dropped silently. Media-header template *submission* needs Meta's Resumable Upload handle.
- Other "demo" wording still in the product UI (honest labels for features that are not built, but confusing in production): Contacts CSV import/export toasts, Analytics export toast, Admin Plans "create plan" toast, Integrations page ("Demo build — credentials held in memory only"), AI agent detail sample, and Billing copy for the sandbox mode. Each needs either a real implementation or the button hidden.

## 5. Safety

- `server/.env` on a development machine can hold the **production** database URL. `npm run prisma:migrate`, `prisma:reset` and `db:push` now run `scripts/guard-destructive-db.mjs` first and refuse any non-local database unless `LOOPWAVE_ALLOW_DESTRUCTIVE_DB=<host>` is set deliberately. Direct `npx prisma migrate dev` is not intercepted — do not run it. Production only ever receives `prisma migrate deploy` (Railway start command).
- Create a separate development database (e.g. a Neon branch) and point local `server/.env` at it; the test suite currently runs against the shared production database.
- Use a different `ENCRYPTION_KEY` locally than in production.
- Secrets already rotated after exposure: the verify token (logged once) and the App Secret (pasted into chat once).
- Railway is on a trial that ends about **17 Oct 2026**; usage is tiny ($0.58 for 17-28 Sep) but a paid plan is needed after the trial or services stop.
