# OpenDental Sidecar

Modern read-only web interface for OpenDental. Phase 1 — viewer only, no writes.

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐       ┌──────────────┐
│  Next.js (React)     │──────▶│  ASP.NET Core 8 API   │──────▶│  OpenDental   │
│  Patient Search      │       │  Dapper + DTOs        │       │  MySQL DB    │
│  Patient Profile     │◀──────│  Read-only MySQL user │◀──────│  (local)      │
│  Appointments        │       └──────────────────────┘       └──────────────┘
│  Procedures          │
│  Claims Dashboard    │
└──────────────────────┘
```

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org)
- A running OpenDental MySQL database

## Quick Start

### 1. Configure the Database

Create a read-only MySQL user and grant SELECT on the OpenDental database:

```sql
CREATE USER 'reader'@'%' IDENTIFIED BY 'reader';
GRANT SELECT ON opendental.* TO 'reader'@'%';
FLUSH PRIVILEGES;
```

### 2. Configure the Backend

Edit `backend/OpenDentalSidecar.Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "OpenDental": "Server=localhost;Port=3306;Database=opendental;User=reader;Password=reader;Allow User Variables=True;Default Command Timeout=120;"
  }
}
```

### 3. Start the Backend

```bash
cd backend
dotnet run --project OpenDentalSidecar.Api
```

The API starts on `http://localhost:5000`. Swagger UI at `/swagger`.

### 4. Configure the Frontend

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 5. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at `http://localhost:3000`.

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Patient Search | `/` | Search by name, number, phone, or DOB |
| Patient Profile | `/patients/{patNum}` | Demographics, insurance, provider info |
| Appointments | `/patients/{patNum}` (tab) | Upcoming + past appointments |
| Procedures | `/patients/{patNum}` (tab) | Completed + treatment planned procedures |
| Claims Dashboard | `/patients/{patNum}` (tab) | Open/sent/unsent claims with status |
| Claim Detail | `/claims/{claimNum}` | Full claim breakdown with line items |

## Phase 1 — Read-Only Scope

No writes, no claim submissions, no appointment modifications, no insurance calculations.

**Non-goals (future phases):**
- Patient editing
- Appointment creation/modification
- Claim submission
- Insurance calculations
- eclaims / X12 integration
- Treatment planning logic

## Tech Stack

- **Backend:** ASP.NET Core 8, Dapper, MySqlConnector, Swashbuckle
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, shadcn/ui, Lucide icons
- **Design:** Soft UI + Minimalism — pine green primary, slate background

## Database Schema

The API maps to the OpenDental MySQL schema (28 core tables). Primary keys follow `[Entity]Num` convention. Status codes are mapped from OpenDental's C# enums.

Key tables: `patient`, `appointment`, `procedurelog`, `procedurecode`, `claim`, `claimproc`, `claimpayment`, `insplan`, `inssub`, `patplan`, `carrier`, `provider`, `definition`, `operatory`, `clinic`
