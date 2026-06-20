using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;
using OpenDentalSidecar.Api.Data.Schema;

namespace OpenDentalSidecar.Api.Data;

public class CommlogRepository : ICommlogRepository
{
    private readonly string _connStr;
    private readonly SchemaIntrospector _schema;
    public CommlogRepository(string connStr, SchemaIntrospector schema)
    {
        _connStr = connStr;
        _schema = schema;
    }
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<CommlogDto>> GetByPatient(long patNum, int limit = 200)
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT c.CommlogNum, c.PatNum, c.CommDateTime, c.CommType, c.Mode_, c.SentOrReceived, c.Note,
                   d.ItemName AS CommTypeDesc
            FROM commlog c
            LEFT JOIN definition d ON c.CommType = d.DefNum
            WHERE c.PatNum = @patNum
            ORDER BY c.CommDateTime DESC
            LIMIT @lim;
            """, new { patNum, lim = limit });
        return rows.Select(r => new CommlogDto
        {
            CommlogNum = (long)r.CommlogNum,
            PatNum = (long)r.PatNum,
            CommDateTime = (DateTime)r.CommDateTime,
            CommType = (long)r.CommType,
            CommTypeDesc = (string?)r.CommTypeDesc ?? "",
            Mode = Convert.ToInt32(r.Mode_),
            ModeDesc = ModeDesc(Convert.ToInt32(r.Mode_)),
            SentOrReceived = Convert.ToInt32(r.SentOrReceived),
            Note = (string?)r.Note,
        }).ToList();
    }

    public async Task<long> Create(CreateCommlogRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Note))
            throw new ArgumentException("Note is required.");

        using var db = Db();
        var columns = await _schema.GetColumns("commlog");
        var (sql, p) = OdInsertBuilder.BuildInsert("commlog", columns,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["PatNum"] = req.PatNum,
                ["CommDateTime"] = DateTime.Now,
                ["CommType"] = req.CommType,
                ["Note"] = req.Note.Trim(),
                ["Mode_"] = req.Mode,
                ["SentOrReceived"] = req.SentOrReceived,
                ["DateTEntry"] = DateTime.Now,
            });
        return await db.ExecuteScalarAsync<long>(sql, p);
    }

    public static string ModeDesc(int mode) => mode switch
    {
        0 => "None",
        1 => "Email",
        2 => "Mail",
        3 => "Phone",
        4 => "In person",
        5 => "Text",
        6 => "Email + text",
        7 => "Phone + text",
        8 => "Fax",
        _ => $"Mode {mode}",
    };
}
