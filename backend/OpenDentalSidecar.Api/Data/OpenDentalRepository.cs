using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class OpenDentalRepository
{
    private readonly string _connectionString;

    public OpenDentalRepository(string connectionString)
    {
        _connectionString = connectionString;
    }

    private MySqlConnection CreateConnection() => new(_connectionString);

    // ── Patient Search ──────────────────────────────────────────────

    public async Task<IReadOnlyList<PatientSummaryDto>> SearchPatients(string query, int limit = 50)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT p.PatNum, p.LName, p.FName, p.MiddleI, p.Preferred,
                   p.Birthdate, p.HmPhone, p.WkPhone, p.WirelessPhone,
                   p.Email, p.PatStatus
            FROM patient p
            WHERE p.LName LIKE @q OR p.FName LIKE @q OR p.Preferred LIKE @q
               OR CONCAT(p.FName, ' ', p.LName) LIKE @q
               OR CONCAT(p.LName, ', ', p.FName) LIKE @q
               OR REPLACE(p.HmPhone, '-', '') LIKE @q
               OR REPLACE(p.WirelessPhone, '-', '') LIKE @q
               OR CAST(p.PatNum AS CHAR) LIKE @q
               OR DATE_FORMAT(p.Birthdate, '%Y-%m-%d') LIKE @q
            ORDER BY p.LName, p.FName
            LIMIT @lim;
            """;
        var q = $"%{query}%";
        var rows = await db.QueryAsync(sql, new { q, lim = limit });
        return rows.Select(r => MapPatientSummary(r)).ToList();
    }

    public async Task<PatientDetailDto?> GetPatient(long patNum)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT p.*,
                   g.LName AS GuarLName, g.FName AS GuarFName,
                   pri.Abbr AS PriProvAbbr
            FROM patient p
            LEFT JOIN patient g ON p.Guarantor = g.PatNum
            LEFT JOIN provider pri ON p.PriProv = pri.ProvNum
            WHERE p.PatNum = @patNum;
            """;
        var p = await db.QueryFirstOrDefaultAsync(sql, new { patNum });
        if (p == null) return null;

        // Get insurance plans
        var insSql = """
            SELECT pl.PlanNum, c.CarrierName, pl.GroupName, pl.GroupNum AS GroupId,
                   pp.Ordinal, s.Subscriber, pl.PlanType,
                   CONCAT(sp.LName, ', ', sp.FName) AS SubscriberName,
                   s.SubscriberID
            FROM patplan pp
            JOIN inssub s ON pp.InsSubNum = s.InsSubNum
            JOIN insplan pl ON s.PlanNum = pl.PlanNum
            JOIN carrier c ON pl.CarrierNum = c.CarrierNum
            LEFT JOIN patient sp ON s.Subscriber = sp.PatNum
            WHERE pp.PatNum = @patNum
            ORDER BY pp.Ordinal;
            """;
        var plans = (await db.QueryAsync(insSql, new { patNum }))
            .Select(r => new InsuranceSummaryDto
            {
                PlanNum = (long)r.PlanNum,
                CarrierName = (string)r.CarrierName,
                GroupName = (string?)r.GroupName,
                GroupId = (string?)r.GroupId,
                Ordinal = (int)r.Ordinal,
                SubscriberName = (string?)r.SubscriberName,
                SubscriberId = (string?)r.SubscriberID,
            }).ToList();

        return new PatientDetailDto
        {
            PatNum = (long)p.PatNum,
            LName = (string)p.LName,
            FName = (string)p.FName,
            MiddleI = (string?)p.MiddleI,
            Preferred = (string?)p.Preferred,
            Birthdate = (DateTime?)p.Birthdate == default ? null : (DateTime?)p.Birthdate,
            SSN = (string?)p.SSN,
            Address = (string?)p.Address,
            Address2 = (string?)p.Address2,
            City = (string?)p.City,
            State = (string?)p.State,
            Zip = (string?)p.Zip,
            HmPhone = (string?)p.HmPhone,
            WkPhone = (string?)p.WkPhone,
            WirelessPhone = (string?)p.WirelessPhone,
            Email = (string?)p.Email,
            PatStatus = (int)p.PatStatus,
            PatStatusDesc = PatientStatusDesc((int)p.PatStatus),
            Guarantor = (long)p.Guarantor > 0 ? (long?)p.Guarantor : null,
            GuarantorName = p.GuarLName != null ? $"{p.GuarLName}, {p.GuarFName}" : "",
            PreferredProvider = (long)p.PriProv > 0 ? (long?)p.PriProv : null,
            PreferredProviderName = (string?)p.PriProvAbbr ?? "",
            InsurancePlans = plans,
        };
    }

    // ── Appointments ────────────────────────────────────────────────

    public async Task<IReadOnlyList<AppointmentDto>> GetAppointments(long patNum)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.ProvNum, a.Op AS OperatoryNum,
                   a.AptDateTime, a.AptStatus, a.Note, a.ProcDescript, a.ClinicNum,
                   prov.Abbr AS ProviderName,
                   op.Abbreviation AS OperatoryName
            FROM appointment a
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN operatory op ON a.Op = op.OperatoryNum
            WHERE a.PatNum = @patNum
            ORDER BY a.AptDateTime DESC;
            """;
        var rows = await db.QueryAsync(sql, new { patNum });
        return rows.Select(r => new AppointmentDto
        {
            AptNum = (long)r.AptNum,
            PatNum = (long)r.PatNum,
            ProvNum = (long?)r.ProvNum,
            ProviderName = (string?)r.ProviderName,
            OperatoryNum = (long?)r.OperatoryNum,
            OperatoryName = (string?)r.OperatoryName,
            AptDateTime = (DateTime)r.AptDateTime,
            AptStatus = (int)r.AptStatus,
            AptStatusDesc = AptStatusDesc((int)r.AptStatus),
            Note = (string?)r.Note,
            ProcDescript = (string?)r.ProcDescript,
            ClinicNum = (long?)r.ClinicNum,
        }).ToList();
    }

    // ── Procedures ──────────────────────────────────────────────────

    public async Task<IReadOnlyList<ProcedureDto>> GetProcedures(long patNum)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT pl.ProcNum, pl.PatNum, pl.ProvNum, pl.AptNum, pl.CodeNum,
                   pl.ProcDate, pl.ProcFee, pl.ProcStatus, pl.ClaimNote,
                   pl.ToothNum, pl.ToothRange, pl.Surf,
                   pc.ProcCode, pc.Descript,
                   prov.Abbr AS ProviderName
            FROM procedurelog pl
            LEFT JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
            LEFT JOIN provider prov ON pl.ProvNum = prov.ProvNum
            WHERE pl.PatNum = @patNum
            ORDER BY pl.ProcDate DESC, pl.ProcNum DESC
            LIMIT 200;
            """;
        var rows = await db.QueryAsync(sql, new { patNum });
        return rows.Select(r => new ProcedureDto
        {
            ProcNum = (long)r.ProcNum,
            PatNum = (long)r.PatNum,
            ProvNum = (long?)r.ProvNum,
            ProviderName = (string?)r.ProviderName,
            AptNum = (long?)r.AptNum,
            CodeNum = (long)r.CodeNum,
            ProcCode = (string?)r.ProcCode ?? "",
            Descript = (string?)r.Descript ?? "",
            ProcDate = (DateTime)r.ProcDate,
            ProcFee = (double)r.ProcFee,
            ProcStatus = (int)r.ProcStatus,
            ProcStatusDesc = ProcStatusDesc((int)r.ProcStatus),
            ToothNum = (string?)r.ToothNum,
            ToothRange = (string?)r.ToothRange,
            Surf = (string?)r.Surf,
            ProcNotes = (string?)r.ClaimNote,
        }).ToList();
    }

    // ── Claims ──────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ClaimDto>> GetClaims(long patNum)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT c.ClaimNum, c.PatNum, c.ProvTreat, c.PlanNum, c.InsSubNum,
                   c.ClaimStatus, c.DateService, c.DateSent, c.ClaimFee,
                   c.ClaimForm,
                   prov.Abbr AS ProviderName,
                   car.CarrierName,
                   car.CarrierNum
            FROM claim c
            LEFT JOIN provider prov ON c.ProvTreat = prov.ProvNum
            LEFT JOIN insplan pl ON c.PlanNum = pl.PlanNum
            LEFT JOIN carrier car ON pl.CarrierNum = car.CarrierNum
            WHERE c.PatNum = @patNum
            ORDER BY c.DateService DESC;
            """;
        var rows = await db.QueryAsync(sql, new { patNum });

        var results = new List<ClaimDto>();
        foreach (var r in rows)
        {
            var claimNum = (long)r.ClaimNum;
            var cpSql = """
                SELECT COALESCE(SUM(cp.InsPayAmt), 0) AS InsPayAmt,
                       COALESCE(SUM(cp.WriteOff), 0) AS WriteOff,
                       COALESCE(SUM(cp.DedApplied), 0) AS DedApplied
                FROM claimproc cp
                WHERE cp.ClaimNum = @claimNum AND cp.Status != 7;
                """;
            var cp = await db.QueryFirstAsync(cpSql, new { claimNum });

            results.Add(new ClaimDto
            {
                ClaimNum = claimNum,
                PatNum = (long)r.PatNum,
                ProvNum = (long?)r.ProvTreat,
                ProviderName = (string?)r.ProviderName,
                PlanNum = (long?)r.PlanNum,
                CarrierName = (string?)r.CarrierName,
                InsSubNum = (long?)r.InsSubNum,
                ClaimStatus = 0,
                ClaimStatusDesc = ClaimStatusDesc((string)r.ClaimStatus),
                DateService = (DateTime?)r.DateService == default ? null : (DateTime?)r.DateService,
                DateSent = (DateTime?)r.DateSent == default ? null : (DateTime?)r.DateSent,
                ClaimFee = (double)r.ClaimFee,
                InsPayAmt = (double)cp.InsPayAmt,
                WriteOff = (double)cp.WriteOff,
                DedApplied = (double)cp.DedApplied,
                CarrierNum = (long?)r.CarrierNum,
                ClaimForm = (int?)r.ClaimForm,
            });
        }
        return results;
    }

    public async Task<ClaimDetailDto?> GetClaimDetail(long claimNum)
    {
        using var db = CreateConnection();
        var sql = """
            SELECT c.*, prov.Abbr AS ProviderName, car.CarrierName
            FROM claim c
            LEFT JOIN provider prov ON c.ProvTreat = prov.ProvNum
            LEFT JOIN insplan pl ON c.PlanNum = pl.PlanNum
            LEFT JOIN carrier car ON pl.CarrierNum = car.CarrierNum
            WHERE c.ClaimNum = @claimNum;
            """;
        var r = await db.QueryFirstOrDefaultAsync(sql, new { claimNum });
        if (r == null) return null;

        // ClaimProcs
        var cpSql = """
            SELECT cp.*, pc.ProcCode, pc.Descript, pl.ToothNum, pl.Surf
            FROM claimproc cp
            LEFT JOIN procedurelog pl ON cp.ProcNum = pl.ProcNum
            LEFT JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
            WHERE cp.ClaimNum = @claimNum
            ORDER BY cp.ClaimProcNum;
            """;
        var procs = (await db.QueryAsync(cpSql, new { claimNum }))
            .Select(cp => new ClaimProcDto
            {
                ClaimProcNum = (long)cp.ClaimProcNum,
                ClaimNum = (long)cp.ClaimNum,
                ProcNum = (long?)cp.ProcNum ?? 0,
                ProcCode = (string?)cp.ProcCode ?? "",
                Descript = (string?)cp.Descript ?? "",
                ProcFee = (double)cp.FeeBilled,
                InsPayAmt = (double)(cp.InsPayAmt ?? 0),
                DedApplied = (double)(cp.DedApplied ?? 0),
                WriteOff = (double)(cp.WriteOff ?? 0),
                Status = (int)cp.Status,
                StatusDesc = ClaimProcStatusDesc((int)cp.Status),
                ToothNum = (string?)cp.ToothNum,
                Surf = (string?)cp.Surf,
            }).ToList();

        // Payments
        var paySql = """
            SELECT cp.ClaimPaymentNum, cp.ClaimNum, cp.CheckAmt,
                   cp.CheckDate, cp.CheckNum, cp.DateIssued
            FROM claimpayment cp
            WHERE cp.ClaimNum = @claimNum;
            """;
        var payments = (await db.QueryAsync(paySql, new { claimNum }))
            .Select(p => new ClaimPaymentDto
            {
                ClaimPaymentNum = (long)p.ClaimPaymentNum,
                ClaimNum = (long)p.ClaimNum,
                PayAmt = (double)(p.CheckAmt ?? 0),
                DatePay = (DateTime?)p.DateIssued == default ? (DateTime?)p.CheckDate : (DateTime?)p.DateIssued,
                CheckNum = (string?)p.CheckNum,
            }).ToList();

        var insPayAmt = procs.Sum(p => p.InsPayAmt);
        var writeOff = procs.Sum(p => p.WriteOff);
        var dedApplied = procs.Sum(p => p.DedApplied);

        DateTime minDate = default;

        return new ClaimDetailDto
        {
            ClaimNum = (long)r.ClaimNum,
            PatNum = (long)r.PatNum,
            ClaimStatus = 0,
            ClaimStatusDesc = ClaimStatusDesc((string)r.ClaimStatus),
            CarrierName = (string?)r.CarrierName,
            DateService = (DateTime?)r.DateService == minDate ? null : (DateTime?)r.DateService,
            DateSent = (DateTime?)r.DateSent == minDate ? null : (DateTime?)r.DateSent,
            DateReceived = (DateTime?)r.DateReceived == minDate ? null : (DateTime?)r.DateReceived,
            ClaimFee = (double)r.ClaimFee,
            InsPayAmt = insPayAmt,
            WriteOff = writeOff,
            DedApplied = dedApplied,
            InsEstimate = (double)r.InsPayEst,
            BalanceRemaining = (double)r.ClaimFee - insPayAmt,
            ClaimForm = (int?)r.ClaimForm,
            ProviderName = (string?)r.ProviderName,
            Procedures = procs,
            Payments = payments,
        };
    }

    // ── Status Code Mappings ────────────────────────────────────────
    // Verified against OpenDental v24.3 Enumerations.cs

    private static string PatientStatusDesc(int status) => status switch
    {
        0 => "Patient",
        1 => "NonPatient",
        2 => "Inactive",
        3 => "Archived",
        4 => "Deleted",
        5 => "Deceased",
        6 => "Prospective",
        _ => $"Unknown ({status})",
    };

    private static string AptStatusDesc(int status) => status switch
    {
        1 => "Scheduled",
        2 => "Complete",
        3 => "UnschedList",
        5 => "Broken",
        6 => "Planned",
        7 => "PtNote",
        8 => "PtNoteCompleted",
        _ => $"Unknown ({status})",
    };

    private static string ProcStatusDesc(int status) => status switch
    {
        1 => "Treatment Planned",
        2 => "Complete",
        3 => "Existing Current",
        4 => "Existing Other",
        5 => "Referred",
        6 => "Deleted",
        7 => "Condition",
        8 => "TP Inactive",
        _ => $"Unknown ({status})",
    };

    private static string ClaimStatusDesc(string status) => status switch
    {
        "U" => "Not Sent",
        "H" => "Hold (Wait Prim)",
        "W" => "Waiting to Send",
        "P" => "Probably Sent",
        "S" => "Sent",
        "R" => "Received",
        "I" => "Hold (In Process)",
        _ => $"Unknown ({status})",
    };

    private static string ClaimProcStatusDesc(int status) => status switch
    {
        0 => "Not Received",
        1 => "Received",
        2 => "Preauth",
        3 => "Adjustment",
        4 => "Supplemental",
        5 => "Cap Claim",
        6 => "Estimate",
        7 => "Cap Complete",
        8 => "Cap Estimate",
        9 => "Ins History",
        _ => $"Unknown ({status})",
    };

    private static PatientSummaryDto MapPatientSummary(dynamic r) => new()
    {
        PatNum = (long)r.PatNum,
        LName = (string)r.LName,
        FName = (string)r.FName,
        MiddleI = (string?)r.MiddleI,
        Preferred = (string?)r.Preferred,
        Birthdate = (DateTime?)r.Birthdate == default ? null : (DateTime?)r.Birthdate,
        HmPhone = (string?)r.HmPhone,
        WkPhone = (string?)r.WkPhone,
        WirelessPhone = (string?)r.WirelessPhone,
        Email = (string?)r.Email,
        PatStatus = (int)r.PatStatus,
        PatStatusDesc = PatientStatusDesc((int)r.PatStatus),
    };
}
