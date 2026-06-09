# Backend API

## Base URL

| Environment | URL |
|-------------|-----|
| Docker Compose | `http://localhost:5000/api/v1` |
| Local dev | `http://localhost:5000/api/v1` |
| Frontend proxy | `/api/v1` |

## Authentication

Currently: **None** (Phase 1 — scaffolding ready for Phase 2)

## Endpoints

### Patient Search

```
GET /api/v1/patients/search?q={query}&limit={limit}
```

Search patients by name, phone, patient number, or date of birth.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `limit` | int | No | Max results (default 50) |

**Response:** `PatientSummary[]`
```json
[
  {
    "patNum": 1,
    "lName": "Johnson",
    "fName": "Alice",
    "middleI": null,
    "preferred": "Ali",
    "birthdate": "1990-03-15T00:00:00",
    "hmPhone": "416-555-0101",
    "wkPhone": null,
    "wirelessPhone": "416-555-0102",
    "email": "alice.j@email.com",
    "patStatus": 0,
    "patStatusDesc": "Patient"
  }
]
```

### Patient Detail

```
GET /api/v1/patients/{patNum}
```

**Response:** `PatientDetail` (includes demographics, insurance plans, guarantor info)
Note: SSN is intentionally excluded from all responses.

### Patient Appointments

```
GET /api/v1/patients/{patNum}/appointments
```

**Response:** `Appointment[]`

### Patient Procedures

```
GET /api/v1/patients/{patNum}/procedures
```

**Response:** `Procedure[]` (max 200, ordered by date descending)

### Patient Claims

```
GET /api/v1/patients/{patNum}/claims
```

**Response:** `ClaimDto[]` (with aggregated InsPayAmt, WriteOff, DedApplied)

### Claim Detail

```
GET /api/v1/claims/{claimNum}
```

**Response:** `ClaimDetail` (with line-item procedures and payment records)

## Status Codes

### Patient Status

| Code | Label |
|------|-------|
| 0 | Patient |
| 1 | NonPatient |
| 2 | Inactive |
| 3 | Archived |
| 4 | Deleted |
| 5 | Deceased |
| 6 | Prospective |

### Appointment Status

| Code | Label |
|------|-------|
| 1 | Scheduled |
| 2 | Complete |
| 3 | UnschedList |
| 5 | Broken |
| 6 | Planned |
| 7 | PtNote |
| 8 | PtNoteCompleted |

### Procedure Status

| Code | Label |
|------|-------|
| 1 | Treatment Planned |
| 2 | Complete |
| 3 | Existing Current |
| 4 | Existing Other |
| 5 | Referred |
| 6 | Deleted |
| 7 | Condition |
| 8 | TP Inactive |

### Claim Status (varchar(1))

| Char | Label |
|------|-------|
| U | Not Sent |
| H | Hold (Wait Prim) |
| W | Waiting to Send |
| P | Probably Sent |
| S | Sent |
| R | Received |
| I | Hold (In Process) |

### ClaimProc Status

| Code | Label |
|------|-------|
| 0 | Not Received |
| 1 | Received |
| 2 | Preauth |
| 3 | Adjustment |
| 4 | Supplemental |
| 5 | Cap Claim |
| 6 | Estimate |
| 7 | Cap Complete |
| 8 | Cap Estimate |
| 9 | Ins History |

## DTOs

All DTOs live in `backend/OpenDentalSidecar.Api/Models/`. Key types:

- `PatientSummaryDto` — search result row
- `PatientDetailDto` — full patient with insurance
- `AppointmentDto` — appointment with provider/operatory names
- `ProcedureDto` — procedure with code description
- `ClaimDto` — claim summary with aggregates
- `ClaimDetailDto` — full claim with line items and payments
- `ClaimProcDto` — line-item procedure on a claim
- `ClaimPaymentDto` — insurance payment on a claim
- `InsuranceSummaryDto` — insurance plan for patient profile
