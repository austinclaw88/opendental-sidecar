using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IBenefitRepository
{
    Task<IReadOnlyList<PlanBenefitsDto>> GetByPatient(long patNum);
}
