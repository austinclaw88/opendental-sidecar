using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/patients")]
public class PatientsController : ControllerBase
{
    private readonly OpenDentalRepository _repo;

    public PatientsController(OpenDentalRepository repo) => _repo = repo;

    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<PatientSummaryDto>>> Search(
        [FromQuery] string q, [FromQuery] int limit = 50)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<PatientSummaryDto>());
        return Ok(await _repo.SearchPatients(q.Trim(), limit));
    }

    [HttpGet("{patNum}")]
    public async Task<ActionResult<PatientDetailDto>> GetPatient(long patNum)
    {
        var patient = await _repo.GetPatient(patNum);
        if (patient == null) return NotFound();
        return Ok(patient);
    }

    [HttpGet("{patNum}/appointments")]
    public async Task<ActionResult<IReadOnlyList<AppointmentDto>>> GetAppointments(long patNum)
        => Ok(await _repo.GetAppointments(patNum));

    [HttpGet("{patNum}/procedures")]
    public async Task<ActionResult<IReadOnlyList<ProcedureDto>>> GetProcedures(long patNum)
        => Ok(await _repo.GetProcedures(patNum));

    [HttpGet("{patNum}/claims")]
    public async Task<ActionResult<IReadOnlyList<ClaimDto>>> GetClaims(long patNum)
        => Ok(await _repo.GetClaims(patNum));
}
