using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class BenefitsController : ControllerBase
{
    private readonly IBenefitRepository _benefits;
    public BenefitsController(IBenefitRepository benefits) => _benefits = benefits;

    /// <summary>Insurance benefits for a patient, grouped by plan: annual max, deductible,
    /// and coverage % by category, plus the full benefit line list.</summary>
    [HttpGet("patients/{patNum:long}/benefits")]
    public async Task<ActionResult<IReadOnlyList<PlanBenefitsDto>>> GetByPatient(long patNum)
        => Ok(await _benefits.GetByPatient(patNum));
}
