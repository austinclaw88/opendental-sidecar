using System.ComponentModel.DataAnnotations;

namespace OpenDentalSidecar.Api.Models;

public class CreatePatientRequest
{
    [Required, MaxLength(100)] public string LName { get; set; } = "";
    [Required, MaxLength(100)] public string FName { get; set; } = "";
    [MaxLength(100)] public string? MiddleI { get; set; }
    [MaxLength(100)] public string? Preferred { get; set; }
    public DateOnly? Birthdate { get; set; }
    /// <summary>0 Male, 1 Female, 2 Unknown, 3 Other (OpenDental PatientGender).</summary>
    public int Gender { get; set; } = 2;
    public string? Address { get; set; }
    public string? Address2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? HmPhone { get; set; }
    public string? WkPhone { get; set; }
    public string? WirelessPhone { get; set; }
    public string? Email { get; set; }
    public long? PriProv { get; set; }
    public long? ClinicNum { get; set; }
    /// <summary>Existing PatNum to join this patient to a family. When null, the new patient is their own guarantor.</summary>
    public long? Guarantor { get; set; }
    [MaxLength(15)] public string? Title { get; set; }
    [MaxLength(100)] public string? Salutation { get; set; }
    /// <summary>SIN/SSN. Stored as entered.</summary>
    [MaxLength(100)] public string? Ssn { get; set; }
    /// <summary>Position enum: 0 Single, 1 Married, 2 Child, 3 Widowed, 4 Divorced.</summary>
    public int? Position { get; set; }
    [MaxLength(100)] public string? ChartNumber { get; set; }
    [MaxLength(100)] public string? Language { get; set; }
    [MaxLength(255)] public string? County { get; set; }
    [MaxLength(255)] public string? Country { get; set; }
    /// <summary>Address & phone note shown on the patient banner.</summary>
    public string? AddrNote { get; set; }
    public string? MedUrgNote { get; set; }
    public string? ApptModNote { get; set; }
    public string? FamFinUrgNote { get; set; }
    [MaxLength(255)] public string? EmploymentNote { get; set; }
    /// <summary>0 Unknown, 1 OK to text, 2 Do not text.</summary>
    public int? TxtMsgOk { get; set; }
    /// <summary>ContactMethod enum: 0 None, 2 HmPhone, 3 WkPhone, 4 WirelessPh, 5 Email, 6 SeeNotes, 8 TextMessage.</summary>
    public int? PreferContactMethod { get; set; }
    public int? PreferConfirmMethod { get; set; }
    public int? PreferRecallMethod { get; set; }
    public long? SecProv { get; set; }
    public long? FeeSched { get; set; }
    /// <summary>DefNum from definition category 4 (BillingTypes).</summary>
    public long? BillingType { get; set; }
    public DateOnly? DateFirstVisit { get; set; }
    /// <summary>Minutes to ask the patient to arrive early.</summary>
    public int? AskToArriveEarly { get; set; }
    /// <summary>Premedication required flag (0/1).</summary>
    public int? Premed { get; set; }
    /// <summary>
    /// Any other patient column in the connected database, by exact column name
    /// (e.g. {"GradeLevel": 2, "SchoolName": "UBC"}). Validated against the live
    /// schema; unknown columns return 400 with the column name.
    /// </summary>
    public Dictionary<string, object?>? ExtraFields { get; set; }
}

public class UpdatePatientRequest
{
    public string? LName { get; set; }
    public string? FName { get; set; }
    public string? MiddleI { get; set; }
    public string? Preferred { get; set; }
    public DateOnly? Birthdate { get; set; }
    public int? Gender { get; set; }
    public string? Address { get; set; }
    public string? Address2 { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? HmPhone { get; set; }
    public string? WkPhone { get; set; }
    public string? WirelessPhone { get; set; }
    public string? Email { get; set; }
    public long? PriProv { get; set; }
    public int? PatStatus { get; set; }
    public long? ClinicNum { get; set; }
    public long? Guarantor { get; set; }
    [MaxLength(15)] public string? Title { get; set; }
    [MaxLength(100)] public string? Salutation { get; set; }
    /// <summary>SIN/SSN. Stored as entered.</summary>
    [MaxLength(100)] public string? Ssn { get; set; }
    /// <summary>Position enum: 0 Single, 1 Married, 2 Child, 3 Widowed, 4 Divorced.</summary>
    public int? Position { get; set; }
    [MaxLength(100)] public string? ChartNumber { get; set; }
    [MaxLength(100)] public string? Language { get; set; }
    [MaxLength(255)] public string? County { get; set; }
    [MaxLength(255)] public string? Country { get; set; }
    /// <summary>Address & phone note shown on the patient banner.</summary>
    public string? AddrNote { get; set; }
    public string? MedUrgNote { get; set; }
    public string? ApptModNote { get; set; }
    public string? FamFinUrgNote { get; set; }
    [MaxLength(255)] public string? EmploymentNote { get; set; }
    /// <summary>0 Unknown, 1 OK to text, 2 Do not text.</summary>
    public int? TxtMsgOk { get; set; }
    /// <summary>ContactMethod enum: 0 None, 2 HmPhone, 3 WkPhone, 4 WirelessPh, 5 Email, 6 SeeNotes, 8 TextMessage.</summary>
    public int? PreferContactMethod { get; set; }
    public int? PreferConfirmMethod { get; set; }
    public int? PreferRecallMethod { get; set; }
    public long? SecProv { get; set; }
    public long? FeeSched { get; set; }
    /// <summary>DefNum from definition category 4 (BillingTypes).</summary>
    public long? BillingType { get; set; }
    public DateOnly? DateFirstVisit { get; set; }
    /// <summary>Minutes to ask the patient to arrive early.</summary>
    public int? AskToArriveEarly { get; set; }
    /// <summary>Premedication required flag (0/1).</summary>
    public int? Premed { get; set; }
    /// <summary>
    /// Any other patient column in the connected database, by exact column name
    /// (e.g. {"GradeLevel": 2, "SchoolName": "UBC"}). Validated against the live
    /// schema; unknown columns return 400 with the column name.
    /// </summary>
    public Dictionary<string, object?>? ExtraFields { get; set; }
}

public class FamilyMemberDto
{
    public long PatNum { get; set; }
    public string Name { get; set; } = "";
    public DateTime? Birthdate { get; set; }
    public int Age { get; set; }
    public int PatStatus { get; set; }
    public string PatStatusDesc { get; set; } = "";
    public bool IsGuarantor { get; set; }
    public string? WirelessPhone { get; set; }
    public int Position { get; set; } // Position enum: 0 Single, 1 Married, 2 Child, ...
}
