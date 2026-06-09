using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IClaimRepository
{
    Task<IReadOnlyList<ClaimDto>> GetByPatient(long patNum);
    Task<ClaimDetailDto?> GetDetail(long claimNum);
}
