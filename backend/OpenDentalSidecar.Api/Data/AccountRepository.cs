using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;
using OpenDentalSidecar.Api.Data.Schema;

namespace OpenDentalSidecar.Api.Data;

public class AccountRepository : IAccountRepository
{
    private readonly string _connStr;
    private readonly SchemaIntrospector _schema;
    public AccountRepository(string connStr, SchemaIntrospector schema)
    {
        _connStr = connStr;
        _schema = schema;
    }
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<FamilyMemberDto>> GetFamily(long patNum)
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT f.PatNum, f.LName, f.FName, f.Preferred, f.Birthdate, f.PatStatus,
                   f.Guarantor, f.Position, f.WirelessPhone
            FROM patient p
            JOIN patient f ON f.Guarantor = p.Guarantor
            WHERE p.PatNum = @patNum AND f.PatStatus != 4
            ORDER BY f.Birthdate;
            """, new { patNum });
        return rows.Select(r =>
        {
            var bd = r.Birthdate is DateTime d && d.Year > 1900 ? (DateTime?)d : null;
            var age = bd == null ? 0
                : (int)((DateTime.Today - bd.Value).TotalDays / 365.2425);
            return new FamilyMemberDto
            {
                PatNum = (long)r.PatNum,
                Name = $"{r.LName}, {r.FName}" + (string.IsNullOrEmpty((string?)r.Preferred) ? "" : $" ({r.Preferred})"),
                Birthdate = bd,
                Age = age,
                PatStatus = Convert.ToInt32(r.PatStatus),
                PatStatusDesc = PatientRepository.PatientStatusDesc(Convert.ToInt32(r.PatStatus)),
                IsGuarantor = (long)r.PatNum == (long)r.Guarantor,
                WirelessPhone = (string?)r.WirelessPhone,
                Position = Convert.ToInt32(r.Position),
            };
        }).ToList();
    }

    public async Task<AccountSummaryDto?> GetFamilyAccount(long patNum)
    {
        using var db = Db();
        var guar = await db.QueryFirstOrDefaultAsync("""
            SELECT g.PatNum, CONCAT(g.LName, ', ', g.FName) AS Name
            FROM patient p JOIN patient g ON p.Guarantor = g.PatNum
            WHERE p.PatNum = @patNum;
            """, new { patNum });
        if (guar == null) return null;
        long guarantorNum = (long)guar.PatNum;

        // Completed procedures (charges).
        var procs = await db.QueryAsync("""
            SELECT pl.ProcNum AS Id, pl.ProcDate AS Date, pl.PatNum,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   CONCAT(pc.ProcCode, ' — ', COALESCE(NULLIF(pc.AbbrDesc, ''), pc.Descript)) AS Description,
                   prov.Abbr AS ProviderAbbr,
                   pl.ProcFee * (CASE WHEN pl.UnitQty + pl.BaseUnits = 0 THEN 1 ELSE pl.UnitQty + pl.BaseUnits END) AS Amount
            FROM procedurelog pl
            JOIN patient p ON pl.PatNum = p.PatNum
            JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
            LEFT JOIN provider prov ON pl.ProvNum = prov.ProvNum
            WHERE p.Guarantor = @guarantorNum AND pl.ProcStatus = 2;
            """, new { guarantorNum });

        // Patient payments (paysplits, credits).
        var splits = await db.QueryAsync("""
            SELECT ps.SplitNum AS Id, ps.DatePay AS Date, ps.PatNum,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   CONCAT('Payment — ', COALESCE(d.ItemName, 'Patient payment'),
                          CASE WHEN pay.CheckNum != '' THEN CONCAT(' #', pay.CheckNum) ELSE '' END) AS Description,
                   prov.Abbr AS ProviderAbbr,
                   ps.SplitAmt AS Amount
            FROM paysplit ps
            JOIN patient p ON ps.PatNum = p.PatNum
            LEFT JOIN payment pay ON ps.PayNum = pay.PayNum
            LEFT JOIN definition d ON pay.PayType = d.DefNum
            LEFT JOIN provider prov ON ps.ProvNum = prov.ProvNum
            WHERE p.Guarantor = @guarantorNum;
            """, new { guarantorNum });

        // Adjustments (signed).
        var adjs = await db.QueryAsync("""
            SELECT a.AdjNum AS Id, a.AdjDate AS Date, a.PatNum,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   CONCAT('Adjustment — ', COALESCE(d.ItemName, '')) AS Description,
                   prov.Abbr AS ProviderAbbr,
                   a.AdjAmt AS Amount
            FROM adjustment a
            JOIN patient p ON a.PatNum = p.PatNum
            LEFT JOIN definition d ON a.AdjType = d.DefNum
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            WHERE p.Guarantor = @guarantorNum;
            """, new { guarantorNum });

        // Insurance payments and writeoffs (credits) on received claims.
        var insRows = await db.QueryAsync("""
            SELECT cp.ClaimProcNum AS Id, cp.DateCP AS Date, cp.PatNum,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   CONCAT('Insurance — ', COALESCE(c.CarrierName, 'payment')) AS Description,
                   prov.Abbr AS ProviderAbbr,
                   cp.InsPayAmt AS InsPayAmt, cp.WriteOff AS WriteOff
            FROM claimproc cp
            JOIN patient p ON cp.PatNum = p.PatNum
            LEFT JOIN insplan ip ON cp.PlanNum = ip.PlanNum
            LEFT JOIN carrier c ON ip.CarrierNum = c.CarrierNum
            LEFT JOIN provider prov ON cp.ProvNum = prov.ProvNum
            WHERE p.Guarantor = @guarantorNum AND cp.Status IN (1, 4)
              AND (cp.InsPayAmt != 0 OR cp.WriteOff != 0);
            """, new { guarantorNum });

        var entries = new List<LedgerEntryDto>();
        foreach (var r in procs)
            entries.Add(Map("procedure", r, Convert.ToDecimal(r.Amount)));
        foreach (var r in splits)
            entries.Add(Map("payment", r, -Convert.ToDecimal(r.Amount)));
        foreach (var r in adjs)
            entries.Add(Map("adjustment", r, Convert.ToDecimal(r.Amount)));
        foreach (var r in insRows)
            entries.Add(Map("insurance", r, -(Convert.ToDecimal(r.InsPayAmt) + Convert.ToDecimal(r.WriteOff))));

        entries = entries.OrderBy(e => e.Date).ThenBy(e => e.Kind).ThenBy(e => e.Id).ToList();
        decimal running = 0;
        foreach (var e in entries)
        {
            running += e.Amount;
            e.RunningBalance = running;
        }

        return new AccountSummaryDto
        {
            GuarantorPatNum = guarantorNum,
            GuarantorName = (string)guar.Name,
            EstimatedBalance = running,
            TotalCharges = entries.Where(e => e.Amount > 0).Sum(e => e.Amount),
            TotalCredits = -entries.Where(e => e.Amount < 0).Sum(e => e.Amount),
            Family = (await GetFamily(patNum)).ToList(),
            Entries = entries,
        };
    }

    private static LedgerEntryDto Map(string kind, dynamic r, decimal amount) => new()
    {
        Kind = kind,
        Id = (long)r.Id,
        Date = (DateTime)r.Date,
        PatNum = (long)r.PatNum,
        PatientName = (string)r.PatientName,
        Description = (string?)r.Description ?? "",
        ProviderAbbr = (string?)r.ProviderAbbr,
        Amount = amount,
    };

    public async Task<long> CreatePayment(CreatePaymentRequest req)
    {
        if (req.PayAmt == 0)
            throw new ArgumentException("PayAmt cannot be zero.");

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var payType = await db.ExecuteScalarAsync<long?>(
            "SELECT DefNum FROM definition WHERE DefNum = @payType AND Category = 10;",
            new { req.PayType }, tx);
        if (payType == null)
            throw new ArgumentException("PayType must be a definition in category 10 (PaymentTypes).");

        var patient = await db.QueryFirstOrDefaultAsync(
            "SELECT PriProv, ClinicNum FROM patient WHERE PatNum = @patNum;",
            new { req.PatNum }, tx);
        if (patient == null)
            throw new ArgumentException("Patient not found.");

        var payDate = (req.PayDate ?? DateOnly.FromDateTime(DateTime.Today)).ToDateTime(TimeOnly.MinValue);
        var provNum = req.ProvNum ?? (long)patient.PriProv;
        var clinicNum = req.ClinicNum ?? (long)patient.ClinicNum;

        var payCols = await _schema.GetColumns("payment");
        var (paySql, payParams) = OdInsertBuilder.BuildInsert("payment", payCols,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["PayType"] = req.PayType,
                ["PayDate"] = payDate,
                ["PayAmt"] = req.PayAmt,
                ["CheckNum"] = req.CheckNum,
                ["PayNote"] = req.PayNote,
                ["PatNum"] = req.PatNum,
                ["ClinicNum"] = clinicNum,
                ["DateEntry"] = DateTime.Today,
            });
        var payNum = await db.ExecuteScalarAsync<long>(paySql, payParams, tx);

        var splitCols = await _schema.GetColumns("paysplit");
        var (splitSql, splitParams) = OdInsertBuilder.BuildInsert("paysplit", splitCols,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["SplitAmt"] = req.PayAmt,
                ["PatNum"] = req.PatNum,
                ["ProcDate"] = payDate,
                ["PayNum"] = payNum,
                ["ProvNum"] = provNum,
                ["DatePay"] = payDate,
                ["DateEntry"] = DateTime.Today,
                ["ClinicNum"] = clinicNum,
            });
        await db.ExecuteScalarAsync<long>(splitSql, splitParams, tx);

        await tx.CommitAsync();
        return payNum;
    }

    public async Task<long> CreateAdjustment(CreateAdjustmentRequest req)
    {
        if (req.AdjAmt == 0)
            throw new ArgumentException("AdjAmt cannot be zero.");

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var adjType = await db.ExecuteScalarAsync<long?>(
            "SELECT DefNum FROM definition WHERE DefNum = @adjType AND Category = 1;",
            new { req.AdjType }, tx);
        if (adjType == null)
            throw new ArgumentException("AdjType must be a definition in category 1 (AdjTypes).");

        var patient = await db.QueryFirstOrDefaultAsync(
            "SELECT PriProv, ClinicNum FROM patient WHERE PatNum = @patNum;",
            new { req.PatNum }, tx);
        if (patient == null)
            throw new ArgumentException("Patient not found.");

        var adjDate = (req.AdjDate ?? DateOnly.FromDateTime(DateTime.Today)).ToDateTime(TimeOnly.MinValue);
        var provNum = req.ProvNum ?? (long)patient.PriProv;
        var clinicNum = req.ClinicNum ?? (long)patient.ClinicNum;

        var adjCols = await _schema.GetColumns("adjustment");
        var (adjSql, adjParams) = OdInsertBuilder.BuildInsert("adjustment", adjCols,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["AdjDate"] = adjDate,
                ["AdjAmt"] = req.AdjAmt,
                ["PatNum"] = req.PatNum,
                ["AdjType"] = req.AdjType,
                ["ProvNum"] = provNum,
                ["AdjNote"] = req.Note,
                ["ProcDate"] = adjDate,
                ["DateEntry"] = DateTime.Today,
                ["ClinicNum"] = clinicNum,
            });
        var adjNum = await db.ExecuteScalarAsync<long>(adjSql, adjParams, tx);

        await tx.CommitAsync();
        return adjNum;
    }
}
