# Edgelink SEO Automation Dashboard

A Next.js 14 application for SEO audits, with an administrator portal, a client dashboard, PostgreSQL persistence, a BullMQ worker, Claude-powered analysis, and PDF reports.


## Project Demo

[▶ Watch the full project demo](https://github.com/swapnilk1806/edgelink-ai-audit/blob/main/vedio/demo.mp4)

## What it does

- Lets administrators manage client accounts and queue website audits.
- Shows audit progress and results in the admin and client portals.
- Crawls public websites and collects on-page and technical SEO signals.
- Uses mock PageSpeed, Search Console, and DataForSEO data when `USE_MOCKS=true`.
- Uses Claude (`claude-sonnet-4-6`) for structured findings in live mode and evidence-based local analysis in mock mode.
- Generates downloadable PDF reports.
- Logs mock email and WhatsApp delivery; these are not live delivery integrations.

## Screenshots and sample report

The `img/` folder contains application screenshots. The `report/` folder contains a sample SEO audit as a single PDF.

| Screen | Screenshot |
|---|---|
| Admin login | ![Admin login page](./img/admin%20login%20page.png) |
| Admin dashboard | ![Admin dashboard](./img/admin%20dashboard.png) |
| Admin clients | ![Admin clients page](./img/admin%20page%20Clients.png) |
| Admin audit history | ![Admin audit history](./img/admin%20Audit%20history.png) |
| Client dashboard | ![Client dashboard](./img/clients%20Dashbaord.png) |
| Client report | ![Client report](./img/clients%20Report.png) |

[Open the sample SEO audit PDF](./report/seo-audit-c13efe23-acc6-4ce2-b55a-23e50224170f.pdf).

## Architecture

- `frontend/` is the Next.js web application. Its API routes handle authentication, client and audit management, and report downloads.
- `backend/` contains shared server-side services, database setup, mock integrations, and the BullMQ audit worker.
- The web application and worker both use PostgreSQL and Redis. The worker is a separate process; it does not expose an HTTP port.
- The web application listens on port `3000` by default. Its API routes use the same host and port, for example `http://localhost:3000/api/admin/overview`.

The worker processes jobs from the `seo-audit-jobs` queue. It crawls the site, gathers applicable signals, analyzes them, stores the result, generates a report, and records mock notification outcomes.

## Requirements

- Node.js `>=20.11.0`
- npm
- PostgreSQL (a hosted PostgreSQL service such as Neon or Supabase can be used)
- Redis TCP access compatible with BullMQ (for example, an Upstash Redis TCP URL)
- An Anthropic API key to run audits with Claude when `USE_MOCKS=false`

## Local setup

Open PowerShell at the repository root and install each app's dependencies:

```powershell
Set-Location frontend
npm ci
Set-Location ..\backend
npm ci
Set-Location ..
```

Create the backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Edit `backend/.env` and set at least:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DATABASE_SSL=auto
UPSTASH_REDIS_URL=rediss://default:PASSWORD@HOST:6379
SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters-long
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-4-6
USE_MOCKS=true
APP_URL=http://localhost:3000
REPORT_STORAGE_DIR=./reports
SEED_ADMIN_EMAIL=admin@example.com
SEED_PASSWORD=replace-with-a-strong-password
```

Use the Redis **TCP** connection URL, not an HTTPS REST URL or token. Use the same `SESSION_SECRET` for the web app and worker. `DATABASE_SSL=auto` uses TLS for remote production databases and disables it for localhost; it also accepts `true` or `false`. With `USE_MOCKS=true`, the audit runs without a paid AI key; external sample metrics are only applied when their fixture host matches the audited site.

The frontend reads its server-side environment from `backend/.env` through `frontend/next.config.mjs`; `frontend/.env` contains the same runtime values as a local fallback. Keep those shared values in sync. The backend file is loaded first. Do not put database credentials, Redis credentials, session secrets, or API keys in `NEXT_PUBLIC_*` variables.

Client website URLs must be real, publicly resolvable websites. Reserved placeholder domains such as `.example` cannot be crawled; update those website URLs in the admin client manager before retrying their audits. For hosted PostgreSQL, use `sslmode=verify-full` in `DATABASE_URL` to retain certificate and hostname verification without the node-postgres compatibility warning.

Website fetches have a 30-second timeout. If an audit times out, verify that the site is reachable from the worker and retry; timeout errors identify whether crawling, Claude analysis, or PDF generation exceeded its limit.

### Initialize the database

From the repository root:

```powershell
Set-Location backend
npm run db:migrate
```

For a new installation, create or update the administrator account after configuring `SEED_ADMIN_EMAIL` and `SEED_PASSWORD`:

```powershell
Set-Location backend
npm run db:seed
```

The seed command also applies the initial SQL setup. Use a production-strength password and protect the database credentials. Run `npm run db:migrate` before starting the worker after deploying schema changes.

### Start the app and worker

Run each command in a separate terminal, from the indicated directory.

Terminal 1 - web app:

```powershell
Set-Location frontend
npm run dev
```

Open `http://localhost:3000/login`.

Terminal 2 - audit worker:

```powershell
Set-Location backend
npm run worker
```

The worker requires the same database, Redis, session, and AI configuration. The admin portal can queue jobs while the worker is running.

## API routes

These routes are part of the Next.js app and share its host and port:

| Route | Purpose |
|---|---|
| `/api/auth/login` | Sign in |
| `/api/auth/logout` | Sign out |
| `/api/admin/overview` | Admin overview data |
| `/api/admin/clients` | List and create clients |
| `/api/admin/clients/[id]` | Update or remove a client |
| `/api/admin/audits` | List audits and queue an audit |
| `/api/client/audits` | Client audit history |
| `/api/reports/[auditId]` | Download an audit PDF |

## Environment variables

Use `backend/.env.example` and `frontend/.env.example` as local templates. Keep shared runtime values in both local files; set the corresponding values in the deployment platform's environment settings:

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string used by the app and worker |
| `UPSTASH_REDIS_URL` | Yes | Redis TCP URL for BullMQ |
| `SESSION_SECRET` | Yes | Secret used to sign sessions; use at least 32 characters |
| `ANTHROPIC_API_KEY` | Live mode only | Anthropic API key for Claude; not required when `USE_MOCKS=true` |
| `ANTHROPIC_MODEL` | No | Anthropic model name; defaults to `claude-sonnet-4-6` |
| `DATABASE_SSL` | No | `auto`, `true`, or `false`; defaults to automatic behavior |
| `APP_URL` | No | App's public URL; defaults to `http://localhost:3000` |
| `USE_MOCKS` | No | Set to `true` to use the available mock provider data |
| `REPORT_STORAGE_DIR` | No | Report output directory; defaults to `./reports` |
| `SEED_ADMIN_EMAIL` | For initial seed | Administrator email created by the seed command |
| `SEED_PASSWORD` | For initial seed | Administrator password created by the seed command |
| `SEED_SAMPLE_CLIENT_EMAIL` | No | Optional sample client account during seeding |
| `SEED_SAMPLE_CLIENT_PASSWORD` | No | Optional sample client account password |

The environment template also includes optional integration placeholders. Do not assume that setting an optional key enables a live provider: PageSpeed, Search Console, DataForSEO, email, WhatsApp, and object-storage integrations currently use mock or placeholder behavior.

## Deploying the web app to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. Set the Vercel **Root Directory** to `frontend`. The Next.js app imports server-side code from `backend/`; enable Vercel's option to include files outside the root directory if it is shown.
3. Use Node.js 20.x, `npm ci` for installation, and `npm run build` for the build.
4. Add the required environment variables in Vercel's project settings:
   - `DATABASE_URL`
   - `DATABASE_SSL=auto`
   - `UPSTASH_REDIS_URL`
   - `SESSION_SECRET` (generate a new, unique production value)
   - `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` when `USE_MOCKS=false`
   - `APP_URL` set to the deployed URL or custom domain
   - `USE_MOCKS=true` for mock provider data, or `false` only if all required live integrations have been implemented
   - `REPORT_STORAGE_DIR=/tmp/reports` for temporary report generation
5. Apply the database setup and create the initial administrator against the production database. Do not commit environment files or expose secret variables to browser code.

### Deploy the worker separately

Deploy the worker as a long-running Node.js service on a worker-capable host such as Render or Railway:

- Root directory: `backend`
- Install command: `npm ci`
- Start command: `npm run worker`
- Configure the same `DATABASE_URL`, `DATABASE_SSL`, `UPSTASH_REDIS_URL`, `SESSION_SECRET`, and Anthropic variables as the Vercel project when using live analysis.

Vercel hosts the web app and its API routes; it should not be used to keep this BullMQ worker running continuously. There is currently no scheduled-audit endpoint in the app, so an external cron service cannot trigger audits until such an endpoint is added and secured.

## Operational notes and limitations

- Reports are written to the local filesystem. Vercel's `/tmp` directory is temporary and should not be treated as durable storage. Configure and implement persistent object storage before relying on report retention in production.
- The existing storage and notification helpers are mocks; adding environment variables alone does not make them live integrations.
- Mock provider data is sample data and should not be presented as real measurements for a client.
- The crawler is intended for public websites, not internal or private network targets.
- Keep secrets server-side, use TLS for hosted database and Redis connections, and do not commit `.env` files.

## Validation

Run the frontend typecheck and production build:

```powershell
Set-Location frontend
npm run typecheck
npm run build
```

Run the backend typecheck:

```powershell
Set-Location backend
npm run typecheck
```

An end-to-end audit requires reachable PostgreSQL and Redis services and a public website to crawl. A valid Anthropic API key is additionally required only when `USE_MOCKS=false`.

## Project layout

```text
frontend/
  src/app/                 Pages and Next.js API routes
  src/components/          Admin, authentication, and client UI
  next.config.mjs          Loads local backend environment for server routes
  .env.example             Frontend server environment template
backend/
  src/db/                  SQL setup and seed script
  src/lib/                 Database, queue, crawl, AI, and report services
  src/mocks/               Mock integrations and fixtures
  src/workers/             BullMQ worker entry point
  .env.example             Backend environment template
  reports/                 Local report output
img/                        Application screenshots
report/                     Sample SEO audit PDF
```
