using System.Text.Json;
using MySqlConnector;

namespace OpenDentalSidecar.Api.Middleware;

/// <summary>
/// Converts exceptions into readable JSON instead of opaque 500s:
///   ArgumentException        -> 400 { error }
///   InvalidOperationException-> 409 { error }
///   MySql connection failures -> 503 { error }
///   MySql permission failures -> 403 { error }
///   MySqlException            -> 500 { error }
/// Full database details are logged server-side instead of returned to clients.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            var (status, body) = ex switch
            {
                ArgumentException ae => (StatusCodes.Status400BadRequest,
                    (object)new { error = ae.Message }),
                InvalidOperationException ioe => (StatusCodes.Status409Conflict,
                    (object)new { error = ioe.Message }),
                MySqlException me when me.Number == 1042 || me.Number == 0 => (StatusCodes.Status503ServiceUnavailable,
                    (object)new
                    {
                        error = "Database connection failed. Check the OpenDental connection string and network access.",
                    }),
                MySqlException me when me.Number == 1142 => (StatusCodes.Status403Forbidden,
                    (object)new
                    {
                        error = "The configured database user does not have permission for this write. Use a write-enabled MySQL user or run the sidecar in read-only mode.",
                    }),
                MySqlException me => (StatusCodes.Status500InternalServerError,
                    (object)new
                    {
                        error = "Database error. Check the backend logs for details.",
                    }),
                _ => (StatusCodes.Status500InternalServerError,
                    (object)new { error = ex.Message }),
            };

            if (status >= 500)
                _logger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            else
                _logger.LogWarning("Request rejected for {Method} {Path}: {Message}", context.Request.Method, context.Request.Path, ex.Message);

            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(body, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            }));
        }
    }
}
