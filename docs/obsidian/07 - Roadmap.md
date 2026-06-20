# Roadmap

## Current: v1.1.1 — Viewer Hardening

- [x] Docker Compose (frontend + backend + demo MySQL)
- [x] Environment-based configuration
- [x] CORS locked to frontend origin
- [x] Swagger dev-only
- [x] SSN excluded from API responses
- [x] Audit logging middleware
- [x] Repository split (Patient, Appointment, Procedure, Claim)
- [x] Repository interfaces (IPatientRepository, etc.)
- [x] API versioning (/api/v1/)
- [x] N+1 fix for claim aggregates
- [x] Demo seed data (10 patients, claims, appointments)
- [x] GitHub Actions CI
- [x] CI path + env fixes
- [x] Frontend Dockerfile cleanup

## Done: v1.5 — Schema-Driven Writes

- [x] `SchemaIntrospector` reads live table structure from information_schema (cached)
- [x] `OdInsertBuilder` emits full-column INSERTs / validated UPDATEs from the live schema
- [x] All 10 write paths refactored off hardcoded column lists (fixes strict-mode 500s)
- [x] Version-agnostic: same binary runs on OD 24-3 / 25-4 / future
- [x] `ExceptionHandlingMiddleware` returns JSON errors with MySQL code + SQL state
- [x] New-patient form expanded (SIN, position, contact prefs, providers, notes, billing type)
- [x] `ExtraFields` passthrough on patient + appointment for any other column, schema-validated
- [x] Demo seed split: `00-schema.sql` (generated full DDL) + data-only 01/02/03
- [x] `tools/schema-gen/generate_schema.py` regenerates demo DDL from the OD XML
- [x] Verified end-to-end against live MariaDB 10.11 in strict mode

## Done: v1.3 — Front Desk Plus

- [x] Insurance management (view/add/edit/drop coverage, carrier find-or-create)
- [x] Schedule week view (`GET /schedule/range`)
- [x] ASAP list + appointment priority flag
- [x] Break/unschedule with reason (auto comm log entry)
- [x] Book from recall (stamps `recall.DateScheduled`)
- [x] Ledger adjustments (definition category 1 validated)
- [x] Clinic-wide claims work queue with status filters and stale-claim flags
- [x] Demo seed 03 (insurance columns, dual coverage, ASAP, extra claims)
- [x] ESLint: React 19 strict rules downgraded to warnings (CI green)

## Next: v1.4 — Auth + Foundation

- [ ] Authentication (Auth0 / Clerk / Microsoft Entra)
- [ ] Role model (user, clinic, permissions)
- [ ] Service layer between controllers and repositories
- [ ] Caching (IMemoryCache → Redis)
- [ ] Dashboard MVP (appointment counts, claim status, production stats)
- [ ] Expand seed data (all claim statuses, multiple insurance, complex scenarios)
- [ ] Integration tests

## Future: v1.3+

- [ ] Analytics and business intelligence
- [ ] AI features (claim readiness scoring, appointment optimization)
- [ ] Workflow automation
- [ ] Multi-practice support
- [ ] Selective workflow replacement (read/write)

## Never (explicit non-goals)

- Full OpenDental replacement
- Clinical charting (tooth chart, perio, 3D)
- eRx / ePrescribing
- Imaging bridges (TigerView, VixWin)
- Custom reporting engine (use embedded BI instead)
