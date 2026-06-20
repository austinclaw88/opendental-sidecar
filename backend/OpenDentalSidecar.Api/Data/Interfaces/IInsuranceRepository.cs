using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IInsuranceRepository
{
    Task<IReadOnlyList<InsuranceCoverageDto>> GetByPatient(long patNum);
    Task<IReadOnlyList<CarrierDto>> SearchCarriers(string? q);
    Task<long> AddCoverage(long patNum, CreateInsuranceRequest req);
    Task<bool> UpdateCoverage(long patPlanNum, UpdatePatPlanRequest req);
    Task<bool> DropCoverage(long patPlanNum);
}
