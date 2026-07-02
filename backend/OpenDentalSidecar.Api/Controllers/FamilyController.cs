using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;

namespace OpenDentalSidecar.Api.Controllers;

public record MoveToFamilyRequest(long TargetPatNum);

[ApiController]
[Route("api/v1")]
public class FamilyController : ControllerBase
{
    private readonly IFamilyRepository _family;
    public FamilyController(IFamilyRepository family) => _family = family;

    /// <summary>Make this patient the guarantor of their family.</summary>
    [HttpPost("patients/{patNum:long}/set-guarantor")]
    public async Task<IActionResult> SetGuarantor(long patNum)
    {
        var updated = await _family.SetGuarantor(patNum);
        return Ok(new { updated });
    }

    /// <summary>Move this patient into another patient's family.</summary>
    [HttpPost("patients/{patNum:long}/move-to-family")]
    public async Task<IActionResult> MoveToFamily(long patNum, [FromBody] MoveToFamilyRequest req)
    {
        try
        {
            var ok = await _family.MoveToFamily(patNum, req.TargetPatNum);
            return ok ? Ok(new { moved = true }) : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
