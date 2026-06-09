using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.IO;

namespace OpenDentalSidecar.Api.Middleware;

/// <summary>
/// Logs read-only API access to a structured audit file.
/// Records: timestamp, user, method, route, and patient/claim IDs found in the URL.
/// File is rotated daily. Buffer flushed every 5s or 50 entries.
/// </summary>
public class AuditMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string _logDir;
    private static readonly ConcurrentQueue<AuditEntry> _buffer = new();
    private static readonly RecyclableMemoryStreamManager _mem = new();
    private static readonly string[] _idPatterns = ["patNum", "claimNum", "appointmentNum", "procNum"];

    private static DateTime _lastFlush = DateTime.UtcNow;
    private static readonly object _flushLock = new();

    public AuditMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _logDir = config.GetValue<string>("Audit:LogDir") ?? "logs/audit";
        Directory.CreateDirectory(_logDir);
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        var entry = new AuditEntry
        {
            Timestamp = DateTime.UtcNow,
            Method = ctx.Request.Method,
            Path = ctx.Request.Path,
            QueryString = ctx.Request.QueryString.ToString(),
        };

        // Extract entity IDs from route
        foreach (var seg in ctx.Request.Path.ToString().Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            if (long.TryParse(seg, out var id))
            {
                // Determine context from the preceding path segment
                var parts = ctx.Request.Path.ToString().Split('/', StringSplitOptions.RemoveEmptyEntries);
                var idx = Array.IndexOf(parts, seg);
                if (idx > 0)
                {
                    var ctxSegment = parts[idx - 1].ToLowerInvariant();
                    if (ctxSegment is "patients" or "claims" or "appointments" or "procedures")
                        entry.ResourceType = ctxSegment.TrimEnd('s');
                    entry.ResourceId = id;
                    break;
                }
            }
        }

        _buffer.Enqueue(entry);

        // Flush every 50 entries or 5 seconds
        if (_buffer.Count >= 50 || (DateTime.UtcNow - _lastFlush).TotalSeconds >= 5)
            Flush();

        await _next(ctx);
    }

    public static void Flush()
    {
        lock (_flushLock)
        {
            if (_buffer.IsEmpty) return;
            var entries = new List<AuditEntry>();
            while (_buffer.TryDequeue(out var e)) entries.Add(e);
            if (entries.Count == 0) return;

            var date = DateTime.UtcNow.ToString("yyyy-MM-dd");
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", _logDir);
            Directory.CreateDirectory(path);
            var file = Path.Combine(path, $"audit-{date}.jsonl");

            var lines = entries.Select(e => JsonSerializer.Serialize(e, JsonOptions));
            File.AppendAllLines(file, lines);
            _lastFlush = DateTime.UtcNow;
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };
}

public record AuditEntry
{
    public DateTime Timestamp { get; init; }
    public string Method { get; init; } = "";
    public string Path { get; init; } = "";
    public string? QueryString { get; init; }
    public string? ResourceType { get; init; }
    public long? ResourceId { get; init; }
    public string? User { get; init; }
}
