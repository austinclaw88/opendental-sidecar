using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;
using OpenDentalSidecar.Api.Data.Schema;

namespace OpenDentalSidecar.Api.Data;

public class InsuranceRepository : IInsuranceRepository
{
    private readonly string _connStr;
    private readonly SchemaIntrospector _schema;
    public InsuranceRepository(string connStr, SchemaIntrospector schema)
    {
        _connStr = connStr;
        _schema = schema;
    }
    private MySqlConnection Db() => new(_connStr);

    // ── Reads ───────────────────────────────────────────────────

    public async Task<IReadOnlyList<InsuranceCoverageDto>> GetByPatient(long patNum)
    {
        using var db = Db();
        var sql = """
            SELECT pp.PatPlanNum, pp.PatNum, pp.Ordinal, pp.Relationship,
                   isub.InsSubNum, isub.Subscriber AS SubscriberPatNum, isub.SubscriberID,
                   isub.DateEffective, isub.DateTerm, isub.SubscNote,
                   CONCAT(subp.LName, ', ', subp.FName) AS SubscriberName,
                   ip.PlanNum, ip.GroupName, ip.GroupNum,
                   fs.Description AS FeeSchedDesc,
                   c.CarrierNum, c.CarrierName, c.Phone AS CarrierPhone, c.ElectID
            FROM patplan pp
            JOIN inssub isub ON pp.InsSubNum = isub.InsSubNum
            JOIN insplan ip ON isub.PlanNum = ip.PlanNum
            LEFT JOIN carrier c ON ip.CarrierNum = c.CarrierNum
            LEFT JOIN feesched fs ON ip.FeeSched = fs.FeeSchedNum
            LEFT JOIN patient subp ON isub.Subscriber = subp.PatNum
            WHERE pp.PatNum = @patNum
            ORDER BY pp.Ordinal;
            """;
        var rows = await db.QueryAsync(sql, new { patNum });
        return rows.Select(r => new InsuranceCoverageDto
        {
            PatPlanNum = (long)r.PatPlanNum,
            PatNum = (long)r.PatNum,
            Ordinal = Convert.ToInt32(r.Ordinal),
            Relationship = Convert.ToInt32(r.Relationship),
            RelationshipDesc = RelationshipDesc(Convert.ToInt32(r.Relationship)),
            InsSubNum = (long)r.InsSubNum,
            SubscriberPatNum = (long)r.SubscriberPatNum,
            SubscriberName = (string?)r.SubscriberName ?? "",
            SubscriberId = (string?)r.SubscriberID,
            DateEffective = NullDate(r.DateEffective),
            DateTerm = NullDate(r.DateTerm),
            SubscNote = (string?)r.SubscNote,
            PlanNum = (long)r.PlanNum,
            GroupName = (string?)r.GroupName,
            GroupNum = (string?)r.GroupNum,
            FeeSchedDesc = (string?)r.FeeSchedDesc,
            CarrierNum = r.CarrierNum == null ? 0 : (long)r.CarrierNum,
            CarrierName = (string?)r.CarrierName ?? "(no carrier)",
            CarrierPhone = (string?)r.CarrierPhone,
            ElectId = (string?)r.ElectID,
        }).ToList();
    }

    public async Task<IReadOnlyList<CarrierDto>> SearchCarriers(string? q)
    {
        using var db = Db();
        var sql = """
            SELECT CarrierNum, CarrierName, Phone, ElectID
            FROM carrier
            WHERE (@q = '' OR CarrierName LIKE @like)
            ORDER BY CarrierName
            LIMIT 50;
            """;
        var rows = await db.QueryAsync(sql, new { q = q ?? "", like = $"%{q}%" });
        return rows.Select(r => new CarrierDto
        {
            CarrierNum = (long)r.CarrierNum,
            CarrierName = (string?)r.CarrierName ?? "",
            Phone = (string?)r.Phone,
            ElectId = (string?)r.ElectID,
        }).ToList();
    }

    // ── Writes ──────────────────────────────────────────────────

    public async Task<long> AddCoverage(long patNum, CreateInsuranceRequest req)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var patientExists = await db.ExecuteScalarAsync<long?>(
            "SELECT PatNum FROM patient WHERE PatNum = @patNum;", new { patNum }, tx);
        if (patientExists == null)
            throw new ArgumentException("Patient not found.");

