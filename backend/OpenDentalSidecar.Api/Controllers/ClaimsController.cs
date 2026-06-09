using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/claims")]
public class ClaimsController : ControllerBase
{
    private readonly OpenDentalRepository _repo;

    public ClaimsController(OpenDentalRepository repo) => _repo = repo;

    [HttpGet("{claimNum}")]
    public async Task<ActionResult<ClaimDetailDto>> GetClaim(long claimNum)
    {
        var claim = await _repo.GetClaimDetail(claimNum);
        if (claim == null) return NotFound();
        return Ok(claim);
    }
}
