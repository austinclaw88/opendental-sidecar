using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/appointments")]
public class AppointmentsController : ControllerBase
{
    private readonly IAppointmentRepository _appointments;

    public AppointmentsController(IAppointmentRepository appointments)
        => _appointments = appointments;

    /// <summary>Unscheduled list: broken + unscheduled appointments for active patients.</summary>
    [HttpGet("unscheduled")]
    public async Task<ActionResult<IReadOnlyList<ConfirmationItemDto>>> GetUnscheduled()
        => Ok(await _appointments.GetUnscheduled());

    /// <summary>ASAP list: appointments flagged Priority=1 waiting for an earlier opening.</summary>
    [HttpGet("asap")]
    public async Task<ActionResult<IReadOnlyList<ConfirmationItemDto>>> GetAsap()
        => Ok(await _appointments.GetAsap());

    [HttpGet("{aptNum:long}")]
    public async Task<ActionResult<AppointmentDetailDto>> GetDetail(long aptNum)
    {
        var apt = await _appointments.GetDetail(aptNum);
        if (apt == null) return NotFound();
        return Ok(apt);
    }

    /// <summary>Book a new appointment. Returns the new AptNum.</summary>
    [HttpPost]
    public async Task<ActionResult<WriteResultDto>> Create([FromBody] CreateAppointmentRequest req)
    {
        if (req.PatNum <= 0) return BadRequest(new { error = "PatNum is required." });
        if (req.OperatoryNum <= 0) return BadRequest(new { error = "OperatoryNum is required." });
        if (req.Minutes is < 5 or > 540)
            return BadRequest(new { error = "Minutes must be between 5 and 540." });

        try
        {
            var aptNum = await _appointments.Create(req);
            return CreatedAtAction(nameof(GetDetail), new { aptNum },
                new WriteResultDto { Id = aptNum, Message = "Appointment created." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Edit an appointment (move, re-time, change provider/op/note).</summary>
    [HttpPut("{aptNum:long}")]
    public async Task<ActionResult<WriteResultDto>> Update(long aptNum, [FromBody] UpdateAppointmentRequest req)
    {
        try
        {
            var ok = await _appointments.Update(aptNum, req);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = aptNum, Message = "Appointment updated." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Set status: 1 Scheduled, 2 Complete, 3 Unscheduled list, 5 Broken.</summary>
    [HttpPut("{aptNum:long}/status")]
    public async Task<ActionResult<WriteResultDto>> SetStatus(long aptNum, [FromBody] SetAppointmentStatusRequest req)
    {
        try
        {
            var ok = await _appointments.SetStatus(aptNum, req.AptStatus, req.Reason);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = aptNum, Message = "Status updated." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Flag or unflag an appointment as ASAP (0 Normal, 1 ASAP).</summary>
    [HttpPut("{aptNum:long}/priority")]
    public async Task<ActionResult<WriteResultDto>> SetPriority(long aptNum, [FromBody] SetPriorityRequest req)
    {
        try
        {
            var ok = await _appointments.SetPriority(aptNum, req.Priority);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = aptNum, Message = "Priority updated." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Set confirmation status (DefNum from definition category 2).</summary>
    [HttpPut("{aptNum:long}/confirmation")]
    public async Task<ActionResult<WriteResultDto>> SetConfirmation(long aptNum, [FromBody] SetConfirmationRequest req)
    {
        try
        {
            var ok = await _appointments.SetConfirmation(aptNum, req.ConfirmedDefNum);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = aptNum, Message = "Confirmation updated." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Stamp or clear arrived / seated / dismissed times for office flow.</summary>
    [HttpPut("{aptNum:long}/flow")]
    public async Task<ActionResult<WriteResultDto>> SetFlowTime(long aptNum, [FromBody] SetFlowTimeRequest req)
    {
        try
        {
            var ok = await _appointments.SetFlowTime(aptNum, req.Milestone, req.Clear);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto
            {
                Id = aptNum,
                Message = req.Clear ? $"{req.Milestone} time cleared." : $"Marked {req.Milestone}."
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
