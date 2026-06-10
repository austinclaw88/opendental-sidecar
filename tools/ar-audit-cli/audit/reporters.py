from __future__ import annotations
"""
Report generation for AR audit results.
Produces CSV files and a Markdown summary report.
"""

import csv
import json
import os
from datetime import datetime
from typing import Any

from .detectors import compute_priority_score, CLAIM_STATUS_MAP


# ── Output directory ─────────────────────────────────────────────

OUTPUT_DIR = "audit-output"


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def output_path(filename: str) -> str:
    return os.path.join(OUTPUT_DIR, filename)


# ── CSV writer ───────────────────────────────────────────────────

def write_csv(filename: str, rows: list[dict[str, Any]]):
    """Write a list of dicts to a CSV file."""
    if not rows:
        with open(output_path(filename), "w") as f:
            f.write("(no results)\n")
        return

    path = output_path(filename)
    fieldnames = [k for k in rows[0].keys() if not k.startswith("_")]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            filtered = {k: v for k, v in row.items() if k in fieldnames}
            writer.writerow(filtered)


# ── Aggregation helpers ──────────────────────────────────────────

def _sum_amount(rows: list[dict], key: str = "EstRemaining") -> float:
    return round(sum(float(r.get(key, 0) or 0) for r in rows), 2)


def _first_amount(rows: list[dict], key: str = "ClaimFee") -> float:
    """Total of a specific amount key across all rows."""
    return round(sum(float(r.get(key, 0) or 0) for r in rows), 2)


# ── Priority-scored master list ──────────────────────────────────

def build_priority_list(aged_ar: list[dict]) -> list[dict]:
    """Add priority scores to aged AR candidates and sort descending."""
    for row in aged_ar:
        row["PriorityScore"] = compute_priority_score(row)
    aged_ar.sort(key=lambda r: r["PriorityScore"], reverse=True)
    return aged_ar


# ── Collate all results ──────────────────────────────────────────

def collate(all_results: dict[str, list[dict]]) -> dict:
    """Aggregate totals and compute summary statistics."""
    aged_ar = all_results.get("aged_ar", [])
    no_payment = all_results.get("no_payment", [])
    denied = all_results.get("denied", [])
    unfiled_sec = all_results.get("unfiled_secondary", [])
    completed_unbilled = all_results.get("completed_unbilled", [])
    underpayments = all_results.get("underpayment", [])
    dead_ar = all_results.get("dead_ar", [])

    # Score the AR candidates
    scored = build_priority_list(list(aged_ar))

    # Visible insurance AR = total remaining on aged claims
    visible_ar = _sum_amount(aged_ar, "EstRemaining")
    dead_ar_total = _sum_amount(dead_ar, "EstRemaining")
    no_pay_total = _first_amount(no_payment, "ClaimFee")
    denied_total = _first_amount(denied, "ClaimFee")
    underpay_total = _first_amount(underpayments, "UnderpaymentAmount")

    # Likely recoverable: aged AR minus dead AR
    likely_recoverable = round(max(0, visible_ar - dead_ar_total), 2)

    # High priority: score >= 50
    high_priority = [r for r in scored if r.get("PriorityScore", 0) >= 50]

    # Top carrier by stuck balance
    from collections import Counter
    carrier_balances = Counter()
    carrier_counts = Counter()
    carrier_ages: dict[str, list[int]] = {}
    for r in aged_ar:
        name = r.get("CarrierName", "Unknown")
        carrier_balances[name] += float(r.get("EstRemaining", 0))
        carrier_counts[name] += 1
        carrier_ages.setdefault(name, []).append(r.get("DaysOutstanding", 0))

    top_carrier = carrier_balances.most_common(1)
    top_carrier_name = top_carrier[0][0] if top_carrier else "N/A"
    top_carrier_bal = round(top_carrier[0][1], 2) if top_carrier else 0

    # Carrier breakdown table
    carrier_breakdown = []
    for name in sorted(carrier_balances, key=lambda n: carrier_balances[n], reverse=True):
        ages = carrier_ages.get(name, [0])
        avg_age = round(sum(ages) / len(ages), 1) if ages else 0
        carrier_breakdown.append({
            "Carrier": name,
            "CandidateBalance": round(carrier_balances[name], 2),
            "ClaimCount": carrier_counts[name],
            "AvgAgeDays": avg_age,
        })

    # Aging buckets
    aged_buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0}
    for r in aged_ar:
        bucket = r.get("AgingBucket", "120+")
        aged_buckets[bucket] += float(r.get("EstRemaining", 0))

    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "visible_insurance_ar": visible_ar,
            "likely_recoverable_candidates": likely_recoverable,
            "questionable_dead_ar": dead_ar_total,
            "high_priority_claim_count": len(high_priority),
            "top_carrier_by_stuck_balance": top_carrier_name,
            "top_carrier_balance": top_carrier_bal,
            "total_aged_claims": len(aged_ar),
            "total_no_payment_claims": len(no_payment),
            "total_denied_claims": len(denied),
            "total_unfiled_secondary_candidates": len(unfiled_sec),
            "total_completed_unbilled_procs": len(completed_unbilled),
            "total_underpayment_candidates": len(underpayments),
            "total_dead_ar_claims": len(dead_ar),
            "aging_buckets": {
                k: round(v, 2) for k, v in aged_buckets.items()
            },
        },
        "carrier_breakdown": carrier_breakdown,
        "top_10": [
            {
                "ClaimNum": r["ClaimNum"],
                "PatientName": r.get("PatientName", ""),
                "CarrierName": r.get("CarrierName", ""),
                "EstRemaining": r.get("EstRemaining", 0),
                "DaysOutstanding": r.get("DaysOutstanding", 0),
                "AgingBucket": r.get("AgingBucket", ""),
                "PriorityScore": r.get("PriorityScore", 0),
                "ClaimStatus": r.get("ClaimStatusDesc", ""),
            }
            for r in high_priority[:10]
        ],
    }


