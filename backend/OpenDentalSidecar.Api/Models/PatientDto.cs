namespace OpenDentalSidecar.Api.Models;

public record PatientSummaryDto
{
    public long PatNum { get; init; }
    public string LName { get; init; } = "";
    public string FName { get; init; } = "";
    public string? MiddleI { get; init; }
    public string? Preferred { get; init; }
    public DateTime? Birthdate { get; init; }
    public string? HmPhone { get; init; }
    public string? WkPhone { get; init; }
    public string? WirelessPhone { get; init; }
    public string? Email { get; init; }
    public int PatStatus { get; init; }
    public string PatStatusDesc { get; init; } = "";
}

public record PatientDetailDto
{
    public long PatNum { get; init; }
    public string LName { get; init; } = "";
    public string FName { get; init; } = "";
    public string? MiddleI { get; init; }
    public string? Preferred { get; init; }
    public DateTime? Birthdate { get; init; }
    // SSN intentionally excluded — PHI minimization
    public string? Address { get; init; }
    public string? Address2 { get; init; }
    public string? City { get; init; }
    public string? State { get; init; }
    public string? Zip { get; init; }
    public string? HmPhone { get; init; }
    public string? WkPhone { get; init; }
    public string? WirelessPhone { get; init; }
    public string? Email { get; init; }
    public int PatStatus { get; init; }
    public string PatStatusDesc { get; init; } = "";
    public long? Guarantor { get; init; }
    public string GuarantorName { get; init; } = "";
    public long? PreferredProvider { get; init; }
    public string PreferredProviderName { get; init; } = "";
    public List<InsuranceSummaryDto> InsurancePlans { get; init; } = [];
}

public record InsuranceSummaryDto
{
    public long PlanNum { get; init; }
    public string CarrierName { get; init; } = "";
    public string? GroupName { get; init; }
    public string? GroupId { get; init; }
    public int Ordinal { get; init; }
    public string? SubscriberName { get; init; }
    public string? SubscriberId { get; init; }
}
