namespace OpenDentalSidecar.Api.Models;

public record ProcedureDto
{
    public long ProcNum { get; init; }
    public long PatNum { get; init; }
    public long? ProvNum { get; init; }
    public string? ProviderName { get; init; }
    public long? AptNum { get; init; }
    public long CodeNum { get; init; }
    public string ProcCode { get; init; } = "";
    public string Descript { get; init; } = "";
    public DateTime ProcDate { get; init; }
    public double ProcFee { get; init; }
    public int ProcStatus { get; init; }
    public string ProcStatusDesc { get; init; } = "";
    public string? ToothNum { get; init; }
    public string? ToothRange { get; init; }
    public string? Surf { get; init; }
    public string? ProcNotes { get; init; }
}
