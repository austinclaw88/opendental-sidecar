using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class ProcedureRepository : IProcedureRepository
{
    private readonly string _connStr;
    public ProcedureRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<ProcedureDto>> GetByPatient(long patNum)
    {
        using var db = Db();
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
            ProcStatusDesc = StatusDesc((int)r.ProcStatus),
            ToothNum = (string?)r.ToothNum,
            ToothRange = (string?)r.ToothRange,
            Surf = (string?)r.Surf,
            ProcNotes = (string?)r.ClaimNote,
        }).ToList();
    }

    public static string StatusDesc(int s) => s switch
    {
        1 => "Treatment Planned",
        2 => "Complete",
        3 => "Existing Current",
        4 => "Existing Other",
        5 => "Referred",
        6 => "Deleted",
        7 => "Condition",
        8 => "TP Inactive",
        _ => $"Unknown ({s})",
    };
}
