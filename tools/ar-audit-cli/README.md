# OpenDental AR Leakage Audit CLI

**Read-only insurance revenue recovery analysis for OpenDental.**

This CLI connects to an OpenDental MySQL database and identifies insurance revenue leakage candidates across 7 categories. It produces CSV files and a Markdown summary report.

## Quick Start

```bash
# Install dependencies
pip install -r tools/ar-audit-cli/requirements.txt

# Set your connection string
export OPENDENTAL_CONNECTION_STRING="Server=localhost;Port=3306;Database=opendental;User=readonly;Password=..."

# Run the audit
python3 tools/ar-audit-cli/ar_audit_cli.py
```

## Output

All reports written to `audit-output/`:

| File | Description |
|------|-------------|
| `ar_leakage_summary.md` | Full Markdown report with exec summary, top 10, methodology |
| `ar_leakage_candidates.csv` | Master list of all aged AR claims with priority scores |
| `aged_claims.csv` | All aged insurance AR claims by bucket |
| `denied_claims.csv` | Claims showing denial signals |
| `unpaid_claims.csv` | Claims with zero insurance payment received |
| `unfiled_secondary_candidates.csv` | Primary paid but secondary claim may be missing |
| `completed_unbilled_procedures.csv` | Completed billable procedures with no claim |
| `underpayment_candidates.csv` | Paid significantly below estimate (experimental) |
| `metadata.json` | Run metadata and aggregate summary |

## Leakage Categories

1. **Aged Insurance AR** — Outstanding balances aged 30/60/90/120+ days
2. **Claims With No Payment** — Sent but no insurance payment recorded
3. **Denied or Rejected Claims** — Denial signals from status and payment patterns
4. **Unfiled Secondary Candidates** — Primary paid, secondary may be missing
5. **Completed Procedures With No Claim** — Billable procs with no associated claim
6. **Underpayment Candidates** — Paid significantly below estimate (experimental)
7. **Dead / Questionable AR** — Likely unrecoverable (old, resolved, or timely-filing risk)

## Priority Score

Claims are scored 0–100 using: `balance + age + status + carrier_type - dead_ar_penalty`

- **≥ 50**: High priority — work these first
- **30–49**: Medium priority
- **< 30**: Low priority

## Usage

```bash
# Custom output directory
python3 ar_audit_cli.py --output ./my-audit

# Adjust no-payment threshold to 60 days
python3 ar_audit_cli.py --threshold 60

# Connection string via argument
python3 ar_audit_cli.py --connection-string "Server=..."
```

## Requirements

- Python 3.9+
- MySQL client access to OpenDental database
- Read-only database user recommended

## OpenDental Version

Tested against OpenDental v24.3 schema. Column names/types may vary slightly between versions.

## Read-Only

This tool performs **no writes** to the OpenDental database. All operations are `SELECT` queries with `autocommit=True` (no transactions).
