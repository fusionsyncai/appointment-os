# Appointment OS — Project Specification

A multi-tenant SaaS platform for marketing agencies and service businesses to manage customers, appointments, and third-party integrations.

This document combines the original product prompt with the reference implementation in `ref-app/`. Use it as the source of truth when building the production application in the repository root.

---

## Overview

**Appointment OS** gives each agency an isolated workspace where team members can:

- Track customers and their meeting history
- Schedule and monitor appointments
- Connect Google Calendar and Slack
- View analytics and recent activity from a unified dashboard

The product should feel production-ready — comparable in polish to Linear, Stripe Dashboard, or Attio — with fast page loads, responsive layouts, and thoughtful empty/loading/error states.

---

## Repository Structure

| Path | Purpose |
|------|---------|
| `/` | Production app target — Next.js, NextAuth, PostgreSQL |
| `ref-app/` | UI/UX prototype built on Base44 (React + Vite) |
| `docs/` | Project documentation (this file) |

The **ref-app** is a functional prototype that validates layout, page structure, data flows, and visual design. The **root project** is the scaffold for the real implementation with proper auth, database, and multi-tenant isolation.

---

## Tech Stack

### Target (Production)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| Auth | NextAuth — email/password + Google Sign In |
| Database | PostgreSQL |
| Architecture | Multi-tenant (agency-scoped data) |
| Styling | Tailwind CSS, light/dark mode |
| UI | Modern SaaS components (shadcn/ui or equivalent) |

### Reference App (`ref-app/`)

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Vite |
| Backend | Base44 SDK (`@base44/sdk`) |
| Routing | React Router v6 |
| Data fetching | TanStack React Query |
| UI | shadcn/ui (Radix primitives) |
| Charts | Recharts |
| Theming | next-themes |

---

## Core Concept

- Each **agency** has its own isolated workspace.
- Users sign up and belong to **exactly one agency**.
- **All data must be scoped to the agency** — customers, appointments, integrations, activity, and settings.
- On signup: create agency → create first admin user → redirect to dashboard.

---

## User Roles

### Agency Admin

| Capability | Allowed |
|------------|---------|
| Manage agency settings | ✓ |
| Manage integrations | ✓ |
| View all customers | ✓ |
| View all appointments | ✓ |
| Invite team members | ✓ |
| Change roles / remove users | ✓ |

### Agency Member

| Capability | Allowed |
|------------|---------|
| View customers | ✓ |
| View appointments | ✓ |
| Create customers | ✓ |
| Manage integrations | ✗ |

> **Ref-app note:** Roles are stored as `admin` | `member` on the user record. Settings page gates team management actions to admins only.

---

## Data Models

### Agency

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `name` | string | Display name |
| `logo_url` | string? | Optional logo |
| `timezone` | string | e.g. `America/New_York` |
| `created_at` | timestamp | |

### User

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `agency_id` | UUID | FK → Agency |
| `name` | string | Full name |
| `email` | string | Unique per agency |
| `role` | enum | `admin` \| `member` |
| `created_at` | timestamp | |

### Customer

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `agency_id` | UUID | FK → Agency |
| `first_name` | string | Required |
| `last_name` | string | Required |
| `email` | string | Required, used for calendar sync matching |
| `phone` | string? | |
| `company_name` | string? | |
| `notes` | text? | |
| `last_activity_date` | timestamp? | Updated on appointment activity |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### Appointment

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `agency_id` | UUID | FK → Agency |
| `customer_id` | UUID | FK → Customer (required) |
| `google_event_id` | string? | Set when synced from Google Calendar |
| `title` | string | Required |
| `description` | text? | |
| `start_time` | timestamp | Required |
| `end_time` | timestamp | Required |
| `status` | enum | `scheduled` \| `completed` \| `cancelled` |
| `meeting_link` | string? | e.g. Google Meet URL |
| `created_at` | timestamp | |

