# Architecture Overview

## System Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌──────────┐
│  Next.js     │────▶│  ASP.NET Core 8  │────▶│  MySQL   │
│  Frontend    │     │  API             │     │  (host)  │
│  - Sidebar   │◀────│  - Controllers   │     │          │
│  - Search    │     │  - Services (TBD)│     │          │
│  - Profile   │     │  - Repositories  │     │          │
│  - Tables    │     │  - Audit         │     │          │
└─────────────┘     └──────────────────┘     └──────────┘
       :3000                 :8080                :3306
```

## Layer Architecture

```
┌──────────────────────────────────────┐
│  Controllers                         │
│  - Route handling, validation        │
│  - Depends on: Repository Interfaces │
├──────────────────────────────────────┤
│  Repository Interfaces                │
│  - IPatientRepository (etc.)         │
│  - Enables testing + swap            │
├──────────────────────────────────────┤
│  Repository Implementations          │
│  - PatientRepository                 │
│  - AppointmentRepository             │
│  - ProcedureRepository               │
│  - ClaimRepository                   │
│  - Depends on: Dapper + MySQL        │
├──────────────────────────────────────┤
│  Middleware                           │
│  - AuditMiddleware (request logging) │
│  - Auth (Phase 2 target)             │
├──────────────────────────────────────┤
│  Database (read-only)                │
│  - OpenDental MySQL                  │
│  - Read-only MySQL user              │
└──────────────────────────────────────┘
```

## Design Decisions

### Read-Only First
We never write to the database. This eliminates the most common source of data corruption and makes the system safe to deploy alongside production OpenDental.

### Interface-Based DI
Repositories are registered behind interfaces. This lets us swap implementations for testing or for different PMS backends without changing controllers.

### API Versioning
All routes live under `/api/v1/`. The frontend calls these explicitly. Next.js rewrites proxy them to the backend container in Docker. This lets us evolve the API without breaking existing clients.

### Business Domains
The API is organized by business domain, not by database table:
- `GET /api/v1/patients/{patNum}/claims` — not `GET /api/v1/claims?patNum=...`
- `GET /api/v1/patients/{patNum}/appointments`
- `GET /api/v1/patients/{patNum}/procedures`

## Files Reference

| Layer | Source |
|-------|--------|
| Controllers | `backend/OpenDentalSidecar.Api/Controllers/` |
| Interfaces | `backend/OpenDentalSidecar.Api/Data/Interfaces/` |
| Repositories | `backend/OpenDentalSidecar.Api/Data/*Repository.cs` |
| Middleware | `backend/OpenDentalSidecar.Api/Middleware/` |
| DTOs | `backend/OpenDentalSidecar.Api/Models/` |
| Entry point | `backend/OpenDentalSidecar.Api/Program.cs` |
