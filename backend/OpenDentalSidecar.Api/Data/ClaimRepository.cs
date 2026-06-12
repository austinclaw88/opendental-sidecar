using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class ClaimRepository : IClaimRepository
{
    private readonly string _connStr;
    public ClaimRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<ClaimDto>> GetByPatient(long patNum)
    {
        using var db = Db();
        var sql = """
            SELECT c.ClaimNum, c.PatNum, c.ProvTreat, c.PlanNum, c.InsSubNum,
                   c.ClaimStatus, c.DateService, c.DateSent, c.ClaimFee,
                   c.ClaimForm,
                   prov.Abbr AS ProviderName,
                   car.CarrierName, car.CarrierNum
            FROM claim c
            LEFT JOIN provider prov ON c.ProvTreat = prov.ProvNum
            LEFT JOIN insplan pl ON c.PlanNum = pl.PlanNum
            LEFT JOIN carrier car ON pl.CarrierNum = car.CarrierNum
            WHERE c.PatNum = @patNum
            ORDER BY c.DateService DESC;
            """;
        var claims = (await db.QueryAsync(sql, new { patNum })).ToList();
        if (claims.Count == 0) return [];

        // ── Batch aggregate claimprocs: fixes N+1 ──
        var claimNums = claims.Select(c => (long)c.ClaimNum).ToHashSet();
        var aggSql = """
            SELECT cp.ClaimNum,
                   COALESCE(SUM(cp.InsPayAmt), 0) AS InsPayAmt,
                   COALESCE(SUM(cp.WriteOff), 0) AS WriteOff,
                   COALESCE(SUM(cp.DedApplied), 0) AS DedApplied
            FROM claimproc cp
            WHERE cp.ClaimNum IN @claimNums AND cp.Status != 7
            GROUP BY cp.ClaimNum;
            """;
        var aggRows = (await db.QueryAsync(aggSql, new { claimNums }))
            .ToDictionary(r => (long)r.ClaimNum);

        return claims.Select(c =>
        {
            var claimNum = (long)c.ClaimNum;
            var agg = aggRows.GetValueOrDefault(claimNum);
            return new ClaimDto
            {
                ClaimNum = claimNum,
                PatNum = (long)c.PatNum,
                ProvNum = (long?)c.ProvTreat,
                ProviderName = (string?)c.ProviderName,
                PlanNum = (long?)c.PlanNum,
                CarrierName = (string?)c.CarrierName,
                InsSubNum = (long?)c.InsSubNum,
                ClaimStatusDesc = ClaimStatusDesc((string)c.ClaimStatus),
                DateService = NullDate(c.DateService),
                DateSent = NullDate(c.DateSent),
                ClaimFee = (double)c.ClaimFee,
                InsPayAmt = agg != null ? (double)agg.InsPayAmt : 0,
                WriteOff = agg != null ? (double)agg.WriteOff : 0,
                DedApplied = agg != null ? (double)agg.DedApplied : 0,
                CarrierNum = (long?)c.CarrierNum,
                ClaimForm = (int?)c.ClaimForm,
            };
        }).ToList();
    }

    public async Task<ClaimDetailDto?> GetDetail(long claimNum)
    {
        using var db = Db();
        var sql = """
            SELECT c.*, prov.Abbr AS ProviderName, car.CarrierName
            FROM claim c
            LEFT JOIN provider prov ON c.ProvTreat = prov.ProvNum
            LEFT JOIN insplan pl ON c.PlanNum = pl.PlanNum
            LEFT JOIN carrier car ON pl.CarrierNum = car.CarrierNum
            WHERE c.ClaimNum = @claimNum;
            """;
        var r = await db.QueryFirstOrDefaultAsync(sql, new { claimNum });
        if (r == null) return null;

        var cpSql = """
            SELECT cp.*, pc.ProcCode, pc.Descript, pl.ToothNum, pl.Surf
            FROM claimproc cp
            LEFT JOIN procedurelog pl ON cp.ProcNum = pl.ProcNum
            LEFT JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
            WHERE cp.ClaimNum = @claimNum
            ORDER BY cp.ClaimProcNum;
            """;
        var procs = (await db.QueryAsync(cpSql, new { claimNum }))
            .Select(cp => new ClaimProcDto
            {
                ClaimProcNum = (long)cp.ClaimProcNum,
                ClaimNum = (long)cp.ClaimNum,
                ProcNum = (long?)cp.ProcNum ?? 0,
                ProcCode = (string?)cp.ProcCode ?? "",
                Descript = (string?)cp.Descript ?? "",
                ProcFee = (double)cp.FeeBilled,
                InsPayAmt = (double)(cp.InsPayAmt ?? 0),
                DedApplied = (double)(cp.DedApplied ?? 0),
                WriteOff = (double)(cp.WriteOff ?? 0),
                Status = (int)cp.Status,
                StatusDesc = ClaimProcStatusDesc((int)cp.Status),
                ToothNum = (string?)cp.ToothNum,
                Surf = (string?)cp.Surf,
            }).ToList();

        var paySql = """
            SELECT DISTINCT pay.ClaimPaymentNum, cp.ClaimNum, pay.CheckAmt,
                   pay.CheckDate, NULL AS CheckNum, pay.CheckDate AS DateIssued
            FROM claimproc cp
            INNER JOIN claimpayment pay ON cp.ClaimPaymentNum = pay.ClaimPaymentNum
            WHERE cp.ClaimNum = @claimNum AND cp.ClaimPaymentNum <> 0
            ORDER BY pay.CheckDate DESC;
            """;
        var payments = (await db.QueryAsync(paySql, new { claimNum }))
            .Select(p => new ClaimPaymentDto
            {
                ClaimPaymentNum = (long)p.ClaimPaymentNum,
                ClaimNum = (long)p.ClaimNum,
                PayAmt = (double)(p.CheckAmt ?? 0),
                DatePay = NullDate(p.DateIssued) ?? NullDate(p.CheckDate),
                CheckNum = (string?)p.CheckNum,
            }).ToList();

        var insPayAmt = procs.Sum(p => p.InsPayAmt);
        var writeOff = procs.Sum(p => p.WriteOff);
        var dedApplied = procs.Sum(p => p.DedApplied);

        return new ClaimDetailDto
        {
            ClaimNum = (long)r.ClaimNum,
            PatNum = (long)r.PatNum,
            ClaimStatusDesc = ClaimStatusDesc((string)r.ClaimStatus),
            CarrierName = (string?)r.CarrierName,
            DateService = NullDate(r.DateService),
            DateSent = NullDate(r.DateSent),
            DateReceived = NullDate(r.DateReceived),
            ClaimFee = (double)r.ClaimFee,
            InsPayAmt = insPayAmt,
            WriteOff = writeOff,
            DedApplied = dedApplied,
            InsEstimate = (double)(r.InsPayEst ?? 0),
            BalanceRemaining = (double)r.ClaimFee - insPayAmt,
            ClaimForm = (int?)r.ClaimForm,
            ProviderName = (string?)r.ProviderName,
            Procedures = procs,
            Payments = payments,
        };
    }

    private static DateTime? NullDate(object? val) =>
        val is DateTime dt && dt > new DateTime(1900, 1, 1) ? dt : null;

    public static string ClaimStatusDesc(string s) => s switch
    {
        "U" => "Not Sent",
        "H" => "Hold (Wait Prim)",
        "W" => "Waiting to Send",
        "P" => "Probably Sent",
        "S" => "Sent",
        "R" => "Received",
        "I" => "Hold (In Process)",
        _ => $"Unknown ({s})",
    };

    public static string ClaimProcStatusDesc(int s) => s switch
    {
        0 => "Not Received",
        1 => "Received",
        2 => "Preauth",
        3 => "Adjustment",
        4 => "Supplemental",
        5 => "Cap Claim",
        6 => "Estimate",
        7 => "Cap Complete",
        8 => "Cap Estimate",
        9 => "Ins History",
        _ => $"Unknown ({s})",
    };
}