# ── Markdown report ──────────────────────────────────────────────

def write_markdown_report(
    summary: dict,
    top_10: list[dict],
    all_results: dict[str, list[dict]],
):
    """Generate the master Markdown report."""
    s = summary["summary"]
    lines = []

    lines.append("# Open Dental AR Leakage Audit")
    lines.append("")
    lines.append(f"_Generated: {summary['generated_at']}_")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **Visible Insurance AR** | ${s['visible_insurance_ar']:,.2f} |")
    lines.append(f"| **Likely Recoverable Candidates** | ${s['likely_recoverable_candidates']:,.2f} |")
    lines.append(f"| **Questionable / Dead AR** | ${s['questionable_dead_ar']:,.2f} |")
    lines.append(f"| **High-Priority Claims (score ≥ 50)** | {s['high_priority_claim_count']} |")
    lines.append(f"| **Top Carrier by Stuck Balance** | {s['top_carrier_by_stuck_balance']} (${s['top_carrier_balance']:,.2f}) |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Summary Statistics")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **Total Aged Claims** | {s['total_aged_claims']} |")
    lines.append(f"| **Claims With No Payment** | {s['total_no_payment_claims']} |")
    lines.append(f"| **Denied / Rejected** | {s['total_denied_claims']} |")
    lines.append(f"| **Unfiled Secondary Candidates** | {s['total_unfiled_secondary_candidates']} |")
    lines.append(f"| **Completed Unbilled Procs** | {s['total_completed_unbilled_procs']} |")
    lines.append(f"| **Underpayment Candidates** | {s['total_underpayment_candidates']} |")
    lines.append(f"| **Dead / Questionable AR Claims** | {s['total_dead_ar_claims']} |")
    lines.append("")
    lines.append("## Aging Buckets (Insurance AR)")
    lines.append("")
    lines.append("| Bucket | Balance |")
    lines.append("|--------|--------|")
    for bucket in ["0-30", "31-60", "61-90", "91-120", "120+"]:
        bal = s["aging_buckets"].get(bucket, 0)
        lines.append(f"| **{bucket} days** | ${bal:,.2f} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Leakage Breakdown")
    lines.append("")
    aged_total = _sum_amount(all_results.get("aged_ar", []), "EstRemaining")
    no_pay_total = _first_amount(all_results.get("no_payment", []), "ClaimFee")
    denied_total = _first_amount(all_results.get("denied", []), "ClaimFee")
    unbilled_total = _first_amount(all_results.get("completed_unbilled", []), "ProcFee")
    lines.append(f"| Category | Count | Total ($) |")
    lines.append(f"|----------|-------|-----------|")
    lines.append(f"| **Aged AR** (insurance balance outstanding) | {s['total_aged_claims']} | ${aged_total:,.2f} |")
    lines.append(f"| **Denied / Rejected** | {s['total_denied_claims']} | ${denied_total:,.2f} |")
    lines.append(f"| **No Payment** (sent but $0 received) | {s['total_no_payment_claims']} | ${no_pay_total:,.2f} |")
    lines.append(f"| **Unfiled Secondary** | {s['total_unfiled_secondary_candidates']} | — |")
    lines.append(f"| **Completed Unbilled** (procedures w/o claim) | {s['total_completed_unbilled_procs']} | ${unbilled_total:,.2f} |")
    lines.append(f"| **Underpayment Candidates** | {s['total_underpayment_candidates']} | ${_first_amount(all_results.get('underpayment', []), 'UnderpaymentAmount'):,.2f} |")
    lines.append(f"| **Questionable / Dead AR** | {s['total_dead_ar_claims']} | ${s['questionable_dead_ar']:,.2f} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Carrier Breakdown")
    lines.append("")
    carrier_rows = summary.get("carrier_breakdown", [])
    if carrier_rows:
        lines.append("| Carrier | Candidate Balance | Claim Count | Avg Age (days) |")
        lines.append("|---------|-------------------|-------------|----------------|")
        for cr in carrier_rows[:15]:  # top 15
            lines.append(f"| {cr['Carrier']} | ${cr['CandidateBalance']:,.2f} | {cr['ClaimCount']} | {cr['AvgAgeDays']} |")
        if len(carrier_rows) > 15:
            lines.append(f"| _... and {len(carrier_rows) - 15} more_ | | | |")
    else:
        lines.append("_No carrier data available._")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Top 10 Recovery Opportunities")
    lines.append("")
    if top_10:
        lines.append("| # | Patient | Carrier | Remaining | Days Out | Bucket | Score | Status |")
        lines.append("|---|---------|---------|-----------|----------|--------|-------|--------|")
        for i, r in enumerate(top_10, 1):
            lines.append(
                f"| {i} | {r['PatientName']} | {r['CarrierName']} "
                f"| ${r['EstRemaining']:,.2f} | {r['DaysOutstanding']} "
                f"| {r['AgingBucket']} | {r['PriorityScore']} "
                f"| {r['ClaimStatus']} |"
            )
    else:
        lines.append("_No high-priority claims identified._")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Priority Score Methodology")
    lines.append("")
    lines.append("**Formula:** `priority_score = balance_weight + age_weight + status_weight + carrier_type - dead_ar_penalty`")
    lines.append("")
    lines.append("| Factor | Weight Range | Notes |")
    lines.append("|--------|-------------|-------|")
    lines.append("| **Balance** | 0 – 40 | Higher remaining balance = higher score |")
    lines.append("| **Age** | 0 – 25 | Older claims score higher (up to 120+ days) |")
    lines.append("| **Status** | 0 – 20 | Received > Sent > Waiting > Hold |")
    lines.append("| **Carrier Type** | 10 – 15 | Primary slightly higher than secondary |")
    lines.append("| **Dead AR Penalty** | 0 – 30 | Subtracted for likely-unrecoverable claims |")
    lines.append("")
    lines.append("Score interpretation: **≥ 50** = high priority, **30–49** = medium, **< 30** = low.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Category Details")
    lines.append("")

    # Aged AR detail
    if all_results.get("aged_ar"):
        lines.append("### 1. Aged Insurance AR")
        lines.append("")
        lines.append(f"Total claims: {s['total_aged_claims']} | Total outstanding: ${aged_total:,.2f}")
        lines.append("")
        lines.append("Claims with insurance balance still outstanding. Sorted by priority score.")
        lines.append("")
        lines.append(f"See [`aged_claims.csv`](aged_claims.csv) for full list.")
        lines.append("")

    # No payment detail
    if all_results.get("no_payment"):
        lines.append("### 2. Claims With No Insurance Payment")
        lines.append("")
        lines.append(f"Total: {s['total_no_payment_claims']} claims | Total fee: ${no_pay_total:,.2f}")
        lines.append("")
        lines.append("Claims that were sent to insurance but have zero payment recorded.")
        lines.append("")
        lines.append(f"See [`unpaid_claims.csv`](unpaid_claims.csv) for full list.")
        lines.append("")

    # Denied detail
    if all_results.get("denied"):
        lines.append("### 3. Denied or Rejected Claims")
        lines.append("")
        lines.append(f"Total: {s['total_denied_claims']} claims | Total fee: ${denied_total:,.2f}")
        lines.append("")
        lines.append("Claims showing denial signals: zero payment after receipt, in-process limbo, or unresponded.")
        lines.append("")
        lines.append(f"See [`denied_claims.csv`](denied_claims.csv) for full list.")
        lines.append("")

    # Unfiled secondary
    if all_results.get("unfiled_secondary"):
        lines.append("### 4. Unfiled Secondary Candidates")
        lines.append("")
        lines.append(f"Total: {s['total_unfiled_secondary_candidates']} patients")
        lines.append("")
        lines.append("Patients with secondary insurance where primary appears paid but no secondary claim was filed.")
        lines.append("")
        lines.append(f"See [`unfiled_secondary_candidates.csv`](unfiled_secondary_candidates.csv) for full list.")
        lines.append("")

    # Completed unbilled
    if all_results.get("completed_unbilled"):
        lines.append("### 5. Completed Procedures With No Claim")
        lines.append("")
        lines.append(f"Total: {s['total_completed_unbilled_procs']} procedures | Total fee: ${unbilled_total:,.2f}")
        lines.append("")
        lines.append("**⚠️ Needs human review.** These are completed insurance-billable procedures ")
        lines.append("with no associated claim. Could indicate missing claims or data entry issues.")
        lines.append("")
        lines.append(f"See [`completed_unbilled_procedures.csv`](completed_unbilled_procedures.csv) for full list.")
        lines.append("")

    # Underpayments
    if all_results.get("underpayment"):
        lines.append("### 6. Underpayment Candidates (Experimental)")
        lines.append("")
        lines.append(f"Total: {s['total_underpayment_candidates']} claims")
        lines.append("")
        lines.append("**⚠️ Experimental.** Claims where insurance paid significantly less than estimated.")
        lines.append("Verify against fee schedule and benefit details before pursuing.")
        lines.append("")
        lines.append(f"See [`underpayment_candidates.csv`](underpayment_candidates.csv) for full list.")
        lines.append("")

    # Dead AR
    if all_results.get("dead_ar"):
        lines.append("### 7. Dead / Questionable AR")
        lines.append("")
        lines.append(f"Total: {s['total_dead_ar_claims']} claims | Total balance: ${s['questionable_dead_ar']:,.2f}")
        lines.append("")
        lines.append("Claims classified as likely unrecoverable due to age, timely filing risk, ")
        lines.append("or being fully resolved. Do not invest time on these.")
        lines.append("")
        lines.append("Categories:")
        lines.append("- **Very old** (>2 years): low recovery probability")
        lines.append("- **Timely filing risk** (>12 months, unpaid): likely past filing deadline")
        lines.append("- **Likely resolved**: insurance + write-off + deductible = claim fee")
        lines.append("- **Stale partial**: partial payment with no recent activity")
        lines.append("")
        lines.append(f"See [`aged_claims.csv`](aged_claims.csv) (filtered with dead AR flag) for full list.")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Methodology & Assumptions")
    lines.append("")
    lines.append("### Database Tables Used")
    lines.append("- `claim` — Claim header with status, fee, payments")
    lines.append("- `claimproc` — Claim line items with insurance estimates and actuals")
    lines.append("- `claimpayment` — Insurance payment records")
    lines.append("- `procedurelog` — Completed procedure records")
    lines.append("- `procedurecode` — Procedure code definitions and billability flags")
    lines.append("- `insplan` — Insurance plan details")
    lines.append("- `carrier` — Insurance carrier names")
    lines.append("- `patient` — Patient demographics and insurance indicators")
    lines.append("- `patplan` — Patient-to-plan mapping with ordinal (primary/secondary)")
    lines.append("- `inssub` — Insurance subscriber records")
    lines.append("")
    lines.append("### OpenDental Version Assumptions")
    lines.append("- Tested against OpenDental v24.3 schema")
    lines.append("- Column names and types may vary slightly between versions")
    lines.append("- `claim.ClaimStatus` is varchar(1): U/H/W/P/S/R/I")
    lines.append("- `claimproc.Status` is tinyint: 0=NotReceived, 1=Received, 6=Estimate, etc.")
    lines.append("- `procedurelog.ProcStatus` = 2 means Complete")
    lines.append("- `procedurecode.NoBillIns` = 1 means the code is not billed to insurance")
    lines.append("")
    lines.append("## Caveats")
    lines.append("")
    lines.append("**This is a read-only analytical audit. It does not prove recoverability. All findings require human review.**")
    lines.append("")
    lines.append("- **No fee schedule or UCR data is queried** (depends on version/setup) — underpayment detection uses `InsPayEst` which may be inaccurate")
    lines.append("- **Completed unbilled procedures** detection is approximate and may include procedures where billing was intentionally deferred")
    lines.append("- **Does not distinguish** between electronic and paper claims")
    lines.append("- **Timely filing estimates** are based on claim age and status, not actual insurance filing deadlines (which vary by carrier and plan)")
    lines.append("- **Denial signals** are inferred from payment patterns, not EOB/ERA data")
    lines.append("- **Unfiled secondary** detection requires that primary claims are properly marked as received — if primary EOBs are not posted in OpenDental, this category will undercount")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Output Files")
    lines.append("")
    lines.append("| File | Description |")
    lines.append("|------|-------------|")
    lines.append("| `ar_leakage_summary.md` | This report |")
    lines.append("| `ar_leakage_candidates.csv` | Master list with priority scores |")
    lines.append("| `aged_claims.csv` | Aged insurance AR detail |")
    lines.append("| `denied_claims.csv` | Denied/rejected claims |")
    lines.append("| `unpaid_claims.csv` | Claims with no payment received |")
    lines.append("| `unfiled_secondary_candidates.csv` | Missing secondary claims |")
    lines.append("| `completed_unbilled_procedures.csv` | Completed unbilled procs |")
    lines.append("| `metadata.json` | Run metadata and summary |")
    lines.append("")

    path = output_path("ar_leakage_summary.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")

    return path


