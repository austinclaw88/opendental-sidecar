using System.ComponentModel.DataAnnotations;

namespace OpenDentalSidecar.Api.Models;

public class AppointmentDetailDto : ScheduleAppointmentDto
{
    public long? ClinicNum { get; set; }
    public List<ProcedureDto> Procedures { get; set; } = new();
}

public class CreateAppointmentRequest
{
    [Required] public long PatNum { get; set; }
    [Required] public DateTime AptDateTime { get; set; }
    /// <summary>Length in minutes. Rounded to 5-minute increments, 5..540.</summary>
    [Required, Range(5, 540)] public int Minutes { get; set; }
    [Required] public long OperatoryNum { get; set; }
    public long? ProvNum { get; set; }
    public long? ProvHyg { get; set; }
    public bool IsHygiene { get; set; }
    public bool IsNewPatient { get; set; }
    public long? AppointmentTypeNum { get; set; }
    public long? ClinicNum { get; set; }
    public string? Note { get; set; }
    public string? ProcDescript { get; set; }
    /// <summary>Treatment-planned procedure numbers to attach to this appointment.</summary>
    public List<long>? ProcNums { get; set; }
    /// <summary>When booking from the recall list, the recall row to mark as scheduled.</summary>
    public long? RecallNum { get; set; }
    /// <summary>Any other appointment column in the connected database, by exact column name. Validated against the live schema.</summary>
    public Dictionary<string, object?>? ExtraFields { get; set; }
}

public class UpdateAppointmentRequest
{
    public DateTime? AptDateTime { get; set; }
    public int? Minutes { get; set; }
    public long? OperatoryNum { get; set; }
    public long? ProvNum { get; set; }
    public long? AppointmentTypeNum { get; set; }
    public string? Note { get; set; }
    public string? ProcDescript { get; set; }
    public bool? IsNewPatient { get; set; }
    /// <summary>Treatment-planned procedure numbers that should remain attached to this appointment. Omit to leave attachments unchanged.</summary>
    public List<long>? ProcNums { get; set; }
    /// <summary>Any other appointment column in the connected database, by exact column name. Validated against the live schema.</summary>
    public Dictionary<string, object?>? ExtraFields { get; set; }
}

public class SetAppointmentStatusRequest
{
    /// <summary>Target ApptStatus: 1 Scheduled, 2 Complete, 3 UnschedList, 5 Broken.</summary>
    [Required] public int AptStatus { get; set; }
    /// <summary>Optional reason, logged to the patient's comm log when breaking or unscheduling.</summary>
    public string? Reason { get; set; }
}

public class SetPriorityRequest
{
    /// <summary>0 Normal, 1 ASAP.</summary>
    [Required] public int Priority { get; set; }
}

public class SetConfirmationRequest
{
    /// <summary>DefNum from definition category 2 (ApptConfirmed). Also used for Arrived/Seated/Dismissed style statuses.</summary>
    [Required] public long ConfirmedDefNum { get; set; }
}

public class SetFlowTimeRequest
{
    /// <summary>"arrived" | "seated" | "dismissed". Sets the matching timestamp to now (or clears when Clear is true).</summary>
    [Required] public string Milestone { get; set; } = "";
    public bool Clear { get; set; }
}

public class WriteResultDto
{
    public long Id { get; set; }
    public string Message { get; set; } = "ok";
}