> **Ref-app note:** The prototype also denormalizes `customer_name` and `customer_email` on appointments for display convenience. In production, prefer joins or computed fields.

### Integration

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `agency_id` | UUID | FK → Agency |
| `provider` | enum | `google_calendar` \| `slack` |
| `status` | enum | `connected` \| `disconnected` |
| `access_token` | string | Encrypted at rest |
| `refresh_token` | string? | Encrypted at rest |
| `metadata` | JSONB | Provider-specific (workspace_id, channels, etc.) |
| `calendar_id` | string? | Google Calendar only |
| `workspace_name` | string? | Slack only |
| `selected_channel` | string? | Slack default notification channel |
| `last_sync_at` | timestamp? | |
| `total_synced` | integer | Count of synced events |
| `connected_at` | timestamp | |

### Activity (Audit / Feed)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `agency_id` | UUID | FK → Agency |
| `type` | enum | See below |
| `description` | string | Human-readable message |
| `entity_id` | string? | Related record ID |
| `actor_name` | string? | User who triggered the action |
| `created_at` | timestamp | |

**Activity types:**

- `customer_created`
- `meeting_booked`
- `meeting_cancelled`
- `integration_connected`
- `integration_disconnected`

---

## Customer Relationship Rules

1. A customer can have **multiple appointments**.
2. Every appointment must belong to **exactly one customer**.
3. When a Google Calendar event is synced:
   1. Search for existing customer by **email** (attendee).
   2. If found → attach appointment to existing customer.
   3. If not found → auto-create customer, then create appointment.
4. Customer detail should show:
   - Contact information
   - Appointment count
   - Upcoming appointments
   - Previous appointments
   - Last interaction date

> **Ref-app implementation:** `Integrations.jsx` → `syncGoogle()` implements this flow using LLM-generated mock events. Production should use the Google Calendar API with real OAuth tokens.

---

## Authentication

Use **NextAuth** with:

- Email/password credentials
- Google OAuth Sign In

**Signup flow:**

1. User registers (email/password or Google).
2. Create a new **Agency** record.
3. Create the **User** as `admin` linked to that agency.
4. Redirect to `/` (dashboard).

**Ref-app note:** Auth is handled by Base44 SDK (`db.auth.me()`, `db.auth.logout()`, `db.auth.redirectToLogin()`). Login/register pages exist in `ref-app/src/pages/` but are routed through Base44's hosted auth flow.

---

## Application Layout

### Sidebar Navigation

| Route | Label |
|-------|-------|
| `/` | Dashboard |
| `/customers` | Customers |
| `/appointments` | Appointments |
| `/integrations` | Integrations |
| `/settings` | Settings |

### Top Bar

- Global search (customers, appointments)
- Notifications bell
- Theme toggle (light/dark)
- User menu (profile, settings, sign out)

### Responsive Behavior

- Sidebar collapses to drawer on mobile (`ref-app/src/components/Sidebar.jsx`)
- Sticky top bar with backdrop blur
- Content area with consistent padding (`p-4 lg:p-6 xl:p-8`)

---

## Pages

### Dashboard (`/`)

**KPI cards:**

- Total Customers
- Total Appointments
- Upcoming Appointments
- Meetings This Week

**Charts:**

- Appointments by Month (bar chart, last 6 months)
- New Customers by Month (line chart, last 6 months)

**Widgets:**

- Upcoming Meetings (next 5, clickable → customer detail)
- Recent Activity Feed (last 8 events)

**Ref-app files:** `ref-app/src/pages/Dashboard.jsx`, `ref-app/src/components/KpiCard.jsx`

---

### Customers (`/customers`)

**Table columns:**

| Column | Source |
|--------|--------|
| Name | `first_name` + `last_name` |
| Company | `company_name` |
| Email | `email` |
| Phone | `phone` |
| Total Meetings | Count of related appointments |
| Last Activity | Latest appointment date or `last_activity_date` |
| Actions | Edit, Delete |

**Features:**

