using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

/// <summary>
/// Read-only access to insurance benefits (the `benefit` table). Benefits attach to a
/// plan (PlanNum) or, rarely, to a single patient as an override (PatPlanNum). This reads
/// both, groups them per coverage, and interprets the X12-derived enums into the numbers a
/// front desk actually uses.
/// </summary>
public class BenefitRepository : IBenefitRepository
{
    private readonly string _connStr;
    public BenefitRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<PlanBenefitsDto>> GetByPatient(long patNum)
    {
        using var db = Db();

        // 1. The patient's coverages (one row per patplan).
        var coverages = (await db.QueryAsync(
            """
            SELECT pp.PatPlanNum, pp.Ordinal, ip.PlanNum, c.CarrierName
            FROM patplan pp
            JOIN inssub isub ON pp.InsSubNum = isub.InsSubNum
            JOIN insplan ip ON isub.PlanNum = ip.PlanNum
            LEFT JOIN carrier c ON ip.CarrierNum = c.CarrierNum
            WHERE pp.PatNum = @patNum
            ORDER BY pp.Ordinal;
            """, new { patNum })).ToList();

        if (coverages.Count == 0) return new List<PlanBenefitsDto>();

        var planNums = coverages.Select(c => (long)c.PlanNum).Distinct().ToArray();
        var patPlanNums = coverages.Select(c => (long)c.PatPlanNum).Distinct().ToArray();

        // 2. Every benefit line for those plans (plan-level) or this patient (override).
        var benefits = (await db.QueryAsync(
            """
            SELECT b.BenefitNum, b.PlanNum, b.PatPlanNum, b.CovCatNum,
                   b.BenefitType, b.Percent, b.MonetaryAmt, b.TimePeriod, b.CoverageLevel,
                   cc.Description AS CovCatDesc, cc.CovOrder
            FROM benefit b
            LEFT JOIN covcat cc ON b.CovCatNum = cc.CovCatNum
            WHERE b.PlanNum IN @planNums OR b.PatPlanNum IN @patPlanNums
            ORDER BY COALESCE(cc.CovOrder, 0), b.BenefitType;
            """, new { planNums, patPlanNums })).ToList();

        var result = new List<PlanBenefitsDto>();
        foreach (var cov in coverages)
        {
            long patPlanNum = (long)cov.PatPlanNum;
            long planNum = (long)cov.PlanNum;

            // A line belongs here if it's a patient override on this patplan, or a
            // plan-level line (PatPlanNum = 0) for this plan. Overrides sorted last so
            // they win the per-category dedupe and headline picks below.
            var lines = benefits
                .Where(b => (long)b.PatPlanNum == patPlanNum
                            || ((long)b.PatPlanNum == 0 && (long)b.PlanNum == planNum))
                .OrderBy(b => (long)b.PatPlanNum == patPlanNum ? 1 : 0)
                .ToList();

            var categories = new List<CategoryBenefitDto>();
            var items = new List<BenefitItemDto>();
            decimal? annualMax = null; string? maxLevel = null; string? maxPeriod = null;
            decimal? deductible = null; string? dedLevel = null; string? dedPeriod = null;

            foreach (var b in lines)
            {
                int type = Convert.ToInt32(b.BenefitType);
                int pctRaw = Convert.ToInt32(b.Percent);
                double amtRaw = b.MonetaryAmt == null ? -1 : Convert.ToDouble(b.MonetaryAmt);
                int? percent = pctRaw < 0 ? (int?)null : pctRaw;
                decimal? amount = amtRaw < 0 ? (decimal?)null : (decimal)amtRaw;
                long covCatNum = b.CovCatNum == null ? 0 : (long)b.CovCatNum;
                string? cat = (string?)b.CovCatDesc;
                string period = TimePeriodDesc(Convert.ToInt32(b.TimePeriod));
                string level = CoverageLevelDesc(Convert.ToInt32(b.CoverageLevel));

                items.Add(new BenefitItemDto
                {
                    Type = BenefitTypeDesc(type),
                    Category = cat,
                    Percent = percent,
                    Amount = amount,
                    Period = period,
                    Level = level,
                });

                if (type == 1 && percent != null && covCatNum != 0 && cat != null)
                {
                    // Co-insurance for a specific category.
                    categories.Add(new CategoryBenefitDto { Category = cat, Percent = percent.Value });
                }
                else if (type == 2 && covCatNum == 0 && amount != null)
                {
                    // General deductible. Prefer the Individual figure.
                    if (deductible == null || level == "Individual")
                    {
                        deductible = amount; dedLevel = level; dedPeriod = period;
                    }
                }
                else if (type == 5 && covCatNum == 0 && amount != null)
                {
                    // General limitation = annual maximum. Prefer the Individual figure.
                    if (annualMax == null || level == "Individual")
                    {
                        annualMax = amount; maxLevel = level; maxPeriod = period;
                    }
                }
            }

            // Keep one row per category (override wins, since it is sorted last).
            categories = categories
                .GroupBy(c => c.Category)
                .Select(g => g.Last())
                .ToList();

            result.Add(new PlanBenefitsDto
            {
                PatPlanNum = patPlanNum,
                PlanNum = planNum,
                Ordinal = Convert.ToInt32(cov.Ordinal),
                CarrierName = (string?)cov.CarrierName ?? "",
                AnnualMax = annualMax,
                AnnualMaxLevel = maxLevel,
                AnnualMaxPeriod = maxPeriod,
                Deductible = deductible,
                DeductibleLevel = dedLevel,
                DeductiblePeriod = dedPeriod,
                Categories = categories,
                Items = items,
            });
        }

        return result;
    }

    // ── Enum descriptions (InsBenefitType, BenefitTimePeriod, BenefitCoverageLevel) ──

    private static string BenefitTypeDesc(int t) => t switch
    {
        0 => "Active coverage",
        1 => "Co-insurance",
        2 => "Deductible",
        3 => "Copay",
        4 => "Exclusion",
        5 => "Limitation",
        _ => "Other",
    };

    private static string TimePeriodDesc(int t) => t switch
    {
        1 => "Service year",
        2 => "Calendar year",
        3 => "Lifetime",
        4 => "Years",
        _ => "",
    };

    private static string CoverageLevelDesc(int l) => l switch
    {
        1 => "Individual",
        2 => "Family",
        _ => "",
    };
}
