# Known Issues

## Resolved

### v1.1.1 — Double `/v1` Routing Bug

**Status:** Fixed in v1.1.1.

The frontend API client called `/api/v1${path}` and the Next.js rewrite also added `/api/v1/*`. This would have resulted in `/api/v1/v1/patients/...` in Docker/proxy mode.

**Fix:** Frontend keeps `/api/v1` in the client, Next.js rewrite proxies `/api/*` → `/api/*` (preserving the full path unchanged).

## Active

### Search Performance (P2)

Patient search uses `%LIKE%` across multiple columns (name, phone, DOB, patient number). On a large OpenDental database (100k+ patients), this will be slow without proper indexing.

**Mitigation:** `LIMIT 50` prevents runaway queries.
**Fix:** Add MySQL fulltext index or move to Elasticsearch/Meilisearch.

### No Authentication (P2)

All endpoints are currently unauthenticated. Read-only is safe from data corruption, but patient PHI is exposed to anyone who can reach the API.

**Target:** Phase 2 — Auth0/Clerk/Microsoft Entra integration.

### N+1 in Claim Detail (P0 — Resolved)

The original claim list query performed a separate aggregate query per claim. Fixed in v1.1 with a single `GROUP BY` query and in-memory join.

**Status:** Resolved.

### Audit Middleware Flush (P1)

Audit entries are buffered and flushed every 5 seconds or 50 entries. If the process crashes between flushes, entries in the buffer are lost.

**Fix:** Add periodic flush in background service or switch to synchronous writes.

### Frontend Rewrite in Dev Mode

Running `npm run dev` without Docker requires `API_PROXY_TARGET=http://localhost:5000` in `frontend/.env.local`. This is documented in `frontend/.env.example` but easy to miss.

**Fix:** Add a startup check that warns if the proxy target isn't set.

## Architectural Debt

### No Service Layer

Controllers call repositories directly. Business logic lives in repositories or controllers. This will become a problem as the system grows.

**Target:** Phase 2 — add service layer between controllers and repositories.

### No Integration Tests

No tests verify that the API returns correct results against a real OpenDental database. Schema changes in OpenDental could silently break queries.

**Target:** Phase 2 — integration tests against the demo seed database.

### Demo Seed Data is Minimal

10 patients, 6 claims, minimal insurance configurations. Good for smoke testing but misses edge cases (multiple insurance, complex claim statuses, partial payments).

**Target:** Phase 2 — expand seed data.
