using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IProcedureRepository
{
    Task<IReadOnlyList<ProcedureDto>> GetByPatient(long patNum);
}
