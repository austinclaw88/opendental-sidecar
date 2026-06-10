"""
Canada-specific report generation for AR audit.
Produces CSV files and a Canada follow-up summary Markdown report.
"""

import csv
import json
import os
from datetime import datetime
from collections import Counter
from typing import Any

from .canada_detectors import (
    detect_stale_predeterminations,
    detect_high_value_treatment_followup,
    detect_assignment_ar,
    detect_secondary_coordination,
    detect_cdcp_followup,
    detect_missing_documentation,
    detect_followup_ownership_gaps,
    compute_canada_priority_score,
)

OUTPUT_DIR = "audit-output"


def _sum(rows: list[dict], key: str) -> float:
    return round(sum(float(r.get(key, 0) or 0) for r in rows), 2)


def _count(rows: list[dict]) -> int:
    return len(rows)


def write_csv(filename: str, rows: list[dict[str, Any]]):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, filename)
    if not rows:
        with open(path, "w") as f:
            f.write("(no results)\n")
        return
    fieldnames = [k for k in rows[0].keys() if not k.startswith("_")]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            filtered = {k: v for k, v in row.items() if k in fieldnames}
            writer.writerow(filtered)


def _enrich_priority(data: list[dict]) -> list[dict]:
    """Add Canada priority score to each row and sort descending."""
    for row in data:
        row["PriorityScore"] = compute_canada_priority_score(row)
    data.sort(key=lambda r: r.get("PriorityScore", 0), reverse=True)
    return data


def write_canada_csvs(all_results: dict[str, list[dict]]):
    """Write all Canada-specific CSVs."""
    write_csv("predetermination_followup_candidates.csv",
              _enrich_priority(list(all_results.get("stale_predetermination", []))))
    write_csv("stale_predeterminations.csv",
              all_results.get("stale_predetermination", []))
    write_csv("high_value_treatment_followup.csv",
              _enrich_priority(list(all_results.get("high_value_treatment_followup", []))))
    write_csv("assignment_ar_candidates.csv",
              _enrich_priority(list(all_results.get("assignment_ar", []))))
    write_csv("secondary_coordination_candidates.csv",
              all_results.get("secondary_coordination", []))
    write_csv("cdcp_followup_candidates.csv",
              _enrich_priority(list(all_results.get("cdcp_followup", []))))
    write_csv("missing_documentation_candidates.csv",
              all_results.get("missing_documentation", []))
    write_csv("followup_ownership_candidates.csv",
              _enrich_priority(list(all_results.get("followup_ownership_gap", []))))


