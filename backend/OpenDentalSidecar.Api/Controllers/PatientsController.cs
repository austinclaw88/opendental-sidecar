using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/patients")]
public class PatientsController : ControllerBase
{
    private readonly PatientRepository _patients;
    private readonly AppointmentRepository _appointments;
    private readonly ProcedureRepository _procedures;
    private readonly ClaimRepository _claims;

    public PatientsController(
        PatientRepository patients,
        AppointmentRepository appointments,
        ProcedureRepository procedures,
        ClaimRepository claims)
    {
        _patients = patients;
        _appointments = appointments;
        _procedures = procedures;
        _claims = claims;
    }

    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<PatientSummaryDto>>> Search(
        [FromQuery] string q, [FromQuery] int limit = 50)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<PatientSummaryDto>());
        return Ok(await _patients.Search(q.Trim(), limit));
    }

    [HttpGet("{patNum}")]
    public async Task<ActionResult<PatientDetailDto>> GetPatient(long patNum)
    {
        var patient = await _patients.GetDetail(patNum);
        if (patient == null) return NotFound();
        return Ok(patient);
    }

    [HttpGet("{patNum}/appointments")]
    public async Task<ActionResult<IReadOnlyList<AppointmentDto>>> GetAppointments(long patNum)
        => Ok(await _appointments.GetByPatient(patNum));

    [HttpGet("{patNum}/procedures")]
    public async Task<ActionResult<IReadOnlyList<ProcedureDto>>> GetProcedures(long patNum)
        => Ok(await _procedures.GetByPatient(patNum));

    [HttpGet("{patNum}/claims")]
    public async Task<ActionResult<IReadOnlyList<ClaimDto>>> GetClaims(long patNum)
        => Ok(await _claims.GetByPatient(patNum));
}
