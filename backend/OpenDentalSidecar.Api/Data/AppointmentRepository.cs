using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;
using OpenDentalSidecar.Api.Data.Schema;

namespace OpenDentalSidecar.Api.Data;

public class AppointmentRepository : IAppointmentRepository
{
    private readonly string _connStr;
    private readonly SchemaIntrospector _schema;
    public AppointmentRepository(string connStr, SchemaIntrospector schema)
    {
        _connStr = connStr;
        _schema = schema;
    }
    private MySqlConnection Db() => new(_connStr);

    // ── Reads ───────────────────────────────────────────────────

    public async Task<IReadOnlyList<AppointmentDto>> GetByPatient(long patNum)
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.ProvNum, a.Op AS OperatoryNum,
                   a.AptDateTime, a.AptStatus, a.Note, a.ProcDescript, a.ClinicNum,
                   prov.Abbr AS ProviderName,
                   COALESCE(op.Abbrev, op.OpName) AS OperatoryName
            FROM appointment a
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN operatory op ON a.Op = op.OperatoryNum
            WHERE a.PatNum = @patNum
            ORDER BY a.AptDateTime DESC;
            """;
        var rows = await db.QueryAsync(sql, new { patNum });
        return rows.Select(r => new AppointmentDto
        {
            AptNum = (long)r.AptNum,
            PatNum = (long)r.PatNum,
            ProvNum = (long?)r.ProvNum,
            ProviderName = (string?)r.ProviderName,
            OperatoryNum = (long?)r.OperatoryNum,
            OperatoryName = (string?)r.OperatoryName,
            AptDateTime = (DateTime)r.AptDateTime,
            AptStatus = (int)r.AptStatus,
            AptStatusDesc = StatusDesc((int)r.AptStatus),
            Note = (string?)r.Note,
            ProcDescript = (string?)r.ProcDescript,
            ClinicNum = (long?)r.ClinicNum,
        }).ToList();
    }

    public async Task<AppointmentDetailDto?> GetDetail(long aptNum)
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.AptDateTime, a.Pattern, a.Op, a.ProvNum,
                   a.AptStatus, a.Confirmed, a.IsNewPatient, a.IsHygiene, a.Note,
                   a.ProcDescript, a.AppointmentTypeNum, a.ClinicNum, a.Priority,
                   a.DateTimeArrived, a.DateTimeSeated, a.DateTimeDismissed,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   COALESCE(NULLIF(p.WirelessPhone, ''), NULLIF(p.HmPhone, '')) AS PatientPhone,
                   prov.Abbr AS ProviderAbbr, prov.ProvColor AS ProviderColor,
                   d.ItemName AS ConfirmedDesc, d.ItemColor AS ConfirmedColor,
                   at.AppointmentTypeName
            FROM appointment a
            JOIN patient p ON a.PatNum = p.PatNum
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN definition d ON a.Confirmed = d.DefNum
            LEFT JOIN appointmenttype at ON a.AppointmentTypeNum = at.AppointmentTypeNum
            WHERE a.AptNum = @aptNum;
            """;
        var r = await db.QueryFirstOrDefaultAsync(sql, new { aptNum });
        if (r == null) return null;

        var procs = (await db.QueryAsync("""
            SELECT pl.ProcNum, pl.PatNum, pl.ProvNum, pl.AptNum, pl.CodeNum,
                   pc.ProcCode, COALESCE(NULLIF(pc.AbbrDesc, ''), pc.Descript) AS Descript,
                   pl.ProcDate, pl.ProcFee, pl.ProcStatus,
                   pl.ToothNum, pl.ToothRange, pl.Surf,
                   prov.Abbr AS ProviderName
            FROM procedurelog pl
            JOIN procedurecode pc ON pl.CodeNum = pc.CodeNum
            LEFT JOIN provider prov ON pl.ProvNum = prov.ProvNum
            WHERE pl.AptNum = @aptNum
            ORDER BY pc.ProcCode;
            """, new { aptNum }))
            .Select(p => new ProcedureDto
            {
                ProcNum = (long)p.ProcNum,
                PatNum = (long)p.PatNum,
                ProvNum = (long?)p.ProvNum,
                ProviderName = (string?)p.ProviderName,
                AptNum = (long?)p.AptNum,
                CodeNum = (long)p.CodeNum,
                ProcCode = (string)p.ProcCode,
                Descript = (string?)p.Descript ?? "",
                ProcDate = (DateTime)p.ProcDate,
                ProcFee = Convert.ToDouble(p.ProcFee),
                ProcStatus = Convert.ToInt32(p.ProcStatus),
                ProcStatusDesc = ProcedureRepository.StatusDesc(Convert.ToInt32(p.ProcStatus)),
                ToothNum = (string?)p.ToothNum,
                ToothRange = (string?)p.ToothRange,
                Surf = (string?)p.Surf,
            }).ToList();