def collate_canada(all_results: dict[str, list[dict]]) -> dict:
    """Compute aggregate statistics for Canada report."""
    stale_predets = all_results.get("stale_predetermination", [])
    high_value_tx = all_results.get("high_value_treatment_followup", [])
    assignment_ar = all_results.get("assignment_ar", [])
    secondary = all_results.get("secondary_coordination", [])
    cdcp = all_results.get("cdcp_followup", [])
    missing_doc = all_results.get("missing_documentation", [])
    ownership_gaps = all_results.get("followup_ownership_gap", [])

    stale_scored = _enrich_priority(list(stale_predets))
    high_value_scored = _enrich_priority(list(high_value_tx))
    assignment_scored = _enrich_priority(list(assignment_ar))

    # Stale predet breakdown
    stale_levels = Counter()
    for r in stale_predets:
        stale_levels[r.get("StaleLevel", "unknown")] += 1

    # Follow-up gap breakdown
    gap_levels = Counter()
    for r in high_value_tx:
        gap_levels[r.get("FollowUpGap", "unknown")] += 1

    # Value tier breakdown
    value_tiers = Counter()
    for r in high_value_tx:
        value_tiers[r.get("ValueTier", "unknown")] += 1

    # Top carriers for stale predets
    carrier_counts = Counter()
    for r in stale_predets:
        carrier_counts[r.get("CarrierName", "Unknown")] += 1

        # Ownership gap scores
    ownership_scored = _enrich_priority(list(ownership_gaps))
    has_no_comm = len([r for r in ownership_gaps if "No communication" in (r.get("GapSignals", "") or "")])

    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "total_stale_predeterminations": len(stale_predets),
            "critical_stale_predeterminations": stale_levels.get("critical", 0),
            "overdue_predeterminations": stale_levels.get("overdue", 0),
            "stale_predeterminations": stale_levels.get("stale", 0),
            "total_predet_value": _sum(stale_predets, "ClaimFee"),
            "total_high_value_treatment_plans": len(high_value_tx),
            "premium_treatment_plans": value_tiers.get("premium", 0),
            "high_value_plans": value_tiers.get("high", 0),
            "medium_value_plans": value_tiers.get("medium", 0),
            "total_tx_value": _sum(high_value_tx, "ProcFee"),
            "critical_followup_gap": gap_levels.get("critical", 0),
            "total_assignment_ar_candidates": len(assignment_ar),
            "total_assignment_ar_balance": _sum(assignment_ar, "InsuranceBalance"),
            "assignment_ar_over_90": len([r for r in assignment_ar if r.get("DaysOutstanding", 0) > 90]),
            "total_secondary_coordination": len(secondary),
            "secondary_with_issues": len([r for r in secondary if r.get("Issues", "").startswith("$")]),
            "total_cdcp_candidates": len(cdcp),
            "total_cdcp_balance": _sum(cdcp, "BalanceRemaining"),
            "total_missing_documentation": len(missing_doc),
            "total_ownership_gaps": len(ownership_gaps),
            "no_recent_communication": has_no_comm,
            "top_predet_carrier": carrier_counts.most_common(1)[0][0] if carrier_counts else "N/A",
        },
        "stale_levels": dict(stale_levels),
        "gap_levels": dict(gap_levels),
        "value_tiers": dict(value_tiers),
        "top_stale_predeterminations": stale_scored[:10] if stale_scored else [],
        "top_high_value_treatment": high_value_scored[:10] if high_value_scored else [],
        "top_assignment_ar": assignment_scored[:10] if assignment_scored else [],
        "top_ownership_gaps": ownership_scored[:10] if ownership_scored else [],
    }


