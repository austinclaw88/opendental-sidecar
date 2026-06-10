# Open Dental AR Leakage Audit

_Generated: 2026-06-10T02:45:59.807486_

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Visible Insurance AR** | $4,970.00 |
| **Likely Recoverable Candidates** | $3,420.00 |
| **Questionable / Dead AR** | $1,550.00 |
| **High-Priority Claims (score ≥ 50)** | 14 |
| **Top Carrier by Stuck Balance** | Cigna Dental PPO ($1,950.00) |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Total Aged Claims** | 15 |
| **Claims With No Payment** | 5 |
| **Denied / Rejected** | 3 |
| **Unfiled Secondary Candidates** | 2 |
| **Completed Unbilled Procs** | 2 |
| **Underpayment Candidates** | 2 |
| **Dead / Questionable AR Claims** | 3 |

## Aging Buckets (Insurance AR)

| Bucket | Balance |
|--------|--------|
| **0-30 days** | $75.00 |
| **31-60 days** | $295.00 |
| **61-90 days** | $660.00 |
| **91-120 days** | $500.00 |
| **120+ days** | $3,440.00 |

---

## Leakage Breakdown

| Category | Count | Total ($) |
|----------|-------|-----------|
| **Aged AR** (insurance balance outstanding) | 15 | $4,970.00 |
| **Denied / Rejected** | 3 | $895.00 |
| **No Payment** (sent but $0 received) | 5 | $4,170.00 |
| **Unfiled Secondary** | 2 | — |
| **Completed Unbilled** (procedures w/o claim) | 2 | $625.00 |
| **Underpayment Candidates** | 2 | $700.00 |
| **Questionable / Dead AR** | 3 | $1,550.00 |

---

## Carrier Breakdown

| Carrier | Candidate Balance | Claim Count | Avg Age (days) |
|---------|-------------------|-------------|----------------|
| Cigna Dental PPO | $1,950.00 | 2 | 225.0 |
| Canada Life | $890.00 | 1 | 200.0 |
| Delta Dental Premier | $660.00 | 2 | 80.0 |
| Guardian Dental | $600.00 | 2 | 160.0 |
| Manulife | $350.00 | 1 | 120.0 |
| Sun Life | $150.00 | 1 | 95.0 |
| Green Shield | $125.00 | 1 | 60.0 |
| MetLife PDP | $120.00 | 2 | 47.5 |
| Delta Dental PPO | $75.00 | 2 | 25.0 |
| Aetna Dental | $50.00 | 1 | 25.0 |

---

## Top 10 Recovery Opportunities

| # | Patient | Carrier | Remaining | Days Out | Bucket | Score | Status |
|---|---------|---------|-----------|----------|--------|-------|--------|
| 1 | Thomas, Kevin | Cigna Dental PPO | $1,150.00 | 300 | 120+ | 95 | Sent |
| 2 | Williams, Mike | Cigna Dental PPO | $800.00 | 150 | 120+ | 90 | Sent |
| 3 | Davis, Lisa | Canada Life | $890.00 | 200 | 120+ | 85 | Not Sent |
| 4 | Martinez, Anna | Manulife | $350.00 | 120 | 91-120 | 85 | Received |
| 5 | Jones, David | Guardian Dental | $400.00 | 180 | 120+ | 80 | Sent |
| 6 | Johnson, Sarah | Delta Dental Premier | $480.00 | 75 | 61-90 | 70 | Sent |
| 7 | White, Daniel | Guardian Dental | $200.00 | 140 | 120+ | 70 | Not Sent |
| 8 | Miller, James | Sun Life | $150.00 | 95 | 91-120 | 65 | Sent |
| 9 | Smith, John | Delta Dental PPO | $50.00 | 35 | 31-60 | 60 | Received |
| 10 | Rodriguez, Carlos | Green Shield | $125.00 | 60 | 31-60 | 60 | Received |

---

## Priority Score Methodology

**Formula:** `priority_score = balance_weight + age_weight + status_weight + carrier_type - dead_ar_penalty`

| Factor | Weight Range | Notes |
|--------|-------------|-------|
| **Balance** | 0 – 40 | Higher remaining balance = higher score |
| **Age** | 0 – 25 | Older claims score higher (up to 120+ days) |
| **Status** | 0 – 20 | Received > Sent > Waiting > Hold |
| **Carrier Type** | 10 – 15 | Primary slightly higher than secondary |
| **Dead AR Penalty** | 0 – 30 | Subtracted for likely-unrecoverable claims |

