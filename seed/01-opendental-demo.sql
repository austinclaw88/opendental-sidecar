-- OpenDental Sidecar - Demo Seed Data
-- Creates minimal OpenDental-like tables with sanitized sample data.
-- Executed automatically by docker compose when using the demo profile.

-- ── Definition (lookup table) ──
INSERT INTO definition (DefNum, Category, ItemName) VALUES
(1, 4, 'Standard Billing'),
(2, 11, 'Diagnostic'),
(3, 11, 'Preventive'),
(4, 11, 'Restorative'),
(5, 11, 'Endodontic');

-- ── Provider ──
INSERT INTO provider (ProvNum, Abbr, FName, LName) VALUES
(1, 'JSM', 'Jane', 'Smith'),
(2, 'RWL', 'Robert', 'Wilson'),
(3, 'MCH', 'Maria', 'Chen');

-- ── Carrier (insurance companies) ──
INSERT INTO carrier (CarrierNum, CarrierName) VALUES
(1, 'SunLife Dental'),
(2, 'Manulife Dental'),
(3, 'GreenShield Canada');

-- ── FeeSched ──
INSERT INTO feesched (FeeSchedNum, Description) VALUES
(1, 'Standard Ontario Fee Guide'),
(2, 'Premium Fee Schedule');

-- ── InsPlan ──
INSERT INTO insplan (PlanNum, CarrierNum, GroupName, GroupNum, FeeSched) VALUES
(1, 1, 'TechCorp', 'TC-001', 1),
(2, 2, 'MapleLeaf', 'ML-002', 1),
(3, 3, 'Univ Health', 'UH-003', 2);

-- ── Patient ──
INSERT INTO patient (PatNum, LName, FName, MiddleI, Preferred, PatStatus, Birthdate, Address, City, State, Zip, HmPhone, WirelessPhone, Email, Guarantor, PriProv) VALUES
(1,  'Johnson', 'Alice', '',    'Ali',    0, '1990-03-15', '123 Oak St', 'Toronto', 'ON', 'M5A1A1', '416-555-0101', '416-555-0102', 'alice.j@email.com', 1, 1),
(2,  'Martinez', 'Bob',    'L', '',     0, '1985-07-22', '456 Maple Ave', 'Vancouver', 'BC', 'V6B2B2', '604-555-0201', '604-555-0202', 'bob.m@email.com', 2, 2),
(3,  'Patel',    'Carol', '', '',    0, '1978-11-02', '789 Pine Rd', 'Calgary', 'AB', 'T2P3C3', '403-555-0301', '', 'carol.p@email.com', 3, 1),
(4,  'Chen',     'David',  'W',     'Dave',  0, '1995-01-10', '321 Elm St', 'Toronto', 'ON', 'M5B2C2', '416-555-0401', '416-555-0402', 'dave.c@email.com', 4, 3),
(5,  'Thompson', 'Emma', '', '',    0, '2000-06-18', '654 Birch Ln', 'Ottawa', 'ON', 'K1P1D1', '613-555-0501', '613-555-0502', 'emma.t@email.com', 5, 2),
(6,  'Garcia',   'Frank',  'R', '',    0, '1972-09-30', '987 Cedar Blvd', 'Montreal', 'QC', 'H3A1E1', '514-555-0601', '', 'frank.g@email.com', 6, 1),
(7,  'Lee',      'Grace', '', '',    2, '1968-04-05', '147 Spruce Ct', 'Vancouver', 'BC', 'V5K1F1', '604-555-0701', '', 'grace.lee@email.com', 7, 2),
(8,  'Wilson',   'Henry',  'A',     'Hank',  0, '1988-12-25', '258 Ash Way', 'Toronto', 'ON', 'M6G2G2', '416-555-0801', '416-555-0802', 'hank.w@email.com', 8, 3),
(9,  'Brown',    'Isabel', '',    'Izzy',  0, '1992-08-14', '369 Fir Dr', 'Victoria', 'BC', 'V8W1H1', '250-555-0901', '', 'izzy.b@email.com', 9, 1),
(10, 'Kim',      'James',  'S', '',    0, '1975-05-20', '482 Walnut Ave', 'Toronto', 'ON', 'M4C3H3', '416-555-1001', '416-555-1002', 'james.k@email.com', 10, 2);

