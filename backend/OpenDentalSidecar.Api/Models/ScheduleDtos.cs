namespace OpenDentalSidecar.Api.Models;

/// <summary>One appointment as rendered on the schedule book day grid.</summary>
public class ScheduleAppointmentDto
{
    public long AptNum { get; set; }
    public long PatNum { get; set; }
    public string PatientName { get; set; } = "";
    public string? PatientPhone { get; set; }
    public DateTime AptDateTime { get; set; }
    /// <summary>Length in minutes, derived from the time pattern (5 min per pattern char).</summary>
    public int Minutes { get; set; }
    public string Pattern { get; set; } = "";
    public long OperatoryNum { get; set; }
    public long? ProvNum { get; set; }
    public string? ProviderAbbr { get; set; }
    public int? ProviderColor { get; set; }
    public int AptStatus { get; set; }
    public string AptStatusDesc { get; set; } = "";
    public long ConfirmedDefNum { get; set; }
    public string? ConfirmedDesc { get; set; }
    public int? ConfirmedColor { get; set; }
    public bool IsNewPatient { get; set; }
    public bool IsHygiene { get; set; }
    public string? Note { get; set; }
    public string? ProcDescript { get; set; }
    public long? AppointmentTypeNum { get; set; }
    public string? AppointmentTypeName { get; set; }
    public DateTime? DateTimeArrived { get; set; }
    public DateTime? DateTimeSeated { get; set; }
    public DateTime? DateTimeDismissed { get; set; }
    /// <summary>0 Normal, 1 ASAP.</summary>
    public int Priority { get; set; }
}

/// <summary>A provider-schedule or blockout segment for the day grid background.</summary>
public class ScheduleBlockDto
{
    public long ScheduleNum { get; set; }
    public DateOnly SchedDate { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan StopTime { get; set; }
    public int SchedType { get; set; } // 0 Practice, 1 Provider, 2 Blockout, 3 Employee
    public long? ProvNum { get; set; }
    public string? ProvAbbr { get; set; }
    public long? BlockoutType { get; set; }
    public string? BlockoutDesc { get; set; }
    public int? BlockoutColor { get; set; }
    public string? Note { get; set; }
    public List<long> Ops { get; set; } = new();
}

public class ScheduleDayDto
{
    public DateOnly Date { get; set; }
    public List<OperatoryDto> Operatories { get; set; } = new();
    public List<ScheduleAppointmentDto> Appointments { get; set; } = new();
    public List<ScheduleBlockDto> Blocks { get; set; } = new();
}

/// <summary>A row on the confirmation work list (calls for tomorrow, etc.).</summary>
public class ConfirmationItemDto
{
    public long AptNum { get; set; }
    public long PatNum { get; set; }
    public string PatientName { get; set; } = "";
    public string? HmPhone { get; set; }
    public string? WirelessPhone { get; set; }
    public string? Email { get; set; }
    public DateTime AptDateTime { get; set; }
    public int Minutes { get; set; }
    public string? ProviderAbbr { get; set; }
    public string? OperatoryAbbrev { get; set; }
    public long ConfirmedDefNum { get; set; }
    public string? ConfirmedDesc { get; set; }
    public int? ConfirmedColor { get; set; }
    public string? ProcDescript { get; set; }
    public string? ApptPhoneNote { get; set; }
    /// <summary>0 Normal, 1 ASAP. Populated for the unscheduled/ASAP lists.</summary>
    public int Priority { get; set; }
    public int AptStatus { get; set; }
    public string? AptStatusDesc { get; set; }
}
