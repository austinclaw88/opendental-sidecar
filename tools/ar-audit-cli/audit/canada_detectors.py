"""
Canada-specific leakage detectors for OpenDental AR audit.

Focuses on insurance/predetermination follow-up leakage common in
Canadian dental practices using CDAnet.

All queries are read-only. Each function returns a list of dicts
with a `_category` key for tracing.

Schema assumptions (OpenDental v24.3):
  - Predeterminations: claim.ClaimType = 'PreAuth'
  - Preauth claimprocs: claimproc.Status = 2
  - Treatment planned procs: procedurelog.ProcStatus = 1 (TP)
  - `treatplan` and `treatplanattach` may not exist
  - `document`, `sheet` tables may not exist
  - CDCP detection is heuristic based on plan/carrier name patterns
  - Assignment detection is heuristic
"""

from datetime import date, datetime, timedelta
from typing import Any, Optional
from mysql.connector import MySQLConnection

from .db import query_all
from .detectors import CLAIM_STATUS_MAP, CLAIM_PROC_STATUS_MAP

# ── Helpers ──────────────────────────────────────────────────────

TODAY = date.today()


def _days_since(d: Optional[date]) -> int:
    if d is None:
        return 9999
    return (TODAY - d).days


def _safe_date(val: Any) -> Optional[date]:
    """Convert a datetime/date/None to date or None."""
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    return None


# Known CDCP plan name patterns (Canadian Dental Care Plan)
CDCP_PATTERNS = [
    "cdcp", "canadian dental care", "dental care plan",
    "soins dentaires", "regime canadien", "plan canadien",
    "sun life", "sunlife",  # Sun Life administers CDCP
    "government of canada", "gouvernement du canada",
    "canada dental", "dentaire canada",
]


def _is_cdcp_carrier(name: Optional[str]) -> bool:
    if not name:
        return False
    nl = name.lower()
    return any(p in nl for p in CDCP_PATTERNS)


# ── Category 1: Stale Predeterminations ──────────────────────────

def detect_stale_predeterminations(
    cnx: MySQLConnection,
    stale_days: int = 14,
) -> list[dict[str, Any]]:
    """Find predeterminations that are pending, stale, or unresolved.

    OpenDental stores predeterminations in the claim table with
    ClaimType='PreAuth'. ClaimProc.Status=2 indicates preauth.
    """
    sql = """
        SELECT
            c.ClaimNum,
            c.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car.CarrierName,
            c.DateService,
            c.DateSent,
            c.ClaimFee,
            c.ClaimStatus,
            c.InsPayEst,
            pc.ProcCode,
            pc.Descript AS ProcDescript,
            pl.ToothNum,
            pl.Surf,
            (
                SELECT GROUP_CONCAT(DISTINCT cp2.CodeSent SEPARATOR ', ')
                FROM claimproc cp2
                WHERE cp2.ClaimNum = c.ClaimNum
                  AND cp2.Status = 2
            ) AS PreauthCodes,
            (
                SELECT GROUP_CONCAT(DISTINCT pc2.Descript SEPARATOR '; ')
                FROM claimproc cp2
                JOIN procedurelog pl2 ON pl2.ProcNum = cp2.ProcNum
                JOIN procedurecode pc2 ON pc2.CodeNum = pl2.CodeNum
                WHERE cp2.ClaimNum = c.ClaimNum
                  AND cp2.Status = 2
            ) AS PreauthDescriptions,
            (
                SELECT COUNT(*) FROM appointment a
                WHERE a.PatNum = c.PatNum
                  AND a.AptStatus = 1  -- Scheduled
                  AND a.AptDateTime > CURDATE()
            ) AS HasFutureAppointment,
            (
                SELECT COUNT(*) FROM commlog cl
                WHERE cl.PatNum = c.PatNum
                  AND cl.CommDateTime > DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            ) AS RecentCommCount
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        LEFT JOIN claimproc cp ON cp.ClaimNum = c.ClaimNum AND cp.Status = 2
        LEFT JOIN procedurelog pl ON pl.ProcNum = cp.ProcNum
        LEFT JOIN procedurecode pc ON pc.CodeNum = pl.CodeNum
        WHERE c.ClaimType = 'PreAuth'
          AND c.ClaimFee > 0
          AND c.ClaimStatus IN ('P', 'S', 'R')
        ORDER BY c.DateService DESC
    """
    rows = query_all(cnx, sql)
    seen = {}
    results = []

    for r in rows:
        cn = r["ClaimNum"]
        if cn in seen:
            continue
        seen[cn] = True

        ds = _safe_date(r.get("DateService"))
        days_out = _days_since(ds)

        # Categorize staleness
        if days_out > 60:
            stale_level = "critical"
        elif days_out > 30:
            stale_level = "overdue"
        elif days_out > stale_days:
            stale_level = "stale"
        else:
            stale_level = "recent"

        # Priority based on value and age
        fee = float(r["ClaimFee"] or 0)

        results.append({
            "_category": "stale_predetermination",
            "ClaimNum": cn,
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(ds or ""),
            "DateSent": str(_safe_date(r.get("DateSent")) or ""),
            "ClaimFee": fee,
            "InsPayEst": float(r["InsPayEst"] or 0),
            "DaysOutstanding": days_out,
            "StaleLevel": stale_level,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "PreauthCodes": r["PreauthCodes"] or "",
            "PreauthDescriptions": r["PreauthDescriptions"] or "",
            "ProcCode": r["ProcCode"] or "",
            "ProcDescript": r["ProcDescript"] or "",
            "ToothNum": r["ToothNum"] or "",
            "Surf": r["Surf"] or "",
            "HasFutureAppointment": bool(r["HasFutureAppointment"]),
            "RecentCommCount": int(r["RecentCommCount"] or 0),
        })

    return results