-- ── InsSub (subscribers) ──
INSERT INTO inssub (InsSubNum, PlanNum, Subscriber, SubscriberID) VALUES
(1, 1, 1, 'TC-ALICE-001'),
(2, 2, 2, 'ML-BOB-002'),
(3, 3, 4, 'UH-DAVE-003'),
(4, 1, 8, 'TC-HANK-004'),
(5, 2, 10, 'ML-JAMES-005');

-- ── PatPlan (patient → insurance) ──
INSERT INTO patplan (PatPlanNum, PatNum, InsSubNum, Ordinal, Relationship) VALUES
(1, 1, 1, 1, 0),
(2, 2, 2, 1, 0),
(3, 4, 3, 1, 0),
(4, 3, 1, 1, 2),
(5, 8, 4, 1, 0),
(6, 10, 5, 1, 0);

-- ── ProcedureCode ──
INSERT INTO procedurecode (CodeNum, ProcCode, Descript, AbbrDesc, ProcCat) VALUES
(1, 'D0120', 'Periodic oral evaluation', 'Exam', 2),
(2, 'D1110', 'Adult prophylaxis', 'Cleaning', 3),
(3, 'D0210', 'Intraoral - complete series', 'X-Rays', 2),
(4, 'D2391', 'Resin-based composite - 1 surface', 'Filling', 4),
(5, 'D2392', 'Resin-based composite - 2 surfaces', 'Filling', 4);

-- ── ProcedureLog ──
INSERT INTO procedurelog (ProcNum, PatNum, AptNum, CodeNum, ProcDate, ProcFee, ProcStatus, ProvNum, ToothNum, Surf, ClinicNum) VALUES
(1,  1, 1, 1, '2026-01-15', 85.00,  2, 1, '', '', 0),
(2,  1, 1, 2, '2026-01-15', 120.00, 2, 1, '', '', 0),
(3,  1, 1, 3, '2026-01-15', 130.00, 2, 1, '', '', 0),
(4,  2, 2, 1, '2026-02-10', 85.00,  2, 2, '', '', 0),
(5,  2, 2, 2, '2026-02-10', 120.00, 2, 2, '', '', 0),
(6,  3, 3, 4, '2026-03-05', 210.00, 2, 1, '14',  'MO',  0),
(7,  4, 4, 5, '2026-03-20', 270.00, 2, 3, '19',  'DO',  0),
(8,  4, 4, 6, '2026-03-20', 1100.00,2, 3, '19', '',  0),
(9,  5, 5, 2, '2026-04-01', 120.00, 2, 2, '', '', 0),
(10, 1, 0, 4, '2026-05-01', 210.00, 1, 1, '3',   'MO',  0),
(11, 6, 0, 6, '2026-05-15', 1100.00,1, 1, '30', '',  0),
(12, 8, 6, 1, '2026-05-20', 85.00,  2, 3, '', '', 0),
(13, 9, 7, 2, '2026-06-01', 120.00, 2, 1, '', '', 0),
(14, 10, 0, 4, '2026-06-10', 210.00, 1, 2, '18',  'MO',  0),
(15, 5, 0, 6, '2026-06-15', 1100.00,1, 2, '3', '',  0);

-- ── Appointment ──
INSERT INTO appointment (AptNum, PatNum, ProvNum, Op, AptDateTime, AptStatus, Note, ProcDescript) VALUES
(1, 1, 1, 1, '2026-01-15 09:00:00', 2, 'Routine cleaning', 'Exam, Cleaning, X-Rays'),
(2, 2, 2, 2, '2026-02-10 10:00:00', 2, '', 'Exam, Cleaning'),
(3, 3, 1, 1, '2026-03-05 11:00:00', 2, 'Complaint of pain #14', 'Filling #14'),
(4, 4, 3, 3, '2026-03-20 13:00:00', 2, 'Root canal referral', 'Fillings + Root Canal #19'),
(5, 5, 2, 2, '2026-04-01 09:30:00', 2, 'Regular checkup', 'Cleaning'),
(6, 8, 3, 3, '2026-05-20 10:00:00', 2, '', 'Oral evaluation'),
(7, 9, 1, 1, '2026-06-01 14:00:00', 2, '', 'Cleaning'),
(8, 1, 1, 1, '2026-07-15 09:00:00', 1, 'Filling #3', 'Composite #3'),
(9, 10, 2, 2, '2026-07-20 11:00:00', 1, 'Cavity #18', 'Composite #18'),
(10, 2, 2, 2, '2026-08-10 10:00:00', 1, 'Regular checkup', 'Exam, Cleaning');

