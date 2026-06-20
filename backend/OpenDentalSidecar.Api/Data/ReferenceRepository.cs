using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;
using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data;

public class ReferenceRepository : IReferenceRepository
{
    private readonly string _connStr;
    public ReferenceRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<IReadOnlyList<OperatoryDto>> GetOperatories()
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT OperatoryNum, OpName, Abbrev, ItemOrder, IsHygiene,
                   ProvDentist, ProvHygienist, ClinicNum
            FROM operatory
            WHERE IsHidden = 0
            ORDER BY ItemOrder;
            """);
        return rows.Select(r => new OperatoryDto
        {
            OperatoryNum = (long)r.OperatoryNum,
            OpName = (string)r.OpName,
            Abbrev = (string?)r.Abbrev ?? "",
            ItemOrder = Convert.ToInt32(r.ItemOrder),
            IsHygiene = Convert.ToInt32(r.IsHygiene) == 1,
            ProvDentist = (long)r.ProvDentist > 0 ? (long?)r.ProvDentist : null,
            ProvHygienist = (long)r.ProvHygienist > 0 ? (long?)r.ProvHygienist : null,
            ClinicNum = (long)r.ClinicNum > 0 ? (long?)r.ClinicNum : null,
        }).ToList();
    }

    public async Task<IReadOnlyList<ProviderDto>> GetProviders()
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT ProvNum, Abbr, LName, FName, IsSecondary, IsHidden, ProvColor, ItemOrder
            FROM provider
            WHERE IsHidden = 0 AND ProvStatus = 0
            ORDER BY ItemOrder;
            """);
        return rows.Select(r => new ProviderDto
        {
            ProvNum = (long)r.ProvNum,
            Abbr = (string?)r.Abbr ?? "",
            LName = (string?)r.LName ?? "",
            FName = (string?)r.FName ?? "",
            IsSecondary = Convert.ToInt32(r.IsSecondary) == 1,
            IsHidden = Convert.ToInt32(r.IsHidden) == 1,
            ProvColor = Convert.ToInt32(r.ProvColor),
            ItemOrder = Convert.ToInt32(r.ItemOrder),
        }).ToList();
    }

    public async Task<IReadOnlyList<DefinitionDto>> GetDefinitions(int category)
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT DefNum, Category, ItemOrder, ItemName, ItemValue, ItemColor
            FROM definition
            WHERE Category = @category AND IsHidden = 0
            ORDER BY ItemOrder;
            """, new { category });
        return rows.Select(r => new DefinitionDto
        {
            DefNum = (long)r.DefNum,
            Category = Convert.ToInt32(r.Category),
            ItemOrder = Convert.ToInt32(r.ItemOrder),
            ItemName = (string?)r.ItemName ?? "",
            ItemValue = (string?)r.ItemValue ?? "",
            ItemColor = Convert.ToInt32(r.ItemColor),
        }).ToList();
    }

    public async Task<IReadOnlyList<AppointmentTypeDto>> GetAppointmentTypes()
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT AppointmentTypeNum, AppointmentTypeName, AppointmentTypeColor, Pattern, CodeStr
            FROM appointmenttype
            WHERE IsHidden = 0
            ORDER BY ItemOrder;
            """);
        return rows.Select(r => new AppointmentTypeDto
        {
            AppointmentTypeNum = (long)r.AppointmentTypeNum,
            AppointmentTypeName = (string?)r.AppointmentTypeName ?? "",
            AppointmentTypeColor = Convert.ToInt32(r.AppointmentTypeColor),
            Pattern = (string?)r.Pattern ?? "",
            CodeStr = (string?)r.CodeStr ?? "",
        }).ToList();
    }

    public async Task<IReadOnlyList<ClinicDto>> GetClinics()
    {
        using var db = Db();
        var rows = await db.QueryAsync("""
            SELECT ClinicNum, Description, Abbr FROM clinic WHERE IsHidden = 0 ORDER BY ItemOrder;
            """);
        return rows.Select(r => new ClinicDto
        {
            ClinicNum = (long)r.ClinicNum,
            Description = (string?)r.Description ?? "",
            Abbr = (string?)r.Abbr ?? "",
        }).ToList();
    }
}
