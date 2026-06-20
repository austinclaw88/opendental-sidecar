-- OpenDental Sidecar - Phase 2 (Front Desk) Demo Seed
-- Extends the Phase 1 demo schema with the columns and tables the
-- receptionist read/write features need: schedule grid, booking,
-- confirmations, recall, payments, comm logs, and signalod refresh.
-- Executed automatically by docker compose (demo profile) after 01.

-- ════════════════════════════════════════════════════════════════
-- 1. Extend existing tables to match the columns the API touches
-- ════════════════════════════════════════════════════════════════

UPDATE operatory SET ItemOrder = OperatoryNum;
UPDATE operatory SET ProvDentist = 1 WHERE OperatoryNum = 1;
UPDATE operatory SET ProvDentist = 2 WHERE OperatoryNum = 2;
UPDATE operatory SET ProvDentist = 3, IsHygiene = 1, ProvHygienist = 3 WHERE OperatoryNum = 3;

-- ARGB ints: teal, indigo, amber
UPDATE provider SET ProvColor = -16728876, ItemOrder = 1 WHERE ProvNum = 1;
UPDATE provider SET ProvColor = -10720320, ItemOrder = 2 WHERE ProvNum = 2;
UPDATE provider SET ProvColor = -278483,   ItemOrder = 3, IsSecondary = 1 WHERE ProvNum = 3;

-- Patient: add every column the registration INSERT writes, with safe defaults.
UPDATE claimproc cp
  JOIN claim c ON cp.ClaimNum = c.ClaimNum
  SET cp.DateCP = c.DateReceived
  WHERE cp.Status = 1;

-- ════════════════════════════════════════════════════════════════
-- 2. New tables
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 3. Lookup data (definition categories used by the front desk)
-- ════════════════════════════════════════════════════════════════

-- Category 1: adjustment types
INSERT INTO definition (DefNum, Category, ItemName, ItemValue, ItemOrder) VALUES
(20, 1, 'Courtesy Discount', '-', 0),
(21, 1, 'Senior Discount',   '-', 1),
(22, 1, 'NSF Fee',           '+', 2);

-- Category 2: appointment confirmation statuses
INSERT INTO definition (DefNum, Category, ItemName, ItemColor, ItemOrder) VALUES
(30, 2, 'Not Called',    -1,        0),
(31, 2, 'Left Message',  -278483,   1),
(32, 2, 'Texted',        -5383962,  2),
(33, 2, 'Confirmed',     -16728876, 3),
(34, 2, 'Arrived',       -10720320, 4);

-- Category 10: payment types
INSERT INTO definition (DefNum, Category, ItemName, ItemOrder) VALUES
(40, 10, 'Cash',        0),
(41, 10, 'Cheque',      1),
(42, 10, 'Credit Card', 2),
(43, 10, 'Debit',       3),
(44, 10, 'E-Transfer',  4);

-- Category 25: blockout types
INSERT INTO definition (DefNum, Category, ItemName, ItemColor, ItemOrder) VALUES
(50, 25, 'Lunch',          -2894893, 0),
(51, 25, 'Staff Meeting',  -5383962, 1);

-- Category 27: commlog types
INSERT INTO definition (DefNum, Category, ItemName, ItemOrder) VALUES
(60, 27, 'Appointment Related', 0),
(61, 27, 'Financial',           1),
(62, 27, 'Recall Reminder',     2),
(63, 27, 'Miscellaneous',       3);

-- ════════════════════════════════════════════════════════════════
-- 4. Appointment types
-- ════════════════════════════════════════════════════════════════

INSERT INTO appointmenttype (AppointmentTypeNum, AppointmentTypeName, AppointmentTypeColor, ItemOrder, Pattern) VALUES
(1, 'New Patient Exam', -16728876, 0, '//XXXXXXXX//'),     -- 60 min
(2, 'Recall / Hygiene', -10720320, 1, '//XXXXXX//'),       -- 50 min
(3, 'Emergency',        -1092784,  2, '/XXXX/'),           -- 30 min
(4, 'Restorative',      -278483,   3, '//XXXXXXXXXXXX//'); -- 80 min

