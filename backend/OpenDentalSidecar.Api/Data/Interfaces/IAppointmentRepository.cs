using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IAppointmentRepository
{
    Task<IReadOnlyList<AppointmentDto>> GetByPatient(long patNum);
}
