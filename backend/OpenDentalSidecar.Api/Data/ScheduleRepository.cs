using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class ScheduleRepository : IScheduleRepository
{
    private readonly string _connStr;
    private readonly IReferenceRepository _reference;

    public ScheduleRepository(string connStr, IReferenceRepository reference)
    {
        _connStr = connStr;
        _reference = reference;
    }

    private MySqlConnection Db() => new(_connStr);

    internal static int PatternMinutes(string? pattern)
        => string.IsNullOrEmpty(pattern) ? 30 : pattern.Length * 5;

    public async Task<ScheduleDayDto> GetDay(DateOnly date, long? clinicNum)
    {
        using var db = Db();
        var ops = (await _reference.GetOperatories())
            .Where(o => clinicNum == null || o.ClinicNum == clinicNum || o.ClinicNum == null)
            .ToList();

        var apptSql = """
            SELECT a.AptNum, a.PatNum, a.AptDateTime, a.Pattern, a.Op, a.ProvNum,
                   a.AptStatus, a.Confirmed, a.IsNewPatient, a.IsHygiene, a.Note,
                   a.ProcDescript, a.AppointmentTypeNum, a.Priority,
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
            WHERE DATE(a.AptDateTime) = @date
              AND a.AptStatus IN (1, 2)
            ORDER BY a.AptDateTime;
            """;
        var apptRows = await db.QueryAsync(apptSql, new { date = date.ToDateTime(TimeOnly.MinValue) });

        var appointments = apptRows.Select(r => new ScheduleAppointmentDto
        {
            AptNum = (long)r.AptNum,
            PatNum = (long)r.PatNum,
            PatientName = (string)r.PatientName,
            PatientPhone = (string?)r.PatientPhone,
            AptDateTime = (DateTime)r.AptDateTime,
            Pattern = (string?)r.Pattern ?? "",
            Minutes = PatternMinutes((string?)r.Pattern),
            OperatoryNum = (long)r.Op,
            ProvNum = (long)r.ProvNum > 0 ? (long?)r.ProvNum : null,
            ProviderAbbr = (string?)r.ProviderAbbr,
            ProviderColor = r.ProviderColor == null ? null : (int?)Convert.ToInt32(r.ProviderColor),
            AptStatus = Convert.ToInt32(r.AptStatus),
            AptStatusDesc = AppointmentRepository.StatusDesc(Convert.ToInt32(r.AptStatus)),
            ConfirmedDefNum = (long)r.Confirmed,
            ConfirmedDesc = (string?)r.ConfirmedDesc,
            ConfirmedColor = r.ConfirmedColor == null ? null : (int?)Convert.ToInt32(r.ConfirmedColor),
            IsNewPatient = Convert.ToInt32(r.IsNewPatient) == 1,
            IsHygiene = Convert.ToInt32(r.IsHygiene) == 1,
            Note = (string?)r.Note,
            ProcDescript = (string?)r.ProcDescript,
            AppointmentTypeNum = (long)r.AppointmentTypeNum > 0 ? (long?)r.AppointmentTypeNum : null,
            AppointmentTypeName = (string?)r.AppointmentTypeName,
            DateTimeArrived = NullDateTime(r.DateTimeArrived),
            DateTimeSeated = NullDateTime(r.DateTimeSeated),
            DateTimeDismissed = NullDateTime(r.DateTimeDismissed),
            Priority = Convert.ToInt32(r.Priority),
        }).ToList();

        var blockSql = """
            SELECT s.ScheduleNum, s.SchedDate, s.StartTime, s.StopTime, s.SchedType,
                   s.ProvNum, s.BlockoutType, s.Note,
                   prov.Abbr AS ProvAbbr,
                   d.ItemName AS BlockoutDesc, d.ItemColor AS BlockoutColor
            FROM schedule s
            LEFT JOIN provider prov ON s.ProvNum = prov.ProvNum
            LEFT JOIN definition d ON s.BlockoutType = d.DefNum
            WHERE s.SchedDate = @date AND s.SchedType IN (1, 2) AND s.Status = 0;
            """;
        var blockRows = (await db.QueryAsync(blockSql, new { date = date.ToDateTime(TimeOnly.MinValue) })).ToList();

        var blocks = new List<ScheduleBlockDto>();
        if (blockRows.Count > 0)
        {
            var schedNums = blockRows.Select(r => (long)r.ScheduleNum).ToList();
            var opLinks = (await db.QueryAsync(
                    "SELECT ScheduleNum, OperatoryNum FROM scheduleop WHERE ScheduleNum IN @schedNums;",
                    new { schedNums }))
                .GroupBy(r => (long)r.ScheduleNum)
                .ToDictionary(g => g.Key, g => g.Select(r => (long)r.OperatoryNum).ToList());

            blocks = blockRows.Select(r => new ScheduleBlockDto
            {
                ScheduleNum = (long)r.ScheduleNum,
                SchedDate = DateOnly.FromDateTime((DateTime)r.SchedDate),
                StartTime = (TimeSpan)r.StartTime,
                StopTime = (TimeSpan)r.StopTime,
                SchedType = Convert.ToInt32(r.SchedType),
                ProvNum = (long)r.ProvNum > 0 ? (long?)r.ProvNum : null,
                ProvAbbr = (string?)r.ProvAbbr,
                BlockoutType = (long)r.BlockoutType > 0 ? (long?)r.BlockoutType : null,
                BlockoutDesc = (string?)r.BlockoutDesc,
                BlockoutColor = r.BlockoutColor == null ? null : (int?)Convert.ToInt32(r.BlockoutColor),
                Note = (string?)r.Note,
                Ops = opLinks.TryGetValue((long)r.ScheduleNum, out var list) ? list : new List<long>(),
            }).ToList();
        }

        return new ScheduleDayDto
        {
            Date = date,
            Operatories = ops,
            Appointments = appointments,
            Blocks = blocks,
        };
    }

    public async Task<IReadOnlyList<ScheduleDayDto>> GetRange(DateOnly from, DateOnly to, long? clinicNum)
    {
        // Week view: up to 31 days, each fetched with the same logic as the day grid.
        // The day count is small enough that per-day queries stay simple and correct.
        var days = new List<ScheduleDayDto>();
        for (var d = from; d <= to; d = d.AddDays(1))
            days.Add(await GetDay(d, clinicNum));
        return days;
    }

    public async Task<IReadOnlyList<ConfirmationItemDto>> GetConfirmationList(DateOnly from, DateOnly to)
    {
        using var db = Db();
        var sql = """
            SELECT a.AptNum, a.PatNum, a.AptDateTime, a.Pattern, a.Confirmed, a.ProcDescript,
                   CONCAT(p.LName, ', ', p.FName) AS PatientName,
                   p.HmPhone, p.WirelessPhone, p.Email,
                   prov.Abbr AS ProviderAbbr,
                   COALESCE(NULLIF(op.Abbrev, ''), op.OpName) AS OperatoryAbbrev,
                   d.ItemName AS ConfirmedDesc, d.ItemColor AS ConfirmedColor,
                   pn.ApptPhone AS ApptPhoneNote
            FROM appointment a
            JOIN patient p ON a.PatNum = p.PatNum
            LEFT JOIN provider prov ON a.ProvNum = prov.ProvNum
            LEFT JOIN operatory op ON a.Op = op.OperatoryNum
            LEFT JOIN definition d ON a.Confirmed = d.DefNum
            LEFT JOIN patientnote pn ON a.PatNum = pn.PatNum
            WHERE a.AptStatus = 1
              AND DATE(a.AptDateTime) >= @from AND DATE(a.AptDateTime) <= @to
            ORDER BY a.AptDateTime;
            """;
        var rows = await db.QueryAsync(sql, new
        {
            from = from.ToDateTime(TimeOnly.MinValue),
            to = to.ToDateTime(TimeOnly.MinValue),
        });
        return rows.Select(r => new ConfirmationItemDto
        {
            AptNum = (long)r.AptNum,
            PatNum = (long)r.PatNum,
            PatientName = (string)r.PatientName,
            HmPhone = (string?)r.HmPhone,
            WirelessPhone = (string?)r.WirelessPhone,
            Email = (string?)r.Email,
            AptDateTime = (DateTime)r.AptDateTime,
            Minutes = PatternMinutes((string?)r.Pattern),
            ProviderAbbr = (string?)r.ProviderAbbr,
            OperatoryAbbrev = (string?)r.OperatoryAbbrev,
            ConfirmedDefNum = (long)r.Confirmed,
            ConfirmedDesc = (string?)r.ConfirmedDesc,
            ConfirmedColor = r.ConfirmedColor == null ? null : (int?)Convert.ToInt32(r.ConfirmedColor),
            ProcDescript = (string?)r.ProcDescript,
            ApptPhoneNote = (string?)r.ApptPhoneNote,
        }).ToList();
    }

    private static DateTime? NullDateTime(dynamic value)
    {
        if (value == null) return null;
        var dt = (DateTime)value;
        return dt.Year <= 1 ? null : dt;
    }
}