-- ════════════════════════════════════════════════════════════════
-- 5. Bring historical appointments up to Phase 2 shape
-- ════════════════════════════════════════════════════════════════

UPDATE appointment SET Pattern = '//XXXXXX//', Confirmed = 30 WHERE AptNum BETWEEN 1 AND 10;
UPDATE appointment SET AppointmentTypeNum = 2, IsHygiene = 1 WHERE AptNum IN (1, 2, 5, 7, 10);
UPDATE appointment SET AppointmentTypeNum = 4, Pattern = '//XXXXXXXXXXXX//' WHERE AptNum IN (3, 4, 8, 9);
UPDATE appointment SET Confirmed = 33 WHERE AptNum IN (8, 9, 10);

-- ════════════════════════════════════════════════════════════════
-- 6. Live demo data anchored to the current date
--    (so the schedule grid and work lists are populated on first run)
-- ════════════════════════════════════════════════════════════════

-- Today's appointments across the three operatories
INSERT INTO appointment (AptNum, PatNum, ProvNum, Op, AptDateTime, AptStatus, Note, ProcDescript,
   Pattern, Confirmed, AppointmentTypeNum, IsHygiene, IsNewPatient) VALUES
(101, 1,  1, 1, CONCAT(CURDATE(), ' 08:00:00'), 1, 'Prefers morning visits', 'Recall — exam, cleaning, BWX', '//XXXXXX//',       33, 2, 1, 0),
(102, 3,  1, 1, CONCAT(CURDATE(), ' 09:00:00'), 1, NULL,                     'Composite #14 MO',             '//XXXXXXXXXXXX//', 31, 4, 0, 0),
(103, 6,  1, 1, CONCAT(CURDATE(), ' 11:00:00'), 1, 'RCT consult #30',        'Endo consult',                 '/XXXX/',           30, 3, 0, 0),
(104, 2,  2, 2, CONCAT(CURDATE(), ' 08:30:00'), 1, NULL,                     'Recall — exam, cleaning',      '//XXXXXX//',       33, 2, 1, 0),
(105, 10, 2, 2, CONCAT(CURDATE(), ' 10:00:00'), 1, 'Cavity #18',             'Composite #18 MO',             '//XXXXXXXXXXXX//', 32, 4, 0, 0),
(106, 4,  3, 3, CONCAT(CURDATE(), ' 09:00:00'), 1, NULL,                     'Hygiene — scaling',            '//XXXXXX//',       30, 2, 1, 0),
(107, 9,  3, 3, CONCAT(CURDATE(), ' 13:00:00'), 1, 'New patient referral',   'New patient exam + FMX',       '//XXXXXXXX//',     33, 1, 0, 1),
-- Tomorrow
(108, 5,  2, 2, CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 09:00:00'), 1, NULL, 'Recall — exam, cleaning', '//XXXXXX//', 30, 2, 1, 0),
(109, 8,  1, 1, CONCAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), ' 10:30:00'), 1, NULL, 'Crown prep #19',          '//XXXXXXXXXXXX//', 30, 4, 0, 0),
-- Work-list items: one broken, one on the unscheduled list
(110, 7,  2, 0, DATE_SUB(CURDATE(), INTERVAL 9 DAY),  5, 'No-show, rebook',        'Recall — exam, cleaning', '//XXXXXX//', 30, 2, 1, 0),
(111, 6,  1, 0, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 3, 'Wants evening slot',     'RCT #30',                 '//XXXXXXXXXXXX//', 30, 4, 0, 0);

-- Provider working schedules for today and tomorrow, plus a lunch blockout
INSERT INTO schedule (ScheduleNum, SchedDate, StartTime, StopTime, SchedType, ProvNum, BlockoutType, Note, Status) VALUES
(1, CURDATE(), '08:00:00', '17:00:00', 1, 1, 0, '', 0),
(2, CURDATE(), '08:00:00', '17:00:00', 1, 2, 0, '', 0),
(3, CURDATE(), '09:00:00', '16:00:00', 1, 3, 0, '', 0),
(4, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '08:00:00', '17:00:00', 1, 1, 0, NULL, 0),
(5, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '08:00:00', '17:00:00', 1, 2, 0, NULL, 0),
(6, CURDATE(), '12:00:00', '13:00:00', 2, 0, 50, 'Lunch', 0);

