using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/commlogs")]
public class CommlogsController : ControllerBase
{
    private readonly ICommlogRepository _commlogs;
    public CommlogsController(ICommlogRepository commlogs) => _commlogs = commlogs;

    /// <summary>Log a communication entry (call, text, email, in person) for a patient.</summary>
    [HttpPost]
    public async Task<ActionResult<WriteResultDto>> Create([FromBody] CreateCommlogRequest req)
    {
        try
        {
            var id = await _commlogs.Create(req);
            return Ok(new WriteResultDto { Id = id, Message = "Communication logged" });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
