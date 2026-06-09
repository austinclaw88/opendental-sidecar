using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class PatientRepository : IPatientRepository
{
    private readonly string _connStr;
    public PatientRepository(string connStr) => _connStr = connStr;
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
                   g.LName AS GuarLName, g.FName AS GuarFName,
                   pri.Abbr AS PriProvAbbr
            FROM patient p
            LEFT JOIN patient g ON p.Guarantor = g.PatNum
            LEFT JOIN provider pri ON p.PriProv = pri.ProvNum
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