        return new AppointmentDetailDto
        {
            AptNum = (long)r.AptNum,
            PatNum = (long)r.PatNum,
            PatientName = (string)r.PatientName,
            PatientPhone = (string?)r.PatientPhone,
            AptDateTime = (DateTime)r.AptDateTime,
            Pattern = (string?)r.Pattern ?? "",
            Minutes = ScheduleRepository.PatternMinutes((string?)r.Pattern),
            OperatoryNum = (long)r.Op,
            ProvNum = (long)r.ProvNum > 0 ? (long?)r.ProvNum : null,
            ProviderAbbr = (string?)r.ProviderAbbr,
            ProviderColor = r.ProviderColor == null ? null : (int?)Convert.ToInt32(r.ProviderColor),
            AptStatus = Convert.ToInt32(r.AptStatus),
            AptStatusDesc = StatusDesc(Convert.ToInt32(r.AptStatus)),
            ConfirmedDefNum = (long)r.Confirmed,
            ConfirmedDesc = (string?)r.ConfirmedDesc,
            ConfirmedColor = r.ConfirmedColor == null ? null : (int?)Convert.ToInt32(r.ConfirmedColor),
            IsNewPatient = Convert.ToInt32(r.IsNewPatient) == 1,
            IsHygiene = Convert.ToInt32(r.IsHygiene) == 1,
            Note = (string?)r.Note,
            ProcDescript = (string?)r.ProcDescript,
            AppointmentTypeNum = (long)r.AppointmentTypeNum > 0 ? (long?)r.AppointmentTypeNum : null,
            AppointmentTypeName = (string?)r.AppointmentTypeName,
            ClinicNum = (long)r.ClinicNum > 0 ? (long?)r.ClinicNum : null,
            DateTimeArrived = NullDateTime(r.DateTimeArrived),
            DateTimeSeated = NullDateTime(r.DateTimeSeated),
            DateTimeDismissed = NullDateTime(r.DateTimeDismissed),
            Priority = Convert.ToInt32(r.Priority),
            Procedures = procs,
        };
    }

    public async Task<IReadOnlyList<ConfirmationItemDto>> GetUnscheduled()
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.AptDateTime, a.Pattern, a.Confirmed, a.ProcDescript,
                   a.AptStatus, a.Priority,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   p.HmPhone, p.WirelessPhone, p.Email,
                   prov.Abbr AS ProviderAbbr,
                   d.ItemName AS ConfirmedDesc, d.ItemColor AS ConfirmedColor
            FROM appointment a
            JOIN patient p ON a.PatNum = p.PatNum
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN definition d ON a.Confirmed = d.DefNum
            WHERE a.AptStatus IN (3, 5)
              AND p.PatStatus = 0
            ORDER BY a.AptDateTime DESC
            LIMIT 500;
            """;
        var rows = await db.QueryAsync(sql);
        return rows.Select(r => (ConfirmationItemDto)MapListItem(r)).ToList();
    }

    /// <summary>ASAP list: appointments flagged Priority=1 that are still actionable
    /// (scheduled, unscheduled, broken, or planned).</summary>
    public async Task<IReadOnlyList<ConfirmationItemDto>> GetAsap()
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.AptDateTime, a.Pattern, a.Confirmed, a.ProcDescript,
                   a.AptStatus, a.Priority,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   p.HmPhone, p.WirelessPhone, p.Email,
                   prov.Abbr AS ProviderAbbr,
                   d.ItemName AS ConfirmedDesc, d.ItemColor AS ConfirmedColor
            FROM appointment a
            JOIN patient p ON a.PatNum = p.PatNum
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN definition d ON a.Confirmed = d.DefNum
            WHERE a.Priority = 1
              AND a.AptStatus IN (1, 3, 5, 6)
              AND p.PatStatus = 0
            ORDER BY a.AptDateTime
            LIMIT 500;
            """;
        var rows = await db.QueryAsync(sql);
        return rows.Select(r => (ConfirmationItemDto)MapListItem(r)).ToList();
    }

    private static ConfirmationItemDto MapListItem(dynamic r) => new()
    {
        AptNum = (long)r.AptNum,
        PatNum = (long)r.PatNum,
        PatientName = (string)r.PatientName,
        HmPhone = (string?)r.HmPhone,
        WirelessPhone = (string?)r.WirelessPhone,
        Email = (string?)r.Email,
        AptDateTime = (DateTime)r.AptDateTime,
        Minutes = ScheduleRepository.PatternMinutes((string?)r.Pattern),
        ProviderAbbr = (string?)r.ProviderAbbr,
        ConfirmedDefNum = (long)r.Confirmed,
        ConfirmedDesc = (string?)r.ConfirmedDesc,
        ConfirmedColor = r.ConfirmedColor == null ? null : (int?)Convert.ToInt32(r.ConfirmedColor),
        ProcDescript = (string?)r.ProcDescript,
        Priority = Convert.ToInt32(r.Priority),
        AptStatus = Convert.ToInt32(r.AptStatus),
        AptStatusDesc = StatusDesc(Convert.ToInt32(r.AptStatus)),
    };

    // ── Writes ──────────────────────────────────────────────────

    public async Task<long> Create(CreateAppointmentRequest req)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var pattern = MinutesToPattern(req.Minutes);

        // Default Confirmed to the first ApptConfirmed definition ("Not Called" in stock setups).
        var defaultConfirmed = await db.ExecuteScalarAsync<long?>(
            "SELECT DefNum FROM definition WHERE Category = 2 AND IsHidden = 0 ORDER BY ItemOrder LIMIT 1;",
            transaction: tx) ?? 0;

        // Default provider: explicit -> operatory's dentist -> patient's primary provider.
        long provNum = req.ProvNum ?? 0;
        if (provNum == 0)
        {
            provNum = await db.ExecuteScalarAsync<long?>(
                "SELECT ProvDentist FROM operatory WHERE OperatoryNum = @op;",
                new { op = req.OperatoryNum }, tx) ?? 0;
        }
        if (provNum == 0)
        {
            provNum = await db.ExecuteScalarAsync<long?>(
                "SELECT PriProv FROM patient WHERE PatNum = @patNum;",
                new { req.PatNum }, tx) ?? 0;
        }

        var columns = await _schema.GetColumns("appointment");
        var fields = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["PatNum"] = req.PatNum,
            ["AptStatus"] = 1,
            ["Pattern"] = pattern,
            ["Confirmed"] = defaultConfirmed,
            ["Op"] = req.OperatoryNum,
            ["Note"] = req.Note,
            ["ProvNum"] = provNum,
            ["ProvHyg"] = req.ProvHyg,
            ["AptDateTime"] = req.AptDateTime,
            ["IsNewPatient"] = req.IsNewPatient ? 1 : 0,
            ["ProcDescript"] = req.ProcDescript,
            ["ClinicNum"] = req.ClinicNum,
            ["IsHygiene"] = req.IsHygiene ? 1 : 0,
            ["AppointmentTypeNum"] = req.AppointmentTypeNum,
            ["SecDateTEntry"] = DateTime.Now,
        };
        if (req.ExtraFields != null)
            foreach (var (key, value) in req.ExtraFields)
                fields[key] = value; // validated against the live schema by the builder

        var (sql, p) = OdInsertBuilder.BuildInsert("appointment", columns, fields);
        var aptNum = await db.ExecuteScalarAsync<long>(sql, p, tx);

        // Attach treatment-planned procedures to this appointment.
        if (req.ProcNums is { Count: > 0 })
        {
            await db.ExecuteAsync("""
                UPDATE procedurelog SET AptNum = @aptNum
                WHERE ProcNum IN @procNums AND PatNum = @patNum AND ProcStatus = 1;
                """, new { aptNum, procNums = req.ProcNums, patNum = req.PatNum }, tx);
        }

        // Booking from the recall list: stamp the recall row so it drops off the due list.
        if (req.RecallNum is > 0)
        {
            await db.ExecuteAsync("""
                UPDATE recall SET DateScheduled = @dateScheduled
                WHERE RecallNum = @recallNum AND PatNum = @patNum;
                """, new { dateScheduled = req.AptDateTime.Date, recallNum = req.RecallNum, patNum = req.PatNum }, tx);
        }

        await InsertAppointmentSignal(db, tx, aptNum, req.AptDateTime);
        await tx.CommitAsync();
        return aptNum;
    }

    public async Task<bool> Update(long aptNum, UpdateAppointmentRequest req)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var existing = await db.QueryFirstOrDefaultAsync(
            "SELECT AptDateTime, Pattern, PatNum FROM appointment WHERE AptNum = @aptNum;",
            new { aptNum }, tx);
        if (existing == null) return false;
        var oldDate = (DateTime)existing.AptDateTime;
        var patNum = (long)existing.PatNum;

        var fields = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["AptDateTime"] = req.AptDateTime,
            ["Pattern"] = req.Minutes.HasValue ? MinutesToPattern(req.Minutes.Value) : null,
            ["Op"] = req.OperatoryNum,
            ["ProvNum"] = req.ProvNum,
            ["AppointmentTypeNum"] = req.AppointmentTypeNum,
            ["Note"] = req.Note,
            ["ProcDescript"] = req.ProcDescript,
            ["IsNewPatient"] = req.IsNewPatient.HasValue ? (req.IsNewPatient.Value ? 1 : 0) : null,
        };
        if (req.ExtraFields != null)
            foreach (var (key, value) in req.ExtraFields)
                fields[key] = value;
        var affected = 0;
        if (fields.Values.Any(v => v != null))
        {
            var columns = await _schema.GetColumns("appointment");
            var (sql, p) = OdInsertBuilder.BuildUpdate("appointment", columns, aptNum, fields);
            affected = await db.ExecuteAsync(sql, p, tx);
        }

        if (req.ProcNums != null)
        {
            await db.ExecuteAsync("""
                UPDATE procedurelog SET AptNum = 0
                WHERE AptNum = @aptNum AND PatNum = @patNum AND ProcStatus = 1;
                """, new { aptNum, patNum }, tx);

            if (req.ProcNums.Count > 0)
            {
                await db.ExecuteAsync("""
                    UPDATE procedurelog SET AptNum = @aptNum
                    WHERE ProcNum IN @procNums AND PatNum = @patNum AND ProcStatus = 1;
                    """, new { aptNum, procNums = req.ProcNums, patNum }, tx);
            }
        }

        await InsertAppointmentSignal(db, tx, aptNum, oldDate);
        if (req.AptDateTime.HasValue && req.AptDateTime.Value.Date != oldDate.Date)
            await InsertAppointmentSignal(db, tx, aptNum, req.AptDateTime.Value);

        await tx.CommitAsync();
        return affected > 0 || req.ProcNums != null;
    }

    public async Task<bool> SetStatus(long aptNum, int aptStatus, string? reason = null)
    {
        if (aptStatus is not (1 or 2 or 3 or 5))
            throw new ArgumentException("AptStatus must be 1 (Scheduled), 2 (Complete), 3 (Unscheduled), or 5 (Broken).");

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var apt = await db.QueryFirstOrDefaultAsync(
            "SELECT AptDateTime, PatNum FROM appointment WHERE AptNum = @aptNum;", new { aptNum }, tx);
        if (apt == null) return false;
        var aptDate = (DateTime)apt.AptDateTime;

        var affected = await db.ExecuteAsync(
            "UPDATE appointment SET AptStatus = @aptStatus WHERE AptNum = @aptNum;",
            new { aptNum, aptStatus }, tx);

        // Breaking or unscheduling with a reason: log it on the patient's comm log
        // so the front desk has a paper trail when rebooking.
        if (aptStatus is 3 or 5 && !string.IsNullOrWhiteSpace(reason))
        {
            var verb = aptStatus == 5 ? "broken" : "unscheduled";
            var commCols = await _schema.GetColumns("commlog");
            var (commSql, commParams) = OdInsertBuilder.BuildInsert("commlog", commCols,
                new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["PatNum"] = (long)apt.PatNum,
                    ["CommDateTime"] = DateTime.Now,
                    ["Note"] = $"Appointment {aptDate:yyyy-MM-dd HH:mm} {verb}: {reason!.Trim()}",
                    ["Mode_"] = 3,
                    ["SentOrReceived"] = 1,
                    ["DateTEntry"] = DateTime.Now,
                });
            await db.ExecuteScalarAsync<long>(commSql, commParams, tx);
        }

        await InsertAppointmentSignal(db, tx, aptNum, aptDate);
        await tx.CommitAsync();
        return affected > 0;
    }

    public async Task<bool> SetPriority(long aptNum, int priority)
    {
        if (priority is not (0 or 1))
            throw new ArgumentException("Priority must be 0 (Normal) or 1 (ASAP).");

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var aptDate = await db.ExecuteScalarAsync<DateTime?>(
            "SELECT AptDateTime FROM appointment WHERE AptNum = @aptNum;", new { aptNum }, tx);
        if (aptDate == null) return false;

        var affected = await db.ExecuteAsync(
            "UPDATE appointment SET Priority = @priority WHERE AptNum = @aptNum;",
            new { aptNum, priority }, tx);

        await InsertAppointmentSignal(db, tx, aptNum, aptDate.Value);
        await tx.CommitAsync();
        return affected > 0;
    }

    public async Task<bool> SetConfirmation(long aptNum, long confirmedDefNum)
    {
        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var valid = await db.ExecuteScalarAsync<long?>(
            "SELECT DefNum FROM definition WHERE DefNum = @confirmedDefNum AND Category = 2;",
            new { confirmedDefNum }, tx);
        if (valid == null)
            throw new ArgumentException("ConfirmedDefNum must be a definition in category 2 (ApptConfirmed).");

        var aptDate = await db.ExecuteScalarAsync<DateTime?>(
            "SELECT AptDateTime FROM appointment WHERE AptNum = @aptNum;", new { aptNum }, tx);
        if (aptDate == null) return false;

        var affected = await db.ExecuteAsync(
            "UPDATE appointment SET Confirmed = @confirmedDefNum WHERE AptNum = @aptNum;",
            new { aptNum, confirmedDefNum }, tx);

        await InsertAppointmentSignal(db, tx, aptNum, aptDate.Value);
        await tx.CommitAsync();
        return affected > 0;
    }

    public async Task<bool> SetFlowTime(long aptNum, string milestone, bool clear)
    {
        var column = milestone.ToLowerInvariant() switch
        {
            "arrived" => "DateTimeArrived",
            "seated" => "DateTimeSeated",
            "dismissed" => "DateTimeDismissed",
            _ => throw new ArgumentException("Milestone must be arrived, seated, or dismissed."),
        };

        using var db = Db();
        await db.OpenAsync();
        using var tx = await db.BeginTransactionAsync();

        var aptDate = await db.ExecuteScalarAsync<DateTime?>(
            "SELECT AptDateTime FROM appointment WHERE AptNum = @aptNum;", new { aptNum }, tx);
        if (aptDate == null) return false;

        // Column name is whitelisted above; value is a fixed SQL expression. No user input is interpolated.
        var value = clear ? "'0001-01-01 00:00:00'" : "NOW()";
        var affected = await db.ExecuteAsync(
            $"UPDATE appointment SET {column} = {value} WHERE AptNum = @aptNum;",
            new { aptNum }, tx);

        await InsertAppointmentSignal(db, tx, aptNum, aptDate.Value);
        await tx.CommitAsync();
        return affected > 0;
    }

    // ── Helpers ─────────────────────────────────────────────────

    /// <summary>
    /// Inserts a signalod row (IType 68 = Appointment) so any running OpenDental
    /// workstation viewing this date refreshes its appointment book within seconds.
    /// </summary>
    /// <summary>Insert a refresh signal so open OpenDental workstations reload this appointment's day.</summary>
    private async Task InsertAppointmentSignal(
        MySqlConnection db, System.Data.Common.DbTransaction tx, long aptNum, DateTime aptDateTime)
    {
        var columns = await _schema.GetColumns("signalod");
        var (sql, p) = OdInsertBuilder.BuildInsert("signalod", columns,
            new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
            {
                ["DateViewing"] = aptDateTime.Date,
                ["SigDateTime"] = DateTime.Now,
                ["FKey"] = aptNum,
                ["FKeyType"] = "Appointment",
                ["IType"] = 68, // InvalidType.Appointment
            });
        await db.ExecuteScalarAsync<long>(sql, p, tx);
    }

    /// <summary>Converts minutes to an OpenDental time pattern (one char per 5 minutes, provider time as X).</summary>
    internal static string MinutesToPattern(int minutes)
    {
        var slots = Math.Clamp((int)Math.Round(minutes / 5.0), 1, 108);
        if (slots <= 2) return new string('X', slots);
        // First and last slot as assistant time, provider time in the middle (typical OD convention).
        return "/" + new string('X', slots - 2) + "/";
    }

    public static string StatusDesc(int s) => s switch
    {
        1 => "Scheduled",
        2 => "Complete",
        3 => "UnschedList",
        5 => "Broken",
        6 => "Planned",
        7 => "PtNote",
        8 => "PtNoteCompleted",
        _ => $"Unknown ({s})",
    };

    private static DateTime? NullDateTime(dynamic value)
    {
        if (value == null) return null;
        var dt = (DateTime)value;
        return dt.Year <= 1 ? null : dt;
    }
}