Score interpretation: **≥ 50** = high priority, **30–49** = medium, **< 30** = low.

---

## Category Details

### 1. Aged Insurance AR

Total claims: 15 | Total outstanding: $4,970.00

Claims with insurance balance still outstanding. Sorted by priority score.

See [`aged_claims.csv`](aged_claims.csv) for full list.

### 2. Claims With No Insurance Payment

Total: 5 claims | Total fee: $4,170.00

Claims that were sent to insurance but have zero payment recorded.

See [`unpaid_claims.csv`](unpaid_claims.csv) for full list.

### 3. Denied or Rejected Claims

Total: 3 claims | Total fee: $895.00

Claims showing denial signals: zero payment after receipt, in-process limbo, or unresponded.

See [`denied_claims.csv`](denied_claims.csv) for full list.

### 4. Unfiled Secondary Candidates

Total: 2 patients

Patients with secondary insurance where primary appears paid but no secondary claim was filed.

See [`unfiled_secondary_candidates.csv`](unfiled_secondary_candidates.csv) for full list.

### 5. Completed Procedures With No Claim

Total: 2 procedures | Total fee: $625.00

**⚠️ Needs human review.** These are completed insurance-billable procedures 
with no associated claim. Could indicate missing claims or data entry issues.

See [`completed_unbilled_procedures.csv`](completed_unbilled_procedures.csv) for full list.

### 6. Underpayment Candidates (Experimental)

Total: 2 claims

**⚠️ Experimental.** Claims where insurance paid significantly less than estimated.
Verify against fee schedule and benefit details before pursuing.

See [`underpayment_candidates.csv`](underpayment_candidates.csv) for full list.

### 7. Dead / Questionable AR

Total: 3 claims | Total balance: $1,550.00

Claims classified as likely unrecoverable due to age, timely filing risk, 
or being fully resolved. Do not invest time on these.

Categories:
- **Very old** (>2 years): low recovery probability
- **Timely filing risk** (>12 months, unpaid): likely past filing deadline
- **Likely resolved**: insurance + write-off + deductible = claim fee
- **Stale partial**: partial payment with no recent activity

See [`aged_claims.csv`](aged_claims.csv) (filtered with dead AR flag) for full list.

---

## Methodology & Assumptions

### Database Tables Used
- `claim` — Claim header with status, fee, payments
- `claimproc` — Claim line items with insurance estimates and actuals
- `claimpayment` — Insurance payment records
- `procedurelog` — Completed procedure records
- `procedurecode` — Procedure code definitions and billability flags
- `insplan` — Insurance plan details
- `carrier` — Insurance carrier names
- `patient` — Patient demographics and insurance indicators
- `patplan` — Patient-to-plan mapping with ordinal (primary/secondary)
- `inssub` — Insurance subscriber records

### OpenDental Version Assumptions
- Tested against OpenDental v24.3 schema
- Column names and types may vary slightly between versions
- `claim.ClaimStatus` is varchar(1): U/H/W/P/S/R/I
- `claimproc.Status` is tinyint: 0=NotReceived, 1=Received, 6=Estimate, etc.
- `procedurelog.ProcStatus` = 2 means Complete
- `procedurecode.NoBillIns` = 1 means the code is not billed to insurance

## Caveats

**This is a read-only analytical audit. It does not prove recoverability. All findings require human review.**

- **No fee schedule or UCR data is queried** (depends on version/setup) — underpayment detection uses `InsPayEst` which may be inaccurate
- **Completed unbilled procedures** detection is approximate and may include procedures where billing was intentionally deferred
- **Does not distinguish** between electronic and paper claims
- **Timely filing estimates** are based on claim age and status, not actual insurance filing deadlines (which vary by carrier and plan)
- **Denial signals** are inferred from payment patterns, not EOB/ERA data
- **Unfiled secondary** detection requires that primary claims are properly marked as received — if primary EOBs are not posted in OpenDental, this category will undercount

---

## Output Files

| File | Description |
|------|-------------|
| `ar_leakage_summary.md` | This report |
| `ar_leakage_candidates.csv` | Master list with priority scores |
| `aged_claims.csv` | Aged insurance AR detail |
| `denied_claims.csv` | Denied/rejected claims |
| `unpaid_claims.csv` | Claims with no payment received |
| `unfiled_secondary_candidates.csv` | Missing secondary claims |
| `completed_unbilled_procedures.csv` | Completed unbilled procs |
| `metadata.json` | Run metadata and summary |

