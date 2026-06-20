using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class RecallRepository : IRecallRepository
{
    private readonly string _connStr;
    public RecallRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<RecallDueDto>> GetDue(DateOnly from, DateOnly to, bool includeScheduled)
    {
        using var db = Db();
        var sql = """
            SELECT r.RecallNum, r.PatNum, r.DateDue, r.DatePrevious, r.DateScheduled,
                   r.Note, r.IsDisabled,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   p.HmPhone, p.WirelessPhone, p.Email,
                   rt.Description AS RecallTypeDesc,
                   d.ItemName AS RecallStatusDesc
            FROM recall r
            JOIN patient p ON r.PatNum = p.PatNum
            LEFT JOIN recalltype rt ON r.RecallTypeNum = rt.RecallTypeNum
            LEFT JOIN definition d ON r.RecallStatus = d.DefNum
            WHERE r.IsDisabled = 0
              AND p.PatStatus = 0
              AND r.DateDue >= @from AND r.DateDue <= @to
              AND (@includeScheduled = 1 OR r.DateScheduled = '0001-01-01' OR r.DateScheduled IS NULL)
            ORDER BY r.DateDue
            LIMIT 1000;
            """;
        var rows = await db.QueryAsync(sql, new
        {
            from = from.ToDateTime(TimeOnly.MinValue),
            to = to.ToDateTime(TimeOnly.MinValue),
            includeScheduled = includeScheduled ? 1 : 0,
        });
        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<RecallDueDto>> GetByPatient(long patNum)
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT r.RecallNum, r.PatNum, r.DateDue, r.DatePrevious, r.DateScheduled,
                   r.Note, r.IsDisabled,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   p.HmPhone, p.WirelessPhone, p.Email,
                   rt.Description AS RecallTypeDesc,
                   d.ItemName AS RecallStatusDesc
            FROM recall r
            JOIN patient p ON r.PatNum = p.PatNum
            LEFT JOIN recalltype rt ON r.RecallTypeNum = rt.RecallTypeNum
            LEFT JOIN definition d ON r.RecallStatus = d.DefNum
            WHERE r.PatNum = @patNum
            ORDER BY r.DateDue DESC;
            """, new { patNum });
        return rows.Select(Map).ToList();
    }

    private static RecallDueDto Map(dynamic r) => new()
    {
        RecallNum = (long)r.RecallNum,
        PatNum = (long)r.PatNum,
        PatientName = (string)r.PatientName,
        HmPhone = (string?)r.HmPhone,
        WirelessPhone = (string?)r.WirelessPhone,
        Email = (string?)r.Email,
        DateDue = NullDate(r.DateDue),
        DatePrevious = NullDate(r.DatePrevious),
        DateScheduled = NullDate(r.DateScheduled),
        RecallTypeDesc = (string?)r.RecallTypeDesc ?? "",
        Note = (string?)r.Note,
        RecallStatusDesc = (string?)r.RecallStatusDesc,
        IsDisabled = Convert.ToInt32(r.IsDisabled) == 1,
    };

    private static DateTime? NullDate(object? val) =>
        val is DateTime dt && dt > new DateTime(1900, 1, 1) ? dt : null;
}
