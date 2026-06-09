# Docker and CI

## Docker Architecture

```
┌────────────────────────────────────────────┐
│  docker-compose.yml                        │
│                                            │
│  frontend (Next.js :3000)                  │
│    │                                       │
│    │  /api/* → rewrite                    │
│    ▼                                       │
│  backend (ASP.NET Core :8080)              │
│    │                                       │
│    │  ConnectionStrings__OpenDental        │
│    ▼                                       │
│  host.docker.internal:3306 (MySQL)         │
│    OR                                       │
│  demo-db (MySQL :3307 — demo profile)      │
└────────────────────────────────────────────┘
```

## Usage

### Production-like (real OpenDental DB on host)

```bash
cp .env.example .env
# Edit .env with your MySQL connection string
docker compose up
```

### Demo mode (no real OpenDental needed)

```bash
docker compose --profile demo up
```

This starts a MySQL 8.0 container with sanitized demo data (10 patients, providers, appointments, claims, insurance).

### Services

| Service | Port | Image | Source |
|---------|------|-------|--------|
| `backend` | `5000:8080` | Built from `backend/OpenDentalSidecar.Api/Dockerfile` | ASP.NET Core 8 |
| `frontend` | `3000:3000` | Built from `frontend/Dockerfile` | Next.js 15 |
| `demo-db` | `3307:3306` | `mysql:8.0` (demo profile only) | `seed/01-opendental-demo.sql` |

## Environment Variables

All config via environment variables (see `.env.example`):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `ConnectionStrings__OpenDental` | Yes | — | MySQL connection string |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin |

No passwords in source files. No hardcoded secrets.

## Dockerfiles

### Backend (`backend/OpenDentalSidecar.Api/Dockerfile`)

Two-stage build:
1. **Build** — `mcr.microsoft.com/dotnet/sdk:8.0` — restore + publish
2. **Runtime** — `mcr.microsoft.com/dotnet/aspnet:8.0` — minimal image

### Frontend (`frontend/Dockerfile`)

Two-stage build:
1. **Builder** — `node:20-alpine` — install + build. `API_PROXY_TARGET` build arg sets the rewrite destination
2. **Runner** — `node:20-alpine` — standalone output only

## CI (GitHub Actions)

Defined in `.github/workflows/ci.yml`.

Triggers: push/PR to `main`.

**Jobs:**
1. `backend` — `dotnet restore`, `dotnet build`, Docker build
2. `frontend` — `npm ci`, `npm run lint`, `npm run build`, Docker build
3. `docker-compose` — validates `docker compose config`, builds all images

Environment variables (`ConnectionStrings__OpenDental`, `FRONTEND_URL`) are set at the workflow level to ensure Docker compose validation passes.
