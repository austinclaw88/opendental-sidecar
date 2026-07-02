using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;
using OpenDentalSidecar.Api.Data.Schema;

namespace OpenDentalSidecar.Api.Data;

public class PatientRepository : IPatientRepository
{
    private readonly string _connStr;
    private readonly SchemaIntrospector _schema;
    public PatientRepository(string connStr, SchemaIntrospector schema)
    {
        _connStr = connStr;
        _schema = schema;
    }
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<PatientSummaryDto>> Search(string query, int limit = 50)
    {
        using var db = Db();
        var q = $"%{query}%";
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
        var rows = await db.QueryAsync(sql, new { q, lim = limit });
        return rows.Select(MapSummary).ToList();
    }

    public async Task<PatientDetailDto?> GetDetail(long patNum)
    {
        using var db = Db();
        var sql = """
            SELECT p.PatNum, p.LName, p.FName, p.MiddleI, p.Preferred,
                   p.Birthdate, p.Address, p.Address2, p.City, p.State, p.Zip,
                   p.HmPhone, p.WkPhone, p.WirelessPhone, p.Email,
                   p.PatStatus, p.Guarantor, p.PriProv, p.ClinicNum,
                   p.Gender, p.ChartNumber, p.BillingType, p.TxtMsgOk, p.PreferContactMethod,
                   p.ApptModNote, p.MedUrgNote, p.FamFinUrgNote,
                   g.LName AS GuarLName, g.FName AS GuarFName,
                   pri.Abbr AS PriProvAbbr, bt.ItemName AS BillingTypeName
            FROM patient p
            LEFT JOIN patient g ON p.Guarantor = g.PatNum
            LEFT JOIN provider pri ON p.PriProv = pri.ProvNum
            LEFT JOIN definition bt ON p.BillingType = bt.DefNum
            WHERE p.PatNum = @patNum;
            """;
        var p = await db.QueryFirstOrDefaultAsync(sql, new { patNum });
        if (p == null) return null;

        var insSql = """
            SELECT pl.PlanNum, c.CarrierName, pl.GroupName, pl.GroupNum AS GroupId,
                   pp.Ordinal, s.Subscriber,
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
            Birthdate = NullDate(p.Birthdate),
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
            Gender = (int)p.Gender,
            ChartNumber = (string?)p.ChartNumber,
            BillingType = (long)p.BillingType > 0 ? (long?)p.BillingType : null,
            BillingTypeName = (string?)p.BillingTypeName ?? "",
            TxtMsgOk = (int)p.TxtMsgOk,
            PreferContactMethod = (int)p.PreferContactMethod,
            ApptModNote = (string?)p.ApptModNote,
            MedUrgNote = (string?)p.MedUrgNote,
            FamFinUrgNote = (string?)p.FamFinUrgNote,
            InsurancePlans = plans,
        };
    }

    private static PatientSummaryDto MapSummary(dynamic r) => new()
    {
        PatNum = (long)r.PatNum,
        LName = (string)r.LName,
        FName = (string)r.FName,
        MiddleI = (string?)r.MiddleI,
        Preferred = (string?)r.Preferred,
        Birthdate = NullDate(r.Birthdate),
        HmPhone = (string?)r.HmPhone,
        WkPhone = (string?)r.WkPhone,
        WirelessPhone = (string?)r.WirelessPhone,
        Email = (string?)r.Email,
        PatStatus = (int)r.PatStatus,
        PatStatusDesc = PatientStatusDesc((int)r.PatStatus),
    };

    // ── Writes ──────────────────────────────────────────────────

    public async Task<long> Create(CreatePatientRequest req)
    {
        var columns = await _schema.GetColumns("patient");

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        // Default billing type to the practice's first BillingTypes definition.
        var billingType = req.BillingType ?? await db.ExecuteScalarAsync<long?>(
            "SELECT DefNum FROM definition WHERE Category = 4 AND IsHidden = 0 ORDER BY ItemOrder LIMIT 1;",
            transaction: tx) ?? 0;

        var fields = BuildFieldDict(req, billingType);
        var (sql, p) = OdInsertBuilder.BuildInsert("patient", columns, fields);
        var patNum = await db.ExecuteScalarAsync<long>(sql, p, tx);

        // A patient with no family becomes their own guarantor (OpenDental convention:
        // CreateNewPatient inserts, then updates Guarantor to the new PatNum).
        if (req.Guarantor is null or 0)
        {
            await db.ExecuteAsync(
                "UPDATE patient SET Guarantor = @patNum WHERE PatNum = @patNum;",
                new { patNum }, tx);
        }

        await tx.CommitAsync();
        return patNum;
    }

    /// <summary>Map the typed request onto patient columns; merge validated ExtraFields on top.</summary>
    private static Dictionary<string, object?> BuildFieldDict(CreatePatientRequest req, long billingType)
    {
        var f = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["LName"] = req.LName.Trim(),
            ["FName"] = req.FName.Trim(),
            ["MiddleI"] = req.MiddleI,
            ["Preferred"] = req.Preferred,
            ["Gender"] = req.Gender,
            ["Birthdate"] = req.Birthdate,
            ["Address"] = req.Address,
            ["Address2"] = req.Address2,
            ["City"] = req.City,
            ["State"] = req.State,
            ["Zip"] = req.Zip,
            ["HmPhone"] = req.HmPhone,
            ["WkPhone"] = req.WkPhone,
            ["WirelessPhone"] = req.WirelessPhone,
            ["Email"] = req.Email,
            ["Guarantor"] = req.Guarantor ?? 0,
            ["PriProv"] = req.PriProv,
            ["ClinicNum"] = req.ClinicNum,
            ["BillingType"] = billingType,
            ["SecDateEntry"] = DateTime.Now,
            ["BillingCycleDay"] = 1,
        };
        ApplyCommonFields(f, req.Title, req.Salutation, req.Ssn, req.Position, req.ChartNumber,
            req.Language, req.County, req.Country, req.AddrNote, req.MedUrgNote, req.ApptModNote,
            req.FamFinUrgNote, req.EmploymentNote, req.TxtMsgOk, req.PreferContactMethod,
            req.PreferConfirmMethod, req.PreferRecallMethod, req.SecProv, req.FeeSched,
            req.DateFirstVisit, req.AskToArriveEarly, req.Premed);
        MergeExtraFields(f, req.ExtraFields);
        return f;
    }

    private static void ApplyCommonFields(Dictionary<string, object?> f,
        string? title, string? salutation, string? ssn, int? position, string? chartNumber,
        string? language, string? county, string? country, string? addrNote, string? medUrgNote,
        string? apptModNote, string? famFinUrgNote, string? employmentNote, int? txtMsgOk,
        int? preferContactMethod, int? preferConfirmMethod, int? preferRecallMethod,
        long? secProv, long? feeSched, DateOnly? dateFirstVisit, int? askToArriveEarly, int? premed)
    {
        f["Title"] = title;
        f["Salutation"] = salutation;
        f["SSN"] = ssn;
        f["Position"] = position;
        f["ChartNumber"] = chartNumber;
        f["Language"] = language;
        f["County"] = county;
        f["Country"] = country;
        f["AddrNote"] = addrNote;
        f["MedUrgNote"] = medUrgNote;
        f["ApptModNote"] = apptModNote;
        f["FamFinUrgNote"] = famFinUrgNote;
        f["EmploymentNote"] = employmentNote;
        f["TxtMsgOk"] = txtMsgOk;
        f["PreferContactMethod"] = preferContactMethod;
        f["PreferConfirmMethod"] = preferConfirmMethod;
        f["PreferRecallMethod"] = preferRecallMethod;
        f["SecProv"] = secProv;
        f["FeeSched"] = feeSched;
        f["DateFirstVisit"] = dateFirstVisit;
        f["AskToArriveEarly"] = askToArriveEarly;
        f["Premed"] = premed;
    }

    private static void MergeExtraFields(Dictionary<string, object?> f, Dictionary<string, object?>? extra)
    {
        if (extra == null) return;
        foreach (var (key, value) in extra)
            f[key] = value; // validated against the live schema by the builder
    }

    public async Task<bool> Update(long patNum, UpdatePatientRequest req)
    {
        var columns = await _schema.GetColumns("patient");

        var f = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["LName"] = req.LName,
            ["FName"] = req.FName,
            ["MiddleI"] = req.MiddleI,
            ["Preferred"] = req.Preferred,
            ["Birthdate"] = req.Birthdate,
            ["Gender"] = req.Gender,
            ["Address"] = req.Address,
            ["Address2"] = req.Address2,
            ["City"] = req.City,
            ["State"] = req.State,
            ["Zip"] = req.Zip,
            ["HmPhone"] = req.HmPhone,
            ["WkPhone"] = req.WkPhone,
            ["WirelessPhone"] = req.WirelessPhone,
            ["Email"] = req.Email,
            ["PriProv"] = req.PriProv,
            ["PatStatus"] = req.PatStatus,
            ["ClinicNum"] = req.ClinicNum,
            ["Guarantor"] = req.Guarantor,
            ["BillingType"] = req.BillingType,
        };
        ApplyCommonFields(f, req.Title, req.Salutation, req.Ssn, req.Position, req.ChartNumber,
            req.Language, req.County, req.Country, req.AddrNote, req.MedUrgNote, req.ApptModNote,
            req.FamFinUrgNote, req.EmploymentNote, req.TxtMsgOk, req.PreferContactMethod,
            req.PreferConfirmMethod, req.PreferRecallMethod, req.SecProv, req.FeeSched,
            req.DateFirstVisit, req.AskToArriveEarly, req.Premed);
        MergeExtraFields(f, req.ExtraFields);

        // Nulls mean "unchanged" and are dropped by the builder.
        if (f.Values.All(v => v == null)) return true;

        using var db = Db();
        var (sql, p) = OdInsertBuilder.BuildUpdate("patient", columns, patNum, f);
        var affected = await db.ExecuteAsync(sql, p);
        return affected > 0;
    }

    private static DateTime? NullDate(object? val) =>
        val is DateTime dt && dt > new DateTime(1900, 1, 1) ? dt : null;

    public static string PatientStatusDesc(int status) => status switch
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
}
