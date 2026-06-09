# Repository Layer

## Dependency Flow

```
Controller
  → Repository Interface (injected via DI)
    → Repository Implementation (Dapper + MySQL)
```

## Interfaces

All interfaces live in `backend/OpenDentalSidecar.Api/Data/Interfaces/`.

| Interface | Methods |
|-----------|---------|
| `IPatientRepository` | `Search(query, limit)`, `GetDetail(patNum)` |
| `IAppointmentRepository` | `GetByPatient(patNum)` |
| `IProcedureRepository` | `GetByPatient(patNum)` |
| `IClaimRepository` | `GetByPatient(patNum)`, `GetDetail(claimNum)` |

## Implementations

| Implementation | Interface | Connection | Key Queries |
|---------------|-----------|------------|-------------|
| `PatientRepository` | `IPatientRepository` | MySQL | Patient search (LIKE on name/phone/DOB), Patient detail with insurance join |
| `AppointmentRepository` | `IAppointmentRepository` | MySQL | Appointments by patient, joined with provider + operatory |
| `ProcedureRepository` | `IProcedureRepository` | MySQL | Procedures by patient, joined with code + provider |
| `ClaimRepository` | `IClaimRepository` | MySQL | Claims by patient with batched aggregates, full claim detail with line items |

## DI Registration

In `Program.cs`:

```csharp
builder.Services.AddScoped<IPatientRepository>(_ => new PatientRepository(connStr));
builder.Services.AddScoped<IAppointmentRepository>(_ => new AppointmentRepository(connStr));
builder.Services.AddScoped<IProcedureRepository>(_ => new ProcedureRepository(connStr));
builder.Services.AddScoped<IClaimRepository>(_ => new ClaimRepository(connStr));
```

## Query Patterns

### Scalar Search
```sql
SELECT ... FROM patient
WHERE LName LIKE @q OR FName LIKE @q ...
LIMIT @lim;
```

### Batch Aggregate (N+1 Fix)
```sql
SELECT ClaimNum,
       SUM(InsPayAmt), SUM(WriteOff), SUM(DedApplied)
FROM claimproc
WHERE ClaimNum IN @claimNums
GROUP BY ClaimNum;
```

### Detail Join Chain
```sql
FROM claim
LEFT JOIN provider ON claim.ProvTreat = provider.ProvNum
LEFT JOIN insplan ON claim.PlanNum = insplan.PlanNum
LEFT JOIN carrier ON insplan.CarrierNum = carrier.CarrierNum
```

## Future Considerations

- **Service Layer** — A service layer between controllers and repositories will be added in Phase 2. This decouples business logic from data access.
- **Caching** — `IMemoryCache` for patient demographics and insurance summaries. Redis later for scale.
- **Read Replica** — The connection string can point to a MySQL read replica for production deployments.

## Key Tables

For a full data dictionary, see the Phase 1 analysis at:
`docs/opendental-reference/PHASE1_DATA_DICTIONARY.md` (external reference) or the `seed/` directory for demo schema.

| Table | Purpose | Key FK |
|-------|---------|--------|
| `patient` | Patient demographics | `PatNum` → everything |
| `appointment` | Appointment records | `PatNum`, `ProvNum`, `Op` |
| `procedurelog` | Procedure records | `PatNum`, `CodeNum`, `ProvNum` |
| `procedurecode` | CDT code definitions | `CodeNum` |
| `claim` | Insurance claims | `PatNum`, `PlanNum`, `ProvTreat` |
| `claimproc` | Claim line items | `ClaimNum`, `ProcNum` |
| `claimpayment` | Insurance payments | Links via `claimproc.ClaimPaymentNum` |
| `insplan` | Insurance plans | `CarrierNum`, `FeeSched` |
| `inssub` | Insurance subscribers | `PlanNum`, `Subscriber` |
| `patplan` | Patient → insurance mapping | `PatNum`, `InsSubNum` |
| `carrier` | Insurance carriers | Referenced by `insplan` |
| `provider` | Provider records | Referenced by `patient.PriProv`, `claim.ProvTreat` |
| `definition` | Universal enum lookup | Referenced by many tables |
