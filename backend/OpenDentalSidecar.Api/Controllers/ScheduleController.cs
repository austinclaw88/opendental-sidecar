using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/schedule")]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleRepository _schedule;
    public ScheduleController(IScheduleRepository schedule) => _schedule = schedule;

    /// <summary>The full appointment book for one day: operatories, appointments, blockouts, provider hours.</summary>
    [HttpGet("day")]
    public async Task<ActionResult<ScheduleDayDto>> GetDay(
        [FromQuery] DateOnly? date, [FromQuery] long? clinicNum)
        => Ok(await _schedule.GetDay(date ?? DateOnly.FromDateTime(DateTime.Today), clinicNum));

    /// <summary>The appointment book for a date range (used by the week view). Max 31 days.</summary>
    [HttpGet("range")]
    public async Task<ActionResult<IReadOnlyList<ScheduleDayDto>>> GetRange(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, [FromQuery] long? clinicNum)
    {
        if (to < from) return BadRequest("'to' must be on or after 'from'.");
        if (to.DayNumber - from.DayNumber > 31) return BadRequest("Range is limited to 31 days.");
        return Ok(await _schedule.GetRange(from, to, clinicNum));
    }

    /// <summary>Appointments in a date range that need confirmation calls.</summary>
    [HttpGet("confirmations")]
    public async Task<ActionResult<IReadOnlyList<ConfirmationItemDto>>> GetConfirmations(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var f = from ?? DateOnly.FromDateTime(DateTime.Today.AddDays(1));
        var t = to ?? f;
        if (t < f) return BadRequest("'to' must be on or after 'from'.");
        return Ok(await _schedule.GetConfirmationList(f, t));
    }
}
