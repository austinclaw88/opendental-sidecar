#!/usr/bin/env python3
"""
Generate sample output for the AR Audit CLI using synthetic data.

This script creates realistic-looking OpenDental-like data in-memory,
runs the full audit pipeline against it, and writes sample output files.

Usage:
    python3 sample/gen_seed_output.py

Output: sample-output/ar_leakage_summary.md (and CSVs)
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, datetime, timedelta
from collections import defaultdict
from audit.detectors import (
    detect_aged_ar,
    detect_no_payment_claims,
    detect_denied_claims,
    detect_unfiled_secondary,
    detect_completed_unbilled,
    detect_underpayments,
    detect_dead_ar,
)
from audit.reporters import OUTPUT_DIR, write_all_reports
from audit.db import connect_db, query_all

# ── Import mysql connector for fake cursor support ───────────────
import mysql.connector

SAMPLE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sample-output")


# ── Fake result set helper ───────────────────────────────────────

def fake_rows(rows: list[dict]):
    """Return a function that acts like query_all returning given rows."""
    return rows


# ── Generate realistic seed data ─────────────────────────────────

TODAY = date(2026, 6, 10)

CARRIERS = [
    "Delta Dental PPO", "Delta Dental Premier", "Cigna Dental PPO",
    "MetLife PDP", "Guardian Dental", "Aetna Dental", "Sun Life",
    "Canada Life", "Green Shield", "Manulife",
]

PATIENTS = [
    (1, "Smith, John"), (2, "Johnson, Sarah"), (3, "Williams, Mike"),
    (4, "Brown, Emily"), (5, "Jones, David"), (6, "Garcia, Maria"),
    (7, "Miller, James"), (8, "Davis, Lisa"), (9, "Rodriguez, Carlos"),
    (10, "Martinez, Anna"), (11, "Anderson, Robert"), (12, "Taylor, Susan"),
    (13, "Thomas, Kevin"), (14, "Jackson, Rachel"), (15, "White, Daniel"),
]

def gen_aged_ar():
    rows = []
    for i, (pid, pname) in enumerate(PATIENTS):
        carrier = CARRIERS[i % len(CARRIERS)]
        days = [35, 75, 150, 45, 180, 25, 95, 200, 60, 120, 15, 85, 300, 50, 140][i]
        fee = [250.0, 480.0, 1200.0, 175.0, 2200.0, 350.0, 650.0, 890.0, 525.0, 1600.0, 300.0, 780.0, 1450.0, 420.0, 950.0][i]
        paid = [200.0, 0.0, 400.0, 125.0, 1800.0, 300.0, 500.0, 0.0, 400.0, 1250.0, 275.0, 600.0, 300.0, 350.0, 750.0][i]
        ds = TODAY - timedelta(days=days)
        bucket = "120+"
        if days <= 30: bucket = "0-30"
        elif days <= 60: bucket = "31-60"
        elif days <= 90: bucket = "61-90"
        elif days <= 120: bucket = "91-120"

        remaining = round(fee - paid, 2)
        statuses = ['R', 'S', 'S', 'R', 'S', 'R', 'S', 'U', 'R', 'R', 'W', 'S', 'S', 'R', 'U']
        types = ['P', 'P', 'P', 'S', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'P', 'P', 'S']

        rows.append({
            "_category": "aged_ar",
            "ClaimNum": 1000 + i,
            "PatNum": pid,
            "PatientName": pname,
            "CarrierName": carrier,
            "DateService": ds.isoformat(),
            "ClaimFee": fee,
            "InsPayAmt": paid,
            "EstRemaining": remaining,
            "DaysOutstanding": days,
            "AgingBucket": bucket,
            "ClaimStatus": statuses[i],
            "ClaimStatusDesc": {"R":"Received","S":"Sent","U":"Not Sent","W":"Waiting to Send","I":"Hold (In Process)"}.get(statuses[i], ""),
            "ClaimType": types[i],
            "DateSent": (ds + timedelta(days=3)).isoformat() if days > 3 else "",
            "DateReceived": (ds + timedelta(days=14)).isoformat() if days > 14 else "",
        })
    return rows

def gen_no_payment():
    return [
        {"_category": "no_payment", "ClaimNum": 2001, "PatNum": 2, "PatientName": "Johnson, Sarah", "CarrierName": "Delta Dental PPO", "DateService": "2025-12-15", "DateSent": "2025-12-20", "ClaimFee": 480.0, "InsPayAmt": 0.0, "DaysSinceSent": 172, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ThresholdDays": 30},
        {"_category": "no_payment", "ClaimNum": 2002, "PatNum": 8, "PatientName": "Davis, Lisa", "CarrierName": "Aetna Dental", "DateService": "2026-01-10", "DateSent": "2026-01-15", "ClaimFee": 890.0, "InsPayAmt": 0.0, "DaysSinceSent": 146, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ThresholdDays": 30},
        {"_category": "no_payment", "ClaimNum": 2003, "PatNum": 15, "PatientName": "White, Daniel", "CarrierName": "Manulife", "DateService": "2026-02-05", "DateSent": "2026-02-08", "ClaimFee": 950.0, "InsPayAmt": 0.0, "DaysSinceSent": 122, "ClaimStatus": "U", "ClaimStatusDesc": "Not Sent", "ClaimType": "S", "ThresholdDays": 30},
        {"_category": "no_payment", "ClaimNum": 2004, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Cigna Dental PPO", "DateService": "2026-03-01", "DateSent": "2026-03-05", "ClaimFee": 1200.0, "InsPayAmt": 0.0, "DaysSinceSent": 97, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ThresholdDays": 30},
        {"_category": "no_payment", "ClaimNum": 2005, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Guardian Dental", "DateService": "2026-04-12", "DateSent": "2026-04-15", "ClaimFee": 650.0, "InsPayAmt": 0.0, "DaysSinceSent": 56, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ThresholdDays": 30},
    ]

def gen_denied():
    return [
        {"_category": "denied", "ClaimNum": 3001, "PatNum": 4, "PatientName": "Brown, Emily", "CarrierName": "MetLife PDP", "DateService": "2025-11-20", "DateSent": "2025-11-25", "ClaimFee": 175.0, "InsPayAmt": 0.0, "ClaimStatus": "R", "ClaimStatusDesc": "Received", "DenialSignal": "Received with zero payment", "UnreceivedProcCount": 2},
        {"_category": "denied", "ClaimNum": 3002, "PatNum": 11, "PatientName": "Anderson, Robert", "CarrierName": "Canada Life", "DateService": "2025-10-05", "DateSent": "2025-10-10", "ClaimFee": 300.0, "InsPayAmt": 0.0, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "DenialSignal": "Unreceived claimprocs after 45+ days", "UnreceivedProcCount": 1},
        {"_category": "denied", "ClaimNum": 3003, "PatNum": 14, "PatientName": "Jackson, Rachel", "CarrierName": "Sun Life", "DateService": "2025-09-15", "DateSent": "2025-09-20", "ClaimFee": 420.0, "InsPayAmt": 0.0, "ClaimStatus": "I", "ClaimStatusDesc": "Hold (In Process)", "DenialSignal": "In-process limbo > 60 days", "UnreceivedProcCount": 0},
    ]

def gen_unfiled_secondary():
    return [
        {"_category": "unfiled_secondary", "PatNum": 4, "PatientName": "Brown, Emily", "PrimaryCarrier": "MetLife PDP", "SecondaryCarrier": "Guardian Dental", "PrimaryClaimNum": 1004, "PrimaryClaimFee": 175.0, "PrimaryInsPayAmt": 125.0, "DateService": "2026-04-10", "DateReceived": "2026-04-28", "PrimaryStatus": "R", "HasSecondaryClaim": False, "HasSecondaryClaimProc": False, "Note": "Primary paid — secondary may need filing"},
        {"_category": "unfiled_secondary", "PatNum": 9, "PatientName": "Rodriguez, Carlos", "PrimaryCarrier": "Delta Dental Premier", "SecondaryCarrier": "Aetna Dental", "PrimaryClaimNum": 1009, "PrimaryClaimFee": 525.0, "PrimaryInsPayAmt": 400.0, "DateService": "2026-03-05", "DateReceived": "2026-03-22", "PrimaryStatus": "R", "HasSecondaryClaim": True, "HasSecondaryClaimProc": False, "Note": "Secondary claim exists but may be unpaid"},
    ]

def gen_completed_unbilled():
    return [
        {"_category": "completed_unbilled", "ProcNum": 5001, "PatNum": 6, "PatientName": "Garcia, Maria", "ProcDate": "2026-05-15", "ProcFee": 350.0, "ProcCode": "D2391", "ProcDescript": "Resin composite, one surface, posterior", "ToothNum": "30", "Surf": "O", "AnyClaimProcCount": 0, "Note": "NEEDS HUMAN REVIEW — no claim found for completed procedure"},
        {"_category": "completed_unbilled", "ProcNum": 5002, "PatNum": 12, "PatientName": "Taylor, Susan", "ProcDate": "2026-05-10", "ProcFee": 275.0, "ProcCode": "D2330", "ProcDescript": "Resin composite, one surface, anterior", "ToothNum": "9", "Surf": "M", "AnyClaimProcCount": 0, "Note": "NEEDS HUMAN REVIEW — no claim found for completed procedure"},
    ]

def gen_underpayments():
    return [
        {"_category": "underpayment", "ClaimNum": 1003, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Cigna Dental PPO", "ClaimFee": 1200.0, "InsPayAmt": 400.0, "InsPayEst": 900.0, "UnderpaymentAmount": 500.0, "PayRatio": 0.44, "WriteOff": 100.0, "DedApplied": 50.0, "ClaimStatus": "R", "ClaimType": "P", "DateService": "2026-01-10", "DateReceived": "2026-02-01", "Note": "EXPERIMENTAL — verify against fee schedule and benefit details"},
        {"_category": "underpayment", "ClaimNum": 1005, "PatNum": 5, "PatientName": "Jones, David", "CarrierName": "Delta Dental PPO", "ClaimFee": 2200.0, "InsPayAmt": 1800.0, "InsPayEst": 2000.0, "UnderpaymentAmount": 200.0, "PayRatio": 0.9, "WriteOff": 150.0, "DedApplied": 100.0, "ClaimStatus": "R", "ClaimType": "P", "DateService": "2025-12-01", "DateReceived": "2025-12-20", "Note": "EXPERIMENTAL — verify against fee schedule and benefit details"},
    ]

def gen_dead_ar():
    return [
        {"_category": "dead_ar", "ClaimNum": 4001, "PatNum": 13, "PatientName": "Thomas, Kevin", "CarrierName": "Green Shield", "DateService": "2022-08-15", "ClaimFee": 1450.0, "InsPayAmt": 300.0, "EstRemaining": 1150.0, "WriteOff": 200.0, "DedApplied": 100.0, "DaysOld": 1394, "ClaimStatus": "R", "DeadReasons": "Very old (>2 years); Stale partial payment (>18 months)"},
        {"_category": "dead_ar", "ClaimNum": 4002, "PatNum": 1, "PatientName": "Smith, John", "CarrierName": "Delta Dental PPO", "DateService": "2023-06-01", "ClaimFee": 250.0, "InsPayAmt": 200.0, "EstRemaining": 50.0, "WriteOff": 30.0, "DedApplied": 20.0, "DaysOld": 1099, "ClaimStatus": "R", "DeadReasons": "Very old (>2 years); Likely fully resolved/patient balance"},
        {"_category": "dead_ar", "ClaimNum": 4003, "PatNum": 6, "PatientName": "Garcia, Maria", "CarrierName": "Sun Life", "DateService": "2024-12-01", "ClaimFee": 350.0, "InsPayAmt": 0.0, "EstRemaining": 350.0, "WriteOff": 0.0, "DedApplied": 0.0, "DaysOld": 556, "ClaimStatus": "U", "DeadReasons": "Timely filing risk (>12 months unpaid)"},
    ]


# ── Canada-specific sample data ──────────────────────────────────

CANADIAN_CARRIERS = [
    "Sun Life", "Canada Life", "Green Shield Canada", "Manulife",
    "Sun Life Financial", "CDCP",
]

def gen_stale_predets():
    return [
        {"_category": "stale_predetermination", "ClaimNum": 10001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "DateService": "2025-12-15", "DateSent": "2025-12-18", "ClaimFee": 4800.0, "InsPayEst": 3500.0, "DaysOutstanding": 177, "StaleLevel": "critical", "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "PreauthCodes": "D6240,D6750", "PreauthDescriptions": "Porc crown; Porc crown high noble", "ProcCode": "D6240", "ProcDescript": "Porcelain crown", "ToothNum": "14", "Surf": "", "HasFutureAppointment": False, "RecentCommCount": 0},
        {"_category": "stale_predetermination", "ClaimNum": 10002, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Canada Life", "DateService": "2026-02-01", "DateSent": "2026-02-05", "ClaimFee": 3200.0, "InsPayEst": 2100.0, "DaysOutstanding": 129, "StaleLevel": "critical", "ClaimStatus": "R", "ClaimStatusDesc": "Received", "PreauthCodes": "D5211,D5110", "PreauthDescriptions": "Max partial denture; Complete denture mand", "ProcCode": "D5211", "ProcDescript": "Maxillary partial denture", "ToothNum": "", "Surf": "", "HasFutureAppointment": False, "RecentCommCount": 1},
        {"_category": "stale_predetermination", "ClaimNum": 10003, "PatNum": 10, "PatientName": "Martinez, Anna", "CarrierName": "Sun Life", "DateService": "2026-04-10", "DateSent": "2026-04-12", "ClaimFee": 1800.0, "InsPayEst": 1400.0, "DaysOutstanding": 61, "StaleLevel": "overdue", "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "PreauthCodes": "D2750,D2950", "PreauthDescriptions": "Crown PFM high; Core bld up inc pins", "ProcCode": "D2750", "ProcDescript": "Crown — porcelain fused to high noble metal", "ToothNum": "19", "Surf": "", "HasFutureAppointment": False, "RecentCommCount": 0},
        {"_category": "stale_predetermination", "ClaimNum": 10004, "PatNum": 13, "PatientName": "Thomas, Kevin", "CarrierName": "Green Shield Canada", "DateService": "2026-05-01", "DateSent": "2026-05-03", "ClaimFee": 2500.0, "InsPayEst": 1800.0, "DaysOutstanding": 40, "StaleLevel": "stale", "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "PreauthCodes": "D7210", "PreauthDescriptions": "Extraction erupted tooth", "ProcCode": "D7210", "ProcDescript": "Extraction, erupted tooth requiring removal", "ToothNum": "1", "Surf": "", "HasFutureAppointment": True, "RecentCommCount": 2},
        {"_category": "stale_predetermination", "ClaimNum": 10005, "PatNum": 5, "PatientName": "Jones, David", "CarrierName": "Manulife", "DateService": "2026-05-20", "DateSent": "2026-05-22", "ClaimFee": 6500.0, "InsPayEst": 5200.0, "DaysOutstanding": 21, "StaleLevel": "stale", "ClaimStatus": "P", "ClaimStatusDesc": "Probably Sent", "PreauthCodes": "D7220,D7230", "PreauthDescriptions": "Molar extraction; Impacted wisdom tooth", "ProcCode": "D7220", "ProcDescript": "Extraction, impacted tooth, soft tissue", "ToothNum": "16", "Surf": "", "HasFutureAppointment": False, "RecentCommCount": 0},
    ]

def gen_high_value_tx():
    return [
        {"_category": "high_value_treatment_followup", "ProcNum": 6001, "PatNum": 3, "PatientName": "Williams, Mike", "ProcDate": "2025-12-15", "ProcFee": 4800.0, "ValueTier": "high", "ProcCode": "D6240", "ProcDescript": "Porcelain crown", "ToothNum": "14", "Surf": "", "ProviderAbbr": "JSM", "DaysSincePlanned": 177, "FollowUpGap": "critical", "HasPredetermination": True, "PredetInsPayEst": 3500.0, "HasPlannedAppointment": False, "HasOtherAppointments": False, "HasRecentCommunication": False, "HasInsurance": True},
        {"_category": "high_value_treatment_followup", "ProcNum": 6002, "PatNum": 10, "PatientName": "Martinez, Anna", "ProcDate": "2026-04-10", "ProcFee": 1800.0, "ValueTier": "medium", "ProcCode": "D2750", "ProcDescript": "Crown PFM high noble", "ToothNum": "19", "Surf": "", "ProviderAbbr": "JSM", "DaysSincePlanned": 61, "FollowUpGap": "aging", "HasPredetermination": True, "PredetInsPayEst": 1400.0, "HasPlannedAppointment": False, "HasOtherAppointments": False, "HasRecentCommunication": False, "HasInsurance": True},
        {"_category": "high_value_treatment_followup", "ProcNum": 6003, "PatNum": 5, "PatientName": "Jones, David", "ProcDate": "2026-05-20", "ProcFee": 6500.0, "ValueTier": "premium", "ProcCode": "D7220", "ProcDescript": "Surgical extraction", "ToothNum": "16", "Surf": "", "ProviderAbbr": "AC", "DaysSincePlanned": 21, "FollowUpGap": "recent", "HasPredetermination": True, "PredetInsPayEst": 5200.0, "HasPlannedAppointment": False, "HasOtherAppointments": False, "HasRecentCommunication": False, "HasInsurance": True},
        {"_category": "high_value_treatment_followup", "ProcNum": 6004, "PatNum": 8, "PatientName": "Davis, Lisa", "ProcDate": "2026-03-01", "ProcFee": 3500.0, "ValueTier": "high", "ProcCode": "D5225", "ProcDescript": "Lower partial denture", "ToothNum": "", "Surf": "", "ProviderAbbr": "JSM", "DaysSincePlanned": 101, "FollowUpGap": "critical", "HasPredetermination": False, "PredetInsPayEst": 0.0, "HasPlannedAppointment": False, "HasOtherAppointments": True, "HasRecentCommunication": False, "HasInsurance": True},
        {"_category": "high_value_treatment_followup", "ProcNum": 6005, "PatNum": 15, "PatientName": "White, Daniel", "ProcDate": "2026-04-05", "ProcFee": 1500.0, "ValueTier": "medium", "ProcCode": "D4341", "ProcDescript": "Periodontal scaling and root planing", "ToothNum": "", "Surf": "", "ProviderAbbr": "DH", "DaysSincePlanned": 66, "FollowUpGap": "aging", "HasPredetermination": False, "PredetInsPayEst": 0.0, "HasPlannedAppointment": False, "HasOtherAppointments": False, "HasRecentCommunication": True, "HasInsurance": True},
    ]

def gen_assignment_ar():
    return [
        {"_category": "assignment_ar", "ClaimNum": 11001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "DateService": "2025-12-10", "DateSent": "2025-12-14", "ClaimFee": 1200.0, "InsPayAmt": 0.0, "WriteOff": 0.0, "DedApplied": 0.0, "PatientPayments": 200.0, "InsuranceBalance": 1200.0, "NetReceivable": 1000.0, "DaysOutstanding": 182, "AgingBucket": "90+", "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ReceivedProcCount": 0, "UnreceivedProcCount": 3, "Note": "APPROXIMATE"},
        {"_category": "assignment_ar", "ClaimNum": 11002, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Canada Life", "DateService": "2026-01-15", "DateSent": "2026-01-20", "ClaimFee": 890.0, "InsPayAmt": 0.0, "WriteOff": 0.0, "DedApplied": 0.0, "PatientPayments": 0.0, "InsuranceBalance": 890.0, "NetReceivable": 890.0, "DaysOutstanding": 146, "AgingBucket": "90+", "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "ReceivedProcCount": 0, "UnreceivedProcCount": 2, "Note": "APPROXIMATE"},
        {"_category": "assignment_ar", "ClaimNum": 11003, "PatNum": 13, "PatientName": "Thomas, Kevin", "CarrierName": "Green Shield Canada", "DateService": "2026-03-05", "DateSent": "2026-03-08", "ClaimFee": 1450.0, "InsPayAmt": 300.0, "WriteOff": 100.0, "DedApplied": 50.0, "PatientPayments": 0.0, "InsuranceBalance": 1150.0, "NetReceivable": 1150.0, "DaysOutstanding": 97, "AgingBucket": "90+", "ClaimStatus": "R", "ClaimStatusDesc": "Received", "ClaimType": "P", "ReceivedProcCount": 1, "UnreceivedProcCount": 1, "Note": "APPROXIMATE"},
        {"_category": "assignment_ar", "ClaimNum": 11004, "PatNum": 10, "PatientName": "Martinez, Anna", "CarrierName": "Sun Life", "DateService": "2026-04-01", "DateSent": "2026-04-05", "ClaimFee": 1600.0, "InsPayAmt": 800.0, "WriteOff": 200.0, "DedApplied": 100.0, "PatientPayments": 100.0, "InsuranceBalance": 800.0, "NetReceivable": 700.0, "DaysOutstanding": 70, "AgingBucket": "61-90", "ClaimStatus": "R", "ClaimStatusDesc": "Received", "ClaimType": "P", "ReceivedProcCount": 2, "UnreceivedProcCount": 0, "Note": "APPROXIMATE"},
    ]

def gen_secondary_coordination():
    return [
        {"_category": "secondary_coordination", "PatNum": 4, "PatientName": "Brown, Emily", "PlanCount": 2, "AllCarriers": "Sun Life / Manulife", "CobRule": "Standard", "PaidPrimaryFees": 2450.0, "PaidSecondaryCount": 0, "PrimaryPaidNoSecondaryFees": 1200.0, "Issues": "$1,200.00 primary paid, no secondary claim filed"},
        {"_category": "secondary_coordination", "PatNum": 9, "PatientName": "Rodriguez, Carlos", "PlanCount": 2, "AllCarriers": "Canada Life / Sun Life", "CobRule": "Coordinated", "PaidPrimaryFees": 3800.0, "PaidSecondaryCount": 0, "PrimaryPaidNoSecondaryFees": 3800.0, "Issues": "$3,800.00 primary paid, no secondary claim filed; No secondary claims found in last year"},
        {"_category": "secondary_coordination", "PatNum": 12, "PatientName": "Taylor, Susan", "PlanCount": 2, "AllCarriers": "Green Shield Canada / Manulife", "CobRule": "Standard", "PaidPrimaryFees": 900.0, "PaidSecondaryCount": 1, "PrimaryPaidNoSecondaryFees": 350.0, "Issues": "$350.00 primary paid, no secondary claim filed"},
    ]

def gen_cdcp_followup():
    return [
        {"_category": "cdcp_followup", "ClaimNum": 12001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "GroupName": "CDCP", "DateService": "2025-12-10", "DateSent": "2025-12-14", "ClaimFee": 4800.0, "InsPayAmt": 0.0, "InsPayEst": 3500.0, "BalanceRemaining": 4800.0, "DaysOutstanding": 182, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "PreAuth", "FollowUpReason": "Predetermination — no response yet", "UnreceivedProcs": 2, "ReceivedProcs": 0, "SupplementalProcs": 0},
        {"_category": "cdcp_followup", "ClaimNum": 12002, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Sun Life Financial", "GroupName": "Federal Plan", "DateService": "2026-01-15", "DateSent": "2026-01-20", "ClaimFee": 890.0, "InsPayAmt": 0.0, "InsPayEst": 650.0, "BalanceRemaining": 890.0, "DaysOutstanding": 146, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "FollowUpReason": "Claim sent, no payment received", "UnreceivedProcs": 2, "ReceivedProcs": 0, "SupplementalProcs": 0},
        {"_category": "cdcp_followup", "ClaimNum": 12003, "PatNum": 13, "PatientName": "Thomas, Kevin", "CarrierName": "Sun Life", "GroupName": "CDCP", "DateService": "2026-03-05", "DateSent": "2026-03-08", "ClaimFee": 1450.0, "InsPayAmt": 300.0, "InsPayEst": 1200.0, "BalanceRemaining": 1150.0, "DaysOutstanding": 97, "ClaimStatus": "R", "ClaimStatusDesc": "Received", "ClaimType": "P", "FollowUpReason": "Paid below estimate", "UnreceivedProcs": 1, "ReceivedProcs": 1, "SupplementalProcs": 0},
    ]

def gen_ownership_gaps():
    return [
        {"_category": "followup_ownership_gap", "ClaimNum": 10001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "DateService": "2025-12-15", "DateSent": "2025-12-18", "ClaimFee": 4800.0, "InsPayAmt": 0.0, "DaysSinceSent": 174, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "PreAuth", "GapSignals": "No communication in 60 days; Predet with no scheduled appointment; No open tasks for this claim", "RecentCommCount": 0, "FutureApptCount": 0, "HasTaskTable": True, "OpenTaskCount": 0, "LastCommDate": "Never"},
        {"_category": "followup_ownership_gap", "ClaimNum": 10002, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Canada Life", "DateService": "2026-02-01", "DateSent": "2026-02-05", "ClaimFee": 3200.0, "InsPayAmt": 0.0, "DaysSinceSent": 125, "ClaimStatus": "R", "ClaimStatusDesc": "Received", "ClaimType": "PreAuth", "GapSignals": "No communication in 60 days; Predet with no scheduled appointment; No open tasks for this claim", "RecentCommCount": 1, "FutureApptCount": 0, "HasTaskTable": True, "OpenTaskCount": 0, "LastCommDate": "2026-05-01"},
        {"_category": "followup_ownership_gap", "ClaimNum": 11001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "DateService": "2025-12-10", "DateSent": "2025-12-14", "ClaimFee": 1200.0, "InsPayAmt": 0.0, "DaysSinceSent": 178, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "GapSignals": "No communication in 60 days; No open tasks for this claim", "RecentCommCount": 0, "FutureApptCount": 0, "HasTaskTable": True, "OpenTaskCount": 0, "LastCommDate": "Never"},
    ]


def gen_missing_doc():
    return [
        {"_category": "missing_documentation", "ClaimNum": 10001, "PatNum": 3, "PatientName": "Williams, Mike", "CarrierName": "Sun Life", "DateService": "2025-12-15", "ClaimFee": 4800.0, "InsPayAmt": 0.0, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "PreAuth", "MissingReasons": "Empty ClaimNote", "HasDocumentTable": True, "HasSheetTable": False, "HasTaskTable": False, "Note": "APPROXIMATE"},
        {"_category": "missing_documentation", "ClaimNum": 12002, "PatNum": 7, "PatientName": "Miller, James", "CarrierName": "Sun Life Financial", "DateService": "2026-01-15", "ClaimFee": 890.0, "InsPayAmt": 0.0, "ClaimStatus": "S", "ClaimStatusDesc": "Sent", "ClaimType": "P", "MissingReasons": "Empty ClaimNote", "HasDocumentTable": True, "HasSheetTable": False, "HasTaskTable": False, "Note": "APPROXIMATE"},
    ]


# ── Run audit pipeline against synthetic data ────────────────────

def main():
    print("🏗️  Generating sample audit data...", flush=True)

    # Build synthetic datasets that match what detectors return
    all_results = {
        "aged_ar": gen_aged_ar(),
        "no_payment": gen_no_payment(),
        "denied": gen_denied(),
        "unfiled_secondary": gen_unfiled_secondary(),
        "completed_unbilled": gen_completed_unbilled(),
        "underpayment": gen_underpayments(),
        "dead_ar": gen_dead_ar(),
    }

    # Patch the output directory to sample-output/
    import audit.reporters as rpt
    original_dir = rpt.OUTPUT_DIR
    rpt.OUTPUT_DIR = SAMPLE_DIR

    print("📊 Generating sample reports...", flush=True)
    summary, report_path = write_all_reports(all_results)

    s = summary["summary"]
    print(f"\n{'='*55}", flush=True)
    print(f"  SAMPLE AUDIT COMPLETE", flush=True)
    print(f"{'='*55}", flush=True)
    print(f"  Visible Insurance AR:       ${s['visible_insurance_ar']:>10,.2f}", flush=True)
    print(f"  Likely Recoverable:         ${s['likely_recoverable_candidates']:>10,.2f}", flush=True)
    print(f"  Questionable / Dead AR:     ${s['questionable_dead_ar']:>10,.2f}", flush=True)
    print(f"  High-Priority Claims:       {s['high_priority_claim_count']:>10}", flush=True)
    print(f"  Top Carrier:                {s['top_carrier_by_stuck_balance']} (${s['top_carrier_balance']:,.2f})", flush=True)
    print(f"{'='*55}", flush=True)
    # ── Canada-specific sample reports ──────────────────────────
    from audit.canada_reporters import run_canada_audit

    # Need a fake connection object that skips actual queries
    # Instead, directly call the write functions with synthetic data
    from audit import canada_reporters as ca_rpt
    from audit.canada_reporters import write_canada_csvs, collate_canada, write_canada_summary

    ca_rpt.OUTPUT_DIR = SAMPLE_DIR

    ca_all_results = {
        "stale_predetermination": gen_stale_predets(),
        "high_value_treatment_followup": gen_high_value_tx(),
        "assignment_ar": gen_assignment_ar(),
        "secondary_coordination": gen_secondary_coordination(),
        "cdcp_followup": gen_cdcp_followup(),
        "missing_documentation": gen_missing_doc(),
        "followup_ownership_gap": gen_ownership_gaps(),
    }

    write_canada_csvs(ca_all_results)
    ca_summary = collate_canada(ca_all_results)
    ca_path = write_canada_summary(ca_summary, ca_all_results)

    cs = ca_summary["summary"]
    print(f"\n{'='*55}", flush=True)
    print(f"  SAMPLE CANADA AUDIT COMPLETE", flush=True)
    print(f"{'='*55}", flush=True)
    print(f"  Stale Predets:               {cs['total_stale_predeterminations']:>10}  (${cs['total_predet_value']:>10,.2f})", flush=True)
    print(f"  High-Value Tx Plans:         {cs['total_high_value_treatment_plans']:>10}  (${cs['total_tx_value']:>10,.2f})", flush=True)
    print(f"  Assignment AR Candidates:    {cs['total_assignment_ar_candidates']:>10}  (${cs['total_assignment_ar_balance']:>10,.2f})", flush=True)
    print(f"  CDCP Follow-Up:              {cs['total_cdcp_candidates']:>10}", flush=True)
    print(f"  Missing Documentation:       {cs['total_missing_documentation']:>10}", flush=True)
    print(f"  Follow-Up Ownership Gaps:    {cs['total_ownership_gaps']:>10}", flush=True)
    print(f"{'='*55}", flush=True)
    print(f"\n📁 Sample output written to: {SAMPLE_DIR}/", flush=True)

    # Restore original output dirs
    rpt.OUTPUT_DIR = original_dir
    ca_rpt.OUTPUT_DIR = "audit-output"


if __name__ == "__main__":
    main()
