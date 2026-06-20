using System.ComponentModel.DataAnnotations;

namespace OpenDentalSidecar.Api.Models;

/// <summary>One insurance coverage row for a patient: patplan + inssub + insplan + carrier.</summary>
public class InsuranceCoverageDto
{
    public long PatPlanNum { get; set; }
    public long PatNum { get; set; }
    public int Ordinal { get; set; }
    public int Relationship { get; set; }
    public string RelationshipDesc { get; set; } = "";

    public long InsSubNum { get; set; }
    public long SubscriberPatNum { get; set; }
    public string SubscriberName { get; set; } = "";
    public string? SubscriberId { get; set; }
    public DateTime? DateEffective { get; set; }
    public DateTime? DateTerm { get; set; }
    public string? SubscNote { get; set; }

    public long PlanNum { get; set; }
    public string? GroupName { get; set; }
    public string? GroupNum { get; set; }
    public string? FeeSchedDesc { get; set; }

    public long CarrierNum { get; set; }
    public string CarrierName { get; set; } = "";
    public string? CarrierPhone { get; set; }
    public string? ElectId { get; set; }
}

public class CarrierDto
{
    public long CarrierNum { get; set; }
    public string CarrierName { get; set; } = "";
    public string? Phone { get; set; }
    public string? ElectId { get; set; }
}

public class CreateInsuranceRequest
{
    /// <summary>Existing carrier to attach to. If null, CarrierName is used to find-or-create one.</summary>
    public long? CarrierNum { get; set; }
    /// <summary>Carrier name, used when CarrierNum is not supplied. Matched case-insensitively before creating.</summary>
    public string? CarrierName { get; set; }
    public string? CarrierPhone { get; set; }
    /// <summary>Electronic payer ID (CDAnet carrier ID in Canada).</summary>
    public string? ElectId { get; set; }

    public string? GroupName { get; set; }
    public string? GroupNum { get; set; }

    /// <summary>PatNum of the subscriber. Defaults to the patient when omitted (self).</summary>
    public long? SubscriberPatNum { get; set; }
    public string? SubscriberId { get; set; }
    public DateOnly? DateEffective { get; set; }
    public string? SubscNote { get; set; }

    /// <summary>0 Self, 1 Spouse, 2 Child, 4 HandicapDep, 5 SignifOther, 7 LifePartner, 8 Dependent.</summary>
    public int Relationship { get; set; }

    /// <summary>1 = primary, 2 = secondary. Defaults to next available ordinal.</summary>
    public int? Ordinal { get; set; }
}

public class UpdatePatPlanRequest
{
    public int? Ordinal { get; set; }
    public int? Relationship { get; set; }
    public string? SubscriberId { get; set; }
    public DateOnly? DateTerm { get; set; }
    public string? SubscNote { get; set; }
}

public class ClaimQueueItemDto
{
    public long ClaimNum { get; set; }
    public long PatNum { get; set; }
    public string PatientName { get; set; } = "";
    public string? CarrierName { get; set; }
    public string? ProviderAbbr { get; set; }
    public string ClaimStatus { get; set; } = "";
    public string ClaimStatusDesc { get; set; } = "";
    public DateTime? DateService { get; set; }
    public DateTime? DateSent { get; set; }
    public int? DaysSinceSent { get; set; }
    public decimal ClaimFee { get; set; }
    public decimal InsPayAmt { get; set; }
    public string ClaimType { get; set; } = "";
}

public class CreateAdjustmentRequest
{
    [Required] public long PatNum { get; set; }
    /// <summary>Signed amount. Negative reduces the balance (discount/courtesy), positive adds a charge.</summary>
    [Required] public decimal AdjAmt { get; set; }
    /// <summary>DefNum from definition category 1 (AdjTypes).</summary>
    [Required] public long AdjType { get; set; }
    public DateOnly? AdjDate { get; set; }
    public long? ProvNum { get; set; }
    public long? ClinicNum { get; set; }
    public string? Note { get; set; }
}