-- ── Operatory ──
INSERT INTO operatory (OperatoryNum, Abbrev, OpName) VALUES
(1, 'OP-1', 'Operatory 1'),
(2, 'OP-2', 'Operatory 2'),
(3, 'OP-3', 'Operatory 3');

-- ── Clinic ──
INSERT INTO clinic (ClinicNum, Abbr, Description) VALUES
(1, 'Main', 'Main Clinic');

-- ── Claim ──
INSERT INTO claim (ClaimNum, PatNum, ProvTreat, ProvBill, PlanNum, InsSubNum, ClaimStatus, ClaimType, DateService, DateSent, ClaimFee, InsPayAmt, InsPayEst, DedApplied, WriteOff, ClinicNum) VALUES
(1, 1, 1, 1, 1, 1, 'S', 'P', '2026-01-15', '2026-01-20', 335.00,  268.00,  300.00,  50.00,  17.00,  0),
(2, 1, 1, 1, 1, 1, 'R', 'P', '2026-05-01', '2026-05-05', 210.00,  168.00,  185.00,  25.00,  17.00,  0),
(3, 2, 2, 2, 2, 2, 'S', 'P', '2026-02-10', '2026-02-15', 205.00,  164.00,  180.00,  25.00,  16.00,  0),
(4, 3, 1, 1, 1, 1, 'W', 'P', '2026-03-05', '2026-03-10', 210.00,  0,       185.00,  0,      0,       0),
(5, 4, 3, 3, 3, 3, 'U', 'P', '2026-03-20', '1900-01-01', 1370.00, 0,       1200.00, 0,      0,       0),
(6, 8, 3, 3, 4, 4, 'R', 'P', '2026-05-20', '2026-05-22', 85.00,   68.00,   75.00,   10.00,  7.00,    0);

-- ── ClaimProc ──
INSERT INTO claimproc (ClaimProcNum, ClaimNum, ProcNum, PatNum, ProvNum, FeeBilled, InsPayEst, InsPayAmt, DedApplied, WriteOff, Status, PlanNum, ClinicNum) VALUES
(1,  1, 1, 1, 1, 85.00,  75.00, 68.00,  15.00, 2.00,  1, 1, 0),
(2,  1, 2, 1, 1, 120.00, 105.00, 95.00,  20.00, 5.00,  1, 1, 0),
(3,  1, 3, 1, 1, 130.00, 120.00, 105.00, 15.00, 10.00, 1, 1, 0),
(4,  2, 10, 1, 1, 210.00, 185.00, 168.00, 25.00, 17.00, 1, 1, 0),
(5,  3, 4, 2, 2, 85.00,  75.00, 68.00,  10.00, 7.00,  1, 2, 0),
(6,  3, 5, 2, 2, 120.00, 105.00, 96.00,  15.00, 9.00,  1, 2, 0),
(7,  4, 6, 3, 1, 210.00, 185.00, 0,      0,     0,     0, 1, 0),
(8,  5, 7, 4, 3, 270.00, 240.00, 0,      0,     0,     0, 3, 0),
(9,  5, 8, 4, 3, 1100.00, 960.00, 0,     0,     0,     0, 3, 0),
(10, 6, 12, 8, 3, 85.00,  75.00, 68.00,  10.00, 7.00,  1, 4, 0);

-- ── ClaimPayment ──
INSERT INTO claimpayment (ClaimPaymentNum, CheckDate, CheckAmt, CheckNum, CarrierName, DateIssued, ClinicNum) VALUES
(1, '2026-02-01', 268.00, 'CHK-1001', 'SunLife Dental', '2026-01-28', 0),
(2, '2026-06-01', 168.00, 'CHK-1002', 'SunLife Dental', '2026-05-28', 0),
(3, '2026-03-01', 164.00, 'CHK-2001', 'Manulife Dental', '2026-02-25', 0);

-- Link claimprocs to payments
UPDATE claimproc SET ClaimPaymentNum = 1 WHERE ClaimProcNum BETWEEN 1 AND 3;
UPDATE claimproc SET ClaimPaymentNum = 2 WHERE ClaimProcNum = 4;
UPDATE claimproc SET ClaimPaymentNum = 3 WHERE ClaimProcNum BETWEEN 5 AND 6;
