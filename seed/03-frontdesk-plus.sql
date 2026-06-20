-- OpenDental Sidecar - Phase 3 (Front Desk Plus) Demo Seed
-- Extends the demo schema with the columns the new features write:
-- insurance management (carrier/insplan/inssub/patplan), adjustments,
-- ASAP priority, and richer claim-queue demo data.
-- Executed automatically by docker compose (demo profile) after 02.

-- ════════════════════════════════════════════════════════════════
-- 1. Extend existing tables to match the columns the API touches
-- ════════════════════════════════════════════════════════════════

UPDATE carrier SET Phone = '1-800-786-5433', ElectID = '000016' WHERE CarrierNum = 1; -- SunLife
UPDATE carrier SET Phone = '1-800-268-6195', ElectID = '311140' WHERE CarrierNum = 2; -- Manulife
UPDATE carrier SET Phone = '1-888-711-1119', ElectID = '000102' WHERE CarrierNum = 3; -- GreenShield

-- ════════════════════════════════════════════════════════════════
-- 2. Demo data for the new features
-- ════════════════════════════════════════════════════════════════

-- Emma (5) gets dual coverage: primary on her own GreenShield plan,
-- secondary as a dependent on James's (10) Manulife plan.
INSERT INTO inssub (InsSubNum, PlanNum, Subscriber, SubscriberID, DateEffective) VALUES
(6, 3, 5, 'UH-EMMA-006', '2025-09-01');

INSERT INTO patplan (PatPlanNum, PatNum, InsSubNum, Ordinal, Relationship) VALUES
(7, 5, 6, 1, 0),
(8, 5, 5, 2, 2);

-- Flag Bob's upcoming checkup (apt 10) as ASAP — he asked to be called
-- if anything earlier opens up.
UPDATE appointment SET Priority = 1 WHERE AptNum = 10;

-- Extra claims so the queue filters have something to show:
-- one stale sent claim (follow-up flag) and one on hold.
INSERT INTO claim (ClaimNum, PatNum, ProvTreat, ProvBill, PlanNum, InsSubNum, ClaimStatus, ClaimType, DateService, DateSent, ClaimFee, InsPayAmt, InsPayEst, DedApplied, WriteOff, ClinicNum) VALUES
(7, 9, 1, 1, 1, 1, 'S', 'P', '2026-04-10', '2026-04-12', 420.00, 0, 370.00, 0, 0, 0),
(8, 5, 2, 2, 3, 6, 'H', 'S', '2026-05-15', '0001-01-01', 180.00, 0, 90.00,  0, 0, 0);