- Search (name, email, company)
- Pagination (10 per page in ref-app)
- Create Customer (dialog form)
- Edit Customer (dialog form)
- Delete Customer (confirmation dialog)
- Row click → customer detail page

**Ref-app files:** `ref-app/src/pages/Customers.jsx`, `ref-app/src/components/CustomerFormDialog.jsx`

---

### Customer Detail (`/customers/:id`)

**Sections:**

1. **Customer Information** — email, phone, company, last interaction
2. **Upcoming Meetings** — scheduled future appointments
3. **Appointment History** — past/completed appointments
4. **Notes** — editable notes field

**Actions:** Edit, Delete, Add Appointment

**Ref-app file:** `ref-app/src/pages/CustomerDetail.jsx`

---

### Appointments (`/appointments`)

**Main list columns:**

| Column | Source |
|--------|--------|
| Customer | `customer_name` |
| Meeting Title | `title` |
| Date | `start_time` |
| Duration | Computed from `start_time` / `end_time` |
| Status | `scheduled` \| `completed` \| `cancelled` |

**Features:**

- Search (title, customer name)
- Filter by date: all, upcoming, past, today, this week
- Filter by customer
- Sort: upcoming, recent, by customer

**Right sidebar widgets:**

| Widget | Metrics |
|--------|---------|
| Upcoming Meetings | Next 10 scheduled meetings |
| Analytics | Meetings today, this week, this month, total customers, avg meetings per customer |

**Ref-app file:** `ref-app/src/pages/Appointments.jsx`

---

### Integrations (`/integrations`)

#### Google Calendar

**OAuth stores:** access token, refresh token, calendar ID

**Features:**

- Connect account
- Disconnect account
- Sync events (manual trigger)

**Sync logic:**

- Import upcoming events
- Create appointments
- Auto-create customers when attendee email is unknown
- Update `last_sync_at` and `total_synced`

**Display:** connection status, last sync time, total synced events, calendar ID

#### Slack

**OAuth stores:** workspace ID, access token, selected channel

**Features:**

- Connect workspace
- Disconnect workspace
- Select default notification channel

**Notifications (when connected):**

- New customer created
- New appointment booked
- Appointment cancelled
- Daily summary

**Display:** workspace name, connected status, selected channel

> **Ref-app note:** OAuth is simulated via `db.integrations.Core.InvokeLLM()` for demo purposes. Production requires real Google Calendar and Slack OAuth apps with server-side token exchange and encrypted storage.

**Ref-app file:** `ref-app/src/pages/Integrations.jsx`

---

### Settings (`/settings`)

#### Agency Settings

- Agency name
- Logo URL (upload coming soon in ref-app)
- Timezone selector

#### User Management (admin only)

- Invite user by email + role
- Change member role (admin ↔ member)
- Remove team member

**Ref-app file:** `ref-app/src/pages/Settings.jsx`

---

## Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Multi-tenant isolation | All queries filtered by `agency_id` |
| Row-level protection | Middleware / Prisma scopes / RLS policies |
| OAuth token storage | Encrypt at rest; never expose in client |
| Role-based permissions | Server-side checks on every mutation |
| Audit logs | Activity entity records all key events |

---

## UI Requirements

- Modern SaaS aesthetic (Linear, Stripe, Attio inspiration)
- Professional typography
- Light and dark mode support
- Mobile responsive
- Clean spacing and rounded card containers (`rounded-2xl border border-border bg-card`)
- Consistent status badges (`scheduled`, `completed`, `cancelled`)
- Empty states with icon + title + description
- Loading spinners during data fetch
- Toast notifications for success/error feedback (Sonner in ref-app)

### Shared Components (ref-app)

