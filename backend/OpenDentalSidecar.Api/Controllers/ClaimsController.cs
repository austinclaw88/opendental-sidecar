using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/claims")]
public class ClaimsController : ControllerBase
{
    private readonly IClaimRepository _claims;

    public ClaimsController(IClaimRepository claims) => _claims = claims;

    /// <summary>Clinic-wide claims work queue. status: U Unsent, H Hold, W Waiting, S Sent, R Received,
    /// or "open" for everything not yet received. Omit for all claims in the window.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClaimQueueItemDto>>> GetQueue(
        [FromQuery] string? status, [FromQuery] int days = 365)
    {
        try
        {
            return Ok(await _claims.GetQueue(status, Math.Clamp(days, 1, 3650)));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{claimNum}")]
    public async Task<ActionResult<ClaimDetailDto>> GetClaim(long claimNum)
    {
        var claim = await _claims.GetDetail(claimNum);
        if (claim == null) return NotFound();
        return Ok(claim);
    }
}
