using System.Collections.Concurrent;
using Dapper;
using MySqlConnector;

namespace OpenDentalSidecar.Api.Data.Schema;

public enum ColumnKind { AutoPk, Int, Float, String, Date, DateTime, Time, Timestamp }

public record LiveColumn(string Name, ColumnKind Kind);

/// <summary>
/// Reads the live database's actual table structure from information_schema and
/// caches it. Writes are driven by this, not a hard-coded column list, so the
/// sidecar works unchanged against OpenDental 24-3, 25-4, or future schemas:
/// inserts cover exactly the columns the connected database has.
/// </summary>
public class SchemaIntrospector
{
    private readonly string _connStr;
    private readonly ConcurrentDictionary<string, IReadOnlyList<LiveColumn>> _cache = new(StringComparer.OrdinalIgnoreCase);

    public SchemaIntrospector(string connStr) => _connStr = connStr;

    public async Task<IReadOnlyList<LiveColumn>> GetColumns(string table)
    {
        if (_cache.TryGetValue(table, out var cached)) return cached;

        using var db = new MySqlConnection(_connStr);
        var rows = await db.QueryAsync("""
            SELECT COLUMN_NAME AS Name, DATA_TYPE AS DataType, EXTRA AS Extra
            FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = @table
            ORDER BY ORDINAL_POSITION;
            """, new { table });

        var cols = new List<LiveColumn>();
        foreach (var r in rows)
        {
            string name = (string)r.Name;
            string dataType = ((string)r.DataType).ToLowerInvariant();
            string extra = ((string?)r.Extra ?? "").ToLowerInvariant();
            var kind = extra.Contains("auto_increment") ? ColumnKind.AutoPk : Classify(dataType);
            cols.Add(new LiveColumn(name, kind));
        }
        if (cols.Count == 0)
            throw new ArgumentException(
                $"Table '{table}' does not exist in the connected database. " +
                "Check the connection string points at the OpenDental schema.");

        var result = (IReadOnlyList<LiveColumn>)cols;
        _cache[table] = result;
        return result;
    }

    /// <summary>Drop the cache (e.g. after pointing at a different database).</summary>
    public void Invalidate() => _cache.Clear();

    private static ColumnKind Classify(string dataType) => dataType switch
    {
        "timestamp" => ColumnKind.Timestamp,
        "datetime" => ColumnKind.DateTime,
        "date" => ColumnKind.Date,
        "time" => ColumnKind.Time,
        "double" or "float" or "decimal" => ColumnKind.Float,
        "bigint" or "int" or "mediumint" or "smallint" or "tinyint" or "bit" or "year" => ColumnKind.Int,
        // varchar, char, text family, blob family, enum, set, json
        _ => ColumnKind.String,
    };
}