INSERT INTO scheduleop (ScheduleNum, OperatoryNum) VALUES
(1, 1),
(2, 2),
(3, 3),
(4, 1),
(5, 2),
(6, 1),
(6, 2),
(6, 3);

-- ════════════════════════════════════════════════════════════════
-- 7. Recall, comm logs, payments, adjustments, patient notes
-- ════════════════════════════════════════════════════════════════

INSERT INTO recalltype (RecallTypeNum, Description, DefaultInterval, TimePattern) VALUES
(1, 'Prophy', 393217, '//XXXXXX//'),
(2, 'Perio',  196609, '//XXXXXXXX//');

INSERT INTO recall (RecallNum, PatNum, DateDue, DatePrevious, DateScheduled, RecallInterval, RecallTypeNum, Note, IsDisabled) VALUES
(1, 1,  DATE_ADD(CURDATE(), INTERVAL 7 DAY),   DATE_SUB(CURDATE(), INTERVAL 175 DAY), CURDATE(),     393217, 1, NULL, 0),
(2, 3,  DATE_SUB(CURDATE(), INTERVAL 45 DAY),  DATE_SUB(CURDATE(), INTERVAL 225 DAY), '0001-01-01',  393217, 1, 'Prefers Dr. Smith', 0),
(3, 5,  DATE_SUB(CURDATE(), INTERVAL 14 DAY),  DATE_SUB(CURDATE(), INTERVAL 194 DAY), '0001-01-01',  393217, 1, NULL, 0),
(4, 6,  DATE_SUB(CURDATE(), INTERVAL 90 DAY),  DATE_SUB(CURDATE(), INTERVAL 270 DAY), '0001-01-01',  196609, 2, 'Perio maintenance 3mo', 0),
(5, 8,  DATE_ADD(CURDATE(), INTERVAL 21 DAY),  DATE_SUB(CURDATE(), INTERVAL 159 DAY), '0001-01-01',  393217, 1, NULL, 0),
(6, 9,  DATE_ADD(CURDATE(), INTERVAL 3 DAY),   DATE_SUB(CURDATE(), INTERVAL 177 DAY), '0001-01-01',  393217, 1, NULL, 0);

INSERT INTO commlog (CommlogNum, PatNum, CommDateTime, CommType, Note, Mode_, SentOrReceived, DateTEntry) VALUES
(1, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 60, 'Called to confirm recall appointment. Confirmed for this week.', 1, 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 3, DATE_SUB(NOW(), INTERVAL 5 DAY), 62, 'Left voicemail re: overdue recall.', 1, 1, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(3, 7, DATE_SUB(NOW(), INTERVAL 9 DAY), 60, 'No-show for hygiene. Will call back to rebook.', 1, 1, DATE_SUB(NOW(), INTERVAL 9 DAY)),
(4, 4, DATE_SUB(NOW(), INTERVAL 1 DAY), 61, 'Discussed treatment plan estimate for RCT + crown. Patient reviewing with insurance.', 2, 0, DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT INTO payment (PayNum, PayType, PayDate, PayAmt, CheckNum, PayNote, PatNum, DateEntry) VALUES
(1, 42, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 67.00, '', 'Visa ending 4242', 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
(2, 41, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 41.00, '1042', NULL, 2, DATE_SUB(CURDATE(), INTERVAL 10 DAY));

INSERT INTO paysplit (SplitNum, SplitAmt, PatNum, ProcDate, PayNum, ProvNum, DatePay, DateEntry) VALUES
(1, 67.00, 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 1, 1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL 20 DAY)),
(2, 41.00, 2, DATE_SUB(CURDATE(), INTERVAL 10 DAY), 2, 2, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 10 DAY));

INSERT INTO adjustment (AdjNum, AdjDate, AdjAmt, PatNum, AdjType, ProvNum, AdjNote) VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 15 DAY), -25.00, 4, 20, 3, 'Courtesy discount on RCT consult');

INSERT INTO patientnote (PatNum, ApptPhone) VALUES
(3, 'Call daughter first: 403-555-0399'),
(7, 'Hard of hearing — speak slowly, prefers voicemail');