        // 1. Resolve carrier: explicit num -> name match -> create.
        long carrierNum;
        if (req.CarrierNum is > 0)
        {
            carrierNum = await db.ExecuteScalarAsync<long?>(
                "SELECT CarrierNum FROM carrier WHERE CarrierNum = @num;",
                new { num = req.CarrierNum }, tx)
                ?? throw new ArgumentException("CarrierNum not found.");
        }
        else
        {
            var name = (req.CarrierName ?? "").Trim();
            if (name.Length == 0)
                throw new ArgumentException("Provide CarrierNum or CarrierName.");

            var existing = await db.ExecuteScalarAsync<long?>(
                "SELECT CarrierNum FROM carrier WHERE LOWER(CarrierName) = LOWER(@name) LIMIT 1;",
                new { name }, tx);
            if (existing.HasValue)
            {
                carrierNum = existing.Value;
            }
            else
            {
                var carrierCols = await _schema.GetColumns("carrier");
                var (carrierSql, carrierParams) = OdInsertBuilder.BuildInsert("carrier", carrierCols,
                    new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["CarrierName"] = name,
                        ["Phone"] = req.CarrierPhone,
                        ["ElectID"] = req.ElectId,
                        ["SecDateEntry"] = DateTime.Today,
                    });
                carrierNum = await db.ExecuteScalarAsync<long>(carrierSql, carrierParams, tx);
            }
        }

        // 2. Resolve plan: reuse a plan with the same carrier + group, otherwise create.
        var planNum = await db.ExecuteScalarAsync<long?>("""
            SELECT PlanNum FROM insplan
            WHERE CarrierNum = @carrierNum
              AND COALESCE(GroupName, '') = @groupName
              AND COALESCE(GroupNum, '') = @groupNum
            LIMIT 1;
            """, new
        {
            carrierNum,
            groupName = req.GroupName ?? "",
            groupNum = req.GroupNum ?? "",
        }, tx);
        if (planNum == null)
        {
            var planCols = await _schema.GetColumns("insplan");
            var (planSql, planParams) = OdInsertBuilder.BuildInsert("insplan", planCols,
                new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["CarrierNum"] = carrierNum,
                    ["GroupName"] = req.GroupName,
                    ["GroupNum"] = req.GroupNum,
                    ["SecDateEntry"] = DateTime.Today,
                });
            planNum = await db.ExecuteScalarAsync<long>(planSql, planParams, tx);
        }

        // 3. Resolve subscriber row: reuse the subscriber's inssub on this plan, otherwise create.
        var subscriberPatNum = req.SubscriberPatNum ?? patNum;
        var subscriberExists = await db.ExecuteScalarAsync<long?>(
            "SELECT PatNum FROM patient WHERE PatNum = @sub;", new { sub = subscriberPatNum }, tx);
        if (subscriberExists == null)
            throw new ArgumentException("Subscriber patient not found.");

        var insSubNum = await db.ExecuteScalarAsync<long?>(
            "SELECT InsSubNum FROM inssub WHERE PlanNum = @planNum AND Subscriber = @sub LIMIT 1;",
            new { planNum, sub = subscriberPatNum }, tx);
        if (insSubNum == null)
        {
            var subCols = await _schema.GetColumns("inssub");
            var (subSql, subParams) = OdInsertBuilder.BuildInsert("inssub", subCols,
                new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["PlanNum"] = planNum,
                    ["Subscriber"] = subscriberPatNum,
                    ["SubscriberID"] = req.SubscriberId,
                    ["DateEffective"] = req.DateEffective,
                    ["ReleaseInfo"] = 1,
                    ["AssignBen"] = 1,
                    ["SubscNote"] = req.SubscNote,
                    ["SecDateEntry"] = DateTime.Today,
                });
            insSubNum = await db.ExecuteScalarAsync<long>(subSql, subParams, tx);
        }
        else if (!string.IsNullOrWhiteSpace(req.SubscriberId))
        {
            await db.ExecuteAsync(
                "UPDATE inssub SET SubscriberID = @subscriberId WHERE InsSubNum = @insSubNum;",
                new { subscriberId = req.SubscriberId, insSubNum }, tx);
        }

        // 4. Guard against attaching the same coverage twice.
        var duplicate = await db.ExecuteScalarAsync<long?>(
            "SELECT PatPlanNum FROM patplan WHERE PatNum = @patNum AND InsSubNum = @insSubNum LIMIT 1;",
            new { patNum, insSubNum }, tx);
        if (duplicate.HasValue)
            throw new ArgumentException("This patient already has that coverage attached.");

        // 5. Create the patplan with the requested or next ordinal.
        var maxOrdinal = await db.ExecuteScalarAsync<int?>(
            "SELECT MAX(Ordinal) FROM patplan WHERE PatNum = @patNum;", new { patNum }, tx) ?? 0;
        var ordinal = req.Ordinal is > 0 ? req.Ordinal.Value : maxOrdinal + 1;

        var ppCols = await _schema.GetColumns("patplan");
        var (ppSql, ppParams) = OdInsertBuilder.BuildInsert("patplan", ppCols,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["PatNum"] = patNum,
                ["Ordinal"] = ordinal,
                ["Relationship"] = req.Relationship,
                ["InsSubNum"] = insSubNum,
                ["OrthoAutoFeeBilledOverride"] = -1, // OpenDental's "use plan default" sentinel
                ["SecDateTEntry"] = DateTime.Now,
            });
        var patPlanNum = await db.ExecuteScalarAsync<long>(ppSql, ppParams, tx);

        await tx.CommitAsync();
        return patPlanNum;
    }

    public async Task<bool> UpdateCoverage(long patPlanNum, UpdatePatPlanRequest req)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var row = await db.QueryFirstOrDefaultAsync(
            "SELECT PatNum, InsSubNum, Ordinal FROM patplan WHERE PatPlanNum = @patPlanNum;",
            new { patPlanNum }, tx);
        if (row == null) return false;
        long patNum = (long)row.PatNum;
        long insSubNum = (long)row.InsSubNum;
        int currentOrdinal = Convert.ToInt32(row.Ordinal);

        if (req.Ordinal is > 0 && req.Ordinal.Value != currentOrdinal)
        {
            // Swap with whichever coverage currently holds the target ordinal.
            await db.ExecuteAsync("""
                UPDATE patplan SET Ordinal = @currentOrdinal
                WHERE PatNum = @patNum AND Ordinal = @newOrdinal AND PatPlanNum != @patPlanNum;
                """, new { currentOrdinal, patNum, newOrdinal = req.Ordinal.Value, patPlanNum }, tx);
            await db.ExecuteAsync(
                "UPDATE patplan SET Ordinal = @newOrdinal WHERE PatPlanNum = @patPlanNum;",
                new { newOrdinal = req.Ordinal.Value, patPlanNum }, tx);
        }

        if (req.Relationship.HasValue)
        {
            await db.ExecuteAsync(
                "UPDATE patplan SET Relationship = @rel WHERE PatPlanNum = @patPlanNum;",
                new { rel = req.Relationship.Value, patPlanNum }, tx);
        }

        if (req.SubscriberId != null)
        {
            await db.ExecuteAsync(
                "UPDATE inssub SET SubscriberID = @sid WHERE InsSubNum = @insSubNum;",
                new { sid = req.SubscriberId, insSubNum }, tx);
        }

        if (req.DateTerm.HasValue)
        {
            await db.ExecuteAsync(
                "UPDATE inssub SET DateTerm = @dateTerm WHERE InsSubNum = @insSubNum;",
                new { dateTerm = req.DateTerm.Value.ToDateTime(TimeOnly.MinValue), insSubNum }, tx);
        }

        if (req.SubscNote != null)
        {
            await db.ExecuteAsync(
                "UPDATE inssub SET SubscNote = @note WHERE InsSubNum = @insSubNum;",
                new { note = req.SubscNote, insSubNum }, tx);
        }

        await tx.CommitAsync();
        return true;
    }

    public async Task<bool> DropCoverage(long patPlanNum)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var row = await db.QueryFirstOrDefaultAsync(
            "SELECT PatNum FROM patplan WHERE PatPlanNum = @patPlanNum;", new { patPlanNum }, tx);
        if (row == null) return false;
        long patNum = (long)row.PatNum;

        // Remove only the patient-plan link. The inssub/insplan rows stay so claim
        // history and other family members keep their references, matching OpenDental's behavior.
        await db.ExecuteAsync(
            "DELETE FROM patplan WHERE PatPlanNum = @patPlanNum;", new { patPlanNum }, tx);

        // Re-pack ordinals (1, 2, ...) so the remaining coverage stays consistent.
        var remaining = (await db.QueryAsync(
            "SELECT PatPlanNum FROM patplan WHERE PatNum = @patNum ORDER BY Ordinal;",
            new { patNum }, tx)).ToList();
        for (var i = 0; i < remaining.Count; i++)
        {
            await db.ExecuteAsync(
                "UPDATE patplan SET Ordinal = @ordinal WHERE PatPlanNum = @num;",
                new { ordinal = i + 1, num = (long)remaining[i].PatPlanNum }, tx);
        }

        await tx.CommitAsync();
        return true;
    }

    // ── Helpers ─────────────────────────────────────────────────

    public static string RelationshipDesc(int r) => r switch
    {
        0 => "Self",
        1 => "Spouse",
        2 => "Child",
        3 => "Employee",
        4 => "Handicap Dep",
        5 => "Signif Other",
        6 => "Injured Plaintiff",
        7 => "Life Partner",
        8 => "Dependent",
        _ => $"Unknown ({r})",
    };

    private static DateTime? NullDate(dynamic value)
    {
        if (value == null) return null;
        var dt = (DateTime)value;
        return dt.Year <= 1900 ? null : dt;
    }
}
