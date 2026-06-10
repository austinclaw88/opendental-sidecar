#!/usr/bin/env python3
"""
OpenDental Insurance & Predetermination Follow-Up Audit CLI

Read-only audit tool for Canadian OpenDental practices that identifies
both US-style AR leakage and Canada-specific insurance/predetermination
follow-up leakage.

Produces reports to audit-output/.

Usage:
    export OPENDENTAL_CONNECTION_STRING="Server=localhost;Port=3306;Database=opendental;User=readonly;Password=..."
    python3 ar_audit_cli.py

    # Skip Canada audit for US practices
    python3 ar_audit_cli.py --ar-only

    # Custom output directory
    python3 ar_audit_cli.py --output ./my-audit

    # Canada-only audit
    python3 ar_audit_cli.py --canada-only
"""

import argparse
import sys
import os
from datetime import datetime

from audit.db import get_connection_string, parse_connection_string, connect_db
from audit.detectors import (
    detect_aged_ar,
    detect_no_payment_claims,
    detect_denied_claims,
    detect_unfiled_secondary,
    detect_completed_unbilled,
    detect_underpayments,
    detect_dead_ar,
)
from audit import reporters


def main():
    parser = argparse.ArgumentParser(
        description="OpenDental Insurance & Predetermination Follow-Up Audit CLI",
    )
    parser.add_argument(
        "--output", "-o",
        default=reporters.OUTPUT_DIR,
        help=f"Output directory (default: {reporters.OUTPUT_DIR})",
    )
    parser.add_argument(
        "--threshold", "-t",
        type=int,
        default=30,
        help="Days threshold for no-payment detection (default: 30)",
    )
    parser.add_argument(
        "--connection-string",
        help="MySQL connection string (overrides OPENDENTAL_CONNECTION_STRING env var)",
    )
    parser.add_argument(
        "--ar-only",
        action="store_true",
        help="Run only the US-style AR leakage audit (skip Canada-specific detectors)",
    )
    parser.add_argument(
        "--canada-only",
        action="store_true",
        help="Run only the Canada-specific follow-up audit (skip AR leakage)",
    )
    args = parser.parse_args()

    reporters.OUTPUT_DIR = args.output

    # ── Database connection ──────────────────────────────────────
    print("🔌 Connecting to OpenDental database...", flush=True)
    try:
        conn_str = args.connection_string or get_connection_string()
        params = parse_connection_string(conn_str)
        cnx = connect_db(params)
        print(f"   ✓ Connected to {params['host']}:{params['port']}/{params['database']}", flush=True)
    except ValueError as e:
        print(f"   ✗ {e}", file=sys.stderr, flush=True)
        sys.exit(1)
    except Exception as e:
        print(f"   ✗ Connection failed: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    run_ar = not args.canada_only
    run_ca = not args.ar_only

    start = datetime.now()

    # ── Standard AR Audit ────────────────────────────────────────
    if run_ar:
        print(f"\n🔍 Running AR leakage detectors (threshold: {args.threshold}d)...", flush=True)

        print("   [1/7] Aged insurance AR...", end=" ", flush=True)
        aged_ar = detect_aged_ar(cnx)
        print(f"{len(aged_ar)} claims", flush=True)

        print("   [2/7] Claims with no payment...", end=" ", flush=True)
        no_payment = detect_no_payment_claims(cnx, args.threshold)
        print(f"{len(no_payment)} claims", flush=True)

        print("   [3/7] Denied/rejected claims...", end=" ", flush=True)
        denied = detect_denied_claims(cnx)
        print(f"{len(denied)} claims", flush=True)

        print("   [4/7] Unfiled secondary candidates...", end=" ", flush=True)
        unfiled_sec = detect_unfiled_secondary(cnx)
        print(f"{len(unfiled_sec)} candidates", flush=True)

        print("   [5/7] Completed unbilled procedures...", end=" ", flush=True)
        completed_unbilled = detect_completed_unbilled(cnx)
        print(f"{len(completed_unbilled)} procedures", flush=True)

        print("   [6/7] Underpayment candidates...", end=" ", flush=True)
        underpayments = detect_underpayments(cnx)
        print(f"{len(underpayments)} claims", flush=True)

        print("   [7/7] Dead/questionable AR...", end=" ", flush=True)
        dead_ar = detect_dead_ar(cnx)
        print(f"{len(dead_ar)} claims", flush=True)

        all_results = {
            "aged_ar": aged_ar,
            "no_payment": no_payment,
            "denied": denied,
            "unfiled_secondary": unfiled_sec,
            "completed_unbilled": completed_unbilled,
            "underpayment": underpayments,
            "dead_ar": dead_ar,
        }

        print(f"\n📊 Generating AR reports...", flush=True)
        summary, report_path = reporters.write_all_reports(all_results)
        s = summary["summary"]

        print(f"\n{'='*55}", flush=True)
        print(f"  AR LEAKAGE AUDIT COMPLETE", flush=True)
        print(f"{'='*55}", flush=True)
        print(f"  Visible Insurance AR:       ${s['visible_insurance_ar']:>10,.2f}", flush=True)
        print(f"  Likely Recoverable:         ${s['likely_recoverable_candidates']:>10,.2f}", flush=True)
        print(f"  Questionable / Dead AR:     ${s['questionable_dead_ar']:>10,.2f}", flush=True)
        print(f"  High-Priority Claims:       {s['high_priority_claim_count']:>10}", flush=True)
    else:
        print("   ⏭️  Skipping AR leakage audit (--canada-only)", flush=True)

    # ── Canada-Specific Audit ────────────────────────────────────
    if run_ca:
        from audit.canada_reporters import run_canada_audit

        print(f"\n🍁 Running Canada-specific follow-up detectors...", flush=True)
        ca_summary, ca_report_path = run_canada_audit(cnx, args.output)
        cs = ca_summary["summary"]

        print(f"\n{'='*55}", flush=True)
        print(f"  CANADA FOLLOW-UP AUDIT COMPLETE", flush=True)
        print(f"{'='*55}", flush=True)
        print(f"  Stale Predeterminations:     {cs['total_stale_predeterminations']:>10}  (${cs['total_predet_value']:>10,.2f})", flush=True)
        print(f"  High-Value Tx Plans:         {cs['total_high_value_treatment_plans']:>10}  (${cs['total_tx_value']:>10,.2f})", flush=True)
        print(f"  Assignment AR Candidates:    {cs['total_assignment_ar_candidates']:>10}  (${cs['total_assignment_ar_balance']:>10,.2f})", flush=True)
        print(f"  CDCP Follow-Up Candidates:   {cs['total_cdcp_candidates']:>10}", flush=True)
        print(f"  Missing Documentation:       {cs['total_missing_documentation']:>10}", flush=True)
    else:
        print("\n   ⏭️  Skipping Canada audit (--ar-only)", flush=True)

    elapsed = (datetime.now() - start).total_seconds()
    print(f"\n{'='*55}", flush=True)
    print(f"  Total duration: {elapsed:.1f}s", flush=True)
    print(f"  📁 Reports: {args.output}/", flush=True)
    print(f"{'='*55}", flush=True)
    print()

    cnx.close()


if __name__ == "__main__":
    main()
