using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class InsuranceController : ControllerBase
{
    private readonly IInsuranceRepository _insurance;
    public InsuranceController(IInsuranceRepository insurance) => _insurance = insurance;

    /// <summary>Full insurance coverage for a patient (carrier, plan, subscriber, ordinal).</summary>
    [HttpGet("patients/{patNum:long}/insurance")]
    public async Task<ActionResult<IReadOnlyList<InsuranceCoverageDto>>> GetByPatient(long patNum)
        => Ok(await _insurance.GetByPatient(patNum));

    /// <summary>Attach insurance coverage to a patient. Finds or creates the carrier, plan, and subscriber rows.</summary>
    [HttpPost("patients/{patNum:long}/insurance")]
    public async Task<ActionResult<WriteResultDto>> AddCoverage(long patNum, [FromBody] CreateInsuranceRequest req)
    {
        try
        {
            var patPlanNum = await _insurance.AddCoverage(patNum, req);
            return Ok(new WriteResultDto { Id = patPlanNum, Message = "Coverage added" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Update a coverage row: ordinal (swaps with the holder), relationship, subscriber ID, termination date, note.</summary>
    [HttpPut("insurance/{patPlanNum:long}")]
    public async Task<ActionResult<WriteResultDto>> UpdateCoverage(long patPlanNum, [FromBody] UpdatePatPlanRequest req)
    {
        try
        {
            var ok = await _insurance.UpdateCoverage(patPlanNum, req);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = patPlanNum, Message = "Coverage updated" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Drop coverage from a patient. Removes the patplan link only; plan and subscriber rows are kept for history.</summary>
    [HttpDelete("insurance/{patPlanNum:long}")]
    public async Task<ActionResult<WriteResultDto>> DropCoverage(long patPlanNum)
    {
        var ok = await _insurance.DropCoverage(patPlanNum);
        if (!ok) return NotFound();
        return Ok(new WriteResultDto { Id = patPlanNum, Message = "Coverage dropped" });
    }

    /// <summary>Search carriers by name for the add-insurance picker.</summary>
    [HttpGet("reference/carriers")]
    public async Task<ActionResult<IReadOnlyList<CarrierDto>>> SearchCarriers([FromQuery] string? q)
        => Ok(await _insurance.SearchCarriers(q));
}
