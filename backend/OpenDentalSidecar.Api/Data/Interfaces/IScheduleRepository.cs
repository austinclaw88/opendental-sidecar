using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IScheduleRepository
{
    Task<ScheduleDayDto> GetDay(DateOnly date, long? clinicNum);
    Task<IReadOnlyList<ScheduleDayDto>> GetRange(DateOnly from, DateOnly to, long? clinicNum);
    Task<IReadOnlyList<ConfirmationItemDto>> GetConfirmationList(DateOnly from, DateOnly to);
}
