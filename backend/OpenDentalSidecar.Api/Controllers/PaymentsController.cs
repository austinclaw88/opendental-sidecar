using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1")]
public class PaymentsController : ControllerBase
{
    private readonly IAccountRepository _accounts;
    public PaymentsController(IAccountRepository accounts) => _accounts = accounts;

    /// <summary>Record a ledger adjustment (courtesy discount, NSF fee, write-off, etc.).</summary>
    [HttpPost("adjustments")]
    public async Task<ActionResult<WriteResultDto>> CreateAdjustment([FromBody] CreateAdjustmentRequest req)
    {
        try
        {
            var adjNum = await _accounts.CreateAdjustment(req);
            return Ok(new WriteResultDto { Id = adjNum, Message = "Adjustment recorded" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Record a patient payment (payment row plus a matching paysplit).</summary>
    [HttpPost("payments")]
    public async Task<ActionResult<WriteResultDto>> Create([FromBody] CreatePaymentRequest req)
    {
        try
        {
            var payNum = await _accounts.CreatePayment(req);
            return Ok(new WriteResultDto { Id = payNum, Message = "Payment recorded" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