# ── Category 2: High-Value Treatment Follow-Up ───────────────────

def detect_high_value_treatment_followup(
    cnx: MySQLConnection,
    min_fee: float = 1000.0,
) -> list[dict[str, Any]]:
    """Find high-value treatment-planned procedures without clear follow-up.

    Uses procedurelog.ProcStatus=1 (TP) as a proxy for treatment plans
    when treatplan table is unavailable.
    """
    sql = """
        SELECT
            pl.ProcNum,
            pl.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            pl.ProcDate,
            pl.ProcFee,
            pl.ToothNum,
            pl.Surf,
            pl.ProvNum,
            pl.CodeNum,
            pl.PlannedAptNum,
            pc.ProcCode,
            pc.Descript AS ProcDescript,
            p.PriProv,
            prov.Abbr AS ProviderAbbr,
            p.HasIns,
            (
                SELECT COUNT(*) FROM appointment a
                WHERE a.PatNum = p.PatNum
                  AND a.AptStatus = 1  -- Scheduled
                  AND (pl.PlannedAptNum = 0 OR a.AptNum != pl.PlannedAptNum)
            ) AS OtherScheduledAppts,
            (
                SELECT COUNT(*) FROM appointment a
                WHERE a.AptNum = pl.PlannedAptNum
                  AND a.AptStatus = 1
            ) AS PlannedApptScheduled,
            (
                SELECT COUNT(*) FROM commlog cl
                WHERE cl.PatNum = p.PatNum
                  AND cl.CommDateTime > DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            ) AS RecentCommCount,
            (
                SELECT COUNT(*) FROM claimproc cp
                JOIN claim c ON c.ClaimNum = cp.ClaimNum
                WHERE cp.ProcNum = pl.ProcNum
                  AND c.ClaimType = 'PreAuth'
            ) AS HasPredetermination,
            (
                SELECT COALESCE(MAX(c.InsPayEst), 0) FROM claimproc cp
                JOIN claim c ON c.ClaimNum = cp.ClaimNum
                WHERE cp.ProcNum = pl.ProcNum
                  AND c.ClaimType = 'PreAuth'
            ) AS PredetInsPayEst
        FROM procedurelog pl
        JOIN procedurecode pc ON pc.CodeNum = pl.CodeNum
        JOIN patient p ON p.PatNum = pl.PatNum
        LEFT JOIN provider prov ON prov.ProvNum = p.PriProv
        WHERE pl.ProcStatus = 1  -- TP (Treatment Planned)
          AND pl.ProcFee >= %(min_fee)s
          AND pl.ProcDate > DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
          AND p.PatStatus IN (0, 1, 2)
        ORDER BY pl.ProcFee DESC
        LIMIT 500
    """
    rows = query_all(cnx, sql, {"min_fee": min_fee})
    results = []

    for r in rows:
        proc_date = _safe_date(r.get("ProcDate"))
        days_since_tp = _days_since(proc_date)
        fee = float(r["ProcFee"] or 0)

        # Value tier
        if fee >= 5000:
            value_tier = "premium"
        elif fee >= 3000:
            value_tier = "high"
        elif fee >= 1000:
            value_tier = "medium"
        else:
            value_tier = "standard"

        # Follow-up gap signals
        has_planned_appt = bool(r["PlannedApptScheduled"])
        has_other_appts = bool(r["OtherScheduledAppts"])
        has_recent_comm = int(r["RecentCommCount"] or 0) > 0
        has_predet = bool(r["HasPredetermination"])

        followup_gap = "none"
        if has_planned_appt:
            followup_gap = "scheduled"
        elif has_other_appts or has_recent_comm:
            followup_gap = "possible"
        elif days_since_tp > 90:
            followup_gap = "critical"
        elif days_since_tp > 30:
            followup_gap = "aging"
        elif days_since_tp > 14:
            followup_gap = "recent"

        results.append({
            "_category": "high_value_treatment_followup",
            "ProcNum": r["ProcNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "ProcDate": str(proc_date or ""),
            "ProcFee": fee,
            "ValueTier": value_tier,
            "ProcCode": r["ProcCode"] or "",
            "ProcDescript": r["ProcDescript"] or "",
            "ToothNum": r["ToothNum"] or "",
            "Surf": r["Surf"] or "",
            "ProviderAbbr": r["ProviderAbbr"] or "",
            "DaysSincePlanned": days_since_tp,
            "FollowUpGap": followup_gap,
            "HasPredetermination": has_predet,
            "PredetInsPayEst": float(r["PredetInsPayEst"] or 0),
            "HasPlannedAppointment": has_planned_appt,
            "HasOtherAppointments": has_other_appts,
            "HasRecentCommunication": has_recent_comm,
            "HasInsurance": r["HasIns"] == 'I' if r.get("HasIns") else False,
        })

    return results


# ── Category 3: Assignment AR Candidates ─────────────────────────

def detect_assignment_ar(
    cnx: MySQLConnection,
) -> list[dict[str, Any]]:
    """Identify aging insurance balances that suggest assignment AR.

    Assignment of benefits (insurance pays dentist directly) is common
    in Canada. Without a dedicated schema flag, we approximate by
    looking at claims where:
    - Insurance has an outstanding balance
    - Claim is over 30 days old
    - No clear patient payment (paysplit) covering the balance
    """
    sql = """
        SELECT
            c.ClaimNum,
            c.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car.CarrierName,
            c.DateService,
            c.ClaimFee,
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
            COALESCE(c.WriteOff, 0) AS WriteOff,
            COALESCE(c.DedApplied, 0) AS DedApplied,
            c.ClaimStatus,
            c.ClaimType,
            c.DateSent,
            (
                SELECT COALESCE(SUM(ps.SplitAmt), 0)
                FROM paysplit ps
                JOIN payment pmt ON pmt.PayNum = ps.PayNum
                WHERE ps.PatNum = c.PatNum
                  AND ps.ProcNum IN (
                      SELECT cp.ProcNum FROM claimproc cp
                      WHERE cp.ClaimNum = c.ClaimNum AND cp.ProcNum > 0
                  )
            ) AS PatientPayments,
            (
                SELECT COUNT(*) FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 1
            ) AS ReceivedProcCount,
            (
                SELECT COUNT(*) FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 0
            ) AS UnreceivedProcCount
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimType IN ('P', 'S')
          AND c.ClaimFee > 0
          AND c.ClaimStatus IN ('S', 'R')
          AND COALESCE(c.InsPayAmt, 0) < c.ClaimFee
          AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
          AND c.DateService > '1900-01-01'
          AND c.ClaimFee - COALESCE(c.InsPayAmt, 0) - COALESCE(c.WriteOff, 0) - COALESCE(c.DedApplied, 0) > 25
        ORDER BY c.DateService DESC
        LIMIT 500
    """
    rows = query_all(cnx, sql)
    results = []

    for r in rows:
        ds = _safe_date(r.get("DateService"))
        days_out = _days_since(ds)
        ins_balance = float(r["ClaimFee"]) - float(r["InsPayAmt"])
        net_receivable = ins_balance - float(r["PatientPayments"] or 0)

        if net_receivable <= 25:
            continue

        # Aging bucket
        if days_out > 90:
            bucket = "90+"
        elif days_out > 60:
            bucket = "61-90"
        elif days_out > 30:
            bucket = "31-60"
        else:
            bucket = "0-30"

        results.append({
            "_category": "assignment_ar",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(ds or ""),
            "DateSent": str(_safe_date(r.get("DateSent")) or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": float(r["InsPayAmt"]),
            "WriteOff": float(r["WriteOff"]),
            "DedApplied": float(r["DedApplied"]),
            "PatientPayments": float(r["PatientPayments"] or 0),
            "InsuranceBalance": round(ins_balance, 2),
            "NetReceivable": round(net_receivable, 2),
            "DaysOutstanding": days_out,
            "AgingBucket": bucket,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "ClaimType": r["ClaimType"],
            "ReceivedProcCount": int(r["ReceivedProcCount"] or 0),
            "UnreceivedProcCount": int(r["UnreceivedProcCount"] or 0),
            "Note": "APPROXIMATE — assignment status inferred from insurance balance pattern",
        })

    return results


# ── Category 4: Secondary Coordination Candidates ────────────────

def detect_secondary_coordination(
    cnx: MySQLConnection,
) -> list[dict[str, Any]]:
    """Find patients with multiple insurance plans where coordination
    may need attention.

    Detects:
    - Primary paid, secondary unpaid (expand on existing logic)
    - COB rule mismatches or unclear order
    - Duplicate coverage gaps
    """
    sql = """
        SELECT
            p.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            COUNT(DISTINCT pp.PatPlanNum) AS PlanCount,
            GROUP_CONCAT(DISTINCT car.CarrierName SEPARATOR ' / ') AS AllCarriers,
            MIN(pp.Ordinal) AS PrimaryOrdinal,
            MAX(pp.Ordinal) AS MaxOrdinal,
            ip.CobRule,
            (
                SELECT COALESCE(SUM(c.ClaimFee), 0)
                FROM claim c
                WHERE c.PatNum = p.PatNum
                  AND c.ClaimType = 'P'
                  AND c.ClaimStatus = 'R'
                  AND COALESCE(c.InsPayAmt, 0) > 0
                  AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ) AS PaidPrimaryFees,
            (
                SELECT COUNT(*)
                FROM claim c
                WHERE c.PatNum = p.PatNum
                  AND c.ClaimType = 'S'
                  AND c.ClaimStatus = 'R'
                  AND COALESCE(c.InsPayAmt, 0) > 0
                  AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
            ) AS PaidSecondaryCount,
            (
                SELECT COALESCE(SUM(c.ClaimFee), 0)
                FROM claim c
                WHERE c.PatNum = p.PatNum
                  AND c.ClaimType = 'P'
                  AND c.ClaimStatus = 'R'
                  AND COALESCE(c.InsPayAmt, 0) > 0
                  AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
                  AND NOT EXISTS (
                      SELECT 1 FROM claim c2
                      WHERE c2.PatNum = c.PatNum
                        AND c2.ClaimType = 'S'
                        AND c2.DateService = c.DateService
                  )
            ) AS PrimaryPaidNoSecondaryFees
        FROM patplan pp
        JOIN inssub sub ON sub.InsSubNum = pp.InsSubNum
        JOIN insplan ip ON ip.PlanNum = sub.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        JOIN patient p ON p.PatNum = pp.PatNum
        WHERE p.PatStatus IN (0, 1, 2)
        GROUP BY p.PatNum, p.LName, p.FName, ip.CobRule
        HAVING PlanCount >= 2
        ORDER BY p.LName
        LIMIT 500
    """
    rows = query_all(cnx, sql)
    results = []

    for r in rows:
        paid_primary = float(r["PaidPrimaryFees"] or 0)
        paid_secondary_count = int(r["PaidSecondaryCount"] or 0)
        primary_no_secondary = float(r["PrimaryPaidNoSecondaryFees"] or 0)

        # Determine coordination issue type
        issues = []
        if primary_no_secondary > 0:
            issues.append(f"${primary_no_secondary:,.2f} primary paid, no secondary claim filed")
        if paid_primary > 0 and paid_secondary_count == 0:
            issues.append("No secondary claims found in last year")

        results.append({
            "_category": "secondary_coordination",
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "PlanCount": int(r["PlanCount"]),
            "AllCarriers": r["AllCarriers"] or "",
            "CobRule": r["CobRule"] if r.get("CobRule") else "Unknown",
            "PaidPrimaryFees": paid_primary,
            "PaidSecondaryCount": paid_secondary_count,
            "PrimaryPaidNoSecondaryFees": primary_no_secondary,
            "Issues": "; ".join(issues) if issues else "No issues detected — verify coordination",
        })

    return results


# ── Category 5: CDCP Follow-Up Candidates ────────────────────────

def detect_cdcp_followup(
    cnx: MySQLConnection,
) -> list[dict[str, Any]]:
    """Identify potential CDCP-related cases needing follow-up.

    CDCP (Canadian Dental Care Plan) is administered by Sun Life.
    Detection is heuristic: carrier name matching CDCP/Sun Life
    patterns combined with claim status signals.
    """
    sql = """
        SELECT
            c.ClaimNum,
            c.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car.CarrierName,
            ip.GroupName,
            c.DateService,
            c.DateSent,
            c.ClaimFee,
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
            COALESCE(c.InsPayEst, 0) AS InsPayEst,
            c.ClaimStatus,
            c.ClaimType,
            (
                SELECT COUNT(*) FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 0
            ) AS UnreceivedProcs,
            (
                SELECT COUNT(*) FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 1
            ) AS ReceivedProcs,
            (
                SELECT COUNT(*) FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 4
            ) AS SupplementalProcs,
            (
                SELECT COALESCE(MAX(cp.DateCP), '1900-01-01') FROM claimproc cp
                WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 1
            ) AS LastPaymentDate
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimType IN ('P', 'S', 'PreAuth')
          AND c.ClaimFee > 0
          AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
          AND (
              LOWER(car.CarrierName) LIKE '%sun%life%'
              OR LOWER(car.CarrierName) LIKE '%cdcp%'
              OR LOWER(car.CarrierName) LIKE '%canadian dental care%'
              OR LOWER(car.CarrierName) LIKE '%soins dentaires%'
              OR LOWER(car.CarrierName) LIKE '%regime canadien%'
          )
        ORDER BY c.DateService DESC
        LIMIT 500
    """
    rows = query_all(cnx, sql)
    results = []

    for r in rows:
        ds = _safe_date(r.get("DateService"))
        days_out = _days_since(ds)
        fee = float(r["ClaimFee"] or 0)
        paid = float(r["InsPayAmt"] or 0)
        est = float(r["InsPayEst"] or 0)

        # Determine CDCP follow-up category
        if paid <= 0 and r["ClaimType"] == "PreAuth":
            followup_reason = "Predetermination — no response yet"
        elif paid <= 0 and r["ClaimStatus"] in ("S", "R"):
            followup_reason = "Claim sent, no payment received"
        elif paid > 0 and paid < fee * 0.5:
            followup_reason = "Possible partial/underpayment"
        elif paid > 0 and int(r["UnreceivedProcs"] or 0) > 0:
            followup_reason = "Partial payment with unreceived line items"
        elif est > 0 and paid < est * 0.8:
            followup_reason = "Paid below estimate"
        else:
            followup_reason = "Routine — verify status"

        results.append({
            "_category": "cdcp_followup",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"],
            "GroupName": r.get("GroupName") or "",
            "DateService": str(ds or ""),
            "DateSent": str(_safe_date(r.get("DateSent")) or ""),
            "ClaimFee": fee,
            "InsPayAmt": paid,
            "InsPayEst": est,
            "BalanceRemaining": round(fee - paid, 2),
            "DaysOutstanding": days_out,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "ClaimType": r["ClaimType"],
            "FollowUpReason": followup_reason,
            "UnreceivedProcs": int(r["UnreceivedProcs"] or 0),
            "ReceivedProcs": int(r["ReceivedProcs"] or 0),
            "SupplementalProcs": int(r["SupplementalProcs"] or 0),
        })

    return results


# ── Category 6: Missing Documentation Candidates ──────────────────

def detect_missing_documentation(
    cnx: MySQLConnection,
) -> list[dict[str, Any]]:
    """Find claims or predeterminations that may be missing supporting
    documentation (radiographs, narratives, photos, etc.).

    Detects two patterns:
    1. Claims with empty ClaimNote for document-heavy procedures
       (crowns, bridges, implants, perio, endo, surgery, ortho, major restorative)
    2. Claims with no document/sheet attachments at patient level

    Note: `document` and `sheet` tables may not exist.
    Procedure-code-based heuristic always works regardless.
    """
    # Check if document/sheet tables exist
    table_check = query_all(cnx, """
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('document', 'sheet', 'task')
    """)
    has_doc_table = any(r["TABLE_NAME"] == "document" for r in table_check)
    has_sheet_table = any(r["TABLE_NAME"] == "sheet" for r in table_check)
    has_task_table = any(r["TABLE_NAME"] == "task" for r in table_check)

    # D-code patterns for document-heavy procedures
    # Crowns: D62xx-D68xx, Bridges: D62xx-D69xx, Implants: D60xx-D61xx
    # Perio: D42xx-D43xx, Endo: D31xx-D33xx, Surgery: D71xx-D79xx
    # Ortho: D80xx-D89xx, Major restorative: D62xx-D69xx, D27xx-D29xx
    doc_heavy_patterns = [
        ("Crown", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D62%' OR pc.ProcCode LIKE 'D67%' OR pc.ProcCode LIKE 'D68%' OR pc.ProcCode LIKE 'D27%' OR pc.ProcCode LIKE 'D29%'"),
        ("Bridge", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D62%' OR pc.ProcCode LIKE 'D69%' OR pc.ProcCode LIKE 'D67%'"),
        ("Implant", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D60%' OR pc.ProcCode LIKE 'D61%' OR pc.ProcCode LIKE 'D79%'"),
        ("Perio", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D42%' OR pc.ProcCode LIKE 'D43%' OR pc.ProcCode LIKE 'D49%'"),
        ("Endo", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D31%' OR pc.ProcCode LIKE 'D33%' OR pc.ProcCode LIKE 'D34%'"),
        ("Oral Surgery", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D71%' OR pc.ProcCode LIKE 'D72%' OR pc.ProcCode LIKE 'D73%' OR pc.ProcCode LIKE 'D74%' OR pc.ProcCode LIKE 'D75%' OR pc.ProcCode LIKE 'D79%'"),
        ("Ortho", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D80%' OR pc.ProcCode LIKE 'D81%' OR pc.ProcCode LIKE 'D82%' OR pc.ProcCode LIKE 'D86%' OR pc.ProcCode LIKE 'D87%' OR pc.ProcCode LIKE 'D89%'"),
        ("Major Restorative", "c.ClaimNote", "COALESCE(c.ClaimNote,'') = ''",
         "pc.ProcCode LIKE 'D62%' OR pc.ProcCode LIKE 'D65%' OR pc.ProcCode LIKE 'D66%' OR pc.ProcCode LIKE 'D67%' OR pc.ProcCode LIKE 'D68%' OR pc.ProcCode LIKE 'D69%'"),
    ]

    seen = set()
    results = []

    # Approach 1: Check claims with document-heavy procedure codes and empty notes
    for category, _, empty_note_check, proc_pattern in doc_heavy_patterns:
        sql = f"""
            SELECT DISTINCT
                c.ClaimNum,
                c.PatNum,
                CONCAT(p.LName, ', ', p.FName) AS PatientName,
                car.CarrierName,
                c.DateService,
                c.ClaimFee,
                COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
                c.ClaimStatus,
                c.ClaimType,
                GROUP_CONCAT(DISTINCT pc.ProcCode SEPARATOR ', ') AS ProcCodes,
                GROUP_CONCAT(DISTINCT pc.Descript SEPARATOR '; ') AS ProcDescripts
            FROM claim c
            JOIN claimproc cp ON cp.ClaimNum = c.ClaimNum AND cp.ProcNum > 0
            JOIN procedurelog pl ON pl.ProcNum = cp.ProcNum
            JOIN procedurecode pc ON pc.CodeNum = pl.CodeNum
            JOIN patient p ON p.PatNum = c.PatNum
            JOIN insplan ip ON ip.PlanNum = c.PlanNum
            LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
            WHERE c.ClaimType IN ('P', 'S', 'PreAuth')
              AND c.ClaimFee > 0
              AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
              AND ({empty_note_check})
              AND ({proc_pattern})
            GROUP BY c.ClaimNum, c.PatNum, p.LName, p.FName, car.CarrierName,
                     c.DateService, c.ClaimFee, c.InsPayAmt, c.ClaimStatus, c.ClaimType
            LIMIT 100
        """
        for r in query_all(cnx, sql):
            cn = r["ClaimNum"]
            if cn in seen:
                continue
            seen.add(cn)

            missing_reasons = [f"Empty ClaimNote for {category} procedure"]

            results.append({
                "_category": "missing_documentation",
                "ClaimNum": cn,
                "PatNum": r["PatNum"],
                "PatientName": r["PatientName"],
                "CarrierName": r["CarrierName"] or "Unknown",
                "DateService": str(_safe_date(r.get("DateService")) or ""),
                "ClaimFee": float(r["ClaimFee"]),
                "InsPayAmt": float(r["InsPayAmt"]),
                "ClaimStatus": r["ClaimStatus"],
                "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
                "ClaimType": r["ClaimType"],
                "ProcCodes": r["ProcCodes"] or "",
                "ProcDescripts": r["ProcDescripts"] or "",
                "MissingReasons": "; ".join(missing_reasons),
                "HasDocumentTable": has_doc_table,
                "HasSheetTable": has_sheet_table,
                "HasTaskTable": has_task_table,
                "Note": "APPROXIMATE — procedure code indicates documentation likely needed",
            })

    # Approach 2: Check for claims with no patient-level documents (if table exists)
    if has_doc_table:
        doc_sql = """
            SELECT
                c.ClaimNum,
                c.PatNum,
                CONCAT(p.LName, ', ', p.FName) AS PatientName,
                car.CarrierName,
                c.DateService,
                c.ClaimFee,
                COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
                c.ClaimStatus,
                c.ClaimType,
                (SELECT COUNT(*) FROM document doc WHERE doc.PatNum = c.PatNum) AS DocCount,
                CASE WHEN TRIM(COALESCE(c.ClaimNote, '')) = '' THEN 1 ELSE 0 END AS HasEmptyNote
            FROM claim c
            JOIN patient p ON p.PatNum = c.PatNum
            JOIN insplan ip ON ip.PlanNum = c.PlanNum
            LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
            WHERE c.ClaimFee > 500
              AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
              AND c.ClaimType IN ('P', 'S', 'PreAuth')
            HAVING DocCount = 0
            ORDER BY c.ClaimFee DESC
            LIMIT 100
        """
        for r in query_all(cnx, doc_sql):
            cn = r["ClaimNum"]
            if cn in seen:
                continue
            seen.add(cn)

            missing_reasons = []
            if r.get("HasEmptyNote", 0):
                missing_reasons.append("Empty ClaimNote")
            missing_reasons.append("No documents found for this patient")

            results.append({
                "_category": "missing_documentation",
                "ClaimNum": cn,
                "PatNum": r["PatNum"],
                "PatientName": r["PatientName"],
                "CarrierName": r["CarrierName"] or "Unknown",
                "DateService": str(_safe_date(r.get("DateService")) or ""),
                "ClaimFee": float(r["ClaimFee"]),
                "InsPayAmt": float(r["InsPayAmt"]),
                "ClaimStatus": r["ClaimStatus"],
                "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
                "ClaimType": r["ClaimType"],
                "ProcCodes": "",
                "ProcDescripts": "",
                "MissingReasons": "; ".join(missing_reasons),
                "HasDocumentTable": has_doc_table,
                "HasSheetTable": has_sheet_table,
                "HasTaskTable": has_task_table,
                "Note": "APPROXIMATE — document/sheet availability varies by OpenDental version",
            })

    return results


# ── Category 7: Priority Score (Canada-specific) ─────────────────

# ── Category 7: Follow-Up Ownership Gaps ─────────────────────────

def detect_followup_ownership_gaps(
    cnx: MySQLConnection,
) -> list[dict[str, Any]]:
    """Identify cases where no recent follow-up, no task, or no
    next action appears visible after a predetermination was sent
    or a claim was filed.

    Uses commlog and appointment data. Tasks are checked if the
    task table exists.
    """
    # Check task table availability
    table_check = query_all(cnx, """
        SELECT TABLE_NAME
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN ('task', 'tasklist')
    """)
    has_task_table = any(r["TABLE_NAME"] == "task" for r in table_check)

    # Find predeterminations / claims sent but with no follow-up
    task_subquery = ""
    if has_task_table:
        task_subquery = """
            , (
                SELECT COUNT(*) FROM task t
                WHERE t.KeyNum = c.ClaimNum
                  AND t.TaskStatus != 4  -- not completed
            ) AS OpenTaskCount
        """

    sql = f"""
        SELECT
            c.ClaimNum,
            c.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car.CarrierName,
            c.DateService,
            c.DateSent,
            c.ClaimFee,
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
            c.ClaimStatus,
            c.ClaimType,
            (
                SELECT COUNT(*) FROM commlog cl
                WHERE cl.PatNum = c.PatNum
                  AND cl.CommDateTime > DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            ) AS RecentCommCount,
            (
                SELECT MAX(cl.CommDateTime) FROM commlog cl
                WHERE cl.PatNum = c.PatNum
            ) AS LastCommDate,
            (
                SELECT COUNT(*) FROM appointment a
                WHERE a.PatNum = c.PatNum
                  AND a.AptStatus = 1  -- Scheduled
                  AND a.AptDateTime > CURDATE()
            ) AS FutureApptCount
            {task_subquery}
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimType IN ('PreAuth', 'P', 'S')
          AND c.ClaimFee > 0
          AND c.DateService > DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
          AND c.ClaimStatus IN ('S', 'P', 'R', 'U', 'W')
        ORDER BY c.ClaimFee DESC
        LIMIT 300
    """
    rows = query_all(cnx, sql)
    results = []

    for r in rows:
        ds_service = _safe_date(r.get("DateService"))
        ds_sent = _safe_date(r.get("DateSent"))
        days_since_sent = _days_since(ds_sent) if ds_sent else _days_since(ds_service)
        recent_comm = int(r["RecentCommCount"] or 0)
        future_appts = int(r["FutureApptCount"] or 0)
        open_tasks = int(r.get("OpenTaskCount", 0)) if has_task_table else -1

        # Determine gap signals
        gap_signals = []
        if recent_comm == 0:
            gap_signals.append("No communication in 60 days")
        if future_appts == 0 and r["ClaimType"] == "PreAuth":
            gap_signals.append("Predet with no scheduled appointment")
        if has_task_table and open_tasks == 0:
            gap_signals.append("No open tasks for this claim")
        elif has_task_table and open_tasks > 0:
            # Has tasks — not a gap
            continue

        if not gap_signals:
            continue

        results.append({
            "_category": "followup_ownership_gap",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(ds_service or ""),
            "DateSent": str(ds_sent or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": float(r["InsPayAmt"]),
            "DaysSinceSent": days_since_sent,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "ClaimType": r["ClaimType"],
            "GapSignals": "; ".join(gap_signals),
            "RecentCommCount": recent_comm,
            "FutureApptCount": future_appts,
            "HasTaskTable": has_task_table,
            "OpenTaskCount": open_tasks,
            "LastCommDate": str(_safe_date(r.get("LastCommDate")) or "Never"),
        })

    return results


# ── Category 8: Updated Priority Score (Canada) ─────────────────

def compute_canada_priority_score(row: dict) -> float:
    """Compute a priority score for Canada case follow-up candidates.

    Factors (0-100):
    - Dollar value weight (0-25): higher fee = more urgent
    - Days stale weight (0-20): longer wait = more urgent
    - High-value treatment weight (0-15): planned tx with predet = higher
    - Secondary coordination weight (0-10): multi-plan gap = higher
    - CDCP flag weight (0-10): CDCP uncertainty = higher
    - Missing documentation weight (0-10): doc gap = higher
    - No recent follow-up weight (0-10): no comm/appt = higher
    - Low confidence penalty (0-20): subtract for uncertain categories

    Returns 0-100 scale.
    """
    proc_fee = float(row.get("ProcFee", row.get("ClaimFee", 0)) or 0)
    days_out = row.get("DaysOutstanding", row.get("DaysSincePlanned", 0)) or 0
    gap = row.get("FollowUpGap", row.get("StaleLevel", ""))
    has_predet = row.get("HasPredetermination", False)
    category = row.get("_category", "")
    gap_signals = row.get("GapSignals", "")

    # ── Dollar value weight (0-25) ──────────────────────────────
    if proc_fee >= 5000:
        value_weight = 25
    elif proc_fee >= 3000:
        value_weight = 20
    elif proc_fee >= 1500:
        value_weight = 15
    elif proc_fee >= 500:
        value_weight = 8
    elif proc_fee > 0:
        value_weight = 4
    else:
        value_weight = 0

    # ── Days stale weight (0-20) ────────────────────────────────
    if days_out >= 180:
        age_weight = 20
    elif days_out >= 120:
        age_weight = 16
    elif days_out >= 90:
        age_weight = 12
    elif days_out >= 60:
        age_weight = 8
    elif days_out >= 30:
        age_weight = 5
    elif days_out >= 14:
        age_weight = 3
    else:
        age_weight = 0

    # ── High-value treatment weight (0-15) ──────────────────────
    # Planned high-value cases with predets = most actionable
    if has_predet and proc_fee >= 1000:
        tx_weight = 15
    elif proc_fee >= 3000:
        tx_weight = 12  # High value even without predet
    elif proc_fee >= 1000:
        tx_weight = 8
    elif has_predet:
        tx_weight = 5
    else:
        tx_weight = 0

    # ── Secondary coordination weight (0-10) ────────────────────
    has_issue = bool(row.get("Issues", ""))
    plan_count = int(row.get("PlanCount", 1) or 1)
    if has_issue and plan_count >= 2:
        coord_weight = 10
    elif plan_count >= 2:
        coord_weight = 5
    else:
        coord_weight = 0

    # ── CDCP flag weight (0-10) ─────────────────────────────────
    carrier_name = (row.get("CarrierName", "") or "").lower()
    is_cdcp = any(p in carrier_name for p in CDCP_PATTERNS)
    if is_cdcp:
        if days_out > 60:
            cdcp_weight = 10
        elif days_out > 30:
            cdcp_weight = 8
        else:
            cdcp_weight = 5
    else:
        cdcp_weight = 0

    # ── Missing documentation weight (0-10) ─────────────────────
    missing_reasons = row.get("MissingReasons", "")
    if missing_reasons:
        if "Empty ClaimNote" in missing_reasons and proc_fee > 1000:
            doc_weight = 10
        elif "Empty ClaimNote" in missing_reasons:
            doc_weight = 6
        else:
            doc_weight = 4
    else:
        doc_weight = 0

    # ── No recent follow-up weight (0-10) ───────────────────────
    if gap_signals:
        if "No communication" in gap_signals and "no scheduled" in gap_signals:
            followup_weight = 10
        elif "No communication" in gap_signals:
            followup_weight = 7
        elif "no scheduled" in gap_signals:
            followup_weight = 5
        else:
            followup_weight = 3
    else:
        # Use the gap tier from existing detection
        if gap in ("critical", "overdue"):
            followup_weight = 8
        elif gap in ("aging", "stale"):
            followup_weight = 5
        elif gap in ("recent", "possible"):
            followup_weight = 2
        else:
            followup_weight = 0

    # ── Low confidence penalty (0-20) ───────────────────────────
    penalty = 0
    note = row.get("Note", "") or ""
    if "APPROXIMATE" in note:
        penalty += 10
    if category == "assignment_ar":
        penalty += 5  # Assignment is inferred
    if category == "cdcp_followup" and not is_cdcp:
        penalty += 5
    if category == "missing_documentation" and not row.get("HasDocumentTable", True):
        penalty += 8  # No document table to verify

    score = (
        value_weight + age_weight + tx_weight + coord_weight
        + cdcp_weight + doc_weight + followup_weight - penalty
    )
    return max(0, min(100, score))
