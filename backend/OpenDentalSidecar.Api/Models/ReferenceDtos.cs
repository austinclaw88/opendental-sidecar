namespace OpenDentalSidecar.Api.Models;

public class OperatoryDto
{
    public long OperatoryNum { get; set; }
    public string OpName { get; set; } = "";
    public string Abbrev { get; set; } = "";
    public int ItemOrder { get; set; }
    public bool IsHygiene { get; set; }
    public long? ProvDentist { get; set; }
    public long? ProvHygienist { get; set; }
    public long? ClinicNum { get; set; }
}

public class ProviderDto
{
    public long ProvNum { get; set; }
    public string Abbr { get; set; } = "";
    public string LName { get; set; } = "";
    public string FName { get; set; } = "";
    public bool IsSecondary { get; set; }
    public bool IsHidden { get; set; }
    public int ProvColor { get; set; }
    public int ItemOrder { get; set; }
}

/// <summary>A row from the OpenDental definition table (status lists, payment types, etc.).</summary>
public class DefinitionDto
{
    public long DefNum { get; set; }
    public int Category { get; set; }
    public int ItemOrder { get; set; }
    public string ItemName { get; set; } = "";
    public string ItemValue { get; set; } = "";
    public int ItemColor { get; set; }
}

public class AppointmentTypeDto
{
    public long AppointmentTypeNum { get; set; }
    public string AppointmentTypeName { get; set; } = "";
    public int AppointmentTypeColor { get; set; }
    public string Pattern { get; set; } = "";
    public string CodeStr { get; set; } = "";
}

public class ClinicDto
{
    public long ClinicNum { get; set; }
    public string Description { get; set; } = "";
    public string Abbr { get; set; } = "";
}
