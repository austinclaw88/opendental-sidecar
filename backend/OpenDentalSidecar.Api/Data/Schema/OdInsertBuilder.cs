using System.Text;
using System.Text.Json;
using Dapper;

namespace OpenDentalSidecar.Api.Data.Schema;

/// <summary>
/// Builds INSERTs and UPDATEs from the live table structure supplied by
/// <see cref="SchemaIntrospector"/>. Inserts cover every column the connected
/// database actually has (except the auto-increment key and auto-managed
/// timestamps), so they succeed under MySQL strict mode and adapt automatically
/// to the OpenDental version in use.
/// </summary>
public static class OdInsertBuilder
{
    /// <summary>
    /// Full-column INSERT. Values supplied in <paramref name="values"/>
    /// (case-insensitive column names) are used; every other column gets the
    /// type-appropriate OpenDental default. Returns SQL ending in
    /// SELECT LAST_INSERT_ID(). Values whose column doesn't exist in the live
    /// database throw a clear ArgumentException (surfaced as HTTP 400).
    /// </summary>
    public static (string Sql, DynamicParameters Params) BuildInsert(
        string table, IReadOnlyList<LiveColumn> columns, IDictionary<string, object?> values)
    {
        var provided = Normalize(table, columns, values);

        var cols = new StringBuilder();
        var vals = new StringBuilder();
        var p = new DynamicParameters();
        string? pkName = null;
        foreach (var col in columns)
        {
            if (col.Kind == ColumnKind.AutoPk) { pkName = col.Name; continue; }
            if (col.Kind == ColumnKind.Timestamp) continue;
            if (cols.Length > 0) { cols.Append(", "); vals.Append(", "); }
            cols.Append(col.Name);
            vals.Append('@').Append(col.Name);
            p.Add(col.Name, provided.TryGetValue(col.Name, out var v)
                ? Coerce(col, v)
                : DefaultFor(col.Kind));
        }
        _ = pkName; // tables without auto-increment keys are still insertable
        var sql = $"INSERT INTO {table} ({cols}) VALUES ({vals});\nSELECT LAST_INSERT_ID();";
        return (sql, p);
    }

    /// <summary>UPDATE setting only the supplied columns, validated against the live schema.</summary>
    public static (string Sql, DynamicParameters Params) BuildUpdate(
        string table, IReadOnlyList<LiveColumn> columns, long pkValue,
        IDictionary<string, object?> values)
    {
        var pk = columns.FirstOrDefault(c => c.Kind == ColumnKind.AutoPk)
            ?? throw new ArgumentException($"Table '{table}' has no auto-increment key.");
        var provided = Normalize(table, columns, values);

        var set = new StringBuilder();
        var p = new DynamicParameters();
        foreach (var (name, value) in provided)
        {
            var col = columns.First(c => c.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
            if (col.Kind is ColumnKind.AutoPk or ColumnKind.Timestamp) continue;
            if (set.Length > 0) set.Append(", ");
            set.Append(col.Name).Append(" = @").Append(col.Name);
            p.Add(col.Name, Coerce(col, value));
        }
        if (set.Length == 0)
            throw new ArgumentException("No updatable columns supplied.");
        p.Add("__pk", pkValue);
        return ($"UPDATE {table} SET {set} WHERE {pk.Name} = @__pk;", p);
    }

    // ── internals ───────────────────────────────────────────────

    /// <summary>Match provided keys to live columns; reject unknown columns, the PK, and timestamps.</summary>
    private static Dictionary<string, object?> Normalize(
        string table, IReadOnlyList<LiveColumn> columns, IDictionary<string, object?> values)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in values)
        {
            if (value == null) continue; // null means "not provided" -> default/unchanged
            var col = columns.FirstOrDefault(c => c.Name.Equals(key, StringComparison.OrdinalIgnoreCase))
                ?? throw new ArgumentException(
                    $"'{key}' is not a column on '{table}' in the connected database.");
            if (col.Kind == ColumnKind.AutoPk)
                throw new ArgumentException($"'{key}' is the primary key of '{table}' and cannot be written.");
            if (col.Kind == ColumnKind.Timestamp)
                throw new ArgumentException($"'{key}' is an auto-managed timestamp on '{table}' and cannot be written.");
            result[col.Name] = value;
        }
        return result;
    }

    private static object DefaultFor(ColumnKind kind) => kind switch
    {
        ColumnKind.Int => 0L,
        ColumnKind.Float => 0d,
        ColumnKind.String => "",
        ColumnKind.Date => new DateTime(1, 1, 1),
        ColumnKind.DateTime => new DateTime(1, 1, 1),
        ColumnKind.Time => TimeSpan.Zero,
        _ => throw new ArgumentException($"No default for {kind}."),
    };

    /// <summary>Coerce values (including System.Text.Json elements from ExtraFields) to DB types.</summary>
    private static object Coerce(LiveColumn col, object? value)
    {
        if (value is JsonElement je)
        {
            value = je.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                JsonValueKind.String => je.GetString(),
                JsonValueKind.Number => je.TryGetInt64(out var l) ? l : je.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => throw new ArgumentException($"Unsupported JSON value for column '{col.Name}'."),
            };
        }
        if (value == null) return DefaultFor(col.Kind);

        try
        {
            return col.Kind switch
            {
                ColumnKind.Int => value switch
                {
                    bool b => b ? 1L : 0L,
                    string s when s.Trim().Length == 0 => 0L,
                    string s => long.Parse(s),
                    _ => Convert.ToInt64(value),
                },
                ColumnKind.Float => value switch
                {
                    string s when s.Trim().Length == 0 => 0d,
                    string s => double.Parse(s),
                    _ => Convert.ToDouble(value),
                },
                ColumnKind.String => value.ToString() ?? "",
                ColumnKind.Date or ColumnKind.DateTime => value switch
                {
                    DateTime dt => dt,
                    DateOnly d => d.ToDateTime(TimeOnly.MinValue),
                    string s when s.Trim().Length == 0 => new DateTime(1, 1, 1),
                    string s => DateTime.Parse(s),
                    _ => throw new ArgumentException($"Cannot convert value to date for column '{col.Name}'."),
                },
                ColumnKind.Time => value switch
                {
                    TimeSpan ts => ts,
                    string s when s.Trim().Length == 0 => TimeSpan.Zero,
                    string s => TimeSpan.Parse(s),
                    _ => throw new ArgumentException($"Cannot convert value to time for column '{col.Name}'."),
                },
                _ => throw new ArgumentException($"Column '{col.Name}' ({col.Kind}) is not writable."),
            };
        }
        catch (FormatException)
        {
            throw new ArgumentException($"Value '{value}' is not valid for column '{col.Name}' ({col.Kind}).");
        }
    }
}
