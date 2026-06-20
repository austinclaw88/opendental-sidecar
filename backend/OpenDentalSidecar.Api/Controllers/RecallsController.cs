using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/recalls")]
public class RecallsController : ControllerBase
{
    private readonly IRecallRepository _recalls;
    public RecallsController(IRecallRepository recalls) => _recalls = recalls;

    /// <summary>Recall due list for the front desk to work (defaults: due in the last 6 months through 1 month out).</summary>
    [HttpGet("due")]
    public async Task<ActionResult<IReadOnlyList<RecallDueDto>>> GetDue(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to, [FromQuery] bool includeScheduled = false)
    {
        var f = from ?? DateOnly.FromDateTime(DateTime.Today.AddMonths(-6));
        var t = to ?? DateOnly.FromDateTime(DateTime.Today.AddMonths(1));
        if (t < f) return BadRequest("'to' must be on or after 'from'.");
        return Ok(await _recalls.GetDue(f, t, includeScheduled));
    }
}
