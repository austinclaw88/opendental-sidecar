using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/claims")]
public class ClaimsController : ControllerBase
{
    private readonly ClaimRepository _claims;

    public ClaimsController(ClaimRepository claims) => _claims = claims;

    [HttpGet("{claimNum}")]
    public async Task<ActionResult<ClaimDetailDto>> GetClaim(long claimNum)
    {
        var claim = await _claims.GetDetail(claimNum);
        if (claim == null) return NotFound();
        return Ok(claim);
    }
}
