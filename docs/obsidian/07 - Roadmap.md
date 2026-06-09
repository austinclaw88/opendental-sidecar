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

## Next: v1.2 — Auth + Foundation

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
