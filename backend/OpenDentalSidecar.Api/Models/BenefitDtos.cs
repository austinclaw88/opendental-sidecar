namespace OpenDentalSidecar.Api.Models;

/// <summary>Insurance benefits for one of a patient's plans, with the headline
/// numbers a front desk quotes from (annual max, deductible, coverage % by category)
/// plus the full interpreted benefit list.</summary>
public class PlanBenefitsDto
{
    public long PatPlanNum { get; set; }
    public long PlanNum { get; set; }
    public int Ordinal { get; set; }
    public string CarrierName { get; set; } = "";

    public decimal? AnnualMax { get; set; }
    public string? AnnualMaxLevel { get; set; }   // Individual / Family
    public string? AnnualMaxPeriod { get; set; }  // Calendar year / Service year / Lifetime

    public decimal? Deductible { get; set; }
    public string? DeductibleLevel { get; set; }
    public string? DeductiblePeriod { get; set; }

    public List<CategoryBenefitDto> Categories { get; set; } = new();
    public List<BenefitItemDto> Items { get; set; } = new();
}

/// <summary>Coverage percentage for one service category (e.g. Diagnostic 100%, Major 50%).</summary>
public class CategoryBenefitDto
{
    public string Category { get; set; } = "";
    public int Percent { get; set; }
}

/// <summary>One interpreted benefit row, for the full "all benefit lines" detail view.</summary>
public class BenefitItemDto
{
    public string Type { get; set; } = "";       // Co-insurance / Deductible / Limitation / Copay / Exclusion
    public string? Category { get; set; }
    public int? Percent { get; set; }
    public decimal? Amount { get; set; }
    public string Period { get; set; } = "";
    public string Level { get; set; } = "";
}
