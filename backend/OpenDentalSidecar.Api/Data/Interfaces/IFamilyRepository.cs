namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IFamilyRepository
{
    /// <summary>Makes the patient the guarantor of their current family.
    /// Returns the number of family members updated.</summary>
    Task<int> SetGuarantor(long patNum);

    /// <summary>Moves a patient into another patient's family.
    /// Throws InvalidOperationException if the patient has dependents.</summary>
    Task<bool> MoveToFamily(long patNum, long targetPatNum);
}
