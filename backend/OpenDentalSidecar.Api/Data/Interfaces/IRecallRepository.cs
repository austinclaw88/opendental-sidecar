using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IRecallRepository
{
    Task<IReadOnlyList<RecallDueDto>> GetDue(DateOnly from, DateOnly to, bool includeScheduled);
    Task<IReadOnlyList<RecallDueDto>> GetByPatient(long patNum);
}
