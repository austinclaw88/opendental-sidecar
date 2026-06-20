using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IClaimRepository
{
    Task<IReadOnlyList<ClaimDto>> GetByPatient(long patNum);
    Task<ClaimDetailDto?> GetDetail(long claimNum);
    Task<IReadOnlyList<ClaimQueueItemDto>> GetQueue(string? status, int days);
}
