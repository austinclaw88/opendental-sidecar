using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class AppointmentRepository : IAppointmentRepository
{
    private readonly string _connStr;
    public AppointmentRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<AppointmentDto>> GetByPatient(long patNum)
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.ProvNum, a.Op AS OperatoryNum,
                   a.AptDateTime, a.AptStatus, a.Note, a.ProcDescript, a.ClinicNum,
                   prov.Abbr AS ProviderName,
                   COALESCE(op.Abbrev, op.OpName) AS OperatoryName
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
            AptStatusDesc = StatusDesc((int)r.AptStatus),
            Note = (string?)r.Note,
            ProcDescript = (string?)r.ProcDescript,
            ClinicNum = (long?)r.ClinicNum,
        }).ToList();
    }

    public static string StatusDesc(int s) => s switch
    {
        1 => "Scheduled",
        2 => "Complete",
        3 => "UnschedList",
        5 => "Broken",
        6 => "Planned",
        7 => "PtNote",
        8 => "PtNoteCompleted",
        _ => $"Unknown ({s})",
    };
}
