namespace OpenDentalSidecar.Api.Models;

public record AppointmentDto
{
    public long AptNum { get; init; }
    public long PatNum { get; init; }
    public long? ProvNum { get; init; }
    public string? ProviderName { get; init; }
    public long? OperatoryNum { get; init; }
    public string? OperatoryName { get; init; }
    public DateTime AptDateTime { get; init; }
    public int AptStatus { get; init; }
    public string AptStatusDesc { get; init; } = "";
    public string? Note { get; init; }
    public string? ProcDescript { get; init; }
    public long? ClinicNum { get; init; }
}
