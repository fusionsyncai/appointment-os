# Appointment OS

Multi-tenant SaaS dashboard for agencies to manage customers, appointments, and integrations.

Built with **Next.js**, **NextAuth**, **Supabase (PostgreSQL)**, **Prisma 7**, and **shadcn/ui**. UI is based on the reference app in `ref-app/`.

## Prerequisites

- Node.js 20.19+
- [Supabase](https://supabase.com) project

## Setup

1. **Install dependencies**

```bash
npm install
```

`postinstall` runs `prisma generate` automatically (Prisma 7 requirement).

2. **Configure environment**

Copy `.env.example` to `.env` and fill in values from **Supabase Dashboard → Project Settings → Database**:

| Variable | Supabase source | Purpose |
|----------|-----------------|---------|
| `DATABASE_URL` | **Transaction pooler** (port `6543`, user `postgres.[project-ref]`, `?pgbouncer=true`) | App runtime on Vercel/local via `@prisma/adapter-pg` |
| `DIRECT_URL` | **Direct connection** (port `5432`, user `postgres`, host `db.[project-ref].supabase.co`) | Prisma CLI only (`db push`, migrations, seed) |
| `AUTH_SECRET` | — | Random secret for Auth.js sessions |
| `NEXT_PUBLIC_APP_URL` | — | Public HTTPS URL for Google Calendar webhooks only (ngrok in dev) |
| `ENCRYPTION_KEY` | — | Min 32 chars — encrypts integration tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Optional — Google Sign In |

> **Prisma 7 note:** Connection URLs live in `.env` and are loaded via `prisma.config.ts`. The schema no longer contains a `url` field. See the [Prisma v7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).

3. **Initialize the database**

```bash
npm run db:setup
```

This pushes the schema and seeds demo data:

- **Admin:** `admin@demo.agency` / `password123`
- **Member:** `member@demo.agency` / `password123`
- 20 customers, 50 appointments, connected integrations

4. **Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push the repo and import it in Vercel.
2. Set the same env vars as `.env.example` (especially `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`).
3. Use the **Transaction pooler** string for `DATABASE_URL` (port `6543`, username `postgres.[project-ref]`).
4. Do **not** use `DIRECT_URL` as `DATABASE_URL` on Vercel — serverless needs the pooler.

If you see `Tenant or user not found`:

- Copy the pooler hostname from Supabase Dashboard exactly (`aws-0` vs `aws-1` matters).
- Ensure username is `postgres.[project-ref]`, not `postgres`.
- Add `?pgbouncer=true` to `DATABASE_URL` (the app adds this automatically if missing).

References: [Supabase Prisma troubleshooting](https://supabase.com/docs/guides/database/prisma/prisma-troubleshooting), [Prisma + Supabase](https://www.prisma.io/docs/orm/overview/databases/supabase).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Prisma Client to `generated/prisma` |
| `npm run db:push` | Generate + push schema to Supabase |
| `npm run db:seed` | Seed demo data |
| `npm run db:setup` | Generate + push + seed |

## Features

- Email/password and Google authentication
- Multi-tenant agency workspaces with role-based access
- Dashboard with KPIs, charts, and activity feed
- Customer CRUD with detail pages and appointment history
- Appointments list with filters and analytics sidebar
- Google Calendar and Slack integrations (demo OAuth + sync)
- Agency and team settings

## Project structure

```
app/                  Next.js App Router pages and API routes
components/           UI components (shadcn + app-specific)
generated/prisma/     Prisma 7 generated client (gitignored, created by `prisma generate`)
lib/                  Auth, database adapter, utilities
prisma/               Schema and seed data
prisma.config.ts      Prisma 7 CLI config (Supabase DIRECT_URL)
ref-app/              Original Base44 prototype (reference only)
docs/project.md       Full product specification
```

## Documentation

See [docs/project.md](docs/project.md) for the complete product spec and data models.
