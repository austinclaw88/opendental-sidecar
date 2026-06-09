# Architecture Decision Records

## ADR-001: Keep Sidecar Read-Only

**Date:** 2026-06-09
**Status:** Accepted

### Context

The OpenDental database is the source of truth. Writing to it from a new application risks data corruption, especially while the schema and business rules are still being understood.

### Decision

The OpenDental Sidecar remains read-only indefinitely. No writes to the OpenDental database. All future features (analytics, AI, automation) will work with read access only.

### Consequences

- Safe to deploy alongside production OpenDental
- No risk of data corruption
- Simpler architecture (no transaction management, no locking)
- Cannot perform claim submission, appointment editing, or treatment plan updates
- Future phases that require write access must go through a separate data layer, not directly to OpenDental

---

## ADR-002: Environment-Based Configuration

**Date:** 2026-06-09
**Status:** Accepted

### Context

Hardcoded database credentials in `appsettings.json` create security risks and make it impossible to run the same build in different environments.

### Decision

All configuration is injected via environment variables. `appsettings.json` contains only defaults and structure. The connection string is read at startup from `ConnectionStrings__OpenDental` env var.

### Consequences

- No secrets in source control
- Same Docker image runs in any environment
- Developers must configure env vars locally (documented in `.env.example`)

---

## ADR-003: API Versioning via URL Path

**Date:** 2026-06-09
**Status:** Accepted

### Context

The API will evolve. Without versioning, changes to endpoints will break existing clients.

### Decision

Use URL path versioning (`/api/v1/...`). Frontend calls the versioned path explicitly. Next.js rewrites proxy to the backend preserving the path.

### Consequences

- Explicit versioning visible in requests
- Multiple API versions can coexist
- No header-based versioning complexity
- URL change requires frontend update — but the frontend is a controlled client

---

## ADR-004: Interface-Based Repository DI

**Date:** 2026-06-09
**Status:** Accepted

### Context

Direct dependency on repository implementations makes testing difficult and prevents swapping the data source.

### Decision

All repositories implement interfaces. Controllers depend only on interfaces. DI registration maps interfaces to implementations.

### Consequences

- Repositories can be mocked for unit tests
- Future OpenDental schema changes can be absorbed by swapping implementations
- Other PMS integrations can reuse the same controller layer
- Slight indirection overhead (negligible)

---

## ADR-005: Docker Compose for Local Development

**Date:** 2026-06-09
**Status:** Accepted

### Context

Developers need to run the application without installing .NET 8, Node.js 20, MySQL, or any other dependencies manually.

### Decision

Use Docker Compose for all local development. `docker compose up` starts the frontend, backend, and optionally a demo MySQL database.

### Consequences

- Zero local dependency installation
- Consistent environments across developers
- CI can validate Docker builds
- Demo mode doesn't require a real OpenDental installation
- Docker adds disk and memory overhead

---

## ADR-006: Read-Only MySQL User

**Date:** 2026-06-09
**Status:** Accepted

### Context

The application should be safe to connect to a production OpenDental database without risk of accidental writes.

### Decision

The backend connects using a MySQL user with `SELECT` only privileges. The connection string must reference a read-only user.

### Consequences

- Even a bug in the application code cannot corrupt data
- Requires DBA to create a read-only user
- Some MySQL features (e.g., `INSERT INTO ... SELECT`) are unavailable

---

## ADR-007: Use Dapper over Entity Framework

**Date:** 2026-06-09
**Status:** Accepted

### Context

The OpenDental schema has no foreign key constraints in early tables, uses non-standard naming conventions (`PatNum`, `AptNum`), and has complex join chains. Entity Framework's migration and model-first approach would fight the existing schema.

### Decision

Use Dapper for data access. Raw SQL queries map directly to DTOs. No ORM model generation.

### Consequences

- Full control over SQL queries
- No EF Core migration complexity
- No lazy loading or N+1 surprises from ORM
- Manual SQL means more boilerplate and no compile-time query validation
- Schema changes in OpenDental require manual query updates