# ── Master CSV with priority scores ─────────────────────────────

def write_priority_csv(candidates: list[dict]):
    """Write master candidates CSV with priority scores."""
    write_csv("ar_leakage_candidates.csv", candidates)


# ── Metadata JSON ────────────────────────────────────────────────

def write_metadata(summary: dict):
    path = output_path("metadata.json")
    with open(path, "w") as f:
        json.dump(summary, f, indent=2, default=str)


# ── Orchestrator ─────────────────────────────────────────────────

def write_all_reports(all_results: dict[str, list[dict]]):
    """Run all report generation steps."""
    ensure_output_dir()

    # Individual CSVs
    write_csv("aged_claims.csv", all_results.get("aged_ar", []))
    write_csv("unpaid_claims.csv", all_results.get("no_payment", []))
    write_csv("denied_claims.csv", all_results.get("denied", []))
    write_csv("unfiled_secondary_candidates.csv", all_results.get("unfiled_secondary", []))
    write_csv("completed_unbilled_procedures.csv", all_results.get("completed_unbilled", []))
    write_csv("underpayment_candidates.csv", all_results.get("underpayment", []))
    # Include dead AR flag in aged claims

    # Collate summary
    summary = collate(all_results)

    # Master priority CSV
    scored_aged = build_priority_list(list(all_results.get("aged_ar", [])))
    write_priority_csv(scored_aged)

    # Markdown report
    write_markdown_report(summary, summary.get("top_10", []), all_results)

    # Metadata
    write_metadata(summary)

    return summary, output_path("ar_leakage_summary.md")
