using System.ComponentModel.DataAnnotations;

namespace OpenDentalSidecar.Api.Models;

/// <summary>One row in the family account ledger (procedure, payment split, adjustment, or insurance payment).</summary>
public class LedgerEntryDto
{
    public string Kind { get; set; } = ""; // "procedure" | "payment" | "adjustment" | "insurance"
    public long Id { get; set; }
    public DateTime Date { get; set; }
    public long PatNum { get; set; }
    public string PatientName { get; set; } = "";
    public string Description { get; set; } = "";
    public string? ProviderAbbr { get; set; }
    /// <summary>Signed amount. Charges positive, credits negative.</summary>
    public decimal Amount { get; set; }
    public decimal RunningBalance { get; set; }
}

public class AccountSummaryDto
{
    public long GuarantorPatNum { get; set; }
    public string GuarantorName { get; set; } = "";
    /// <summary>Estimated family balance computed from the ledger (charges minus credits). OpenDental's official aging may differ slightly until its aging routine runs.</summary>
    public decimal EstimatedBalance { get; set; }
    public decimal TotalCharges { get; set; }
    public decimal TotalCredits { get; set; }
    public List<FamilyMemberDto> Family { get; set; } = new();
    public List<LedgerEntryDto> Entries { get; set; } = new();
}

public class PaymentDto
{
    public long PayNum { get; set; }
    public long PatNum { get; set; }
    public DateTime PayDate { get; set; }
    public decimal PayAmt { get; set; }
    public long PayType { get; set; }
    public string PayTypeDesc { get; set; } = "";
    public string? CheckNum { get; set; }
    public string? PayNote { get; set; }
}

public class CreatePaymentRequest
{
    [Required] public long PatNum { get; set; }
    [Required] public decimal PayAmt { get; set; }
    /// <summary>DefNum from definition category 10 (PaymentTypes).</summary>
    [Required] public long PayType { get; set; }
    public DateOnly? PayDate { get; set; }
    public string? CheckNum { get; set; }
    public string? PayNote { get; set; }
    /// <summary>Provider to allocate the payment split to. Defaults to the patient's primary provider.</summary>
    public long? ProvNum { get; set; }
    public long? ClinicNum { get; set; }
}

public class CommlogDto
{
    public long CommlogNum { get; set; }
    public long PatNum { get; set; }
    public DateTime CommDateTime { get; set; }
    public long CommType { get; set; }
    public string CommTypeDesc { get; set; } = "";
    public int Mode { get; set; }
    public string ModeDesc { get; set; } = "";
    public int SentOrReceived { get; set; }
    public string? Note { get; set; }
}

public class CreateCommlogRequest
{
    [Required] public long PatNum { get; set; }
    [Required] public string Note { get; set; } = "";
    /// <summary>DefNum from definition category 27 (CommLogTypes). 0 is allowed.</summary>
    public long CommType { get; set; }
    /// <summary>0 None, 1 Email, 2 Mail, 3 Phone, 4 InPerson, 5 Text.</summary>
    public int Mode { get; set; } = 3;
    /// <summary>0 Unknown, 1 Sent (we contacted them), 2 Received.</summary>
    public int SentOrReceived { get; set; } = 1;
}

public class RecallDueDto
{
    public long RecallNum { get; set; }
    public long PatNum { get; set; }
    public string PatientName { get; set; } = "";
    public string? HmPhone { get; set; }
    public string? WirelessPhone { get; set; }
    public string? Email { get; set; }
    public DateTime? DateDue { get; set; }
    public DateTime? DatePrevious { get; set; }
    public DateTime? DateScheduled { get; set; }
    public string RecallTypeDesc { get; set; } = "";
    public string? Note { get; set; }
    public string? RecallStatusDesc { get; set; }
    public bool IsDisabled { get; set; }
}
