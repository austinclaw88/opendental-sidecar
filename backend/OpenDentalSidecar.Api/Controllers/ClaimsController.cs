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

    [HttpGet("{claimNum}")]
    public async Task<ActionResult<ClaimDetailDto>> GetClaim(long claimNum)
    {
        var claim = await _claims.GetDetail(claimNum);
        if (claim == null) return NotFound();
        return Ok(claim);
    }
}