def write_canada_summary(summary: dict, all_results: dict[str, list[dict]]):
    """Generate the Canada follow-up summary Markdown report."""
    s = summary["summary"]
    lines = []

    lines.append("# Open Dental Insurance and Predetermination Follow-Up Audit")
    lines.append("")
    lines.append(f"_Generated: {summary['generated_at']}_")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **High-value cases needing follow-up** | {s['total_high_value_treatment_plans'] + s['total_stale_predeterminations']} |")
    lines.append(f"| **Estimated value of follow-up candidates** | ${s['total_predet_value'] + s['total_tx_value']:,.2f} |")
    lines.append(f"| **Stale predeterminations** | {s['total_stale_predeterminations']} (${s['total_predet_value']:,.2f}) |")
    lines.append(f"| **Assignment AR candidates** | ${s['total_assignment_ar_balance']:,.2f} |")
    lines.append(f"| **Secondary coordination candidates** | {s['total_secondary_coordination']} |")
    lines.append(f"| **CDCP follow-up candidates** | {s['total_cdcp_candidates']} |")
    lines.append(f"| **Cases with no recent documented follow-up** | {s['no_recent_communication']} |")
    lines.append("")
    lines.append("## Leakage Breakdown")
    lines.append("")
    lines.append("| Category | Count | Total Value |")
    lines.append("|----------|-------|-------------|")
    lines.append(f"| **Stale Predeterminations** | {s['total_stale_predeterminations']} | ${s['total_predet_value']:,.2f} |")
    lines.append(f"| **High-Value Treatment Follow-Up** | {s['total_high_value_treatment_plans']} | ${s['total_tx_value']:,.2f} |")
    lines.append(f"| **Assignment AR** | {s['total_assignment_ar_candidates']} | ${s['total_assignment_ar_balance']:,.2f} |")
    lines.append(f"| **Secondary Coordination** | {s['total_secondary_coordination']} | — |")
    lines.append(f"| **CDCP Follow-Up** | {s['total_cdcp_candidates']} | ${s['total_cdcp_balance']:,.2f} |")
    lines.append(f"| **Missing Documentation** | {s['total_missing_documentation']} | — |")
    lines.append(f"| **Follow-Up Ownership Gaps** | {s['total_ownership_gaps']} | — |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Predetermination Staleness")
    lines.append("")
    stale_levels = summary.get("stale_levels", {})
    if stale_levels:
        lines.append("| Level | Count |")
        lines.append("|-------|-------|")
        for level in ["critical", "overdue", "stale", "recent"]:
            lines.append(f"| **{level}** (>60d / >30d / >14d / <14d) | {stale_levels.get(level, 0)} |")
    lines.append("")
    now = datetime.now()
    stale_predets = all_results.get("stale_predetermination", [])
    stale_scored = _enrich_priority(list(stale_predets))[:10]
    if stale_scored:
        lines.append("### Top 10 Stale Predeterminations")
        lines.append("")
        lines.append("| # | Patient | Carrier | Value | Days Out | Level | Score |")
        lines.append("|---|---------|---------|-------|----------|-------|-------|")
        for i, r in enumerate(stale_scored, 1):
            lines.append(
                f"| {i} | {r.get('PatientName','')} | {r.get('CarrierName','')} "
                f"| ${r.get('ClaimFee',0):,.2f} | {r.get('DaysOutstanding',0)} "
                f"| {r.get('StaleLevel','')} | {r.get('PriorityScore',0)} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## High-Value Treatment Follow-Up Gap")
    lines.append("")
    gap_levels = summary.get("gap_levels", {})
    value_tiers = summary.get("value_tiers", {})
    if gap_levels or value_tiers:
        lines.append("| Metric | Count |")
        lines.append("|--------|-------|")
        lines.append(f"| **Premium Plans** (≥$5K) | {value_tiers.get('premium', 0)} |")
        lines.append(f"| **High Plans** ($3K-$5K) | {value_tiers.get('high', 0)} |")
        lines.append(f"| **Medium Plans** ($1K-$3K) | {value_tiers.get('medium', 0)} |")
        lines.append(f"| **Critical Gap** (no appt/comm >90d) | {gap_levels.get('critical', 0)} |")
        lines.append(f"| **Aging Gap** (no appt/comm >30d) | {gap_levels.get('aging', 0)} |")
        lines.append(f"| **Scheduled** (has appointment) | {gap_levels.get('scheduled', 0)} |")
        lines.append("")
    high_value_tx = all_results.get("high_value_treatment_followup", [])
    high_value_scored = _enrich_priority(list(high_value_tx))[:10]
    if high_value_scored:
        lines.append("### Top 10 High-Value Treatment Follow-Ups")
        lines.append("")
        lines.append("| # | Patient | Proc | Value | Days Planned | Gap | Score |")
        lines.append("|---|---------|------|-------|--------------|-----|-------|")
        for i, r in enumerate(high_value_scored, 1):
            lines.append(
                f"| {i} | {r.get('PatientName','')} | {r.get('ProcCode','')} "
                f"| ${r.get('ProcFee',0):,.2f} | {r.get('DaysSincePlanned',0)} "
                f"| {r.get('FollowUpGap','')} | {r.get('PriorityScore',0)} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Assignment AR Aging")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **Total Assignment AR Candidates** | {s['total_assignment_ar_candidates']} |")
    lines.append(f"| **Total Assignment AR Balance** | ${s['total_assignment_ar_balance']:,.2f} |")
    lines.append(f"| **Aged >90 Days** | {s['assignment_ar_over_90']} |")
    lines.append("")

    assignment_ar = all_results.get("assignment_ar", [])
    assignment_scored = _enrich_priority(list(assignment_ar))[:10]
    if assignment_scored:
        lines.append("### Top 10 Assignment AR")
        lines.append("")
        lines.append("| # | Patient | Carrier | Insurance Balance | Days Out | Type | Score |")
        lines.append("|---|---------|---------|-------------------|----------|------|-------|")
        for i, r in enumerate(assignment_scored, 1):
            lines.append(
                f"| {i} | {r.get('PatientName','')} | {r.get('CarrierName','')} "
                f"| ${r.get('InsuranceBalance',0):,.2f} | {r.get('DaysOutstanding',0)} "
                f"| {r.get('ClaimType','')} | {r.get('PriorityScore',0)} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Secondary Coordination")
    lines.append("")
    secondary = all_results.get("secondary_coordination", [])
    with_issues = [r for r in secondary if r.get("Issues", "").startswith("$")]
    if with_issues:
        lines.append(f"| Metric | Value |")
        lines.append(f"|--------|-------|")
        lines.append(f"| **Coordination Cases** | {s['total_secondary_coordination']} |")
        lines.append(f"| **With Unfiled Secondary** | {len(with_issues)} |")
        lines.append("")
        lines.append("### Top Secondary Coordination Issues")
        lines.append("")
        lines.append("| Patient | Plans | Carriers | Issues |")
        lines.append("|---------|-------|----------|--------|")
        for r in with_issues[:15]:
            lines.append(f"| {r.get('PatientName','')} | {r.get('PlanCount',0)} | {r.get('AllCarriers','')} | {r.get('Issues','')} |")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## CDCP Follow-Up Candidates")
    lines.append("")
    cdcp = all_results.get("cdcp_followup", [])
    cdcp_scored = _enrich_priority(list(cdcp))[:10]
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **Total CDCP Candidates** | {s['total_cdcp_candidates']} |")
    lines.append(f"| **Total Outstanding Balance** | ${s['total_cdcp_balance']:,.2f} |")
    lines.append("")
    if cdcp_scored:
        lines.append("### Top 10 CDCP Follow-Up")
        lines.append("")
        lines.append("| # | Patient | Carrier | Balance | Days Out | Reason | Score |")
        lines.append("|---|---------|---------|---------|----------|--------|-------|")
        for i, r in enumerate(cdcp_scored, 1):
            lines.append(
                f"| {i} | {r.get('PatientName','')} | {r.get('CarrierName','')} "
                f"| ${r.get('BalanceRemaining',0):,.2f} | {r.get('DaysOutstanding',0)} "
                f"| {r.get('FollowUpReason','')} | {r.get('PriorityScore',0)} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    # ── Top 10 Follow-Up Opportunities ───────────────────────
    lines.append("---")
    lines.append("")
    lines.append("## Top 10 Follow-Up Opportunities")
    lines.append("")
    lines.append("Combined priority-ranked list across all categories.")
    lines.append("")
    lines.append("| # | Patient | Carrier | Case Type | Value | Days Stale | Flags | Recommended Next Action |")
    lines.append("|---|---------|---------|-----------|-------|------------|-------|------------------------|")

    # Build combined priority list
    combined = []
    for r in all_results.get("stale_predetermination", []):
        r2 = r.copy()
        r2["_case_type"] = "Predetermination"
        r2["_value"] = float(r.get("ClaimFee", 0))
        r2["_days"] = r.get("DaysOutstanding", 0)
        r2["_combined_score"] = compute_canada_priority_score(r2)
        r2["_action"] = "Contact patient re: treatment, follow up with insurance" if r.get("HasFutureAppointment") else "Schedule case review, check predet status"
        combined.append(r2)
    for r in all_results.get("high_value_treatment_followup", []):
        r2 = r.copy()
        r2["_case_type"] = "High-Value Tx"
        r2["_value"] = float(r.get("ProcFee", 0))
        r2["_days"] = r.get("DaysSincePlanned", 0)
        r2["_combined_score"] = compute_canada_priority_score(r2)
        r2["_action"] = "Contact patient to schedule treatment, verify predet" if r.get("HasPredetermination") else "Check insurance coverage, plan appointment"
        combined.append(r2)
    for r in all_results.get("assignment_ar", []):
        r2 = r.copy()
        r2["_case_type"] = "Assignment AR"
        r2["_value"] = float(r.get("InsuranceBalance", 0))
        r2["_days"] = r.get("DaysOutstanding", 0)
        r2["_combined_score"] = compute_canada_priority_score(r2)
        r2["_action"] = "Call insurance to check claim status, verify assignment"
        combined.append(r2)
    for r in all_results.get("cdcp_followup", []):
        r2 = r.copy()
        r2["_case_type"] = "CDCP Follow-Up"
        r2["_value"] = float(r.get("BalanceRemaining", 0))
        r2["_days"] = r.get("DaysOutstanding", 0)
        r2["_combined_score"] = compute_canada_priority_score(r2)
        r2["_action"] = "Verify CDCP coverage, check patient eligibility, follow up claim"
        combined.append(r2)
    for r in all_results.get("followup_ownership_gap", []):
        r2 = r.copy()
        r2["_case_type"] = "Ownership Gap"
        r2["_value"] = float(r.get("ClaimFee", 0))
        r2["_days"] = r.get("DaysSinceSent", 0)
        r2["_combined_score"] = compute_canada_priority_score(r2)
        signals = r.get("GapSignals", "")
        r2["_action"] = "Assign to coordinator, document next step in commlog, create task"
        combined.append(r2)

    combined.sort(key=lambda r: r.get("_combined_score", 0), reverse=True)
    for i, r in enumerate(combined[:10], 1):
        # Build flags column
        flags = []
        if r.get("StaleLevel") in ("critical", "overdue"):
            flags.append("Critical")
        elif r.get("ValueTier") == "premium":
            flags.append("Premium")
        if r.get("HasPredetermination"):
            flags.append("Has Predet")
        if "CDCP" in r.get("_case_type", "") or "cdcp" in str(r.get("CarrierName", "")).lower():
            flags.append("CDCP")
        if r.get("GapSignals"):
            flags.append("No follow-up")
        if r.get("MissingReasons"):
            flags.append("Missing Docs")
        flag_str = "; ".join(flags) if flags else "—"

        lines.append(
            f"| {i} | {r.get('PatientName','')} | {r.get('CarrierName','')} "
            f"| {r['_case_type']} | ${r['_value']:,.2f} | {r['_days']} "
            f"| {flag_str} | {r['_action']} |"
        )
    if not combined:
        lines.append("| — | _No candidates identified_ | | | | | |")
    lines.append("")

    # ── Report Sections ────────────────────────────────────────────
    lines.append("---")
    lines.append("")
    lines.append("## Predetermination Follow-Up")
    lines.append("")
    lines.append(f"Total: {s['total_stale_predeterminations']} stale predeterminations (${s['total_predet_value']:,.2f})")
    lines.append("")
    if all_results.get("stale_predetermination"):
        lines.append(f"See [`predetermination_followup_candidates.csv`](predetermination_followup_candidates.csv) for full list.")
        lines.append("")

    lines.append("## High-Value Treatment Follow-Up")
    lines.append("")
    lines.append(f"Total: {s['total_high_value_treatment_plans']} plans (${s['total_tx_value']:,.2f})")
    lines.append(f"- Premium plans (≥$5K): {s['premium_treatment_plans']}")
    lines.append(f"- High plans ($3K-$5K): {s['high_value_plans']}")
    lines.append(f"- Medium plans ($1K-$3K): {s['medium_value_plans']}")
    lines.append(f"- Critical follow-up gap: {s['critical_followup_gap']}")
    lines.append("")
    if all_results.get("high_value_treatment_followup"):
        lines.append(f"See [`high_value_treatment_followup.csv`](high_value_treatment_followup.csv) for full list.")
        lines.append("")

    lines.append("## Assignment AR")
    lines.append("")
    lines.append(f"Total: {s['total_assignment_ar_candidates']} candidates (${s['total_assignment_ar_balance']:,.2f})")
    lines.append(f"- Aged >90 days: {s['assignment_ar_over_90']}")
    lines.append("**Note:** Assignment is inferred from insurance balance patterns. Confirm actual assignment status.")
    lines.append("")
    if all_results.get("assignment_ar"):
        lines.append(f"See [`assignment_ar_candidates.csv`](assignment_ar_candidates.csv) for full list.")
        lines.append("")

    lines.append("## Secondary Coordination")
    lines.append("")
    lines.append(f"Total: {s['total_secondary_coordination']} patients with multiple plans")
    lines.append(f"- Unfiled secondary claims: {s['secondary_with_issues']}")
    lines.append("")
    if all_results.get("secondary_coordination"):
        lines.append(f"See [`secondary_coordination_candidates.csv`](secondary_coordination_candidates.csv) for full list.")
        lines.append("")

    lines.append("## CDCP Candidate Cases")
    lines.append("")
    lines.append(f"Total: {s['total_cdcp_candidates']} potential CDCP-related cases (${s['total_cdcp_balance']:,.2f} outstanding)")
    lines.append("")
    lines.append("**Heuristic detection** based on carrier/plan name matching. Confirm with office records.")
    lines.append("")
    if all_results.get("cdcp_followup"):
        lines.append(f"See [`cdcp_followup_candidates.csv`](cdcp_followup_candidates.csv) for full list.")
        lines.append("")

    lines.append("## Follow-Up Ownership Gaps")
    lines.append("")
    lines.append(f"Total: {s['total_ownership_gaps']} cases with no documented follow-up")
    lines.append(f"- No communication in 60 days: {s['no_recent_communication']}")
    lines.append("")
    lines.append("Cases where claims or predeterminations were sent but no next action appears documented.")
    lines.append("Assign to a treatment coordinator for review.")
    lines.append("")
    if all_results.get("followup_ownership_gap"):
        lines.append(f"See [`followup_ownership_candidates.csv`](followup_ownership_candidates.csv) for full list.")
        lines.append("")

    lines.append("## Missing Documentation Candidates")
    lines.append("")
    missing_doc = all_results.get("missing_documentation", [])
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| **Claims With Missing Documentation** | {s['total_missing_documentation']} |")
    lines.append("")
    if missing_doc:
        lines.append("### Missing Documentation Details")
        lines.append("")
        lines.append("| Patient | Carrier | Proc Codes | Service Date | Claim Type | Missing Reasons |")
        lines.append("|---------|----------|------------|-------------|------------|-----------------|")
        for r in missing_doc[:20]:
            procs = r.get('ProcCodes', '')
            proc_str = procs if procs else '—'
            lines.append(
                f"| {r.get('PatientName','')} | {r.get('CarrierName','')} "
                f"| {proc_str} | {r.get('DateService','')} | {r.get('ClaimType','')} "
                f"| {r.get('MissingReasons','')} |"
            )
        lines.append("")

    lines.append("## Follow-Up Ownership Gaps (Detail)")
    lines.append("")
    ownership_gaps = all_results.get("followup_ownership_gap", [])
    if ownership_gaps:
        lines.append("| Patient | Carrier | Value | Days Since Sent | Claim Type | Gap Signals |")
        lines.append("|---------|----------|-------|----------------|------------|-------------|")
        for r in ownership_gaps[:15]:
            lines.append(
                f"| {r.get('PatientName','')} | {r.get('CarrierName','')} "
                f"| ${r.get('ClaimFee',0):,.2f} | {r.get('DaysSinceSent',0)} "
                f"| {r.get('ClaimType','')} | {r.get('GapSignals','')} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## Priority Score Methodology (Canada)")
    lines.append("")
    lines.append("**Formula:** `priority_score = dollar_value + days_stale + high_value_tx + secondary_coordination + cdcp_flag + missing_documentation + no_recent_followup - low_confidence_penalty`")
    lines.append("")
    lines.append("| Factor | Weight Range | Notes |")
    lines.append("|--------|-------------|-------|")
    lines.append("| **Dollar Value** | 0 – 25 | ≥$5K = 25, $3K–$5K = 20, $1.5K–$3K = 15 |")
    lines.append("| **Days Stale** | 0 – 20 | Longer wait = higher urgency |")
    lines.append("| **High-Value Tx** | 0 – 15 | Planned tx with predet = most actionable |")
    lines.append("| **Secondary Coordination** | 0 – 10 | Multi-plan with gaps = higher |")
    lines.append("| **CDCP Flag** | 0 – 10 | CDCP uncertainty + age = higher |")
    lines.append("| **Missing Documentation** | 0 – 10 | Empty note on major work = higher |")
    lines.append("| **No Recent Follow-Up** | 0 – 10 | No comm/appt = higher |")
    lines.append("| **Low Confidence Penalty** | 0 – 20 | Subtracted for APPROXIMATE findings |")
    lines.append("")
    lines.append("Score interpretation: **≥ 50** = high priority, **30–49** = medium, **< 30** = low.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Caveats")
    lines.append("")
    lines.append("**This is a read-only analytical audit. It does not prove recoverability. All findings require human review.**")
    lines.append("")
    lines.append("- **Predetermination detection** relies on `claim.ClaimType = 'PreAuth'` — may miss pre-2008 predets stored differently")
    lines.append("- **High-value treatment tracking** uses `procedurelog.ProcStatus = 1` (TP) as a proxy — the `treatplan` table is not queried (may not exist)")
    lines.append("- **Assignment AR** is inferred from insurance aging patterns — OpenDental has no direct assignment flag")
    lines.append("- **CDCP detection** is heuristic based on carrier/plan name matching — confirm carrier identity manually")
    lines.append("- **Missing documentation** depends on `document`/`sheet` table availability — gracefully degrades if tables don't exist")
    lines.append("- **Procedure-code-based detection** uses D-code patterns for crowns, bridges, implants, perio, endo, surgery, ortho, major restorative")
    lines.append("- **Secondary coordination** detects plan count ≥2 but cannot verify COB rules without full benefit data")
    lines.append("- **Follow-up ownership gaps** use commlog + appointment data — may misclassify if follow-up is documented outside OpenDental")
    lines.append("- **Tasks** are only checked if the task table exists; otherwise skipped gracefully")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Output Files")
    lines.append("")
    lines.append("| File | Description |")
    lines.append("|------|-------------|")
    lines.append("| `canada_followup_summary.md` | This report |")
    lines.append("| `predetermination_followup_candidates.csv` | Stale predeterminations with priority |")
    lines.append("| `stale_predeterminations.csv` | All predeterminations by staleness |")
    lines.append("| `high_value_treatment_followup.csv` | High-value treatment plans needing follow-up |")
    lines.append("| `assignment_ar_candidates.csv` | Assignment AR aging candidates |")
    lines.append("| `secondary_coordination_candidates.csv` | Multi-plan coordination issues |")
    lines.append("| `cdcp_followup_candidates.csv` | Potential CDCP cases needing review |")
    lines.append("| `missing_documentation_candidates.csv` | Claims/predets with missing documentation |")
    lines.append("| `followup_ownership_candidates.csv` | Cases with no documented follow-up |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("_End of report._")
    lines.append("")

    path = os.path.join(OUTPUT_DIR, "canada_followup_summary.md")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    return path


def run_canada_audit(cnx, output_dir: str = "audit-output"):
    """Run all Canada-specific detectors and generate reports.

    Args:
        cnx: MySQL connection
        output_dir: Output directory path

    Returns:
        Tuple of (summary dict, report_path string)
    """
    global OUTPUT_DIR
    OUTPUT_DIR = output_dir

    print("   [CA-1/6] Stale predeterminations...", end=" ", flush=True)
    stale_predets = detect_stale_predeterminations(cnx)
    print(f"{len(stale_predets)} candidates", flush=True)

    print("   [CA-2/6] High-value treatment follow-up...", end=" ", flush=True)
    high_value_tx = detect_high_value_treatment_followup(cnx)
    print(f"{len(high_value_tx)} candidates", flush=True)

    print("   [CA-3/6] Assignment AR candidates...", end=" ", flush=True)
    assignment_ar = detect_assignment_ar(cnx)
    print(f"{len(assignment_ar)} candidates", flush=True)

    print("   [CA-4/6] Secondary coordination...", end=" ", flush=True)
    secondary = detect_secondary_coordination(cnx)
    print(f"{len(secondary)} candidates", flush=True)

    print("   [CA-5/7] CDCP follow-up...", end=" ", flush=True)
    cdcp = detect_cdcp_followup(cnx)
    print(f"{len(cdcp)} candidates", flush=True)

    print("   [CA-6/7] Missing documentation...", end=" ", flush=True)
    missing_doc = detect_missing_documentation(cnx)
    print(f"{len(missing_doc)} candidates", flush=True)

    print("   [CA-7/7] Follow-up ownership gaps...", end=" ", flush=True)
    ownership_gaps = detect_followup_ownership_gaps(cnx)
    print(f"{len(ownership_gaps)} candidates", flush=True)

    all_results = {
        "stale_predetermination": stale_predets,
        "high_value_treatment_followup": high_value_tx,
        "assignment_ar": assignment_ar,
        "secondary_coordination": secondary,
        "cdcp_followup": cdcp,
        "missing_documentation": missing_doc,
        "followup_ownership_gap": ownership_gaps,
    }

    print("\n📊 Generating Canada-specific reports...", flush=True)
    write_canada_csvs(all_results)
    summary = collate_canada(all_results)
    report_path = write_canada_summary(summary, all_results)

    return summary, report_path
