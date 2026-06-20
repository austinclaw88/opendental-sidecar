using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface ICommlogRepository
{
    Task<IReadOnlyList<CommlogDto>> GetByPatient(long patNum, int limit = 200);
    Task<long> Create(CreateCommlogRequest req);
}
