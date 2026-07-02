using Dapper;
using MySqlConnector;
using OpenDentalSidecar.Api.Data.Interfaces;

namespace OpenDentalSidecar.Api.Data;

/// <summary>
/// Family restructuring: set guarantor and move a patient between families.
/// In OpenDental the family is defined entirely by patient.Guarantor (every member
/// points at the family head, including the head itself), so both operations are
/// single-column UPDATEs on the patient table.
/// </summary>
public class FamilyRepository : IFamilyRepository
{
    private readonly string _connStr;
    public FamilyRepository(string connStr) => _connStr = connStr;
    private MySqlConnection Db() => new(_connStr);

    public async Task<int> SetGuarantor(long patNum)
    {
        using var db = Db();
        var current = await db.QueryFirstOrDefaultAsync<long?>(
            "SELECT Guarantor FROM patient WHERE PatNum = @patNum;", new { patNum });
        if (current == null) return 0;              // patient not found
        if (current == patNum) return 0;            // already the guarantor

        // Repoint every member of the family (including the old head) at the new head.
        return await db.ExecuteAsync(
            "UPDATE patient SET Guarantor = @patNum WHERE Guarantor = @current;",
            new { patNum, current });
    }

    public async Task<bool> MoveToFamily(long patNum, long targetPatNum)
    {
        using var db = Db();
        var targetGuar = await db.QueryFirstOrDefaultAsync<long?>(
            "SELECT Guarantor FROM patient WHERE PatNum = @targetPatNum;", new { targetPatNum });
        if (targetGuar == null) return false;       // target not found

        // If the moving patient is a guarantor with other members, moving them would
        // orphan the family. Block it; the user should reassign the guarantor first.
        var dependents = await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM patient WHERE Guarantor = @patNum AND PatNum != @patNum;",
            new { patNum });
        if (dependents > 0)
            throw new InvalidOperationException(
                "This patient is the guarantor of other family members. Set a different guarantor for that family first.");

        var rows = await db.ExecuteAsync(
            "UPDATE patient SET Guarantor = @targetGuar WHERE PatNum = @patNum;",
            new { targetGuar, patNum });
        return rows > 0;
    }
}
