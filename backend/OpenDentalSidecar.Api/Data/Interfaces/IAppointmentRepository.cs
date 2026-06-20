using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IAppointmentRepository
{
    Task<IReadOnlyList<AppointmentDto>> GetByPatient(long patNum);
    Task<AppointmentDetailDto?> GetDetail(long aptNum);
    Task<long> Create(CreateAppointmentRequest req);
    Task<bool> Update(long aptNum, UpdateAppointmentRequest req);
    Task<bool> SetStatus(long aptNum, int aptStatus, string? reason = null);
    Task<bool> SetConfirmation(long aptNum, long confirmedDefNum);
    Task<bool> SetFlowTime(long aptNum, string milestone, bool clear);
    Task<bool> SetPriority(long aptNum, int priority);
    Task<IReadOnlyList<ConfirmationItemDto>> GetUnscheduled();
    Task<IReadOnlyList<ConfirmationItemDto>> GetAsap();
}
