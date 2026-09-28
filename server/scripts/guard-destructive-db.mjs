// Refuses to let a destructive Prisma command (`migrate dev`, `migrate reset`,
// `db push`) run against a remote database from a developer machine.
//
// Why: server/.env on a dev machine can hold the PRODUCTION connection string
// (production Neon has been shared with local dev and the test suite), and
// `prisma migrate dev` / `migrate reset` can drop tables and data when they
// detect drift. Production only ever gets `prisma migrate deploy`
// (`npm run prisma:deploy`), which applies already-reviewed migrations.
//
// Local databases (localhost / 127.0.0.1 / ::1) are always allowed. For a
// remote *development* database, confirm deliberately by setting
//   LOOPWAVE_ALLOW_DESTRUCTIVE_DB=<the database host>
// (typing the host name is the confirmation). Only the host is ever printed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readDotEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

const fromFile = readDotEnv(path.join(serverDir, '.env'))
const effective = (key) => process.env[key] ?? fromFile[key]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
// Neon's pooled and direct endpoints are the same database: `...-pooler.` vs `...`.
const normalize = (host) => host.replace('-pooler', '')

const remote = []
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  const value = effective(key)
  if (!value) continue
  let host
  try {
    host = new URL(value).hostname
  } catch {
    console.error(`Refusing to continue: ${key} is set but is not a valid URL, so it cannot be checked.`)
    process.exit(1)
  }
  if (!LOCAL_HOSTS.has(host)) remote.push({ key, host })
}

if (remote.length === 0) process.exit(0)

const confirmed = effective('LOOPWAVE_ALLOW_DESTRUCTIVE_DB')
const hosts = [...new Set(remote.map((r) => normalize(r.host)))]
if (confirmed && hosts.length === 1 && normalize(confirmed) === hosts[0]) {
  console.warn(`WARNING: running a destructive Prisma command against the remote database ${hosts[0]} (confirmed via LOOPWAVE_ALLOW_DESTRUCTIVE_DB).`)
  process.exit(0)
}

console.error(
  [
    '',
    'REFUSING to run a destructive Prisma command (migrate dev / migrate reset / db push).',
    `  ${remote.map((r) => `${r.key} -> ${r.host}`).join('\n  ')}`,
    '',
    'That is a remote database, and it may be production. `migrate dev` and `migrate reset` can drop tables and delete data.',
    '  - For development, use a local Postgres or a separate development database (e.g. a Neon branch) in server/.env.',
    '  - Production only receives `npm run prisma:deploy` (prisma migrate deploy), never `migrate dev` or `reset`.',
    `  - If this really is a throwaway remote dev database, confirm by setting LOOPWAVE_ALLOW_DESTRUCTIVE_DB=${hosts[0]}`,
    '',
  ].join('\n'),
)
process.exit(1)
