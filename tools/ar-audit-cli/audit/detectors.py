from __future__ import annotations
"""
Leakage detection for OpenDental AR audit.

All queries are read-only.
Each function returns a list of dicts representing leakage candidates
in a specific category. Every row includes a `_category` key for tracing.
"""

from datetime import date, datetime
from typing import Any
from mysql.connector import MySQLConnection

from .db import query_all


# ── Helper: claim status descriptions ─────────────────────────────

CLAIM_STATUS_MAP: dict[str, str] = {
    "U": "Not Sent",
    "H": "Hold (Wait Prim)",
    "W": "Waiting to Send",
    "P": "Probably Sent",
    "S": "Sent",
    "R": "Received",
    "I": "Hold (In Process)",
}

CLAIM_PROC_STATUS_MAP: dict[int, str] = {
    0: "Not Received",
    1: "Received",
    2: "Preauth",
    3: "Adjustment",
    4: "Supplemental",
    5: "Cap Claim",
    6: "Estimate",
    7: "Cap Complete",
    8: "Cap Estimate",
    9: "Ins History",
}

PROC_STATUS_MAP: dict[int, str] = {
    1: "TP",
    2: "C",
    3: "EC",
    4: "EO",
    5: "R",
    6: "D",
    7: "Cn",
    8: "TPi",
}


def _today() -> date:
    return date.today()


def _days_since(d: date | None) -> int:
    if d is None:
        return 9999
    return (_today() - d).days


# ── Category 1: Aged Insurance AR ─────────────────────────────────

