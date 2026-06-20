using Microsoft.AspNetCore.Mvc;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Controllers;

[ApiController]
[Route("api/v1/reference")]
public class ReferenceController : ControllerBase
{
    private readonly IReferenceRepository _reference;
    public ReferenceController(IReferenceRepository reference) => _reference = reference;

    [HttpGet("operatories")]
    public async Task<ActionResult<IReadOnlyList<OperatoryDto>>> GetOperatories()
        => Ok(await _reference.GetOperatories());

    [HttpGet("providers")]
    public async Task<ActionResult<IReadOnlyList<ProviderDto>>> GetProviders()
        => Ok(await _reference.GetProviders());

    [HttpGet("appointment-types")]
    public async Task<ActionResult<IReadOnlyList<AppointmentTypeDto>>> GetAppointmentTypes()
        => Ok(await _reference.GetAppointmentTypes());

    [HttpGet("clinics")]
    public async Task<ActionResult<IReadOnlyList<ClinicDto>>> GetClinics()
        => Ok(await _reference.GetClinics());

    /// <summary>Raw definition rows for a category (2 ApptConfirmed, 10 PaymentTypes, 27 CommLogTypes, ...).</summary>
    [HttpGet("definitions/{category:int}")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetDefinitions(int category)
        => Ok(await _reference.GetDefinitions(category));

    [HttpGet("confirmation-statuses")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetConfirmationStatuses()
        => Ok(await _reference.GetDefinitions(2));

    [HttpGet("payment-types")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetPaymentTypes()
        => Ok(await _reference.GetDefinitions(10));

    [HttpGet("adjustment-types")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetAdjustmentTypes()
        => Ok(await _reference.GetDefinitions(1));

    [HttpGet("billing-types")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetBillingTypes()
        => Ok(await _reference.GetDefinitions(4));

    [HttpGet("commlog-types")]
    public async Task<ActionResult<IReadOnlyList<DefinitionDto>>> GetCommlogTypes()
        => Ok(await _reference.GetDefinitions(27));
}
