using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/patients")]
public class PatientsController : ControllerBase
{
    private readonly IPatientRepository _patients;
    private readonly IAppointmentRepository _appointments;
    private readonly IProcedureRepository _procedures;
    private readonly IClaimRepository _claims;
    private readonly IAccountRepository _account;
    private readonly ICommlogRepository _commlogs;
    private readonly IRecallRepository _recalls;

    public PatientsController(
        IPatientRepository patients,
        IAppointmentRepository appointments,
        IProcedureRepository procedures,
        IClaimRepository claims,
        IAccountRepository account,
        ICommlogRepository commlogs,
        IRecallRepository recalls)
    {
        _patients = patients;
        _appointments = appointments;
        _procedures = procedures;
        _claims = claims;
        _account = account;
        _commlogs = commlogs;
        _recalls = recalls;
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

    /// <summary>Create a new patient. Returns the new PatNum.</summary>
    [HttpPost]
    public async Task<ActionResult<WriteResultDto>> Create([FromBody] CreatePatientRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.LName) || string.IsNullOrWhiteSpace(req.FName))
            return BadRequest(new { error = "First and last name are required." });

        try
        {
            var patNum = await _patients.Create(req);
            return CreatedAtAction(nameof(GetPatient), new { patNum },
                new WriteResultDto { Id = patNum, Message = "Patient created." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>Edit patient demographics and contact info.</summary>
    [HttpPut("{patNum}")]
    public async Task<ActionResult<WriteResultDto>> Update(long patNum, [FromBody] UpdatePatientRequest req)
    {
        try
        {
            var ok = await _patients.Update(patNum, req);
            if (!ok) return NotFound();
            return Ok(new WriteResultDto { Id = patNum, Message = "Patient updated." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
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

    /// <summary>Family members sharing this patient's guarantor.</summary>
    [HttpGet("{patNum}/family")]
    public async Task<ActionResult<IReadOnlyList<FamilyMemberDto>>> GetFamily(long patNum)
        => Ok(await _account.GetFamily(patNum));

    /// <summary>Family ledger: charges, payments, adjustments, insurance, running balance.</summary>
    [HttpGet("{patNum}/account")]
    public async Task<ActionResult<AccountSummaryDto>> GetAccount(long patNum)
    {
        var account = await _account.GetFamilyAccount(patNum);
        if (account == null) return NotFound();
        return Ok(account);
    }

    [HttpGet("{patNum}/commlogs")]
    public async Task<ActionResult<IReadOnlyList<CommlogDto>>> GetCommlogs(long patNum, [FromQuery] int limit = 200)
        => Ok(await _commlogs.GetByPatient(patNum, limit));

    [HttpGet("{patNum}/recalls")]
    public async Task<ActionResult<IReadOnlyList<RecallDueDto>>> GetRecalls(long patNum)
        => Ok(await _recalls.GetByPatient(patNum));
}