def detect_aged_ar(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Find claims with outstanding insurance balance, aged by time."""
    now = _today()
    threshold_30 = now.isoformat()
    # We compute age in Python after fetching

    sql = """
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
            c.DateSent,
            c.DateReceived
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimStatus IN ('U', 'H', 'W', 'S', 'R', 'I')
          AND c.ClaimType IN ('P', 'S')
          AND c.ClaimFee > 0
          AND COALESCE(c.InsPayAmt, 0) < c.ClaimFee
        ORDER BY c.DateService ASC
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        date_service = r.get("DateService")
        if isinstance(date_service, datetime):
            date_service = date_service.date()
        est_remaining = float(r["ClaimFee"]) - float(r["InsPayAmt"])
        days_out = _days_since(date_service)

        bucket = "0-30"
        if days_out > 120:
            bucket = "120+"
        elif days_out > 90:
            bucket = "91-120"
        elif days_out > 60:
            bucket = "61-90"
        elif days_out > 30:
            bucket = "31-60"

        results.append({
            "_category": "aged_ar",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(date_service or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": float(r["InsPayAmt"]),
            "EstRemaining": round(est_remaining, 2),
            "DaysOutstanding": days_out,
            "AgingBucket": bucket,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "ClaimType": r["ClaimType"],
            "DateSent": str(r.get("DateSent") or ""),
            "DateReceived": str(r.get("DateReceived") or ""),
        })

    return results


# ── Category 2: Claims With No Payment ────────────────────────────

def detect_no_payment_claims(cnx: MySQLConnection, threshold_days: int = 30) -> list[dict[str, Any]]:
    """Find claims submitted but with no insurance payment recorded."""
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
            c.ClaimType,
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimStatus IN ('P', 'S', 'R', 'I')
          AND c.ClaimType IN ('P', 'S')
          AND c.DateSent IS NOT NULL
          AND c.DateSent > '1900-01-01'
          AND (COALESCE(c.InsPayAmt, 0) = 0)
          AND c.ClaimFee > 0
        ORDER BY c.DateSent ASC
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        date_sent = r.get("DateSent")
        if isinstance(date_sent, datetime):
            date_sent = date_sent.date()
        days_since_sent = _days_since(date_sent)

        if days_since_sent < threshold_days:
            continue

        results.append({
            "_category": "no_payment",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(r.get("DateService") or ""),
            "DateSent": str(r.get("DateSent") or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": 0.0,
            "DaysSinceSent": days_since_sent,
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "ClaimType": r["ClaimType"],
            "ThresholdDays": threshold_days,
        })

    return results


# ── Category 3: Denied or Rejected Claims ─────────────────────────

def detect_denied_claims(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Find claims or claimprocs that appear denied or rejected.

    Signals:
    - ClaimStatus = 'R' with InsPayAmt = 0 (Received but no payment)
    - ClaimStatus = 'I' (in process limbo)
    - ClaimProc status = 0 (NotReceived) after 45+ days since sent
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
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
            c.ClaimStatus,
            c.ClaimType,
            c.DateReceived,
            (SELECT COUNT(*) FROM claimproc cp
             WHERE cp.ClaimNum = c.ClaimNum AND cp.Status = 0) AS UnreceivedProcCount
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE (
            -- Received with zero payment (possible denial)
            (c.ClaimStatus = 'R' AND COALESCE(c.InsPayAmt, 0) <= 0)
            OR
            -- In process limbo > 60 days
            (c.ClaimStatus = 'I' AND c.DateSent IS NOT NULL
             AND c.DateSent > '1900-01-01'
             AND DATEDIFF(CURDATE(), c.DateSent) > 60)
            OR
            -- Sent/received but all claimprocs are unreceived (Status=0)
            (c.ClaimStatus IN ('S', 'R')
             AND c.DateSent IS NOT NULL
             AND c.DateSent > '1900-01-01'
             AND DATEDIFF(CURDATE(), c.DateSent) > 45
             AND COALESCE(c.InsPayAmt, 0) <= 0)
        )
        AND c.ClaimType IN ('P', 'S')
        AND c.ClaimFee > 0
        ORDER BY c.DateSent DESC
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []
    seen = set()

    for r in rows:
        cn = r["ClaimNum"]
        if cn in seen:
            continue
        seen.add(cn)

        date_sent = r.get("DateSent")
        if isinstance(date_sent, datetime):
            date_sent = date_sent.date()
        date_service = r.get("DateService")
        if isinstance(date_service, datetime):
            date_service = date_service.date()

        denial_signal = "Unknown"
        if r["ClaimStatus"] == "R" and float(r["InsPayAmt"]) <= 0:
            denial_signal = "Received with zero payment"
        elif r["ClaimStatus"] == "I" and _days_since(date_sent) > 60:
            denial_signal = "In-process limbo > 60 days"
        elif r["UnreceivedProcCount"] and int(r["UnreceivedProcCount"]) > 0:
            denial_signal = "Unreceived claimprocs after 45+ days"

        results.append({
            "_category": "denied",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(date_service or ""),
            "DateSent": str(date_sent or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": float(r["InsPayAmt"]),
            "ClaimStatus": r["ClaimStatus"],
            "ClaimStatusDesc": CLAIM_STATUS_MAP.get(r["ClaimStatus"], r["ClaimStatus"]),
            "DenialSignal": denial_signal,
            "UnreceivedProcCount": int(r["UnreceivedProcCount"] or 0),
        })

    return results


# ── Category 4: Unfiled Secondary Candidates ──────────────────────

def detect_unfiled_secondary(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Find patients with secondary insurance where primary appears paid
    but no secondary claim is linked or it's unpaid.

    Logic:
    1. Patients with patplan Ordinal = 2 (secondary insurance)
    2. Have primary claims with Received status and InsPayAmt > 0
    3. No secondary claim (ClaimType='S') exists for matching procedures
       - OR secondary claim exists but is unpaid
    """
    sql = """
        SELECT
            p.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car_pri.CarrierName AS PrimaryCarrier,
            car_sec.CarrierName AS SecondaryCarrier,
            ip_sec.PlanNum AS SecPlanNum,
            c_pri.ClaimNum AS PrimaryClaimNum,
            c_pri.ClaimFee AS PrimaryClaimFee,
            COALESCE(c_pri.InsPayAmt, 0) AS PrimaryInsPayAmt,
            c_pri.DateService,
            c_pri.DateReceived,
            c_pri.ClaimStatus AS PrimaryStatus,
            -- Check if secondary claim exists
            (SELECT COUNT(*) FROM claim c2
             WHERE c2.PatNum = p.PatNum
               AND c2.ClaimType = 'S'
               AND c2.PlanNum = ip_sec.PlanNum
               AND c2.DateService = c_pri.DateService) AS HasSecondaryClaim,
            -- Check if any secondary claimproc exists for these procedures
            (SELECT COUNT(*) FROM claimproc cp2
             JOIN claim c2 ON c2.ClaimNum = cp2.ClaimNum
             WHERE c2.PatNum = p.PatNum
               AND c2.ClaimType = 'S'
               AND c2.PlanNum = ip_sec.PlanNum
               AND cp2.ProcNum IN (
                   SELECT cp.ProcNum FROM claimproc cp
                   WHERE cp.ClaimNum = c_pri.ClaimNum AND cp.ProcNum > 0
               )) AS HasSecondaryClaimProc
        FROM patplan pp_sec
        JOIN inssub sub_sec ON sub_sec.InsSubNum = pp_sec.InsSubNum
        JOIN insplan ip_sec ON ip_sec.PlanNum = sub_sec.PlanNum
        LEFT JOIN carrier car_sec ON car_sec.CarrierNum = ip_sec.CarrierNum
        JOIN patient p ON p.PatNum = pp_sec.PatNum
        JOIN patplan pp_pri ON pp_pri.PatNum = p.PatNum AND pp_pri.Ordinal = 1
        JOIN inssub sub_pri ON sub_pri.InsSubNum = pp_pri.InsSubNum
        JOIN insplan ip_pri ON ip_pri.PlanNum = sub_pri.PlanNum
        LEFT JOIN carrier car_pri ON car_pri.CarrierNum = ip_pri.CarrierNum
        JOIN claim c_pri ON c_pri.PatNum = p.PatNum
            AND c_pri.PlanNum = ip_pri.PlanNum
            AND c_pri.ClaimType = 'P'
        WHERE pp_sec.Ordinal = 2
          AND c_pri.ClaimStatus = 'R'
          AND COALESCE(c_pri.InsPayAmt, 0) > 0
          AND p.PatStatus IN (0, 1, 2)  -- Patient, NonPatient, Inactive
        HAVING HasSecondaryClaim = 0 OR HasSecondaryClaimProc = 0
        ORDER BY p.LName, p.FName
        LIMIT 500
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        results.append({
            "_category": "unfiled_secondary",
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "PrimaryCarrier": r["PrimaryCarrier"] or "Unknown",
            "SecondaryCarrier": r["SecondaryCarrier"] or "Unknown",
            "PrimaryClaimNum": r["PrimaryClaimNum"],
            "PrimaryClaimFee": float(r["PrimaryClaimFee"]),
            "PrimaryInsPayAmt": float(r["PrimaryInsPayAmt"]),
            "DateService": str(r.get("DateService") or ""),
            "DateReceived": str(r.get("DateReceived") or ""),
            "PrimaryStatus": r["PrimaryStatus"],
            "HasSecondaryClaim": bool(r["HasSecondaryClaim"]),
            "HasSecondaryClaimProc": bool(r["HasSecondaryClaimProc"]),
            "Note": "Primary paid — secondary may need filing"
                      if not r["HasSecondaryClaim"]
                      else "Secondary claim exists but may be unpaid",
        })

    return results


# ── Category 5: Completed Procedures With No Claim ───────────────

def detect_completed_unbilled(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Find completed procedures that appear insurance-billable but
    have no associated claim.

    This is approximate — flagged as 'Needs Human Review'.

    Logic:
    - procedurelog.ProcStatus = 2 (Complete)
    - Procedure code does NOT have NoBillIns set
    - Patient has insurance (HasIns = 'I')
    - No matching claimproc with ClaimNum > 0
    - Procedure is within last 2 years (to limit noise)
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
            pc.ProcCode,
            pc.Descript AS ProcDescript,
            pc.NoBillIns,
            p.HasIns,
            -- Check if any claimproc links to this procedure
            (SELECT COUNT(*) FROM claimproc cp
             WHERE cp.ProcNum = pl.ProcNum AND cp.ClaimNum > 0) AS ClaimProcCount,
            -- Check if any claimproc exists at all (even estimates)
            (SELECT COUNT(*) FROM claimproc cp
             WHERE cp.ProcNum = pl.ProcNum) AS AnyClaimProcCount,
            p.ClinicNum
        FROM procedurelog pl
        JOIN procedurecode pc ON pc.CodeNum = pl.CodeNum
        JOIN patient p ON p.PatNum = pl.PatNum
        WHERE pl.ProcStatus = 2  -- Complete
          AND pl.ProcFee > 0
          AND (pc.NoBillIns IS NULL OR pc.NoBillIns = 0)
          AND p.HasIns = 'I'
          AND pl.ProcDate > DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
          AND pl.ProcNum > 0
        HAVING ClaimProcCount = 0
        ORDER BY pl.ProcDate DESC
        LIMIT 1000
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        proc_date = r.get("ProcDate")
        if isinstance(proc_date, datetime):
            proc_date = proc_date.date()

        results.append({
            "_category": "completed_unbilled",
            "ProcNum": r["ProcNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "ProcDate": str(proc_date or ""),
            "ProcFee": float(r["ProcFee"]),
            "ProcCode": r["ProcCode"] or "",
            "ProcDescript": r["ProcDescript"] or "",
            "ToothNum": r["ToothNum"] or "",
            "Surf": r["Surf"] or "",
            "AnyClaimProcCount": int(r["AnyClaimProcCount"]),
            "Note": "NEEDS HUMAN REVIEW — no claim found for completed procedure",
        })

    return results


# ── Category 6: Underpayment Candidates ──────────────────────────

def detect_underpayments(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Identify cases where insurance paid significantly less than
    the estimated amount.

    This is experimental — fee schedules and benefit details vary
    widely across OpenDental versions and practice setups.

    Signals:
    - InsPayAmt < InsPayEst * 0.5 (paid less than half of estimate)
    - ClaimProc where InsPayAmt > 0 but significantly below FeeBilled
      without proportional write-off
    """
    sql = """
        SELECT
            c.ClaimNum,
            c.PatNum,
            CONCAT(p.LName, ', ', p.FName) AS PatientName,
            car.CarrierName,
            c.ClaimFee,
            COALESCE(c.InsPayAmt, 0) AS InsPayAmt,
            COALESCE(c.InsPayEst, 0) AS InsPayEst,
            COALESCE(c.WriteOff, 0) AS WriteOff,
            COALESCE(c.DedApplied, 0) AS DedApplied,
            c.ClaimStatus,
            c.ClaimType,
            c.DateService,
            c.DateReceived
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimStatus IN ('R')
          AND c.ClaimType IN ('P', 'S')
          AND c.ClaimFee > 0
          AND COALESCE(c.InsPayEst, 0) > 0
          AND COALESCE(c.InsPayAmt, 0) < COALESCE(c.InsPayEst, 0) * 0.5
          AND (COALESCE(c.InsPayAmt, 0) + COALESCE(c.WriteOff, 0) + COALESCE(c.DedApplied, 0)) < c.ClaimFee * 0.9
        ORDER BY (COALESCE(c.InsPayEst, 0) - COALESCE(c.InsPayAmt, 0)) DESC
        LIMIT 500
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        est = float(r["InsPayEst"])
        actual = float(r["InsPayAmt"])
        underpay = round(est - actual, 2)
        ratio = round(actual / est, 2) if est > 0 else 0

        results.append({
            "_category": "underpayment",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": actual,
            "InsPayEst": est,
            "UnderpaymentAmount": underpay,
            "PayRatio": ratio,
            "WriteOff": float(r["WriteOff"]),
            "DedApplied": float(r["DedApplied"]),
            "ClaimStatus": r["ClaimStatus"],
            "ClaimType": r["ClaimType"],
            "DateService": str(r.get("DateService") or ""),
            "DateReceived": str(r.get("DateReceived") or ""),
            "Note": "EXPERIMENTAL — verify against fee schedule and benefit details",
        })

    return results


# ── Category 7: Dead or Questionable AR ──────────────────────────

def detect_dead_ar(cnx: MySQLConnection) -> list[dict[str, Any]]:
    """Classify claims that may not be recoverable.

    Categories:
    - Very old (> 2 years)
    - Likely patient balance (insurance portion appears fully paid)
    - Zero-dollar or low-value (< $25 remaining)
    - Potential timely filing risk (over 12 months old, unpaid)
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
            c.DateSent
        FROM claim c
        JOIN patient p ON p.PatNum = c.PatNum
        JOIN insplan ip ON ip.PlanNum = c.PlanNum
        LEFT JOIN carrier car ON car.CarrierNum = ip.CarrierNum
        WHERE c.ClaimType IN ('P', 'S')
          AND c.ClaimFee > 0
          AND (
              -- Very old: over 2 years
              (c.DateService < DATE_SUB(CURDATE(), INTERVAL 2 YEAR))
              OR
              -- Over 12 months, unpaid (timely filing risk)
              (c.DateService < DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
               AND c.ClaimStatus IN ('U', 'H', 'W', 'P', 'S')
               AND COALESCE(c.InsPayAmt, 0) = 0)
              OR
              -- Fully paid or close to it (remaining < $25)
              ((COALESCE(c.InsPayAmt, 0) + COALESCE(c.WriteOff, 0) + COALESCE(c.DedApplied, 0))
               >= (c.ClaimFee - 25))
              OR
              -- Old with partial payment but no recent activity
              (c.DateService < DATE_SUB(CURDATE(), INTERVAL 18 MONTH)
               AND COALESCE(c.InsPayAmt, 0) > 0
               AND COALESCE(c.InsPayAmt, 0) < c.ClaimFee)
          )
        ORDER BY c.DateService ASC
    """
    rows = query_all(cnx, sql)
    results: list[dict[str, Any]] = []

    for r in rows:
        date_service = r.get("DateService")
        if isinstance(date_service, datetime):
            date_service = date_service.date()
        est_remaining = float(r["ClaimFee"]) - float(r["InsPayAmt"])
        total_resolved = float(r["InsPayAmt"]) + float(r["WriteOff"]) + float(r["DedApplied"])
        days_old = _days_since(date_service)

        dead_reasons = []
        if days_old > 730:
            dead_reasons.append("Very old (>2 years)")
        if days_old > 365 and float(r["InsPayAmt"]) == 0 and r["ClaimStatus"] in ("U", "H", "W", "P", "S"):
            dead_reasons.append("Timely filing risk (>12 months unpaid)")
        if total_resolved >= (float(r["ClaimFee"]) - 25):
            dead_reasons.append("Likely fully resolved/patient balance")
        if days_old > 540 and float(r["InsPayAmt"]) > 0 and float(r["InsPayAmt"]) < float(r["ClaimFee"]):
            dead_reasons.append("Stale partial payment (>18 months)")

        results.append({
            "_category": "dead_ar",
            "ClaimNum": r["ClaimNum"],
            "PatNum": r["PatNum"],
            "PatientName": r["PatientName"],
            "CarrierName": r["CarrierName"] or "Unknown",
            "DateService": str(date_service or ""),
            "ClaimFee": float(r["ClaimFee"]),
            "InsPayAmt": float(r["InsPayAmt"]),
            "EstRemaining": round(est_remaining, 2),
            "WriteOff": float(r["WriteOff"]),
            "DedApplied": float(r["DedApplied"]),
            "DaysOld": days_old,
            "ClaimStatus": r["ClaimStatus"],
            "DeadReasons": "; ".join(dead_reasons),
        })

    return results


# ── Priority Score ───────────────────────────────────────────────

def compute_priority_score(row: dict) -> float:
    """Compute a simple priority score for sorting recovery candidates.

    Formula:
        base = estimated_balance_weight  (0-40)
        + age_weight                     (0-25)
        + carrier_weight                 (0-15)
        + status_weight                  (0-20)
        - dead_ar_risk                   (0-30 penalty)

    Returns 0-100 scale. Higher = more urgent.
    """
    est_remaining = row.get("EstRemaining", 0) or 0
    days_out = row.get("DaysOutstanding", 0) or 0
    status_code = row.get("ClaimStatus", "")
    claim_type = row.get("ClaimType", "")

    # Balance weight (0-40): bigger balance = higher priority
    if est_remaining <= 0:
        balance_weight = 0
    elif est_remaining < 50:
        balance_weight = 5
    elif est_remaining < 200:
        balance_weight = 15
    elif est_remaining < 500:
        balance_weight = 25
    elif est_remaining < 1000:
        balance_weight = 35
    else:
        balance_weight = 40

    # Age weight (0-25): older = higher priority (up to a point)
    if days_out <= 0:
        age_weight = 0
    elif days_out < 30:
        age_weight = 5
    elif days_out < 60:
        age_weight = 10
    elif days_out < 90:
        age_weight = 15
    elif days_out < 120:
        age_weight = 20
    else:
        age_weight = 25

    # Status weight (0-20): actionable claims = higher
    # Uses raw ClaimStatus codes (S, R, U, etc.)
    if status_code in ("S", "P"):
        status_weight = 15  # Sent, Probably Sent
    elif status_code == "R":
        status_weight = 20  # Received — response received, take action
    elif status_code in ("U", "W"):
        status_weight = 10  # Not Sent, Waiting to Send
    elif status_code == "H":
        status_weight = 8   # Hold (Wait Prim)
    else:
        status_weight = 5   # I (Hold in Process) or unknown

    # Secondary claims have slightly higher priority
    # (already went through primary, closer to resolution)
    carrier_weight = 10 if claim_type == "S" else 15

    # Dead AR penalty (0-30)
    dead_reasons = row.get("DeadReasons", "")
    dead_penalty = 0
    if dead_reasons:
        if "Very old" in dead_reasons:
            dead_penalty += 15
        if "Timely filing" in dead_reasons:
            dead_penalty += 20
        if "resolved" in dead_reasons:
            dead_penalty += 30
        if "Stale partial" in dead_reasons:
            dead_penalty += 10

    score = balance_weight + age_weight + carrier_weight + status_weight - dead_penalty
    return max(0, min(100, score))