| Component | Purpose |
|-----------|---------|
| `Layout.jsx` | Sidebar + topbar shell |
| `Sidebar.jsx` | Navigation |
| `Topbar.jsx` | Search, notifications, user menu |
| `KpiCard.jsx` | Dashboard metric cards |
| `StatusBadge.jsx` | Appointment status pills |
| `EmptyState.jsx` | Zero-data placeholders |
| `ThemeToggle.jsx` | Light/dark switch |
| `CustomerFormDialog.jsx` | Create/edit customer modal |
| `AppointmentFormDialog.jsx` | Create/edit appointment modal |

---

## Seed Data

Generate realistic sample data for development and demos:

| Entity | Count | Notes |
|--------|-------|-------|
| Customers | 20 | Varied names, companies, emails |
| Appointments | 50 | Mix of scheduled, completed, cancelled |
| Integrations | 2 | Google Calendar + Slack (connected) |
| Activity | ~30 | Spread across activity types |
| Users | 2–3 | 1 admin, 1–2 members |

Seed should produce meaningful dashboard analytics (monthly charts, KPIs, upcoming meetings widget).

---

## Ref-App Entity Schemas

Entity definitions live in `ref-app/entities/` as JSON schemas consumed by Base44:

```
ref-app/entities/
├── Activity
├── Appointment
├── Customer
└── Integration
```

Base44 auto-adds system fields (`id`, `created_date`, etc.) not listed in the schemas above.

---

## Production Implementation Checklist

Use this when porting from ref-app to the Next.js app:

### Database & Auth

- [ ] PostgreSQL schema with Prisma/Drizzle
- [ ] NextAuth with Credentials + Google providers
- [ ] Signup creates Agency + Admin User
- [ ] Session includes `agency_id` and `role`
- [ ] All API routes enforce agency scoping

### Pages (port UI from ref-app)

- [ ] Dashboard with KPIs, charts, activity feed
- [ ] Customers list + detail + CRUD
- [ ] Appointments list + filters + sidebar widgets
- [ ] Integrations (real OAuth)
- [ ] Settings (agency + team management)

### Integrations

- [ ] Google Calendar OAuth + token refresh
- [ ] Calendar sync job (import events, auto-create customers)
- [ ] Slack OAuth + channel selection
- [ ] Slack notification webhooks on customer/appointment events

### Infrastructure

- [ ] Encrypted token storage
- [ ] Activity/audit logging
- [ ] Role-based route and API guards
- [ ] Seed script for dev environment
- [ ] Error boundaries and loading skeletons

---

## Original Product Prompt

The following is the verbatim specification used to generate the ref-app prototype:

> Build a modern SaaS web application for marketing agencies and service businesses.
>
> **Tech Stack:** Next.js 15, NextAuth authentication, PostgreSQL database, multi-tenant architecture, responsive design, clean modern SaaS UI, light and dark mode.
>
> **Core Concept:** The platform allows agencies to manage customers, appointments, and integrations. Each agency has its own isolated workspace. Users sign up and belong to exactly one agency. All data must be scoped to the agency.
>
> **User Roles:** Agency Admin (manage settings, integrations, view all data, invite team) and Agency Member (view/create customers and appointments, no integration access).
>
> **Data Models:** Agency, User, Customer, Appointment, Integration — with fields as defined in this document.
>
> **Customer Rules:** Multiple appointments per customer; calendar sync matches by email and auto-creates customers when needed.
>
> **Auth:** NextAuth with email/password and Google Sign In. Signup creates agency + admin user.
>
> **Pages:** Dashboard, Customers (table + detail), Appointments (list + sidebar widgets), Integrations (Google Calendar + Slack), Settings (agency + team).
>
> **Security:** Multi-tenant row-level protection, agency isolation, secure OAuth storage, audit logs, RBAC.
>
> **UI:** Linear/Stripe/Attio-inspired SaaS design with empty, loading, and error states.
>
> **Seed Data:** 20 customers, 50 appointments, connected integrations, example analytics.

---

## Running the Reference App

```bash
cd ref-app
npm install
npm run dev
```

For full Base44 backend integration, see `ref-app/README.md`.

## Running the Production App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
