using System.Text.Json;

namespace OpenDentalSidecar.Api.Middleware;

/// <summary>
/// Safety switch. When SIDECAR_READONLY=true (env var or config "Sidecar:ReadOnly"),
/// every non-GET/HEAD/OPTIONS request is rejected with 403 before it reaches a controller.
/// Lets you run the sidecar against a production OpenDental database in viewer-only mode,
/// then flip writes on once you have granted the MySQL user INSERT/UPDATE and tested.
/// </summary>
public class ReadOnlyGuardMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _readOnly;

    public ReadOnlyGuardMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        var env = Environment.GetEnvironmentVariable("SIDECAR_READONLY");
        _readOnly = string.Equals(env, "true", StringComparison.OrdinalIgnoreCase)
                    || env == "1"
                    || config.GetValue<bool>("Sidecar:ReadOnly");
    }

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (_readOnly && !HttpMethods.IsGet(ctx.Request.Method)
                      && !HttpMethods.IsHead(ctx.Request.Method)
                      && !HttpMethods.IsOptions(ctx.Request.Method))
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                error = "Sidecar is running in read-only mode. Set SIDECAR_READONLY=false to enable writes."
            }));
            return;
        }

        await _next(ctx);
    }
}
