using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IPatientRepository
{
    Task<IReadOnlyList<PatientSummaryDto>> Search(string query, int limit = 50);
    Task<PatientDetailDto?> GetDetail(long patNum);
}
