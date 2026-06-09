namespace OpenDentalSidecar.Api.Models;

public record ClaimDto
{
    public long ClaimNum { get; init; }
    public long PatNum { get; init; }
    public long? ProvNum { get; init; }
    public string? ProviderName { get; init; }
    public long? PlanNum { get; init; }
    public string? CarrierName { get; init; }
    public long? InsSubNum { get; init; }
    public int ClaimStatus { get; init; }
    public string ClaimStatusDesc { get; init; } = "";
    public DateTime? DateService { get; init; }
    public DateTime? DateSent { get; init; }
    public double ClaimFee { get; init; }
    public double InsPayAmt { get; init; }
    public double WriteOff { get; init; }
    public double DedApplied { get; init; }
    public string? ClaimProcStatusDesc { get; init; }
    public long? CarrierNum { get; init; }
    public int? ClaimForm { get; init; }
}

public record ClaimDetailDto
{
    public long ClaimNum { get; init; }
    public long PatNum { get; init; }
    public int ClaimStatus { get; init; }
    public string ClaimStatusDesc { get; init; } = "";
    public string? CarrierName { get; init; }
    public DateTime? DateService { get; init; }
    public DateTime? DateSent { get; init; }
    public DateTime? DateReceived { get; init; }
    public double ClaimFee { get; init; }
    public double InsPayAmt { get; init; }
    public double WriteOff { get; init; }
    public double DedApplied { get; init; }
    public double BalanceRemaining { get; init; }
    public double InsEstimate { get; init; }
    public int? ClaimForm { get; init; }
    public string? ProviderName { get; init; }
    public List<ClaimProcDto> Procedures { get; init; } = [];
    public List<ClaimPaymentDto> Payments { get; init; } = [];
}

public record ClaimProcDto
{
    public long ClaimProcNum { get; init; }
    public long ClaimNum { get; init; }
    public long ProcNum { get; init; }
    public string ProcCode { get; init; } = "";
    public string Descript { get; init; } = "";
    public double ProcFee { get; init; }
    public double InsPayAmt { get; init; }
    public double DedApplied { get; init; }
    public double WriteOff { get; init; }
    public int Status { get; init; }
    public string StatusDesc { get; init; } = "";
    public string? ToothNum { get; init; }
    public string? Surf { get; init; }
}

public record ClaimPaymentDto
{
    public long ClaimPaymentNum { get; init; }
    public long ClaimNum { get; init; }
    public long? PayNum { get; init; }
    public double PayAmt { get; init; }
    public DateTime? DatePay { get; init; }
    public string? CheckNum { get; init; }
}
