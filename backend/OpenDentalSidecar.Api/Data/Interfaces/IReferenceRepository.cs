using OpenDentalSidecar.Api.Models;

namespace OpenDentalSidecar.Api.Data.Interfaces;

public interface IReferenceRepository
{
    Task<IReadOnlyList<OperatoryDto>> GetOperatories();
    Task<IReadOnlyList<ProviderDto>> GetProviders();
    Task<IReadOnlyList<DefinitionDto>> GetDefinitions(int category);
    Task<IReadOnlyList<AppointmentTypeDto>> GetAppointmentTypes();
    Task<IReadOnlyList<ClinicDto>> GetClinics();
}
