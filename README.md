# OpenDental Sidecar

Modern read-only web interface for OpenDental. Phase 1 — viewer only, no writes.

## Architecture

```
┌────────────┐     ┌──────────────┐     ┌──────────┐
│  Next.js   │────▶│  ASP.NET 8   │────▶│  MySQL   │
│  Container │     │  API         │     │  (host)  │
│  :3000     │◀────│  Container   │     │          │
└────────────┘     │  :8080       │     └──────────┘
                   └──────────────┘
```

## Quick Start

### Option A: Real OpenDental DB

```bash
# 1. Create a read-only MySQL user on your OpenDental server:
#    CREATE USER 'reader'@'%' IDENTIFIED BY 'your_password';
#    GRANT SELECT ON opendental.* TO 'reader'@'%';

# 2. Start with your real DB:
cp .env.example .env
# Edit .env with your MySQL connection string
docker compose up
```

### Option B: Demo DB (no existing OpenDental needed)

```bash
docker compose --profile demo up
```

This spins up:
- A MySQL 8.0 container with sanitized demo data (10 patients, appointments, claims)
- The backend API
- The frontend

Open `http://localhost:3000`.

### Configuration

All configuration via environment variables (see `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ConnectionStrings__OpenDental` | Yes | — | MySQL connection string |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin |

No hardcoded passwords. No secrets in source.

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Patient Search | `/` | Search by name, number, phone, or DOB |
| Patient Profile | `/patients/{patNum}` | Demographics, insurance, provider info |
| Appointments | `/patients/{patNum}` (tab) | Upcoming + past appointments |
| Procedures | `/patients/{patNum}` (tab) | Completed + treatment planned procedures |
| Claims Dashboard | `/patients/{patNum}` (tab) | Open/sent/unsent claims with status |
| Claim Detail | `/claims/{claimNum}` | Full claim breakdown with line items |

## Tech Stack

- **Backend:** ASP.NET Core 8, Dapper, MySqlConnector
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, Lucide
- **Infrastructure:** Docker Compose, GitHub Actions CI

## Security

- Read-only MySQL user (no write access to the database)
- CORS locked to the frontend origin
- Swagger disabled in production
- Audit logging (structured JSONL, daily rotation)
- SSN excluded from all API responses
- Auth scaffolding ready for Phase 2

## CI

GitHub Actions builds both containers, runs linting, and verifies the Docker Compose configuration on every push.
