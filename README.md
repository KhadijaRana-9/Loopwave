# Loopwave

A multi-tenant WhatsApp CRM, marketing and automation platform: shared inbox, contacts/CRM, sales pipeline, campaigns & templates, chatbot and automation flow builders, AI agents, forms, billing/usage, integrations, and a super-admin platform console.

## Stack

- **Frontend**: React 19, Vite, Tailwind CSS, React Router, TanStack Query, Zustand, React Flow (`@xyflow/react`), Recharts, Socket.IO client.
- **Backend** (`server/`): Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Zod validation, JWT + httpOnly cookies, Socket.IO, BullMQ/Redis (optional — see below).

## Project layout

```
src/            React app (pages, features, components, services)
server/         Express API
  src/
    config/       env, prisma client, permissions, integrations catalog
    controllers/  request handlers
    services/     business logic
    repositories/ Prisma queries (every query is tenant-scoped here)
    integrations/ WhatsApp, AI, email, payments provider adapters
    jobs/         BullMQ queue + worker (campaign sending)
    websocket/    Socket.IO server
    validators/   Zod request schemas
    routes/       Express routers
  prisma/         schema, migrations, seed
```

## Local setup

### 1. Database

You need a PostgreSQL database (a free Neon/Supabase project works fine, or run Postgres locally).

```bash
cd server
cp .env.example .env
# fill in DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY
# (the .env.example comments explain each one and how to generate secrets)
npm install
npm run prisma:migrate   # creates tables
npm run seed             # realistic demo data — prints login credentials
```

### 2. Backend

```bash
cd server
npm run dev     # http://localhost:4000
```

### 3. Frontend

```bash
cp .env.example .env   # optional, defaults to http://localhost:4000/api
npm install
npm run dev             # http://localhost:5173
```

Log in with the credentials printed by `npm run seed` (defaults: `aisha@loopwavedemo.com` / `Demo1234!` for the business app, `admin@loopwave.internal` / `ChangeMe123!` for `/admin`).

### 4. Background worker (optional)

Campaign sending works without this — it falls back to sending directly in the API process when Redis isn't reachable. For production, run a real Redis instance and start the dedicated worker so scheduled sends survive a server restart:

```bash
cd server
npm run worker
```

## Commands

| Command | Where | What |
|---|---|---|
| `npm run dev` | root | Start the frontend (Vite) |
| `npm run build` / `npm run lint` | root | Production build / lint the frontend |
| `npm run dev` | `server/` | Start the API with hot reload |
| `npm run worker` | `server/` | Start the BullMQ background worker |
| `npm run build` / `npm start` | `server/` | Compile and run the API in production mode |
| `npm run typecheck` | `server/` | TypeScript check without emitting |
| `npm run prisma:migrate` | `server/` | Create/apply a migration in development |
| `npm run prisma:deploy` | `server/` | Apply migrations in production |
| `npm run prisma:studio` | `server/` | Browse the database |
| `npm run seed` | `server/` | Seed realistic demo data |

## API overview

All routes are mounted under `/api` and cookie-authenticated (`requireAuth` reads the `access_token` httpOnly cookie). Tenant-scoped routes additionally require `requireTenant` and a permission check (`server/src/config/permissions.ts`); every repository query takes `tenantId` as an explicit argument, so tenant isolation is enforced at the data layer, not just the UI.

Key resource groups: `/auth`, `/contacts`, `/pipeline`, `/conversations`, `/templates`, `/campaigns`, `/team`, `/notifications`, `/chatbots`, `/automations`, `/ai-agents`, `/forms` (with a public, unauthenticated `/forms/:id/submit`), `/whatsapp` (including the Meta webhook), `/integrations`, `/billing` (including the payment-provider webhook), `/analytics`, `/admin` (super admin only). See `server/src/routes/index.ts` for the full mount list and each `*.routes.ts` file for its endpoints.

## Integration status (honest, not aspirational)

Every external integration is built as a real adapter with a working demo/sandbox mode, gated by `integrationReadiness` in `server/src/config/env.ts`. Nothing claims to be "connected" unless it actually is:

- **WhatsApp**: Meta Cloud API adapter (`server/src/integrations/whatsapp.adapter.ts`) + webhook with signature verification. Runs in demo mode until `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, etc. are set.
- **AI**: provider-abstracted (`server/src/integrations/ai.adapter.ts`). Uses OpenAI when `OPENAI_API_KEY` is set; otherwise a deterministic, clearly-labeled demo responder grounded in each agent's own configured FAQs/questions.
- **Payments**: Stripe adapter (`server/src/integrations/payments.adapter.ts`) with signature-verified webhook. Without `STRIPE_SECRET_KEY`/`RAZORPAY_KEY_ID`, plan changes go through an explicit sandbox path (no real charge, clearly labeled in the UI).
- **Email**: Resend adapter (`server/src/integrations/email.adapter.ts`); logs to the console in demo mode without `RESEND_API_KEY`.

## What's not production-ready yet

- No automated test suite (unit/integration/e2e) has been added — see the final report delivered alongside this codebase for specifics.
- Real-time and campaign sending fall back to in-process behavior without a running Redis — fine for development, but production should run Redis + the worker.
- File/media upload storage (S3-compatible) is not yet implemented.
